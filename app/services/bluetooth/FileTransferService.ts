/**
 * File Transfer Profile (FTP) Service
 * UUID: 0x1106
 * 
 * Handles file transfer operations with Blackmagic cameras including:
 * - Browse camera file system
 * - List recorded files
 * - Download files
 * - Delete files
 * - Get file metadata
 */

import { BleError, BleErrorCode } from 'react-native-ble-plx'
import {
  BLACKMAGIC_SERVICE_UUIDS,
  GATT_CHARACTERISTICS,
  BlackmagicBluetoothUtils,
  type IBlackmagicBluetoothService
} from './types/BlackmagicTypes'

export interface FileInfo {
  name: string
  path: string
  size: number
  dateCreated: Date
  dateModified: Date
  format: string
  isDirectory: boolean
  thumbnailData?: string // Base64 encoded thumbnail
}

export interface DirectoryListing {
  currentPath: string
  parentPath?: string
  entries: FileInfo[]
}

export interface FileTransferProgress {
  fileName: string
  totalBytes: number
  transferredBytes: number
  percentage: number
  speed: number // bytes per second
}

export interface FileTransferOptions {
  chunkSize?: number // Default 512 bytes
  timeout?: number // Default 30 seconds
  onProgress?: (progress: FileTransferProgress) => void
}

/**
 * File Transfer Service interface
 */
export interface IFileTransferService {
  // Directory operations
  listDirectory(deviceId: string, path?: string): Promise<DirectoryListing>
  changeDirectory(deviceId: string, path: string): Promise<DirectoryListing>
  
  // File operations
  getFileInfo(deviceId: string, filePath: string): Promise<FileInfo>
  downloadFile(deviceId: string, remotePath: string, options?: FileTransferOptions): Promise<ArrayBuffer>
  deleteFile(deviceId: string, filePath: string): Promise<void>
  deleteDirectory(deviceId: string, directoryPath: string): Promise<void>
  
  // File system info
  getStorageInfo(deviceId: string): Promise<{
    totalSpace: number
    freeSpace: number
    usedSpace: number
  }>
  
  // File filtering
  listRecordedFiles(deviceId: string): Promise<FileInfo[]>
  listFilesByType(deviceId: string, extension: string): Promise<FileInfo[]>
  
  // Cleanup
  cleanupDevice(deviceId: string): void
}

/**
 * FTP Service Commands
 */
enum FTPCommand {
  LIST_DIRECTORY = 0x01,
  CHANGE_DIRECTORY = 0x02,
  GET_FILE_INFO = 0x03,
  READ_FILE_CHUNK = 0x04,
  DELETE_FILE = 0x05,
  DELETE_DIRECTORY = 0x06,
  GET_STORAGE_INFO = 0x07,
  CREATE_DIRECTORY = 0x08
}

/**
 * FTP Service Response Codes
 */
enum FTPResponseCode {
  SUCCESS = 0x00,
  FILE_NOT_FOUND = 0x01,
  PERMISSION_DENIED = 0x02,
  DISK_FULL = 0x03,
  INVALID_PATH = 0x04,
  OPERATION_NOT_SUPPORTED = 0x05,
  TRANSFER_ERROR = 0x06,
  TIMEOUT = 0x07
}

export class FileTransferService implements IFileTransferService {
  private bluetoothManager: IBlackmagicBluetoothService
  private activeTransfers: Map<string, boolean> = new Map()
  private currentPaths: Map<string, string> = new Map()
  
  constructor(bluetoothManager: IBlackmagicBluetoothService) {
    this.bluetoothManager = bluetoothManager
  }

  // ============================================================================
  // DIRECTORY OPERATIONS
  // ============================================================================

  async listDirectory(deviceId: string, path: string = '/'): Promise<DirectoryListing> {
    try {
      // Build command packet
      const command = this.buildCommand(FTPCommand.LIST_DIRECTORY, this.encodePath(path))
      
      // Send command and get response
      const response = await this.sendFTPCommand(deviceId, command)
      
      if (response[0] !== FTPResponseCode.SUCCESS) {
        throw new Error(`Failed to list directory: ${this.getErrorMessage(response[0])}`)
      }

      // Parse directory listing from response
      return this.parseDirectoryListing(response.slice(1))
      
    } catch (error) {
      throw new Error(`Failed to list directory "${path}": ${(error as Error).message}`)
    }
  }

  async changeDirectory(deviceId: string, path: string): Promise<DirectoryListing> {
    try {
      // Build command packet  
      const command = this.buildCommand(FTPCommand.CHANGE_DIRECTORY, this.encodePath(path))
      
      // Send command
      const response = await this.sendFTPCommand(deviceId, command)
      
      if (response[0] !== FTPResponseCode.SUCCESS) {
        throw new Error(`Failed to change directory: ${this.getErrorMessage(response[0])}`)
      }

      // Update current path for this device
      this.currentPaths.set(deviceId, path)
      
      // Return new directory listing
      return this.listDirectory(deviceId, path)
      
    } catch (error) {
      throw new Error(`Failed to change to directory "${path}": ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  async getFileInfo(deviceId: string, filePath: string): Promise<FileInfo> {
    try {
      // Build command packet
      const command = this.buildCommand(FTPCommand.GET_FILE_INFO, this.encodePath(filePath))
      
      // Send command
      const response = await this.sendFTPCommand(deviceId, command)
      
      if (response[0] !== FTPResponseCode.SUCCESS) {
        throw new Error(`Failed to get file info: ${this.getErrorMessage(response[0])}`)
      }

      // Parse file info from response
      return this.parseFileInfo(response.slice(1))
      
    } catch (error) {
      throw new Error(`Failed to get info for file "${filePath}": ${(error as Error).message}`)
    }
  }

  async downloadFile(
    deviceId: string, 
    remotePath: string, 
    options: FileTransferOptions = {}
  ): Promise<ArrayBuffer> {
    const chunkSize = options.chunkSize || 512
    const timeout = options.timeout || 30000
    
    try {
      // Check if transfer is already in progress
      if (this.activeTransfers.get(`${deviceId}_${remotePath}`)) {
        throw new Error('Transfer already in progress for this file')
      }

      this.activeTransfers.set(`${deviceId}_${remotePath}`, true)

      // Get file info first
      const fileInfo = await this.getFileInfo(deviceId, remotePath)
      if (fileInfo.isDirectory) {
        throw new Error('Cannot download directory, use listDirectory instead')
      }

      const totalBytes = fileInfo.size
      const chunks: Uint8Array[] = []
      let transferredBytes = 0
      let offset = 0
      const startTime = Date.now()

      // Download file in chunks
      while (transferredBytes < totalBytes) {
        const remainingBytes = totalBytes - transferredBytes
        const currentChunkSize = Math.min(chunkSize, remainingBytes)
        
        // Build read chunk command
        const command = this.buildReadChunkCommand(remotePath, offset, currentChunkSize)
        
        // Send command with timeout
        const response = await BlackmagicBluetoothUtils.createTimeout(
          this.sendFTPCommand(deviceId, command),
          timeout,
          'File transfer timeout'
        )

        if (response[0] !== FTPResponseCode.SUCCESS) {
          throw new Error(`Transfer failed: ${this.getErrorMessage(response[0])}`)
        }

        // Extract chunk data (skip response code and length bytes)
        const chunkLength = (response[1] << 8) | response[2]
        const chunkData = new Uint8Array(response.slice(3, 3 + chunkLength))
        chunks.push(chunkData)

        transferredBytes += chunkLength
        offset += chunkLength

        // Calculate progress
        if (options.onProgress) {
          const elapsedTime = (Date.now() - startTime) / 1000
          const speed = transferredBytes / elapsedTime
          const progress: FileTransferProgress = {
            fileName: fileInfo.name,
            totalBytes,
            transferredBytes,
            percentage: (transferredBytes / totalBytes) * 100,
            speed
          }
          options.onProgress(progress)
        }
      }

      // Combine chunks into single ArrayBuffer
      const result = new Uint8Array(totalBytes)
      let resultOffset = 0
      for (const chunk of chunks) {
        result.set(chunk, resultOffset)
        resultOffset += chunk.length
      }

      return result.buffer

    } catch (error) {
      throw new Error(`Failed to download file "${remotePath}": ${(error as Error).message}`)
    } finally {
      this.activeTransfers.delete(`${deviceId}_${remotePath}`)
    }
  }

  async deleteFile(deviceId: string, filePath: string): Promise<void> {
    try {
      // Build command packet
      const command = this.buildCommand(FTPCommand.DELETE_FILE, this.encodePath(filePath))
      
      // Send command
      const response = await this.sendFTPCommand(deviceId, command)
      
      if (response[0] !== FTPResponseCode.SUCCESS) {
        throw new Error(`Failed to delete file: ${this.getErrorMessage(response[0])}`)
      }
      
    } catch (error) {
      throw new Error(`Failed to delete file "${filePath}": ${(error as Error).message}`)
    }
  }

  async deleteDirectory(deviceId: string, directoryPath: string): Promise<void> {
    try {
      // Build command packet
      const command = this.buildCommand(FTPCommand.DELETE_DIRECTORY, this.encodePath(directoryPath))
      
      // Send command
      const response = await this.sendFTPCommand(deviceId, command)
      
      if (response[0] !== FTPResponseCode.SUCCESS) {
        throw new Error(`Failed to delete directory: ${this.getErrorMessage(response[0])}`)
      }
      
    } catch (error) {
      throw new Error(`Failed to delete directory "${directoryPath}": ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // FILE SYSTEM INFO
  // ============================================================================

  async getStorageInfo(deviceId: string): Promise<{
    totalSpace: number
    freeSpace: number
    usedSpace: number
  }> {
    try {
      // Build command packet
      const command = this.buildCommand(FTPCommand.GET_STORAGE_INFO, new Uint8Array())
      
      // Send command
      const response = await this.sendFTPCommand(deviceId, command)
      
      if (response[0] !== FTPResponseCode.SUCCESS) {
        throw new Error(`Failed to get storage info: ${this.getErrorMessage(response[0])}`)
      }

      // Parse storage info (8 bytes each for total, free space)
      const view = new DataView(response.buffer, 1) // Skip response code
      const totalSpace = view.getBigUint64(0, true) // Little endian
      const freeSpace = view.getBigUint64(8, true)
      
      return {
        totalSpace: Number(totalSpace),
        freeSpace: Number(freeSpace),
        usedSpace: Number(totalSpace - freeSpace)
      }
      
    } catch (error) {
      throw new Error(`Failed to get storage info: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // FILE FILTERING
  // ============================================================================

  async listRecordedFiles(deviceId: string): Promise<FileInfo[]> {
    try {
      // Common video file extensions for Blackmagic cameras
      const videoExtensions = ['.mov', '.mp4', '.braw', '.dng']
      const recordedFiles: FileInfo[] = []

      // Check common recording directories
      const recordingPaths = ['/DCIM', '/Videos', '/Media', '/']
      
      for (const path of recordingPaths) {
        try {
          const listing = await this.listDirectory(deviceId, path)
          
          // Filter for video files
          const videoFiles = listing.entries.filter(entry => 
            !entry.isDirectory && 
            videoExtensions.some(ext => 
              entry.name.toLowerCase().endsWith(ext.toLowerCase())
            )
          )
          
          recordedFiles.push(...videoFiles)
        } catch (error) {
          // Path might not exist, continue with other paths
          continue
        }
      }

      // Sort by modification date (newest first)
      recordedFiles.sort((a, b) => b.dateModified.getTime() - a.dateModified.getTime())
      
      return recordedFiles
      
    } catch (error) {
      throw new Error(`Failed to list recorded files: ${(error as Error).message}`)
    }
  }

  async listFilesByType(deviceId: string, extension: string): Promise<FileInfo[]> {
    try {
      const currentPath = this.currentPaths.get(deviceId) || '/'
      const listing = await this.listDirectory(deviceId, currentPath)
      
      // Filter files by extension
      const filteredFiles = listing.entries.filter(entry => 
        !entry.isDirectory && 
        entry.name.toLowerCase().endsWith(extension.toLowerCase())
      )
      
      return filteredFiles
      
    } catch (error) {
      throw new Error(`Failed to list files with extension "${extension}": ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async sendFTPCommand(deviceId: string, command: Uint8Array): Promise<Uint8Array> {
    try {
      // Convert command to base64
      const commandBase64 = BlackmagicBluetoothUtils.arrayBufferToBase64(command.buffer)
      
      // Send command via File Transfer Profile service
      await this.bluetoothManager.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.FILE_TRANSFER_PROFILE,
        GATT_CHARACTERISTICS.HID_REPORT, // Using HID report for commands
        commandBase64
      )

      // Read response
      const responseBase64 = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.FILE_TRANSFER_PROFILE,
        GATT_CHARACTERISTICS.HID_REPORT
      )

      // Convert response from base64
      const responseBuffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(responseBase64)
      return new Uint8Array(responseBuffer)
      
    } catch (error) {
      throw new Error(`FTP command failed: ${(error as Error).message}`)
    }
  }

  private buildCommand(command: FTPCommand, data: Uint8Array): Uint8Array {
    // Command format: [Command Code][Data Length][Data...]
    const result = new Uint8Array(2 + data.length)
    result[0] = command
    result[1] = data.length
    result.set(data, 2)
    return result
  }

  private buildReadChunkCommand(filePath: string, offset: number, length: number): Uint8Array {
    const pathData = this.encodePath(filePath)
    // Command format: [CMD][Path Length][Path][Offset (4 bytes)][Length (2 bytes)]
    const result = new Uint8Array(1 + 1 + pathData.length + 4 + 2)
    let pos = 0
    
    result[pos++] = FTPCommand.READ_FILE_CHUNK
    result[pos++] = pathData.length
    result.set(pathData, pos)
    pos += pathData.length
    
    // Write offset (little endian)
    result[pos++] = offset & 0xFF
    result[pos++] = (offset >> 8) & 0xFF
    result[pos++] = (offset >> 16) & 0xFF
    result[pos++] = (offset >> 24) & 0xFF
    
    // Write length (little endian)
    result[pos++] = length & 0xFF
    result[pos++] = (length >> 8) & 0xFF
    
    return result
  }

  private encodePath(path: string): Uint8Array {
    // Convert string path to UTF-8 bytes
    return new TextEncoder().encode(path)
  }

  private parseDirectoryListing(data: Uint8Array): DirectoryListing {
    let offset = 0
    
    // Read current path length and path
    const currentPathLength = data[offset++]
    const currentPath = new TextDecoder().decode(data.slice(offset, offset + currentPathLength))
    offset += currentPathLength
    
    // Read parent path (if exists)
    let parentPath: string | undefined
    if (data[offset] > 0) {
      const parentPathLength = data[offset++]
      parentPath = new TextDecoder().decode(data.slice(offset, offset + parentPathLength))
      offset += parentPathLength
    } else {
      offset++ // Skip zero length byte
    }
    
    // Read number of entries
    const entryCount = (data[offset] << 8) | data[offset + 1]
    offset += 2
    
    const entries: FileInfo[] = []
    
    // Parse each entry
    for (let i = 0; i < entryCount; i++) {
      const entry = this.parseFileEntry(data, offset)
      entries.push(entry.fileInfo)
      offset = entry.nextOffset
    }
    
    return {
      currentPath,
      parentPath,
      entries
    }
  }

  private parseFileEntry(data: Uint8Array, offset: number): {
    fileInfo: FileInfo
    nextOffset: number
  } {
    let pos = offset
    
    // Read entry type (file/directory)
    const isDirectory = data[pos++] === 1
    
    // Read name length and name
    const nameLength = data[pos++]
    const name = new TextDecoder().decode(data.slice(pos, pos + nameLength))
    pos += nameLength
    
    // Read path length and path
    const pathLength = data[pos++]
    const path = new TextDecoder().decode(data.slice(pos, pos + pathLength))
    pos += pathLength
    
    // Read file size (8 bytes, little endian)
    const view = new DataView(data.buffer, pos)
    const size = Number(view.getBigUint64(0, true))
    pos += 8
    
    // Read dates (8 bytes each, little endian, Unix timestamp)
    const dateCreated = new Date(Number(view.getBigUint64(8, true)) * 1000)
    const dateModified = new Date(Number(view.getBigUint64(16, true)) * 1000)
    pos += 16
    
    // Read format length and format
    const formatLength = data[pos++]
    const format = new TextDecoder().decode(data.slice(pos, pos + formatLength))
    pos += formatLength
    
    const fileInfo: FileInfo = {
      name,
      path,
      size,
      dateCreated,
      dateModified,
      format,
      isDirectory
    }
    
    return { fileInfo, nextOffset: pos }
  }

  private parseFileInfo(data: Uint8Array): FileInfo {
    const entry = this.parseFileEntry(data, 0)
    return entry.fileInfo
  }

  private getErrorMessage(code: FTPResponseCode): string {
    switch (code) {
      case FTPResponseCode.FILE_NOT_FOUND:
        return 'File not found'
      case FTPResponseCode.PERMISSION_DENIED:
        return 'Permission denied'
      case FTPResponseCode.DISK_FULL:
        return 'Disk full'
      case FTPResponseCode.INVALID_PATH:
        return 'Invalid path'
      case FTPResponseCode.OPERATION_NOT_SUPPORTED:
        return 'Operation not supported'
      case FTPResponseCode.TRANSFER_ERROR:
        return 'Transfer error'
      case FTPResponseCode.TIMEOUT:
        return 'Operation timeout'
      default:
        return 'Unknown error'
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanupDevice(deviceId: string): void {
    // Cancel any active transfers
    const transferKeys = Array.from(this.activeTransfers.keys()).filter(key => 
      key.startsWith(`${deviceId}_`)
    )
    transferKeys.forEach(key => this.activeTransfers.delete(key))
    
    // Clear current path
    this.currentPaths.delete(deviceId)
  }

  cleanup(): void {
    this.activeTransfers.clear()
    this.currentPaths.clear()
  }
}