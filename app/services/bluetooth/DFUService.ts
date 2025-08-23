/**
 * DFU (Device Firmware Update) Service
 * 
 * Handles firmware update operations via Nordic DFU Service (UUID 0xFE59)
 * Based on verified findings from firmware analysis
 */

import { BlackmagicBluetoothManager } from './BlackmagicBluetoothManager'
import { 
  BLACKMAGIC_SERVICE_UUIDS, 
  BlackmagicBluetoothUtils,
  BlackmagicBluetoothError 
} from './types/BlackmagicTypes'

// Nordic DFU Service UUIDs (from firmware analysis)
export const DFU_SERVICE_UUID = '0000fe59-0000-1000-8000-00805f9b34fb'

// Nordic DFU Characteristics 
export const DFU_CHARACTERISTICS = {
  DFU_CONTROL_POINT: '00001531-1212-efde-1523-785feabcd123',
  DFU_PACKET: '00001532-1212-efde-1523-785feabcd123',
  DFU_VERSION: '00001534-1212-efde-1523-785feabcd123'
} as const

// DFU Operation Codes
export const DFU_OPCODES = {
  START_DFU: 0x01,
  INITIALIZE_DFU: 0x02,
  RECEIVE_FIRMWARE_IMAGE: 0x03,
  VALIDATE_FIRMWARE: 0x04,
  ACTIVATE_AND_RESET: 0x05,
  SYSTEM_RESET: 0x06,
  REPORT_RECEIVED_IMAGE_SIZE: 0x07,
  PACKET_RECEIPT_NOTIFICATION_REQUEST: 0x08,
  RESPONSE_CODE: 0x10,
  PACKET_RECEIPT_NOTIFICATION: 0x11
} as const

// DFU Response Codes
export const DFU_RESPONSE_CODES = {
  SUCCESS: 0x01,
  INVALID_STATE: 0x02,
  NOT_SUPPORTED: 0x03,
  DATA_SIZE_EXCEEDS_LIMIT: 0x04,
  CRC_ERROR: 0x05,
  OPERATION_FAILED: 0x06
} as const

export interface FirmwareInfo {
  currentVersion: string
  hardwareRevision: string
  manufacturerName: string
  modelNumber: string
  bootloaderVersion?: string
  applicationVersion?: string
}

export interface FirmwareUpdateOptions {
  verifyAfterUpdate?: boolean
  timeout?: number
  packetReceiptNotificationValue?: number
  onProgress?: (progress: FirmwareUpdateProgress) => void
  onError?: (error: DFUError) => void
}

export interface FirmwareUpdateProgress {
  stage: 'connecting' | 'initializing' | 'uploading' | 'validating' | 'activating' | 'completed'
  bytesTransferred: number
  totalBytes: number
  percentage: number
  estimatedTimeRemaining?: number
}

export interface DFUError {
  code: number
  message: string
  stage: string
}

export interface FirmwareFile {
  data: ArrayBuffer
  size: number
  crc32?: number
  type: 'application' | 'bootloader' | 'softdevice' | 'full'
}

export class DFUService {
  private bluetoothManager: BlackmagicBluetoothManager
  private progressCallbacks: Map<string, (progress: FirmwareUpdateProgress) => void> = new Map()
  private errorCallbacks: Map<string, (error: DFUError) => void> = new Map()
  private updateStates: Map<string, {
    isUpdating: boolean
    stage: string
    bytesTransferred: number
    totalBytes: number
    startTime: Date
  }> = new Map()

  constructor(bluetoothManager: BlackmagicBluetoothManager) {
    this.bluetoothManager = bluetoothManager
  }

  // ============================================================================
  // FIRMWARE VERSION DETECTION
  // ============================================================================

  /**
   * Detect current firmware version and device information
   */
  async detectFirmwareVersion(deviceId: string): Promise<FirmwareInfo> {
    try {
      // Get device information from Device Information Service
      const deviceInfo = await this.bluetoothManager.readCompleteDeviceInfo(deviceId)
      
      let bootloaderVersion: string | undefined
      let applicationVersion: string | undefined

      // Try to read DFU version if service is available
      if (await this.isDFUServiceAvailable(deviceId)) {
        try {
          const dfuVersionData = await this.bluetoothManager.readCharacteristic(
            deviceId,
            DFU_SERVICE_UUID,
            DFU_CHARACTERISTICS.DFU_VERSION
          )
          
          const versionBytes = BlackmagicBluetoothUtils.base64ToArrayBuffer(dfuVersionData)
          const versionView = new DataView(versionBytes)
          
          // DFU Version format: [major, minor, revision]
          const major = versionView.getUint8(0)
          const minor = versionView.getUint8(1)
          const revision = versionView.getUint8(2)
          
          bootloaderVersion = `${major}.${minor}.${revision}`
        } catch (error) {
          console.warn('Could not read DFU version:', error)
        }
      }

      // Parse application version from firmware revision
      if (deviceInfo.deviceInformation?.firmwareRevision) {
        applicationVersion = deviceInfo.deviceInformation.firmwareRevision
      }

      return {
        currentVersion: applicationVersion || deviceInfo.deviceInformation?.firmwareRevision || 'Unknown',
        hardwareRevision: deviceInfo.deviceInformation?.hardwareRevision || 'Unknown',
        manufacturerName: deviceInfo.deviceInformation?.manufacturerName || 'Unknown',
        modelNumber: deviceInfo.deviceInformation?.modelNumber || 'Unknown',
        bootloaderVersion,
        applicationVersion
      }
    } catch (error) {
      throw new Error(`Failed to detect firmware version: ${(error as Error).message}`)
    }
  }

  /**
   * Check if DFU service is available on the device
   */
  async isDFUServiceAvailable(deviceId: string): Promise<boolean> {
    try {
      const services = await this.bluetoothManager.discoverServices(deviceId)
      return services.includes(DFU_SERVICE_UUID)
    } catch (error) {
      return false
    }
  }

  // ============================================================================
  // FIRMWARE UPDATE AVAILABILITY
  // ============================================================================

  /**
   * Check for available firmware updates
   * Note: This is a placeholder - in a real implementation you would check against a server
   */
  async checkForUpdates(deviceId: string): Promise<{
    hasUpdate: boolean
    availableVersion?: string
    updateSize?: number
    releaseNotes?: string
    isMandatory?: boolean
  }> {
    const firmwareInfo = await this.detectFirmwareVersion(deviceId)
    
    // This is a mock implementation - replace with actual update server logic
    return {
      hasUpdate: false,
      availableVersion: undefined,
      updateSize: undefined,
      releaseNotes: 'No updates available at this time.',
      isMandatory: false
    }
  }

  // ============================================================================
  // FIRMWARE FILE OPERATIONS
  // ============================================================================

  /**
   * Download firmware file
   * Note: This is a placeholder - in a real implementation you would download from a server
   */
  async downloadFirmwareFile(
    deviceId: string, 
    version: string,
    onProgress?: (progress: { downloaded: number; total: number }) => void
  ): Promise<FirmwareFile> {
    // This is a mock implementation - replace with actual firmware download logic
    throw new Error('Firmware download not implemented - no firmware server configured')
  }

  /**
   * Validate firmware file before update
   */
  async validateFirmwareFile(file: FirmwareFile, deviceId: string): Promise<boolean> {
    try {
      // Basic validation checks
      if (!file.data || file.data.byteLength === 0) {
        throw new Error('Firmware file is empty')
      }

      if (file.size !== file.data.byteLength) {
        throw new Error('Firmware file size mismatch')
      }

      // Check if device supports DFU
      if (!(await this.isDFUServiceAvailable(deviceId))) {
        throw new Error('Device does not support DFU updates')
      }

      // Validate CRC32 if provided
      if (file.crc32) {
        const calculatedCrc = await this.calculateCRC32(file.data)
        if (calculatedCrc !== file.crc32) {
          throw new Error('Firmware file CRC32 validation failed')
        }
      }

      return true
    } catch (error) {
      console.error('Firmware validation failed:', error)
      return false
    }
  }

  // ============================================================================
  // DFU UPDATE PROCESS
  // ============================================================================

  /**
   * Perform Device Firmware Update
   */
  async performDFUUpdate(
    deviceId: string, 
    firmwareFile: FirmwareFile, 
    options: FirmwareUpdateOptions = {}
  ): Promise<void> {
    if (!await this.isDFUServiceAvailable(deviceId)) {
      throw new Error('DFU service not available on device')
    }

    if (!(await this.validateFirmwareFile(firmwareFile, deviceId))) {
      throw new Error('Firmware file validation failed')
    }

    // Set up update state
    this.updateStates.set(deviceId, {
      isUpdating: true,
      stage: 'connecting',
      bytesTransferred: 0,
      totalBytes: firmwareFile.size,
      startTime: new Date()
    })

    if (options.onProgress) {
      this.progressCallbacks.set(deviceId, options.onProgress)
    }

    if (options.onError) {
      this.errorCallbacks.set(deviceId, options.onError)
    }

    try {
      await this.performDFUSteps(deviceId, firmwareFile, options)
    } catch (error) {
      const dfuError: DFUError = {
        code: -1,
        message: (error as Error).message,
        stage: this.updateStates.get(deviceId)?.stage || 'unknown'
      }
      
      this.errorCallbacks.get(deviceId)?.(dfuError)
      throw error
    } finally {
      this.cleanupUpdate(deviceId)
    }
  }

  private async performDFUSteps(
    deviceId: string, 
    firmwareFile: FirmwareFile, 
    options: FirmwareUpdateOptions
  ): Promise<void> {
    // Step 1: Initialize DFU
    await this.updateStage(deviceId, 'initializing', 0)
    await this.initializeDFU(deviceId, firmwareFile.size)

    // Step 2: Upload firmware
    await this.updateStage(deviceId, 'uploading', 0)
    await this.uploadFirmware(deviceId, firmwareFile, options)

    // Step 3: Validate firmware (if requested)
    if (options.verifyAfterUpdate !== false) {
      await this.updateStage(deviceId, 'validating', firmwareFile.size)
      await this.validateFirmware(deviceId)
    }

    // Step 4: Activate and reset
    await this.updateStage(deviceId, 'activating', firmwareFile.size)
    await this.activateAndReset(deviceId)

    await this.updateStage(deviceId, 'completed', firmwareFile.size)
  }

  private async initializeDFU(deviceId: string, imageSize: number): Promise<void> {
    // Send START_DFU command
    const startCommand = new Uint8Array([DFU_OPCODES.START_DFU, 0x04]) // Application update
    await this.sendDFUControlCommand(deviceId, startCommand)
    
    // Wait for response
    await this.waitForDFUResponse(deviceId, DFU_OPCODES.START_DFU)

    // Send INITIALIZE_DFU command
    const initCommand = new Uint8Array([DFU_OPCODES.INITIALIZE_DFU])
    await this.sendDFUControlCommand(deviceId, initCommand)
    
    await this.waitForDFUResponse(deviceId, DFU_OPCODES.INITIALIZE_DFU)

    // Send image size
    const sizeBuffer = new ArrayBuffer(4)
    const sizeView = new DataView(sizeBuffer)
    sizeView.setUint32(0, imageSize, true) // little endian
    
    await this.bluetoothManager.writeCharacteristic(
      deviceId,
      DFU_SERVICE_UUID,
      DFU_CHARACTERISTICS.DFU_PACKET,
      BlackmagicBluetoothUtils.arrayBufferToBase64(sizeBuffer)
    )
  }

  private async uploadFirmware(
    deviceId: string, 
    firmwareFile: FirmwareFile,
    options: FirmwareUpdateOptions
  ): Promise<void> {
    const chunkSize = 20 // BLE packet size limit
    const data = new Uint8Array(firmwareFile.data)
    let bytesTransferred = 0

    // Set packet receipt notification
    if (options.packetReceiptNotificationValue) {
      const prnCommand = new Uint8Array([
        DFU_OPCODES.PACKET_RECEIPT_NOTIFICATION_REQUEST,
        options.packetReceiptNotificationValue & 0xFF,
        (options.packetReceiptNotificationValue >> 8) & 0xFF
      ])
      await this.sendDFUControlCommand(deviceId, prnCommand)
    }

    // Send RECEIVE_FIRMWARE_IMAGE command
    const receiveCommand = new Uint8Array([DFU_OPCODES.RECEIVE_FIRMWARE_IMAGE])
    await this.sendDFUControlCommand(deviceId, receiveCommand)

    // Upload firmware in chunks
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, Math.min(i + chunkSize, data.length))
      
      await this.bluetoothManager.writeCharacteristic(
        deviceId,
        DFU_SERVICE_UUID,
        DFU_CHARACTERISTICS.DFU_PACKET,
        BlackmagicBluetoothUtils.arrayBufferToBase64(chunk.buffer)
      )

      bytesTransferred += chunk.length
      await this.updateProgress(deviceId, bytesTransferred)

      // Small delay to prevent overwhelming the device
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  private async validateFirmware(deviceId: string): Promise<void> {
    const validateCommand = new Uint8Array([DFU_OPCODES.VALIDATE_FIRMWARE])
    await this.sendDFUControlCommand(deviceId, validateCommand)
    await this.waitForDFUResponse(deviceId, DFU_OPCODES.VALIDATE_FIRMWARE)
  }

  private async activateAndReset(deviceId: string): Promise<void> {
    const activateCommand = new Uint8Array([DFU_OPCODES.ACTIVATE_AND_RESET])
    await this.sendDFUControlCommand(deviceId, activateCommand)
    
    // Note: Device will reset after this command, so we don't wait for a response
    await new Promise(resolve => setTimeout(resolve, 5000)) // Wait for reset
  }

  // ============================================================================
  // DFU COMMUNICATION HELPERS
  // ============================================================================

  private async sendDFUControlCommand(deviceId: string, command: Uint8Array): Promise<void> {
    await this.bluetoothManager.writeCharacteristic(
      deviceId,
      DFU_SERVICE_UUID,
      DFU_CHARACTERISTICS.DFU_CONTROL_POINT,
      BlackmagicBluetoothUtils.arrayBufferToBase64(command.buffer)
    )
  }

  private async waitForDFUResponse(deviceId: string, expectedOpcode: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for DFU response to opcode ${expectedOpcode}`))
      }, 10000)

      this.bluetoothManager.subscribeToCharacteristic(
        deviceId,
        DFU_SERVICE_UUID,
        DFU_CHARACTERISTICS.DFU_CONTROL_POINT,
        (error, data) => {
          if (error) {
            clearTimeout(timeout)
            reject(error)
            return
          }

          if (data) {
            const response = new Uint8Array(BlackmagicBluetoothUtils.base64ToArrayBuffer(data))
            
            if (response[0] === DFU_OPCODES.RESPONSE_CODE && response[1] === expectedOpcode) {
              clearTimeout(timeout)
              
              if (response[2] === DFU_RESPONSE_CODES.SUCCESS) {
                resolve()
              } else {
                reject(new Error(`DFU operation failed with code: ${response[2]}`))
              }
            }
          }
        }
      )
    })
  }

  // ============================================================================
  // PROGRESS TRACKING
  // ============================================================================

  private async updateStage(deviceId: string, stage: string, bytesTransferred: number): Promise<void> {
    const state = this.updateStates.get(deviceId)
    if (!state) return

    state.stage = stage
    state.bytesTransferred = bytesTransferred

    await this.updateProgress(deviceId, bytesTransferred)
  }

  private async updateProgress(deviceId: string, bytesTransferred: number): Promise<void> {
    const state = this.updateStates.get(deviceId)
    if (!state) return

    state.bytesTransferred = bytesTransferred
    const percentage = (bytesTransferred / state.totalBytes) * 100

    // Calculate estimated time remaining
    const elapsed = Date.now() - state.startTime.getTime()
    const rate = bytesTransferred / (elapsed / 1000) // bytes per second
    const remaining = state.totalBytes - bytesTransferred
    const estimatedTimeRemaining = remaining > 0 ? remaining / rate : 0

    const progress: FirmwareUpdateProgress = {
      stage: state.stage as any,
      bytesTransferred,
      totalBytes: state.totalBytes,
      percentage,
      estimatedTimeRemaining
    }

    this.progressCallbacks.get(deviceId)?.(progress)
  }

  // ============================================================================
  // UPDATE STATE MANAGEMENT
  // ============================================================================

  isUpdating(deviceId: string): boolean {
    return this.updateStates.get(deviceId)?.isUpdating || false
  }

  getUpdateProgress(deviceId: string): FirmwareUpdateProgress | null {
    const state = this.updateStates.get(deviceId)
    if (!state) return null

    return {
      stage: state.stage as any,
      bytesTransferred: state.bytesTransferred,
      totalBytes: state.totalBytes,
      percentage: (state.bytesTransferred / state.totalBytes) * 100
    }
  }

  async cancelUpdate(deviceId: string): Promise<void> {
    const state = this.updateStates.get(deviceId)
    if (!state || !state.isUpdating) {
      return
    }

    try {
      // Send system reset to abort update
      const resetCommand = new Uint8Array([DFU_OPCODES.SYSTEM_RESET])
      await this.sendDFUControlCommand(deviceId, resetCommand)
    } catch (error) {
      console.warn('Error sending reset command during cancel:', error)
    } finally {
      this.cleanupUpdate(deviceId)
    }
  }

  private cleanupUpdate(deviceId: string): void {
    this.updateStates.delete(deviceId)
    this.progressCallbacks.delete(deviceId)
    this.errorCallbacks.delete(deviceId)
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async calculateCRC32(data: ArrayBuffer): Promise<number> {
    // Simple CRC32 implementation - replace with a proper library in production
    const polynomial = 0xEDB88320
    let crc = 0xFFFFFFFF
    const bytes = new Uint8Array(data)

    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i]
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? polynomial : 0)
      }
    }

    return (crc ^ 0xFFFFFFFF) >>> 0
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanup(): void {
    this.updateStates.clear()
    this.progressCallbacks.clear()
    this.errorCallbacks.clear()
  }

  cleanupDevice(deviceId: string): void {
    this.cleanupUpdate(deviceId)
  }
}