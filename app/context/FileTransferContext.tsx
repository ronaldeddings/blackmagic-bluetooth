/**
 * File Transfer Context
 * 
 * Manages file transfer operations, download/upload queues, and progress tracking
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  blackmagicBluetoothManager,
  FileInfo,
  TransferProgress,
  TransferOperationType,
  TransferStatus
} from '../services/bluetooth'
import { storage, load, save } from '../utils/storage'

export interface FileTransferItem {
  id: string
  deviceId: string
  operation: TransferOperationType
  status: TransferStatus
  file: FileInfo
  localPath?: string
  progress?: TransferProgress
  startTime?: Date
  endTime?: Date
  error?: string
  isPaused: boolean
  retryCount: number
}

interface FileTransferContextType {
  // Transfer queues
  activeTransfers: FileTransferItem[]
  completedTransfers: FileTransferItem[]
  failedTransfers: FileTransferItem[]
  
  // Queue management
  queueDownload: (deviceId: string, file: FileInfo, localPath: string) => string
  queueUpload: (deviceId: string, localPath: string, remotePath: string) => string
  queueBatchDownload: (deviceId: string, files: FileInfo[], localDir: string) => string[]
  queueBatchUpload: (deviceId: string, localFiles: string[], remoteDir: string) => string[]
  
  // Transfer control
  pauseTransfer: (transferId: string) => Promise<void>
  resumeTransfer: (transferId: string) => Promise<void>
  cancelTransfer: (transferId: string) => Promise<void>
  retryTransfer: (transferId: string) => Promise<void>
  
  // Queue control
  pauseAllTransfers: () => Promise<void>
  resumeAllTransfers: () => Promise<void>
  cancelAllTransfers: () => Promise<void>
  clearCompletedTransfers: () => void
  clearFailedTransfers: () => void
  
  // Statistics
  getTotalProgress: () => number
  getActiveTransferCount: () => number
  getQueuedTransferCount: () => number
  getTotalTransferredBytes: () => number
  getAverageTransferSpeed: () => number
  
  // Settings
  maxConcurrentTransfers: number
  setMaxConcurrentTransfers: (count: number) => void
  autoRetryEnabled: boolean
  setAutoRetryEnabled: (enabled: boolean) => void
  maxRetryCount: number
  setMaxRetryCount: (count: number) => void
  
  // Storage management
  getDownloadHistory: () => FileTransferItem[]
  getStorageUsage: () => Promise<{ totalSize: number; availableSize: number }>
  cleanupDownloads: (olderThanDays: number) => Promise<void>
}

const FileTransferContext = createContext<FileTransferContextType | undefined>(undefined)

export const useFileTransfer = () => {
  const context = useContext(FileTransferContext)
  if (!context) {
    throw new Error('useFileTransfer must be used within a FileTransferProvider')
  }
  return context
}

interface FileTransferProviderProps {
  children: React.ReactNode
}

// Storage keys
const STORAGE_KEYS = {
  TRANSFER_HISTORY: 'fileTransfer.history',
  SETTINGS: 'fileTransfer.settings',
  DOWNLOAD_PATHS: 'fileTransfer.downloadPaths'
} as const

interface FileTransferSettings {
  maxConcurrentTransfers: number
  autoRetryEnabled: boolean
  maxRetryCount: number
}

const DEFAULT_SETTINGS: FileTransferSettings = {
  maxConcurrentTransfers: 3,
  autoRetryEnabled: true,
  maxRetryCount: 3
}

export const FileTransferProvider: React.FC<FileTransferProviderProps> = ({ children }) => {
  const [activeTransfers, setActiveTransfers] = useState<FileTransferItem[]>([])
  const [completedTransfers, setCompletedTransfers] = useState<FileTransferItem[]>([])
  const [failedTransfers, setFailedTransfers] = useState<FileTransferItem[]>([])
  const [settings, setSettings] = useState<FileTransferSettings>(DEFAULT_SETTINGS)

  // Load persisted data on mount
  useEffect(() => {
    const loadPersistedData = () => {
      // Load transfer history
      const history = load<FileTransferItem[]>(STORAGE_KEYS.TRANSFER_HISTORY) || []
      const completed = history.filter(t => t.status === TransferStatus.COMPLETED)
      const failed = history.filter(t => t.status === TransferStatus.FAILED)
      
      setCompletedTransfers(completed)
      setFailedTransfers(failed)
      
      // Load settings
      const savedSettings = load<FileTransferSettings>(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS
      setSettings(savedSettings)
    }
    
    loadPersistedData()
  }, [])

  // Save transfer history when transfers change
  useEffect(() => {
    const allTransfers = [...completedTransfers, ...failedTransfers]
    save(STORAGE_KEYS.TRANSFER_HISTORY, allTransfers)
  }, [completedTransfers, failedTransfers])

  // Save settings when they change
  useEffect(() => {
    save(STORAGE_KEYS.SETTINGS, settings)
  }, [settings])

  // Process transfer queue
  useEffect(() => {
    const processQueue = async () => {
      const running = activeTransfers.filter(t => t.status === TransferStatus.IN_PROGRESS).length
      const queued = activeTransfers.filter(t => t.status === TransferStatus.QUEUED && !t.isPaused)
      
      if (running < settings.maxConcurrentTransfers && queued.length > 0) {
        const nextTransfer = queued[0]
        await startTransfer(nextTransfer)
      }
    }
    
    processQueue()
  }, [activeTransfers, settings.maxConcurrentTransfers])

  const generateTransferId = useCallback(() => {
    return `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }, [])

  const startTransfer = useCallback(async (transfer: FileTransferItem) => {
    try {
      setActiveTransfers(prev => prev.map(t => 
        t.id === transfer.id 
          ? { ...t, status: TransferStatus.IN_PROGRESS, startTime: new Date() }
          : t
      ))

      let progressCallback: (progress: TransferProgress) => void
      
      progressCallback = (progress: TransferProgress) => {
        setActiveTransfers(prev => prev.map(t => 
          t.id === transfer.id ? { ...t, progress } : t
        ))
      }

      let result: any
      if (transfer.operation === TransferOperationType.DOWNLOAD) {
        result = await blackmagicBluetoothManager.downloadFile(
          transfer.deviceId,
          transfer.file.path,
          transfer.localPath!,
          progressCallback
        )
      } else {
        result = await blackmagicBluetoothManager.uploadFile(
          transfer.deviceId,
          transfer.localPath!,
          transfer.file.path,
          progressCallback
        )
      }

      // Transfer completed successfully
      setActiveTransfers(prev => {
        const updated = prev.filter(t => t.id !== transfer.id)
        const completed = prev.find(t => t.id === transfer.id)
        if (completed) {
          setCompletedTransfers(prevCompleted => [...prevCompleted, {
            ...completed,
            status: TransferStatus.COMPLETED,
            endTime: new Date()
          }])
        }
        return updated
      })

    } catch (error) {
      // Transfer failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      setActiveTransfers(prev => {
        const updated = prev.map(t => {
          if (t.id === transfer.id) {
            const updatedTransfer = {
              ...t,
              status: TransferStatus.FAILED,
              error: errorMessage,
              endTime: new Date()
            }
            
            // Auto-retry logic
            if (settings.autoRetryEnabled && t.retryCount < settings.maxRetryCount) {
              return {
                ...updatedTransfer,
                status: TransferStatus.QUEUED,
                retryCount: t.retryCount + 1,
                error: undefined
              }
            } else {
              // Move to failed transfers
              setFailedTransfers(prevFailed => [...prevFailed, updatedTransfer])
              return null
            }
          }
          return t
        }).filter(Boolean) as FileTransferItem[]
        
        return updated
      })
    }
  }, [settings.autoRetryEnabled, settings.maxRetryCount])

  const queueDownload = useCallback((deviceId: string, file: FileInfo, localPath: string): string => {
    const transferId = generateTransferId()
    const transfer: FileTransferItem = {
      id: transferId,
      deviceId,
      operation: TransferOperationType.DOWNLOAD,
      status: TransferStatus.QUEUED,
      file,
      localPath,
      isPaused: false,
      retryCount: 0
    }
    
    setActiveTransfers(prev => [...prev, transfer])
    return transferId
  }, [generateTransferId])

  const queueUpload = useCallback((deviceId: string, localPath: string, remotePath: string): string => {
    const transferId = generateTransferId()
    const transfer: FileTransferItem = {
      id: transferId,
      deviceId,
      operation: TransferOperationType.UPLOAD,
      status: TransferStatus.QUEUED,
      file: { name: localPath.split('/').pop() || 'unknown', path: remotePath, size: 0 },
      localPath,
      isPaused: false,
      retryCount: 0
    }
    
    setActiveTransfers(prev => [...prev, transfer])
    return transferId
  }, [generateTransferId])

  const queueBatchDownload = useCallback((deviceId: string, files: FileInfo[], localDir: string): string[] => {
    return files.map(file => 
      queueDownload(deviceId, file, `${localDir}/${file.name}`)
    )
  }, [queueDownload])

  const queueBatchUpload = useCallback((deviceId: string, localFiles: string[], remoteDir: string): string[] => {
    return localFiles.map(localPath => 
      queueUpload(deviceId, localPath, `${remoteDir}/${localPath.split('/').pop()}`)
    )
  }, [queueUpload])

  const pauseTransfer = useCallback(async (transferId: string) => {
    setActiveTransfers(prev => prev.map(t => 
      t.id === transferId ? { ...t, isPaused: true } : t
    ))
    
    try {
      await blackmagicBluetoothManager.pauseFileTransfer(transferId)
    } catch (error) {
      console.error('Failed to pause transfer:', error)
    }
  }, [])

  const resumeTransfer = useCallback(async (transferId: string) => {
    setActiveTransfers(prev => prev.map(t => 
      t.id === transferId ? { ...t, isPaused: false } : t
    ))
    
    try {
      await blackmagicBluetoothManager.resumeFileTransfer(transferId)
    } catch (error) {
      console.error('Failed to resume transfer:', error)
    }
  }, [])

  const cancelTransfer = useCallback(async (transferId: string) => {
    try {
      await blackmagicBluetoothManager.cancelFileTransfer(transferId)
    } catch (error) {
      console.error('Failed to cancel transfer:', error)
    }
    
    setActiveTransfers(prev => prev.filter(t => t.id !== transferId))
  }, [])

  const retryTransfer = useCallback(async (transferId: string) => {
    const failedTransfer = failedTransfers.find(t => t.id === transferId)
    if (!failedTransfer) return
    
    setFailedTransfers(prev => prev.filter(t => t.id !== transferId))
    setActiveTransfers(prev => [...prev, {
      ...failedTransfer,
      status: TransferStatus.QUEUED,
      error: undefined,
      retryCount: failedTransfer.retryCount + 1
    }])
  }, [failedTransfers])

  const pauseAllTransfers = useCallback(async () => {
    const activeIds = activeTransfers.filter(t => !t.isPaused).map(t => t.id)
    for (const id of activeIds) {
      await pauseTransfer(id)
    }
  }, [activeTransfers, pauseTransfer])

  const resumeAllTransfers = useCallback(async () => {
    const pausedIds = activeTransfers.filter(t => t.isPaused).map(t => t.id)
    for (const id of pausedIds) {
      await resumeTransfer(id)
    }
  }, [activeTransfers, resumeTransfer])

  const cancelAllTransfers = useCallback(async () => {
    const activeIds = activeTransfers.map(t => t.id)
    for (const id of activeIds) {
      await cancelTransfer(id)
    }
  }, [activeTransfers, cancelTransfer])

  const clearCompletedTransfers = useCallback(() => {
    setCompletedTransfers([])
  }, [])

  const clearFailedTransfers = useCallback(() => {
    setFailedTransfers([])
  }, [])

  const getTotalProgress = useCallback((): number => {
    if (activeTransfers.length === 0) return 0
    
    const totalProgress = activeTransfers.reduce((sum, transfer) => {
      return sum + (transfer.progress?.percentage || 0)
    }, 0)
    
    return totalProgress / activeTransfers.length
  }, [activeTransfers])

  const getActiveTransferCount = useCallback(() => {
    return activeTransfers.filter(t => t.status === TransferStatus.IN_PROGRESS).length
  }, [activeTransfers])

  const getQueuedTransferCount = useCallback(() => {
    return activeTransfers.filter(t => t.status === TransferStatus.QUEUED).length
  }, [activeTransfers])

  const getTotalTransferredBytes = useCallback((): number => {
    return [...completedTransfers, ...activeTransfers].reduce((total, transfer) => {
      if (transfer.progress?.bytesTransferred) {
        return total + transfer.progress.bytesTransferred
      }
      return total
    }, 0)
  }, [completedTransfers, activeTransfers])

  const getAverageTransferSpeed = useCallback((): number => {
    const transfersWithSpeed = activeTransfers.filter(t => t.progress?.speed)
    if (transfersWithSpeed.length === 0) return 0
    
    const totalSpeed = transfersWithSpeed.reduce((sum, transfer) => {
      return sum + (transfer.progress?.speed || 0)
    }, 0)
    
    return totalSpeed / transfersWithSpeed.length
  }, [activeTransfers])

  const getDownloadHistory = useCallback(() => {
    return [...completedTransfers, ...failedTransfers]
      .filter(t => t.operation === TransferOperationType.DOWNLOAD)
      .sort((a, b) => {
        const dateA = a.endTime || a.startTime || new Date(0)
        const dateB = b.endTime || b.startTime || new Date(0)
        return dateB.getTime() - dateA.getTime()
      })
  }, [completedTransfers, failedTransfers])

  const getStorageUsage = useCallback(async () => {
    // This would need to be implemented with a native module or file system access
    // For now, return mock data
    return {
      totalSize: 1024 * 1024 * 1024 * 64, // 64GB
      availableSize: 1024 * 1024 * 1024 * 32 // 32GB available
    }
  }, [])

  const cleanupDownloads = useCallback(async (olderThanDays: number) => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
    
    // Remove old completed transfers from history
    setCompletedTransfers(prev => 
      prev.filter(t => {
        const transferDate = t.endTime || t.startTime
        return !transferDate || transferDate > cutoffDate
      })
    )
    
    setFailedTransfers(prev => 
      prev.filter(t => {
        const transferDate = t.endTime || t.startTime
        return !transferDate || transferDate > cutoffDate
      })
    )
  }, [])

  const contextValue: FileTransferContextType = {
    activeTransfers,
    completedTransfers,
    failedTransfers,
    queueDownload,
    queueUpload,
    queueBatchDownload,
    queueBatchUpload,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    retryTransfer,
    pauseAllTransfers,
    resumeAllTransfers,
    cancelAllTransfers,
    clearCompletedTransfers,
    clearFailedTransfers,
    getTotalProgress,
    getActiveTransferCount,
    getQueuedTransferCount,
    getTotalTransferredBytes,
    getAverageTransferSpeed,
    maxConcurrentTransfers: settings.maxConcurrentTransfers,
    setMaxConcurrentTransfers: (count: number) => setSettings(prev => ({ ...prev, maxConcurrentTransfers: count })),
    autoRetryEnabled: settings.autoRetryEnabled,
    setAutoRetryEnabled: (enabled: boolean) => setSettings(prev => ({ ...prev, autoRetryEnabled: enabled })),
    maxRetryCount: settings.maxRetryCount,
    setMaxRetryCount: (count: number) => setSettings(prev => ({ ...prev, maxRetryCount: count })),
    getDownloadHistory,
    getStorageUsage,
    cleanupDownloads
  }

  return (
    <FileTransferContext.Provider value={contextValue}>
      {children}
    </FileTransferContext.Provider>
  )
}