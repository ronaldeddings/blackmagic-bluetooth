/**
 * Object Push Profile (OPP) Service
 * UUID: 0x1105
 * 
 * Handles object push operations with Blackmagic cameras including:
 * - Upload LUTs to camera
 * - Upload presets
 * - Upload configuration files
 * - Handle file transfer progress
 * - Manage transfer queue
 */

import { BleError, BleErrorCode } from 'react-native-ble-plx'
import {
  BLACKMAGIC_SERVICE_UUIDS,
  GATT_CHARACTERISTICS,
  BlackmagicBluetoothUtils,
  type IBlackmagicBluetoothService
} from './types/BlackmagicTypes'

export interface ObjectPushOptions {
  chunkSize?: number // Default 512 bytes
  timeout?: number // Default 30 seconds
  overwrite?: boolean // Default false
  onProgress?: (progress: ObjectPushProgress) => void
  onComplete?: (result: ObjectPushResult) => void
}

export interface ObjectPushProgress {
  fileName: string
  totalBytes: number
  transferredBytes: number
  percentage: number
  speed: number // bytes per second
  estimatedTimeRemaining: number // seconds
}

export interface ObjectPushResult {
  fileName: string
  remotePath: string
  success: boolean
  error?: string
  transferTime: number // seconds
}

export interface ObjectPushItem {
  id: string
  fileName: string
  localData: ArrayBuffer
  remotePath: string
  options: ObjectPushOptions
  priority: number // 1-10, higher numbers = higher priority
  status: 'pending' | 'transferring' | 'completed' | 'failed'
  error?: string
  startTime?: Date
  endTime?: Date
}

export interface LUTInfo {
  name: string
  format: 'cube' | '3dl' | 'csp' | 'lut'
  size: string // e.g., "32x32x32", "33x33x33"
  description?: string
}

export interface PresetInfo {
  name: string
  category: 'exposure' | 'color' | 'lens' | 'recording' | 'general'
  settings: Record<string, any>
  description?: string
}

/**
 * Object Push Service interface
 */
export interface IObjectPushService {
  // File upload operations
  uploadFile(
    deviceId: string, 
    fileName: string, 
    data: ArrayBuffer, 
    remotePath: string, 
    options?: ObjectPushOptions
  ): Promise<ObjectPushResult>
  
  // Specialized uploads
  uploadLUT(deviceId: string, lut: LUTInfo, data: ArrayBuffer, options?: ObjectPushOptions): Promise<ObjectPushResult>
  uploadPreset(deviceId: string, preset: PresetInfo, options?: ObjectPushOptions): Promise<ObjectPushResult>
  uploadConfigFile(deviceId: string, config: any, fileName: string, options?: ObjectPushOptions): Promise<ObjectPushResult>
  
  // Transfer queue management
  addToQueue(item: ObjectPushItem): void
  removeFromQueue(itemId: string): boolean
  clearQueue(): void
  getQueueStatus(): {
    pending: number
    transferring: number
    completed: number
    failed: number
  }
  
  // Queue processing
  processQueue(deviceId: string): Promise<ObjectPushResult[]>
  pauseQueue(): void
  resumeQueue(): void
  
  // Cleanup
  cleanupDevice(deviceId: string): void
}

/**
 * OPP Service Commands
 */
enum OPPCommand {
  START_TRANSFER = 0x01,
  SEND_CHUNK = 0x02,
  END_TRANSFER = 0x03,
  CANCEL_TRANSFER = 0x04,
  GET_STATUS = 0x05,
  SET_PATH = 0x06,
  CHECK_SPACE = 0x07
}

/**
 * OPP Service Response Codes
 */
enum OPPResponseCode {
  SUCCESS = 0x00,
  CONTINUE = 0x01,
  FILE_EXISTS = 0x02,
  INSUFFICIENT_SPACE = 0x03,
  PERMISSION_DENIED = 0x04,
  INVALID_PATH = 0x05,
  TRANSFER_ERROR = 0x06,
  TIMEOUT = 0x07,
  CANCELLED = 0x08,
  UNSUPPORTED_FORMAT = 0x09
}

export class ObjectPushService implements IObjectPushService {
  private bluetoothManager: IBlackmagicBluetoothService
  private transferQueue: ObjectPushItem[] = []
  private activeTransfers: Map<string, ObjectPushItem> = new Map()
  private queueProcessing: boolean = false
  private queuePaused: boolean = false
  
  constructor(bluetoothManager: IBlackmagicBluetoothService) {
    this.bluetoothManager = bluetoothManager
  }

  // ============================================================================
  // FILE UPLOAD OPERATIONS
  // ============================================================================

  async uploadFile(
    deviceId: string,
    fileName: string,
    data: ArrayBuffer,
    remotePath: string,
    options: ObjectPushOptions = {}
  ): Promise<ObjectPushResult> {
    const chunkSize = options.chunkSize || 512
    const timeout = options.timeout || 30000
    const overwrite = options.overwrite || false

    const result: ObjectPushResult = {
      fileName,
      remotePath,
      success: false,
      transferTime: 0
    }

    const startTime = Date.now()

    try {
      // Check if transfer is already in progress
      if (this.activeTransfers.has(`${deviceId}_${fileName}`)) {
        throw new Error('Transfer already in progress for this file')
      }

      // Create transfer item for tracking
      const transferItem: ObjectPushItem = {
        id: `${deviceId}_${fileName}_${Date.now()}`,
        fileName,
        localData: data,
        remotePath,
        options,
        priority: 5, // Default priority
        status: 'transferring'
      }

      this.activeTransfers.set(`${deviceId}_${fileName}`, transferItem)

      // 1. Set remote path
      await this.setRemotePath(deviceId, remotePath)

      // 2. Check available space
      await this.checkSpace(deviceId, data.byteLength)

      // 3. Start transfer
      await this.startTransfer(deviceId, fileName, data.byteLength, overwrite)

      // 4. Send file data in chunks
      const totalBytes = data.byteLength
      let transferredBytes = 0
      let offset = 0

      while (transferredBytes < totalBytes) {
        const remainingBytes = totalBytes - transferredBytes
        const currentChunkSize = Math.min(chunkSize, remainingBytes)
        
        // Extract chunk from data
        const chunk = data.slice(offset, offset + currentChunkSize)
        
        // Send chunk with timeout
        await BlackmagicBluetoothUtils.createTimeout(
          this.sendChunk(deviceId, chunk, offset),
          timeout,
          'Chunk transfer timeout'
        )

        transferredBytes += currentChunkSize
        offset += currentChunkSize

        // Report progress
        if (options.onProgress) {
          const elapsedTime = (Date.now() - startTime) / 1000
          const speed = transferredBytes / elapsedTime
          const estimatedTimeRemaining = (totalBytes - transferredBytes) / speed
          
          const progress: ObjectPushProgress = {
            fileName,
            totalBytes,
            transferredBytes,
            percentage: (transferredBytes / totalBytes) * 100,
            speed,
            estimatedTimeRemaining
          }
          options.onProgress(progress)
        }
      }

      // 5. End transfer
      await this.endTransfer(deviceId)

      // Success
      result.success = true
      result.transferTime = (Date.now() - startTime) / 1000
      
      transferItem.status = 'completed'
      transferItem.endTime = new Date()

      if (options.onComplete) {
        options.onComplete(result)
      }

    } catch (error) {
      result.error = (error as Error).message
      const transferItem = this.activeTransfers.get(`${deviceId}_${fileName}`)
      if (transferItem) {
        transferItem.status = 'failed'
        transferItem.error = result.error
        transferItem.endTime = new Date()
      }

      // Try to cancel transfer on error
      try {
        await this.cancelTransfer(deviceId)
      } catch (cancelError) {
        // Ignore cancel errors
      }

      throw new Error(`Failed to upload file "${fileName}": ${result.error}`)
    } finally {
      this.activeTransfers.delete(`${deviceId}_${fileName}`)
      result.transferTime = (Date.now() - startTime) / 1000
    }

    return result
  }

  // ============================================================================
  // SPECIALIZED UPLOADS
  // ============================================================================

  async uploadLUT(
    deviceId: string,
    lut: LUTInfo,
    data: ArrayBuffer,
    options: ObjectPushOptions = {}
  ): Promise<ObjectPushResult> {
    try {
      // Validate LUT format
      await this.validateLUTFormat(lut, data)
      
      // Determine remote path based on LUT format
      const remotePath = this.getLUTPath(lut.format)
      
      // Add LUT-specific metadata to filename
      const fileName = `${lut.name}_${lut.size}.${lut.format}`
      
      return await this.uploadFile(deviceId, fileName, data, remotePath, options)
      
    } catch (error) {
      throw new Error(`Failed to upload LUT "${lut.name}": ${(error as Error).message}`)
    }
  }

  async uploadPreset(
    deviceId: string,
    preset: PresetInfo,
    options: ObjectPushOptions = {}
  ): Promise<ObjectPushResult> {
    try {
      // Convert preset to JSON
      const presetData = {
        name: preset.name,
        category: preset.category,
        settings: preset.settings,
        description: preset.description,
        createdAt: new Date().toISOString(),
        version: '1.0'
      }
      
      const jsonString = JSON.stringify(presetData, null, 2)
      const data = new TextEncoder().encode(jsonString)
      
      // Determine remote path based on category
      const remotePath = this.getPresetPath(preset.category)
      const fileName = `${preset.name}.preset`
      
      return await this.uploadFile(deviceId, fileName, data.buffer, remotePath, options)
      
    } catch (error) {
      throw new Error(`Failed to upload preset "${preset.name}": ${(error as Error).message}`)
    }
  }

  async uploadConfigFile(
    deviceId: string,
    config: any,
    fileName: string,
    options: ObjectPushOptions = {}
  ): Promise<ObjectPushResult> {
    try {
      // Convert config to JSON
      const configData = {
        ...config,
        uploadedAt: new Date().toISOString(),
        version: '1.0'
      }
      
      const jsonString = JSON.stringify(configData, null, 2)
      const data = new TextEncoder().encode(jsonString)
      
      const remotePath = '/Config'
      const configFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`
      
      return await this.uploadFile(deviceId, configFileName, data.buffer, remotePath, options)
      
    } catch (error) {
      throw new Error(`Failed to upload config file "${fileName}": ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // TRANSFER QUEUE MANAGEMENT
  // ============================================================================

  addToQueue(item: ObjectPushItem): void {
    // Add to queue in priority order
    const insertIndex = this.transferQueue.findIndex(queueItem => 
      queueItem.priority < item.priority
    )
    
    if (insertIndex === -1) {
      this.transferQueue.push(item)
    } else {
      this.transferQueue.splice(insertIndex, 0, item)
    }
  }

  removeFromQueue(itemId: string): boolean {
    const index = this.transferQueue.findIndex(item => item.id === itemId)
    if (index !== -1) {
      this.transferQueue.splice(index, 1)
      return true
    }
    return false
  }

  clearQueue(): void {
    this.transferQueue = []
  }

  getQueueStatus() {
    const status = {
      pending: 0,
      transferring: 0,
      completed: 0,
      failed: 0
    }

    this.transferQueue.forEach(item => {
      status[item.status as keyof typeof status]++
    })

    return status
  }

  async processQueue(deviceId: string): Promise<ObjectPushResult[]> {
    if (this.queueProcessing) {
      throw new Error('Queue is already being processed')
    }

    this.queueProcessing = true
    const results: ObjectPushResult[] = []

    try {
      while (this.transferQueue.length > 0 && !this.queuePaused) {
        // Get next item (highest priority first)
        const item = this.transferQueue.shift()
        if (!item) break

        item.status = 'transferring'
        item.startTime = new Date()

        try {
          const result = await this.uploadFile(
            deviceId,
            item.fileName,
            item.localData,
            item.remotePath,
            item.options
          )
          
          item.status = 'completed'
          results.push(result)
          
        } catch (error) {
          item.status = 'failed'
          item.error = (error as Error).message
          
          const failedResult: ObjectPushResult = {
            fileName: item.fileName,
            remotePath: item.remotePath,
            success: false,
            error: item.error,
            transferTime: 0
          }
          results.push(failedResult)
        }

        item.endTime = new Date()
      }

    } finally {
      this.queueProcessing = false
    }

    return results
  }

  pauseQueue(): void {
    this.queuePaused = true
  }

  resumeQueue(): void {
    this.queuePaused = false
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async sendOPPCommand(deviceId: string, command: Uint8Array): Promise<Uint8Array> {
    try {
      // Convert command to base64
      const commandBase64 = BlackmagicBluetoothUtils.arrayBufferToBase64(command.buffer)
      
      // Send command via Object Push Profile service
      await this.bluetoothManager.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.OBJECT_PUSH_PROFILE,
        GATT_CHARACTERISTICS.HID_REPORT, // Using HID report for commands
        commandBase64
      )

      // Read response
      const responseBase64 = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.OBJECT_PUSH_PROFILE,
        GATT_CHARACTERISTICS.HID_REPORT
      )

      // Convert response from base64
      const responseBuffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(responseBase64)
      return new Uint8Array(responseBuffer)
      
    } catch (error) {
      throw new Error(`OPP command failed: ${(error as Error).message}`)
    }
  }

  private async setRemotePath(deviceId: string, path: string): Promise<void> {
    const pathData = new TextEncoder().encode(path)
    const command = new Uint8Array(2 + pathData.length)
    command[0] = OPPCommand.SET_PATH
    command[1] = pathData.length
    command.set(pathData, 2)

    const response = await this.sendOPPCommand(deviceId, command)
    
    if (response[0] !== OPPResponseCode.SUCCESS) {
      throw new Error(`Failed to set remote path: ${this.getErrorMessage(response[0])}`)
    }
  }

  private async checkSpace(deviceId: string, requiredBytes: number): Promise<void> {
    const command = new Uint8Array(5)
    command[0] = OPPCommand.CHECK_SPACE
    // Write required bytes (little endian)
    command[1] = requiredBytes & 0xFF
    command[2] = (requiredBytes >> 8) & 0xFF
    command[3] = (requiredBytes >> 16) & 0xFF
    command[4] = (requiredBytes >> 24) & 0xFF

    const response = await this.sendOPPCommand(deviceId, command)
    
    if (response[0] !== OPPResponseCode.SUCCESS) {
      throw new Error(`Insufficient space: ${this.getErrorMessage(response[0])}`)
    }
  }

  private async startTransfer(
    deviceId: string, 
    fileName: string, 
    fileSize: number, 
    overwrite: boolean
  ): Promise<void> {
    const nameData = new TextEncoder().encode(fileName)
    const command = new Uint8Array(7 + nameData.length)
    let pos = 0
    
    command[pos++] = OPPCommand.START_TRANSFER
    command[pos++] = nameData.length
    command.set(nameData, pos)
    pos += nameData.length
    
    // Write file size (little endian)
    command[pos++] = fileSize & 0xFF
    command[pos++] = (fileSize >> 8) & 0xFF
    command[pos++] = (fileSize >> 16) & 0xFF
    command[pos++] = (fileSize >> 24) & 0xFF
    
    command[pos++] = overwrite ? 1 : 0

    const response = await this.sendOPPCommand(deviceId, command)
    
    if (response[0] === OPPResponseCode.FILE_EXISTS && !overwrite) {
      throw new Error('File already exists and overwrite is disabled')
    } else if (response[0] !== OPPResponseCode.SUCCESS && response[0] !== OPPResponseCode.CONTINUE) {
      throw new Error(`Failed to start transfer: ${this.getErrorMessage(response[0])}`)
    }
  }

  private async sendChunk(deviceId: string, chunk: ArrayBuffer, offset: number): Promise<void> {
    const chunkData = new Uint8Array(chunk)
    const command = new Uint8Array(7 + chunkData.length)
    let pos = 0
    
    command[pos++] = OPPCommand.SEND_CHUNK
    // Write offset (little endian)
    command[pos++] = offset & 0xFF
    command[pos++] = (offset >> 8) & 0xFF
    command[pos++] = (offset >> 16) & 0xFF
    command[pos++] = (offset >> 24) & 0xFF
    
    // Write chunk size
    command[pos++] = (chunkData.length >> 8) & 0xFF
    command[pos++] = chunkData.length & 0xFF
    
    // Write chunk data
    command.set(chunkData, pos)

    const response = await this.sendOPPCommand(deviceId, command)
    
    if (response[0] !== OPPResponseCode.SUCCESS && response[0] !== OPPResponseCode.CONTINUE) {
      throw new Error(`Chunk transfer failed: ${this.getErrorMessage(response[0])}`)
    }
  }

  private async endTransfer(deviceId: string): Promise<void> {
    const command = new Uint8Array([OPPCommand.END_TRANSFER])
    const response = await this.sendOPPCommand(deviceId, command)
    
    if (response[0] !== OPPResponseCode.SUCCESS) {
      throw new Error(`Failed to complete transfer: ${this.getErrorMessage(response[0])}`)
    }
  }

  private async cancelTransfer(deviceId: string): Promise<void> {
    const command = new Uint8Array([OPPCommand.CANCEL_TRANSFER])
    await this.sendOPPCommand(deviceId, command)
  }

  private async validateLUTFormat(lut: LUTInfo, data: ArrayBuffer): Promise<void> {
    // Basic format validation
    const text = new TextDecoder().decode(data.slice(0, 100))
    
    switch (lut.format) {
      case 'cube':
        if (!text.includes('LUT_3D_SIZE') && !text.includes('DOMAIN_')) {
          throw new Error('Invalid .cube LUT format')
        }
        break
      case '3dl':
        if (!text.includes('3DMESH') && !text.includes('Mesh')) {
          throw new Error('Invalid .3dl LUT format')
        }
        break
      default:
        // Allow other formats to pass through
        break
    }
  }

  private getLUTPath(format: string): string {
    switch (format) {
      case 'cube':
        return '/LUT/Cube'
      case '3dl':
        return '/LUT/3DL'
      case 'csp':
        return '/LUT/CSP'
      default:
        return '/LUT'
    }
  }

  private getPresetPath(category: string): string {
    switch (category) {
      case 'exposure':
        return '/Presets/Exposure'
      case 'color':
        return '/Presets/Color'
      case 'lens':
        return '/Presets/Lens'
      case 'recording':
        return '/Presets/Recording'
      default:
        return '/Presets/General'
    }
  }

  private getErrorMessage(code: OPPResponseCode): string {
    switch (code) {
      case OPPResponseCode.FILE_EXISTS:
        return 'File already exists'
      case OPPResponseCode.INSUFFICIENT_SPACE:
        return 'Insufficient storage space'
      case OPPResponseCode.PERMISSION_DENIED:
        return 'Permission denied'
      case OPPResponseCode.INVALID_PATH:
        return 'Invalid path'
      case OPPResponseCode.TRANSFER_ERROR:
        return 'Transfer error'
      case OPPResponseCode.TIMEOUT:
        return 'Operation timeout'
      case OPPResponseCode.CANCELLED:
        return 'Transfer cancelled'
      case OPPResponseCode.UNSUPPORTED_FORMAT:
        return 'Unsupported file format'
      default:
        return 'Unknown error'
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanupDevice(deviceId: string): void {
    // Cancel any active transfers for this device
    const transferKeys = Array.from(this.activeTransfers.keys()).filter(key => 
      key.startsWith(`${deviceId}_`)
    )
    transferKeys.forEach(key => this.activeTransfers.delete(key))
    
    // Remove any queue items for this device
    this.transferQueue = this.transferQueue.filter(item => 
      !item.id.startsWith(`${deviceId}_`)
    )
  }

  cleanup(): void {
    this.transferQueue = []
    this.activeTransfers.clear()
    this.queueProcessing = false
    this.queuePaused = false
  }
}