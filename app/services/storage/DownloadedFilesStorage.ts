/**
 * Downloaded Files Storage Service
 * 
 * Manages downloaded files, local storage, and file organization
 */

import { storage, load, save } from '../utils/storage'

// Downloaded file record
export interface DownloadedFile {
  id: string
  deviceId: string
  deviceName: string
  originalPath: string
  localPath: string
  fileName: string
  fileSize: number
  fileType: 'video' | 'audio' | 'image' | 'other'
  format?: string
  resolution?: string
  frameRate?: number
  duration?: number
  downloadedAt: Date
  lastAccessedAt?: Date
  thumbnailPath?: string
  previewPath?: string
  metadata: Record<string, any>
  tags: string[]
  isFavorite: boolean
  isArchived: boolean
}

// File collection/project
export interface FileCollection {
  id: string
  name: string
  description?: string
  fileIds: string[]
  createdAt: Date
  updatedAt: Date
  tags: string[]
  color?: string
}

// Storage statistics
export interface StorageStats {
  totalFiles: number
  totalSizeBytes: number
  totalSizeFormatted: string
  fileTypeBreakdown: Record<string, number>
  deviceBreakdown: Record<string, number>
  oldestFile?: DownloadedFile
  newestFile?: DownloadedFile
  largestFile?: DownloadedFile
  mostAccessedFile?: DownloadedFile
  availableSpace: number
  usagePercentage: number
}

// File search options
export interface FileSearchOptions {
  query?: string
  deviceId?: string
  fileType?: 'video' | 'audio' | 'image' | 'other'
  tags?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
  sizeRange?: {
    minBytes: number
    maxBytes: number
  }
  isFavorite?: boolean
  isArchived?: boolean
  sortBy?: 'name' | 'date' | 'size' | 'type' | 'lastAccessed'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

// Storage keys
const STORAGE_KEYS = {
  DOWNLOADED_FILES: 'downloads.files',
  FILE_COLLECTIONS: 'downloads.collections',
  STORAGE_STATS: 'downloads.stats',
  FILE_INDEX: 'downloads.index',
  THUMBNAILS_CACHE: 'downloads.thumbnails'
} as const

export class DownloadedFilesStorage {
  
  /**
   * Add downloaded file record
   */
  static addDownloadedFile(fileData: Omit<DownloadedFile, 'id' | 'downloadedAt' | 'tags' | 'isFavorite' | 'isArchived'>): string {
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const file: DownloadedFile = {
      ...fileData,
      id: fileId,
      downloadedAt: new Date(),
      tags: [],
      isFavorite: false,
      isArchived: false
    }
    
    const files = this.getAllFiles()
    files.unshift(file)
    
    // Keep only the last 1000 files to prevent unlimited growth
    const trimmedFiles = files.slice(0, 1000)
    
    save(STORAGE_KEYS.DOWNLOADED_FILES, trimmedFiles)
    this.updateStorageStats()
    
    return fileId
  }
  
  /**
   * Get all downloaded files
   */
  static getAllFiles(): DownloadedFile[] {
    const files = load<DownloadedFile[]>(STORAGE_KEYS.DOWNLOADED_FILES) || []
    
    // Convert date strings back to Date objects
    return files.map(file => ({
      ...file,
      downloadedAt: new Date(file.downloadedAt),
      lastAccessedAt: file.lastAccessedAt ? new Date(file.lastAccessedAt) : undefined
    }))
  }
  
  /**
   * Get file by ID
   */
  static getFileById(fileId: string): DownloadedFile | null {
    const files = this.getAllFiles()
    const file = files.find(f => f.id === fileId)
    
    if (file) {
      // Update last accessed time
      file.lastAccessedAt = new Date()
      this.updateFile(fileId, { lastAccessedAt: file.lastAccessedAt })
    }
    
    return file || null
  }
  
  /**
   * Search files
   */
  static searchFiles(options: FileSearchOptions = {}): DownloadedFile[] {
    let files = this.getAllFiles()
    
    // Apply filters
    if (options.query) {
      const query = options.query.toLowerCase()
      files = files.filter(file => 
        file.fileName.toLowerCase().includes(query) ||
        file.deviceName.toLowerCase().includes(query) ||
        file.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }
    
    if (options.deviceId) {
      files = files.filter(file => file.deviceId === options.deviceId)
    }
    
    if (options.fileType) {
      files = files.filter(file => file.fileType === options.fileType)
    }
    
    if (options.tags && options.tags.length > 0) {
      files = files.filter(file => 
        options.tags!.some(tag => file.tags.includes(tag))
      )
    }
    
    if (options.dateRange) {
      files = files.filter(file => 
        file.downloadedAt >= options.dateRange!.start &&
        file.downloadedAt <= options.dateRange!.end
      )
    }
    
    if (options.sizeRange) {
      files = files.filter(file => 
        file.fileSize >= options.sizeRange!.minBytes &&
        file.fileSize <= options.sizeRange!.maxBytes
      )
    }
    
    if (options.isFavorite !== undefined) {
      files = files.filter(file => file.isFavorite === options.isFavorite)
    }
    
    if (options.isArchived !== undefined) {
      files = files.filter(file => file.isArchived === options.isArchived)
    }
    
    // Apply sorting
    const sortBy = options.sortBy || 'date'
    const sortOrder = options.sortOrder || 'desc'
    
    files.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.fileName.localeCompare(b.fileName)
          break
        case 'date':
          comparison = a.downloadedAt.getTime() - b.downloadedAt.getTime()
          break
        case 'size':
          comparison = a.fileSize - b.fileSize
          break
        case 'type':
          comparison = a.fileType.localeCompare(b.fileType)
          break
        case 'lastAccessed':
          const aAccessed = a.lastAccessedAt?.getTime() || 0
          const bAccessed = b.lastAccessedAt?.getTime() || 0
          comparison = aAccessed - bAccessed
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
    
    // Apply pagination
    if (options.offset || options.limit) {
      const start = options.offset || 0
      const end = options.limit ? start + options.limit : undefined
      files = files.slice(start, end)
    }
    
    return files
  }
  
  /**
   * Update file
   */
  static updateFile(fileId: string, updates: Partial<DownloadedFile>): boolean {
    const files = this.getAllFiles()
    const fileIndex = files.findIndex(f => f.id === fileId)
    
    if (fileIndex === -1) return false
    
    files[fileIndex] = {
      ...files[fileIndex],
      ...updates
    }
    
    save(STORAGE_KEYS.DOWNLOADED_FILES, files)
    this.updateStorageStats()
    return true
  }
  
  /**
   * Delete file
   */
  static deleteFile(fileId: string): boolean {
    const files = this.getAllFiles()
    const updatedFiles = files.filter(f => f.id !== fileId)
    
    if (updatedFiles.length === files.length) return false // File not found
    
    save(STORAGE_KEYS.DOWNLOADED_FILES, updatedFiles)
    this.updateStorageStats()
    return true
  }
  
  /**
   * Add tag to file
   */
  static addFileTag(fileId: string, tag: string): boolean {
    const files = this.getAllFiles()
    const fileIndex = files.findIndex(f => f.id === fileId)
    
    if (fileIndex === -1) return false
    
    const currentTags = files[fileIndex].tags
    if (!currentTags.includes(tag)) {
      files[fileIndex].tags = [...currentTags, tag]
      save(STORAGE_KEYS.DOWNLOADED_FILES, files)
      return true
    }
    
    return false
  }
  
  /**
   * Remove tag from file
   */
  static removeFileTag(fileId: string, tag: string): boolean {
    const files = this.getAllFiles()
    const fileIndex = files.findIndex(f => f.id === fileId)
    
    if (fileIndex === -1) return false
    
    const currentTags = files[fileIndex].tags
    const updatedTags = currentTags.filter(t => t !== tag)
    
    if (updatedTags.length !== currentTags.length) {
      files[fileIndex].tags = updatedTags
      save(STORAGE_KEYS.DOWNLOADED_FILES, files)
      return true
    }
    
    return false
  }
  
  /**
   * Set file as favorite
   */
  static setFileFavorite(fileId: string, isFavorite: boolean): boolean {
    return this.updateFile(fileId, { isFavorite })
  }
  
  /**
   * Archive/unarchive file
   */
  static setFileArchived(fileId: string, isArchived: boolean): boolean {
    return this.updateFile(fileId, { isArchived })
  }
  
  /**
   * Get all unique tags
   */
  static getAllTags(): string[] {
    const files = this.getAllFiles()
    const tagSet = new Set<string>()
    
    files.forEach(file => {
      file.tags.forEach(tag => tagSet.add(tag))
    })
    
    return Array.from(tagSet).sort()
  }
  
  /**
   * Create file collection
   */
  static createCollection(name: string, description?: string): string {
    const collectionId = `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const collection: FileCollection = {
      id: collectionId,
      name,
      description,
      fileIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: []
    }
    
    const collections = this.getAllCollections()
    collections.unshift(collection)
    
    save(STORAGE_KEYS.FILE_COLLECTIONS, collections)
    return collectionId
  }
  
  /**
   * Get all collections
   */
  static getAllCollections(): FileCollection[] {
    const collections = load<FileCollection[]>(STORAGE_KEYS.FILE_COLLECTIONS) || []
    
    // Convert date strings back to Date objects
    return collections.map(collection => ({
      ...collection,
      createdAt: new Date(collection.createdAt),
      updatedAt: new Date(collection.updatedAt)
    }))
  }
  
  /**
   * Add file to collection
   */
  static addFileToCollection(collectionId: string, fileId: string): boolean {
    const collections = this.getAllCollections()
    const collectionIndex = collections.findIndex(c => c.id === collectionId)
    
    if (collectionIndex === -1) return false
    
    const collection = collections[collectionIndex]
    if (!collection.fileIds.includes(fileId)) {
      collection.fileIds.push(fileId)
      collection.updatedAt = new Date()
      
      save(STORAGE_KEYS.FILE_COLLECTIONS, collections)
      return true
    }
    
    return false
  }
  
  /**
   * Remove file from collection
   */
  static removeFileFromCollection(collectionId: string, fileId: string): boolean {
    const collections = this.getAllCollections()
    const collectionIndex = collections.findIndex(c => c.id === collectionId)
    
    if (collectionIndex === -1) return false
    
    const collection = collections[collectionIndex]
    const updatedFileIds = collection.fileIds.filter(id => id !== fileId)
    
    if (updatedFileIds.length !== collection.fileIds.length) {
      collection.fileIds = updatedFileIds
      collection.updatedAt = new Date()
      
      save(STORAGE_KEYS.FILE_COLLECTIONS, collections)
      return true
    }
    
    return false
  }
  
  /**
   * Delete collection
   */
  static deleteCollection(collectionId: string): boolean {
    const collections = this.getAllCollections()
    const updatedCollections = collections.filter(c => c.id !== collectionId)
    
    if (updatedCollections.length === collections.length) return false
    
    save(STORAGE_KEYS.FILE_COLLECTIONS, updatedCollections)
    return true
  }
  
  /**
   * Get storage statistics
   */
  static getStorageStats(): StorageStats {
    const files = this.getAllFiles()
    
    const totalFiles = files.length
    const totalSizeBytes = files.reduce((sum, file) => sum + file.fileSize, 0)
    
    // File type breakdown
    const fileTypeBreakdown: Record<string, number> = {}
    files.forEach(file => {
      fileTypeBreakdown[file.fileType] = (fileTypeBreakdown[file.fileType] || 0) + 1
    })
    
    // Device breakdown
    const deviceBreakdown: Record<string, number> = {}
    files.forEach(file => {
      deviceBreakdown[file.deviceName] = (deviceBreakdown[file.deviceName] || 0) + 1
    })
    
    // Find special files
    const sortedByDate = [...files].sort((a, b) => a.downloadedAt.getTime() - b.downloadedAt.getTime())
    const sortedBySize = [...files].sort((a, b) => b.fileSize - a.fileSize)
    const sortedByAccess = [...files].sort((a, b) => {
      const aAccessed = a.lastAccessedAt?.getTime() || 0
      const bAccessed = b.lastAccessedAt?.getTime() || 0
      return bAccessed - aAccessed
    })
    
    // Mock available space calculation (would need native module in real app)
    const availableSpace = 1024 * 1024 * 1024 * 32 // 32GB mock
    const usagePercentage = availableSpace > 0 ? (totalSizeBytes / availableSpace) * 100 : 0
    
    return {
      totalFiles,
      totalSizeBytes,
      totalSizeFormatted: this.formatFileSize(totalSizeBytes),
      fileTypeBreakdown,
      deviceBreakdown,
      oldestFile: sortedByDate[0],
      newestFile: sortedByDate[sortedByDate.length - 1],
      largestFile: sortedBySize[0],
      mostAccessedFile: sortedByAccess[0],
      availableSpace,
      usagePercentage
    }
  }
  
  /**
   * Update storage statistics cache
   */
  private static updateStorageStats(): void {
    const stats = this.getStorageStats()
    save(STORAGE_KEYS.STORAGE_STATS, stats)
  }
  
  /**
   * Clean up old files
   */
  static cleanupOldFiles(olderThanDays: number): number {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
    
    const files = this.getAllFiles()
    const filesToKeep = files.filter(file => 
      file.downloadedAt > cutoffDate || file.isFavorite || file.isArchived
    )
    
    const deletedCount = files.length - filesToKeep.length
    
    if (deletedCount > 0) {
      save(STORAGE_KEYS.DOWNLOADED_FILES, filesToKeep)
      this.updateStorageStats()
    }
    
    return deletedCount
  }
  
  /**
   * Clear all downloaded files
   */
  static clearAllFiles(): boolean {
    save(STORAGE_KEYS.DOWNLOADED_FILES, [])
    save(STORAGE_KEYS.FILE_COLLECTIONS, [])
    this.updateStorageStats()
    return true
  }
  
  /**
   * Export files data
   */
  static exportFilesData(): string {
    const files = this.getAllFiles()
    const collections = this.getAllCollections()
    const stats = this.getStorageStats()
    
    return JSON.stringify({
      files,
      collections,
      stats,
      exportedAt: new Date().toISOString()
    }, null, 2)
  }
  
  /**
   * Import files data
   */
  static importFilesData(dataJson: string): boolean {
    try {
      const data = JSON.parse(dataJson)
      
      if (data.files && Array.isArray(data.files)) {
        save(STORAGE_KEYS.DOWNLOADED_FILES, data.files)
      }
      
      if (data.collections && Array.isArray(data.collections)) {
        save(STORAGE_KEYS.FILE_COLLECTIONS, data.collections)
      }
      
      this.updateStorageStats()
      return true
    } catch (error) {
      console.error('Failed to import files data:', error)
      return false
    }
  }
  
  /**
   * Format file size for display
   */
  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  /**
   * Get files by device
   */
  static getFilesByDevice(deviceId: string): DownloadedFile[] {
    return this.searchFiles({ deviceId, sortBy: 'date', sortOrder: 'desc' })
  }
  
  /**
   * Get recent files
   */
  static getRecentFiles(limit: number = 20): DownloadedFile[] {
    return this.searchFiles({ sortBy: 'date', sortOrder: 'desc', limit })
  }
  
  /**
   * Get favorite files
   */
  static getFavoriteFiles(): DownloadedFile[] {
    return this.searchFiles({ isFavorite: true, sortBy: 'date', sortOrder: 'desc' })
  }
  
  /**
   * Get archived files
   */
  static getArchivedFiles(): DownloadedFile[] {
    return this.searchFiles({ isArchived: true, sortBy: 'date', sortOrder: 'desc' })
  }
}

export default DownloadedFilesStorage