/**
 * File Manager Screen
 * 
 * Phase 7.3 - File Manager Screen Implementation
 * - File browser interface
 * - Download manager with progress tracking
 * - File preview thumbnails
 * - Batch operations (download, delete, select all)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  StyleSheet,
  Alert,
  RefreshControl,
  ViewStyle,
  TextStyle,
  Dimensions,
  TouchableOpacity,
  Image,
  Modal
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { Screen } from '../components/Screen'
import { Header } from '../components/Header'
import { Text } from '../components/Text'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { ListItem } from '../components/ListItem'

import { blackmagicBluetoothManager } from '../services/bluetooth/BlackmagicBluetoothManager'
import {
  BlackmagicDeviceInfo,
  CameraFile,
  FileType,
  DownloadProgress,
  BlackmagicBluetoothUtils
} from '../services/bluetooth/types/BlackmagicTypes'

import { colors, spacing } from '../theme'

// Storage keys
const STORAGE_KEYS = {
  DOWNLOAD_PREFERENCES: 'fileManager_downloadPreferences',
  SELECTED_FILES: 'fileManager_selectedFiles'
}

// Types
interface DownloadPreferences {
  autoDownloadThumbnails: boolean
  downloadLocation: 'internal' | 'external'
  autoDeleteAfterDownload: boolean
}

interface FilePreview {
  uri: string
  width: number
  height: number
}

interface FileItem extends CameraFile {
  isSelected: boolean
  downloadProgress?: DownloadProgress
  previewUri?: string
  thumbnail?: FilePreview
}

interface BatchOperation {
  id: string
  type: 'download' | 'delete' | 'move'
  fileIds: string[]
  progress: number
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
}

export const FileManagerScreen: React.FC = () => {
  // State
  const [connectedDevice, setConnectedDevice] = useState<BlackmagicDeviceInfo | undefined>()
  const [isConnected, setIsConnected] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [downloadPreferences, setDownloadPreferences] = useState<DownloadPreferences>({
    autoDownloadThumbnails: true,
    downloadLocation: 'internal',
    autoDeleteAfterDownload: false
  })
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [batchOperations, setBatchOperations] = useState<BatchOperation[]>([])
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [filterType, setFilterType] = useState<FileType | 'all'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [previewModal, setPreviewModal] = useState<{ visible: boolean; file?: FileItem }>({
    visible: false
  })

  const screenWidth = Dimensions.get('window').width
  const gridItemWidth = (screenWidth - spacing.md * 3) / 2

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    initializeFileManager()
    loadPreferences()
    
    return cleanup
  }, [])

  useEffect(() => {
    if (isConnected && connectedDevice) {
      loadFiles()
    } else {
      setFiles([])
    }
  }, [isConnected, connectedDevice])

  // Auto-load thumbnails when preferences change
  useEffect(() => {
    if (downloadPreferences.autoDownloadThumbnails && files.length > 0) {
      loadThumbnails()
    }
  }, [downloadPreferences.autoDownloadThumbnails, files])

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initializeFileManager = useCallback(async () => {
    try {
      // Get current connection state
      const currentDevice = blackmagicBluetoothManager.getConnectedDevice()
      const connectionState = blackmagicBluetoothManager.isConnected()
      
      setConnectedDevice(currentDevice)
      setIsConnected(connectionState)

      // Set up event listeners
      const unsubscribeConnectionChange = blackmagicBluetoothManager.onConnectionStateChange(
        handleConnectionStateChange
      )
      
      const unsubscribeDeviceChange = blackmagicBluetoothManager.onDeviceChange(
        handleDeviceChange
      )

      cleanup.current = () => {
        unsubscribeConnectionChange()
        unsubscribeDeviceChange()
      }
    } catch (error) {
      console.error('Failed to initialize file manager:', error)
    }
  }, [])

  const loadPreferences = useCallback(async () => {
    try {
      const savedPreferences = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOAD_PREFERENCES)
      if (savedPreferences) {
        setDownloadPreferences(JSON.parse(savedPreferences))
      }

      const savedSelected = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_FILES)
      if (savedSelected) {
        setSelectedFiles(new Set(JSON.parse(savedSelected)))
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
    }
  }, [])

  const cleanup = useCallback(() => {
    // Cleanup will be handled by effect cleanup
  }, [])

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleConnectionStateChange = useCallback((connected: boolean) => {
    setIsConnected(connected)
    if (!connected) {
      setFiles([])
      setSelectedFiles(new Set())
    }
  }, [])

  const handleDeviceChange = useCallback((device: BlackmagicDeviceInfo | undefined) => {
    setConnectedDevice(device)
  }, [])

  const handleRefresh = useCallback(async () => {
    if (!isConnected || !connectedDevice) return

    setRefreshing(true)
    await loadFiles()
    setRefreshing(false)
  }, [isConnected, connectedDevice])

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  const loadFiles = useCallback(async () => {
    if (!connectedDevice?.id) return

    try {
      setIsLoading(true)
      
      // Load files from connected device
      const fileList = await blackmagicBluetoothManager.listFiles(connectedDevice.id)
      
      const fileItems: FileItem[] = fileList.map(file => ({
        ...file,
        isSelected: selectedFiles.has(file.id)
      }))

      setFiles(fileItems)

      // Auto-load thumbnails if enabled
      if (downloadPreferences.autoDownloadThumbnails) {
        setTimeout(() => loadThumbnails(), 100)
      }
    } catch (error) {
      console.error('Failed to load files:', error)
      Alert.alert('Error', 'Failed to load files from camera')
    } finally {
      setIsLoading(false)
    }
  }, [connectedDevice, selectedFiles, downloadPreferences.autoDownloadThumbnails])

  const loadThumbnails = useCallback(async () => {
    if (!connectedDevice?.id) return

    const imageFiles = files.filter(file => 
      BlackmagicBluetoothUtils.isImageFile(file.name) && !file.thumbnail
    )

    for (const file of imageFiles.slice(0, 10)) { // Load first 10 thumbnails
      try {
        const thumbnail = await blackmagicBluetoothManager.getFileThumbnail(
          connectedDevice.id,
          file.id
        )
        
        setFiles(prevFiles => 
          prevFiles.map(f => 
            f.id === file.id ? { ...f, thumbnail } : f
          )
        )
      } catch (error) {
        console.error(`Failed to load thumbnail for ${file.name}:`, error)
      }
    }
  }, [connectedDevice, files])

  // ============================================================================
  // FILE SELECTION
  // ============================================================================

  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFiles(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(fileId)) {
        newSelected.delete(fileId)
      } else {
        newSelected.add(fileId)
      }
      
      // Update files state
      setFiles(prevFiles => 
        prevFiles.map(file => ({
          ...file,
          isSelected: newSelected.has(file.id)
        }))
      )

      // Save to storage
      AsyncStorage.setItem(STORAGE_KEYS.SELECTED_FILES, JSON.stringify([...newSelected]))
      
      return newSelected
    })
  }, [])

  const selectAllFiles = useCallback(() => {
    const allFileIds = new Set(files.map(f => f.id))
    setSelectedFiles(allFileIds)
    
    setFiles(prevFiles => 
      prevFiles.map(file => ({ ...file, isSelected: true }))
    )
    
    AsyncStorage.setItem(STORAGE_KEYS.SELECTED_FILES, JSON.stringify([...allFileIds]))
  }, [files])

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set())
    
    setFiles(prevFiles => 
      prevFiles.map(file => ({ ...file, isSelected: false }))
    )
    
    AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_FILES)
  }, [])

  // ============================================================================
  // DOWNLOAD OPERATIONS
  // ============================================================================

  const downloadFile = useCallback(async (file: FileItem) => {
    if (!connectedDevice?.id) return

    try {
      const downloadId = `download_${file.id}_${Date.now()}`
      
      // Update file with download progress
      setFiles(prevFiles => 
        prevFiles.map(f => 
          f.id === file.id 
            ? { ...f, downloadProgress: { progress: 0, bytesReceived: 0, totalBytes: file.size } }
            : f
        )
      )

      // Start download with progress callback
      await blackmagicBluetoothManager.downloadFile(
        connectedDevice.id,
        file.id,
        (progress: DownloadProgress) => {
          setFiles(prevFiles => 
            prevFiles.map(f => 
              f.id === file.id ? { ...f, downloadProgress: progress } : f
            )
          )
        }
      )

      // Download completed
      setFiles(prevFiles => 
        prevFiles.map(f => 
          f.id === file.id ? { ...f, downloadProgress: undefined } : f
        )
      )

      Alert.alert('Success', `Downloaded ${file.name}`)
    } catch (error) {
      console.error('Download failed:', error)
      
      // Clear download progress on error
      setFiles(prevFiles => 
        prevFiles.map(f => 
          f.id === file.id ? { ...f, downloadProgress: undefined } : f
        )
      )
      
      Alert.alert('Download Failed', `Failed to download ${file.name}`)
    }
  }, [connectedDevice])

  const downloadSelectedFiles = useCallback(async () => {
    if (selectedFiles.size === 0) {
      Alert.alert('No Selection', 'Please select files to download')
      return
    }

    const batchId = `batch_${Date.now()}`
    const selectedFileList = files.filter(f => f.isSelected)
    
    const batchOperation: BatchOperation = {
      id: batchId,
      type: 'download',
      fileIds: [...selectedFiles],
      progress: 0,
      status: 'running'
    }

    setBatchOperations(prev => [...prev, batchOperation])

    let completedCount = 0
    const totalCount = selectedFileList.length

    for (const file of selectedFileList) {
      try {
        await downloadFile(file)
        completedCount++
        
        // Update batch progress
        setBatchOperations(prev => 
          prev.map(op => 
            op.id === batchId 
              ? { ...op, progress: (completedCount / totalCount) * 100 }
              : op
          )
        )
      } catch (error) {
        console.error(`Batch download failed for ${file.name}:`, error)
      }
    }

    // Mark batch as completed
    setBatchOperations(prev => 
      prev.map(op => 
        op.id === batchId ? { ...op, status: 'completed', progress: 100 } : op
      )
    )

    Alert.alert('Batch Download Complete', `Downloaded ${completedCount} of ${totalCount} files`)
    clearSelection()
  }, [selectedFiles, files, downloadFile])

  // ============================================================================
  // FILE PREVIEW
  // ============================================================================

  const showFilePreview = useCallback((file: FileItem) => {
    setPreviewModal({ visible: true, file })
  }, [])

  const hideFilePreview = useCallback(() => {
    setPreviewModal({ visible: false })
  }, [])

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const filteredAndSortedFiles = useMemo(() => {
    let filtered = files

    // Apply filter
    if (filterType !== 'all') {
      filtered = filtered.filter(file => file.type === filterType)
    }

    // Apply sort
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'date':
          comparison = new Date(a.modifiedDate).getTime() - new Date(b.modifiedDate).getTime()
          break
        case 'size':
          comparison = a.size - b.size
          break
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [files, filterType, sortBy, sortOrder])

  const selectedCount = selectedFiles.size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const selectedSize = files
    .filter(f => f.isSelected)
    .reduce((sum, file) => sum + file.size, 0)

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderFileItem = useCallback(({ item: file }: { item: FileItem }) => {
    const isImage = BlackmagicBluetoothUtils.isImageFile(file.name)
    const isVideo = BlackmagicBluetoothUtils.isVideoFile(file.name)
    
    return (
      <TouchableOpacity
        style={[
          styles.fileItem,
          viewMode === 'grid' && styles.gridItem,
          file.isSelected && styles.selectedItem
        ]}
        onPress={() => viewMode === 'grid' ? showFilePreview(file) : toggleFileSelection(file.id)}
        onLongPress={() => toggleFileSelection(file.id)}
      >
        {viewMode === 'grid' && file.thumbnail ? (
          <Image source={{ uri: file.thumbnail.uri }} style={styles.thumbnailImage} />
        ) : (
          <View style={styles.fileIcon}>
            <Text style={styles.fileTypeText}>
              {isImage ? '📷' : isVideo ? '🎬' : '📄'}
            </Text>
          </View>
        )}
        
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={viewMode === 'grid' ? 2 : 1}>
            {file.name}
          </Text>
          
          {viewMode === 'list' && (
            <>
              <Text style={styles.fileDetails}>
                {BlackmagicBluetoothUtils.formatFileSize(file.size)} • {file.type.toUpperCase()}
              </Text>
              <Text style={styles.fileDate}>
                {new Date(file.modifiedDate).toLocaleString()}
              </Text>
            </>
          )}
        </View>

        {file.downloadProgress && (
          <View style={styles.downloadProgress}>
            <View 
              style={[
                styles.progressBar, 
                { width: `${file.downloadProgress.progress}%` }
              ]} 
            />
            <Text style={styles.progressText}>
              {Math.round(file.downloadProgress.progress)}%
            </Text>
          </View>
        )}

        {viewMode === 'list' && (
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={() => downloadFile(file)}
            disabled={!!file.downloadProgress}
          >
            <Text style={styles.downloadButtonText}>
              {file.downloadProgress ? 'Downloading...' : 'Download'}
            </Text>
          </TouchableOpacity>
        )}

        {file.isSelected && (
          <View style={styles.selectionIndicator}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }, [viewMode, toggleFileSelection, showFilePreview, downloadFile])

  const renderBatchOperation = useCallback(({ item: operation }: { item: BatchOperation }) => (
    <Card style={styles.batchCard}>
      <View style={styles.batchHeader}>
        <Text style={styles.batchTitle}>
          {operation.type.charAt(0).toUpperCase() + operation.type.slice(1)} Operation
        </Text>
        <Text style={styles.batchStatus}>
          {operation.status.toUpperCase()}
        </Text>
      </View>
      
      <Text style={styles.batchDetails}>
        {operation.fileIds.length} files • {Math.round(operation.progress)}% complete
      </Text>
      
      <View style={styles.batchProgressContainer}>
        <View style={[styles.batchProgressBar, { width: `${operation.progress}%` }]} />
      </View>
      
      {operation.error && (
        <Text style={styles.batchError}>Error: {operation.error}</Text>
      )}
    </Card>
  ), [])

  const renderEmptyState = useCallback(() => {
    if (!isConnected) {
      return (
        <EmptyState
          preset="generic"
          style={styles.emptyState}
          headingText="Camera Not Connected"
          content="Connect to a Blackmagic camera to browse and manage files."
        />
      )
    }

    if (isLoading) {
      return (
        <EmptyState
          preset="generic"
          style={styles.emptyState}
          headingText="Loading Files..."
          content="Please wait while we load files from your camera."
        />
      )
    }

    return (
      <EmptyState
        preset="generic"
        style={styles.emptyState}
        headingText="No Files Found"
        content="No files found on the connected camera."
        button={
          <Button
            text="Refresh"
            onPress={handleRefresh}
            preset="reversed"
          />
        }
      />
    )
  }, [isConnected, isLoading, handleRefresh])

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Screen style={styles.container} preset="fixed">
      <Header
        title="File Manager"
        leftIcon="back"
        rightIcon={viewMode === 'list' ? 'grid' : 'list'}
        onRightPress={() => setViewMode(current => current === 'list' ? 'grid' : 'list')}
      />

      {/* Connection Status */}
      {isConnected && connectedDevice && (
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>{connectedDevice.name || connectedDevice.id}</Text>
              <Text style={styles.fileStats}>
                {files.length} files • {BlackmagicBluetoothUtils.formatFileSize(totalSize)}
              </Text>
            </View>
            
            <Button
              text="Refresh"
              preset="default"
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={isLoading}
            />
          </View>
        </Card>
      )}

      {/* Selection Controls */}
      {selectedCount > 0 && (
        <Card style={styles.selectionCard}>
          <View style={styles.selectionRow}>
            <View>
              <Text style={styles.selectionCount}>
                {selectedCount} selected • {BlackmagicBluetoothUtils.formatFileSize(selectedSize)}
              </Text>
            </View>
            
            <View style={styles.selectionActions}>
              <Button
                text="Download All"
                preset="filled"
                style={styles.batchButton}
                onPress={downloadSelectedFiles}
              />
              <Button
                text="Clear"
                preset="default"
                style={styles.clearButton}
                onPress={clearSelection}
              />
            </View>
          </View>
        </Card>
      )}

      {/* Quick Actions */}
      {isConnected && files.length > 0 && (
        <View style={styles.quickActions}>
          <Button
            text="Select All"
            preset="default"
            style={styles.quickActionButton}
            onPress={selectAllFiles}
            disabled={selectedCount === files.length}
          />
          
          <Button
            text={`Filter: ${filterType === 'all' ? 'All' : filterType.toUpperCase()}`}
            preset="default"
            style={styles.quickActionButton}
            onPress={() => {
              // Cycle through filter types
              const types: (FileType | 'all')[] = ['all', FileType.VIDEO, FileType.IMAGE, FileType.AUDIO]
              const currentIndex = types.indexOf(filterType)
              const nextIndex = (currentIndex + 1) % types.length
              setFilterType(types[nextIndex])
            }}
          />
          
          <Button
            text={`Sort: ${sortBy} ${sortOrder === 'desc' ? '↓' : '↑'}`}
            preset="default"
            style={styles.quickActionButton}
            onPress={() => {
              if (sortBy === 'date') {
                setSortBy('name')
              } else if (sortBy === 'name') {
                setSortBy('size')
              } else {
                setSortBy('date')
                setSortOrder(current => current === 'desc' ? 'asc' : 'desc')
              }
            }}
          />
        </View>
      )}

      {/* File List */}
      <FlashList
        data={filteredAndSortedFiles}
        renderItem={renderFileItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={viewMode === 'list' ? 80 : 120}
        numColumns={viewMode === 'grid' ? 2 : 1}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.palette.primary500}
          />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContainer}
      />

      {/* Batch Operations */}
      {batchOperations.length > 0 && (
        <View style={styles.batchContainer}>
          <Text style={styles.batchSectionTitle}>Operations</Text>
          <FlashList
            data={batchOperations}
            renderItem={renderBatchOperation}
            keyExtractor={(item) => item.id}
            estimatedItemSize={80}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}

      {/* File Preview Modal */}
      <Modal
        visible={previewModal.visible}
        transparent
        animationType="fade"
        onRequestClose={hideFilePreview}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewContainer}>
            <Header
              title={previewModal.file?.name || 'Preview'}
              leftIcon="back"
              onLeftPress={hideFilePreview}
              style={styles.previewHeader}
            />
            
            {previewModal.file && (
              <View style={styles.previewContent}>
                {previewModal.file.thumbnail && (
                  <Image 
                    source={{ uri: previewModal.file.thumbnail.uri }} 
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                )}
                
                <View style={styles.previewDetails}>
                  <Text style={styles.previewFileName}>{previewModal.file.name}</Text>
                  <Text style={styles.previewFileInfo}>
                    {BlackmagicBluetoothUtils.formatFileSize(previewModal.file.size)} • {previewModal.file.type.toUpperCase()}
                  </Text>
                  <Text style={styles.previewFileDate}>
                    Modified: {new Date(previewModal.file.modifiedDate).toLocaleString()}
                  </Text>
                </View>
                
                <View style={styles.previewActions}>
                  <Button
                    text="Download"
                    preset="filled"
                    style={styles.previewDownloadButton}
                    onPress={() => {
                      downloadFile(previewModal.file!)
                      hideFilePreview()
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,

  statusCard: {
    margin: spacing.md,
    marginBottom: spacing.sm
  } as ViewStyle,

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,

  deviceInfo: {
    flex: 1,
  } as ViewStyle,

  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xxs,
  } as TextStyle,

  fileStats: {
    fontSize: 14,
    color: colors.textDim,
  } as TextStyle,

  refreshButton: {
    minWidth: 80,
  } as ViewStyle,

  selectionCard: {
    margin: spacing.md,
    marginTop: 0,
    marginBottom: spacing.sm,
    backgroundColor: colors.palette.primary100,
  } as ViewStyle,

  selectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,

  selectionCount: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.palette.primary700,
  } as TextStyle,

  selectionActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  } as ViewStyle,

  batchButton: {
    minWidth: 100,
  } as ViewStyle,

  clearButton: {
    minWidth: 60,
  } as ViewStyle,

  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  } as ViewStyle,

  quickActionButton: {
    flex: 1,
    minHeight: 36,
  } as ViewStyle,

  listContainer: {
    paddingTop: spacing.sm,
  } as ViewStyle,

  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    minHeight: 80,
  } as ViewStyle,

  gridItem: {
    flex: 1,
    flexDirection: 'column',
    margin: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.separator,
    minHeight: 120,
  } as ViewStyle,

  selectedItem: {
    backgroundColor: colors.palette.primary50,
    borderColor: colors.palette.primary200,
  } as ViewStyle,

  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.palette.neutral200,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  } as ViewStyle,

  fileTypeText: {
    fontSize: 24,
  } as TextStyle,

  thumbnailImage: {
    width: '100%',
    height: 80,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  } as ViewStyle,

  fileInfo: {
    flex: 1,
  } as ViewStyle,

  fileName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: spacing.xxs,
  } as TextStyle,

  fileDetails: {
    fontSize: 14,
    color: colors.textDim,
    marginBottom: spacing.xxs,
  } as TextStyle,

  fileDate: {
    fontSize: 12,
    color: colors.textDim,
  } as TextStyle,

  downloadProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: colors.palette.neutral100,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.palette.primary500,
  } as ViewStyle,

  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  } as TextStyle,

  downloadButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.palette.primary600,
    borderRadius: 4,
  } as ViewStyle,

  downloadButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.palette.primary100,
  } as TextStyle,

  selectionIndicator: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.palette.primary600,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.palette.primary100,
  } as TextStyle,

  batchContainer: {
    padding: spacing.md,
    backgroundColor: colors.palette.neutral50,
  } as ViewStyle,

  batchSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  } as TextStyle,

  batchCard: {
    width: 280,
    marginRight: spacing.sm,
  } as ViewStyle,

  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  } as ViewStyle,

  batchTitle: {
    fontSize: 14,
    fontWeight: '600',
  } as TextStyle,

  batchStatus: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.palette.primary600,
  } as TextStyle,

  batchDetails: {
    fontSize: 12,
    color: colors.textDim,
    marginBottom: spacing.sm,
  } as TextStyle,

  batchProgressContainer: {
    height: 4,
    backgroundColor: colors.palette.neutral200,
    borderRadius: 2,
  } as ViewStyle,

  batchProgressBar: {
    height: '100%',
    backgroundColor: colors.palette.primary600,
    borderRadius: 2,
  } as ViewStyle,

  batchError: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
  } as TextStyle,

  emptyState: {
    paddingTop: spacing.xl,
  } as ViewStyle,

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  previewContainer: {
    width: '90%',
    height: '80%',
    backgroundColor: colors.background,
    borderRadius: 12,
    overflow: 'hidden',
  } as ViewStyle,

  previewHeader: {
    backgroundColor: colors.palette.neutral800,
  } as ViewStyle,

  previewContent: {
    flex: 1,
    padding: spacing.md,
  } as ViewStyle,

  previewImage: {
    flex: 1,
    width: '100%',
    marginBottom: spacing.md,
  } as ViewStyle,

  previewDetails: {
    paddingVertical: spacing.sm,
  } as ViewStyle,

  previewFileName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  } as TextStyle,

  previewFileInfo: {
    fontSize: 14,
    color: colors.textDim,
    marginBottom: spacing.xs,
  } as TextStyle,

  previewFileDate: {
    fontSize: 12,
    color: colors.textDim,
  } as TextStyle,

  previewActions: {
    paddingTop: spacing.md,
  } as ViewStyle,

  previewDownloadButton: {
    width: '100%',
  } as ViewStyle,
})