/**
 * Camera Control Screen
 * 
 * Comprehensive screen for controlling connected Blackmagic cameras
 * Phase 7.2 Implementation: Recording controls, camera settings panels,
 * live status display, and quick access buttons
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  StyleSheet,
  Alert,
  RefreshControl,
  ViewStyle,
  TextStyle,
  ScrollView,
  Dimensions,
  Pressable
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { Text } from '../components/Text'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { Header } from '../components/Header'
import { Card } from '../components/Card'
import { Toggle } from '../components/Toggle'
import { CameraControlPanel } from '../components/bluetooth/CameraControlPanel'

import { blackmagicBluetoothManager } from '../services/bluetooth/BlackmagicBluetoothManager'
import { useCameraControl } from '../context/CameraControlContext'

import {
  ConnectionState,
  ConnectedDevice,
  RecordingState,
  CameraSettings,
  FrameRate,
  Resolution,
  Codec,
  ColorSpace,
  BlackmagicDeviceInfo,
  CameraStatus,
  CameraMode
} from '../services/bluetooth/types/BlackmagicTypes'

import { colors, spacing } from '../theme'

const { width } = Dimensions.get('window')
const cardWidth = (width - spacing.lg * 3) / 2

interface QuickAccessButton {
  id: string
  label: string
  icon: string
  action: () => Promise<void>
  disabled?: boolean
  style?: ViewStyle
}

export const CameraControlScreen: React.FC = () => {
  // Connection State
  const [connectedDevice, setConnectedDevice] = useState<ConnectedDevice | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  )
  
  // Camera State
  const [cameraSettings, setCameraSettings] = useState<CameraSettings | null>(null)
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  
  // UI State
  const [selectedTab, setSelectedTab] = useState<'controls' | 'settings' | 'status'>('controls')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Camera control context
  const cameraControlContext = useCameraControl()

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    initializeScreen()
    return cleanup
  }, [])

  useEffect(() => {
    // Auto-refresh every 5 seconds if enabled and connected
    let interval: NodeJS.Timeout | null = null
    
    if (autoRefresh && connectionState === ConnectionState.CONNECTED && connectedDevice) {
      interval = setInterval(() => {
        refreshCameraData()
      }, 5000)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [autoRefresh, connectionState, connectedDevice])

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initializeScreen = useCallback(async () => {
    try {
      // Get current connection state
      const currentConnectionState = blackmagicBluetoothManager.getConnectionState()
      setConnectionState(currentConnectionState)
      
      const currentConnectedDevice = blackmagicBluetoothManager.getConnectedDevice()
      setConnectedDevice(currentConnectedDevice)

      // Set up event listeners
      const unsubscribeConnectionState = blackmagicBluetoothManager.onConnectionStateChange(
        handleConnectionStateChange
      )
      
      const unsubscribeCameraStatus = blackmagicBluetoothManager.onCameraStatusChange?.(
        handleCameraStatusChange
      )

      // Load initial data if connected
      if (currentConnectionState === ConnectionState.CONNECTED && currentConnectedDevice) {
        await refreshCameraData()
      }

      // Store cleanup function
      cleanup.current = () => {
        unsubscribeConnectionState()
        unsubscribeCameraStatus?.()
      }
    } catch (error) {
      console.error('Failed to initialize camera control screen:', error)
      Alert.alert('Error', 'Failed to initialize camera control')
    }
  }, [])

  const cleanup = useCallback(() => {
    // Cleanup is handled by the stored function
  }, [])

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleConnectionStateChange = useCallback((state: ConnectionState) => {
    setConnectionState(state)
    
    if (state === ConnectionState.CONNECTED) {
      const device = blackmagicBluetoothManager.getConnectedDevice()
      setConnectedDevice(device)
      if (device) {
        refreshCameraData()
      }
    } else if (state === ConnectionState.DISCONNECTED) {
      setConnectedDevice(null)
      setCameraSettings(null)
      setCameraStatus(null)
    }
  }, [])

  const handleCameraStatusChange = useCallback((status: CameraStatus) => {
    setCameraStatus(status)
  }, [])

  // ============================================================================
  // DATA MANAGEMENT
  // ============================================================================

  const refreshCameraData = useCallback(async () => {
    if (!connectedDevice) return

    try {
      setIsLoading(true)
      
      // Fetch all camera data in parallel
      const [settings, status] = await Promise.allSettled([
        blackmagicBluetoothManager.getCameraSettings(connectedDevice.id),
        blackmagicBluetoothManager.getCameraStatus?.(connectedDevice.id)
      ])

      if (settings.status === 'fulfilled') {
        setCameraSettings(settings.value)
      } else {
        console.error('Failed to get camera settings:', settings.reason)
      }

      if (status.status === 'fulfilled' && status.value) {
        setCameraStatus(status.value)
      }
    } catch (error) {
      console.error('Failed to refresh camera data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [connectedDevice])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshCameraData()
    setRefreshing(false)
  }, [refreshCameraData])

  // ============================================================================
  // CAMERA CONTROL ACTIONS
  // ============================================================================

  const handleStartRecording = useCallback(async (deviceId: string) => {
    try {
      await blackmagicBluetoothManager.startRecording(deviceId)
      await refreshCameraData()
    } catch (error) {
      console.error('Failed to start recording:', error)
      throw error
    }
  }, [refreshCameraData])

  const handleStopRecording = useCallback(async (deviceId: string) => {
    try {
      await blackmagicBluetoothManager.stopRecording(deviceId)
      await refreshCameraData()
    } catch (error) {
      console.error('Failed to stop recording:', error)
      throw error
    }
  }, [refreshCameraData])

  const handleToggleRecording = useCallback(async (deviceId: string) => {
    try {
      await blackmagicBluetoothManager.toggleRecording(deviceId)
      await refreshCameraData()
    } catch (error) {
      console.error('Failed to toggle recording:', error)
      throw error
    }
  }, [refreshCameraData])

  const handleAutoFocus = useCallback(async (deviceId: string) => {
    try {
      await blackmagicBluetoothManager.setAutoFocus(deviceId)
      await refreshCameraData()
    } catch (error) {
      console.error('Failed to set auto focus:', error)
      throw error
    }
  }, [refreshCameraData])

  const handleAutoExposure = useCallback(async (deviceId: string) => {
    try {
      await blackmagicBluetoothManager.setAutoExposure(deviceId)
      await refreshCameraData()
    } catch (error) {
      console.error('Failed to set auto exposure:', error)
      throw error
    }
  }, [refreshCameraData])

  const handleAutoISO = useCallback(async (deviceId: string) => {
    try {
      await blackmagicBluetoothManager.setAutoISO(deviceId)
      await refreshCameraData()
    } catch (error) {
      console.error('Failed to set auto ISO:', error)
      throw error
    }
  }, [refreshCameraData])

  const handleAutoWhiteBalance = useCallback(async (deviceId: string) => {
    try {
      await blackmagicBluetoothManager.setAutoWhiteBalance(deviceId)
      await refreshCameraData()
    } catch (error) {
      console.error('Failed to set auto white balance:', error)
      throw error
    }
  }, [refreshCameraData])

  const handleGetCameraSettings = useCallback(async (deviceId: string): Promise<CameraSettings> => {
    try {
      const settings = await blackmagicBluetoothManager.getCameraSettings(deviceId)
      setCameraSettings(settings)
      return settings
    } catch (error) {
      console.error('Failed to get camera settings:', error)
      throw error
    }
  }, [])

  // ============================================================================
  // QUICK ACCESS ACTIONS
  // ============================================================================

  const getQuickAccessButtons = useCallback((): QuickAccessButton[] => {
    if (!connectedDevice) return []

    return [
      {
        id: 'record',
        label: cameraSettings?.recordingState === RecordingState.RECORDING ? 'Stop' : 'Record',
        icon: cameraSettings?.recordingState === RecordingState.RECORDING ? 'stop' : 'recording',
        action: () => handleToggleRecording(connectedDevice.id),
        style: {
          backgroundColor: cameraSettings?.recordingState === RecordingState.RECORDING 
            ? colors.error 
            : colors.palette.primary600
        }
      },
      {
        id: 'focus',
        label: 'Auto Focus',
        icon: 'target',
        action: () => handleAutoFocus(connectedDevice.id)
      },
      {
        id: 'exposure',
        label: 'Auto Exposure',
        icon: 'aperture',
        action: () => handleAutoExposure(connectedDevice.id)
      },
      {
        id: 'iso',
        label: 'Auto ISO',
        icon: 'iso',
        action: () => handleAutoISO(connectedDevice.id)
      },
      {
        id: 'wb',
        label: 'Auto WB',
        icon: 'wb',
        action: () => handleAutoWhiteBalance(connectedDevice.id)
      },
      {
        id: 'refresh',
        label: 'Refresh',
        icon: 'refresh',
        action: async () => {
          await refreshCameraData()
        }
      }
    ]
  }, [
    connectedDevice,
    cameraSettings,
    handleToggleRecording,
    handleAutoFocus,
    handleAutoExposure,
    handleAutoISO,
    handleAutoWhiteBalance,
    refreshCameraData
  ])

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderConnectionStatus = useCallback(() => {
    if (connectionState !== ConnectionState.CONNECTED || !connectedDevice) {
      return (
        <Card style={styles.statusCard}>
          <View style={styles.disconnectedContainer}>
            <Text style={styles.disconnectedTitle}>Camera Not Connected</Text>
            <Text style={styles.disconnectedMessage}>
              Connect to a Blackmagic camera to access camera controls
            </Text>
          </View>
        </Card>
      )
    }

    return (
      <Card style={styles.statusCard}>
        <View style={styles.connectedHeader}>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>
              {connectedDevice.name || 'Blackmagic Camera'}
            </Text>
            <Text style={styles.deviceId}>{connectedDevice.id}</Text>
          </View>
          <View style={styles.connectionIndicator}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedText}>Connected</Text>
          </View>
        </View>
        
        {cameraStatus && (
          <View style={styles.liveStatusContainer}>
            <Text style={styles.sectionTitle}>Live Status</Text>
            <View style={styles.statusGrid}>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Recording</Text>
                <Text style={[
                  styles.statusValue,
                  { color: cameraStatus.isRecording ? colors.error : colors.text }
                ]}>
                  {cameraStatus.isRecording ? 'REC' : 'IDLE'}
                </Text>
              </View>
              
              {cameraStatus.batteryLevel !== undefined && (
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Battery</Text>
                  <Text style={[
                    styles.statusValue,
                    { color: cameraStatus.batteryLevel < 20 ? colors.error : colors.text }
                  ]}>
                    {cameraStatus.batteryLevel}%
                  </Text>
                </View>
              )}
              
              {cameraStatus.storageRemaining !== undefined && (
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Storage</Text>
                  <Text style={styles.statusValue}>
                    {Math.round(cameraStatus.storageRemaining / 1024 / 1024 / 1024)}GB
                  </Text>
                </View>
              )}
              
              {cameraStatus.temperature !== undefined && (
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Temp</Text>
                  <Text style={[
                    styles.statusValue,
                    { color: cameraStatus.temperature > 70 ? colors.error : colors.text }
                  ]}>
                    {cameraStatus.temperature}°C
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </Card>
    )
  }, [connectionState, connectedDevice, cameraStatus])

  const renderQuickAccessButtons = useCallback(() => {
    const buttons = getQuickAccessButtons()
    
    return (
      <Card style={styles.quickAccessCard}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickAccessGrid}>
          {buttons.map((button) => (
            <Pressable
              key={button.id}
              style={[styles.quickAccessButton, button.style]}
              onPress={button.action}
              disabled={button.disabled || isLoading}
            >
              <Text style={styles.quickAccessButtonText}>
                {button.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>
    )
  }, [getQuickAccessButtons, isLoading])

  const renderTabContent = useCallback(() => {
    if (connectionState !== ConnectionState.CONNECTED || !connectedDevice) {
      return null
    }

    switch (selectedTab) {
      case 'controls':
        return (
          <CameraControlPanel
            device={connectedDevice}
            isConnected={true}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onToggleRecording={handleToggleRecording}
            onSetAutoFocus={handleAutoFocus}
            onSetAutoExposure={handleAutoExposure}
            onSetAutoISO={handleAutoISO}
            onSetAutoWhiteBalance={handleAutoWhiteBalance}
            onGetCameraSettings={handleGetCameraSettings}
            settings={cameraSettings || undefined}
          />
        )
      
      case 'settings':
        return renderCameraSettings()
      
      case 'status':
        return renderDetailedStatus()
      
      default:
        return null
    }
  }, [
    selectedTab,
    connectionState,
    connectedDevice,
    cameraSettings,
    handleStartRecording,
    handleStopRecording,
    handleToggleRecording,
    handleAutoFocus,
    handleAutoExposure,
    handleAutoISO,
    handleAutoWhiteBalance,
    handleGetCameraSettings
  ])

  const renderCameraSettings = useCallback(() => {
    return (
      <Card style={styles.settingsCard}>
        <Text style={styles.sectionTitle}>Camera Settings</Text>
        {cameraSettings ? (
          <View style={styles.settingsGrid}>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Frame Rate</Text>
              <Text style={styles.settingValue}>
                {cameraSettings.frameRate || 'Unknown'} fps
              </Text>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Resolution</Text>
              <Text style={styles.settingValue}>
                {cameraSettings.resolution || 'Unknown'}
              </Text>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Codec</Text>
              <Text style={styles.settingValue}>
                {cameraSettings.codec || 'Unknown'}
              </Text>
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Color Space</Text>
              <Text style={styles.settingValue}>
                {cameraSettings.colorSpace || 'Unknown'}
              </Text>
            </View>
            
            {cameraSettings.iso !== undefined && (
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>ISO</Text>
                <Text style={styles.settingValue}>{cameraSettings.iso}</Text>
              </View>
            )}
            
            {cameraSettings.shutterSpeed !== undefined && (
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Shutter Speed</Text>
                <Text style={styles.settingValue}>1/{cameraSettings.shutterSpeed}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.placeholderText}>
            {isLoading ? 'Loading settings...' : 'Settings not available'}
          </Text>
        )}
      </Card>
    )
  }, [cameraSettings, isLoading])

  const renderDetailedStatus = useCallback(() => {
    return (
      <Card style={styles.statusCard}>
        <Text style={styles.sectionTitle}>Detailed Status</Text>
        {cameraStatus ? (
          <View style={styles.statusDetails}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Recording State</Text>
              <Text style={[
                styles.statusValue,
                { color: cameraStatus.isRecording ? colors.error : colors.text }
              ]}>
                {cameraStatus.isRecording ? 'Recording' : 'Idle'}
              </Text>
            </View>
            
            {cameraStatus.recordingTime !== undefined && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Recording Time</Text>
                <Text style={styles.statusValue}>
                  {Math.floor(cameraStatus.recordingTime / 60)}:
                  {(cameraStatus.recordingTime % 60).toString().padStart(2, '0')}
                </Text>
              </View>
            )}
            
            {cameraStatus.batteryLevel !== undefined && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Battery Level</Text>
                <Text style={styles.statusValue}>{cameraStatus.batteryLevel}%</Text>
              </View>
            )}
            
            {cameraStatus.storageRemaining !== undefined && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Storage Remaining</Text>
                <Text style={styles.statusValue}>
                  {Math.round(cameraStatus.storageRemaining / 1024 / 1024 / 1024)} GB
                </Text>
              </View>
            )}
            
            {cameraStatus.temperature !== undefined && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Temperature</Text>
                <Text style={styles.statusValue}>{cameraStatus.temperature}°C</Text>
              </View>
            )}
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Last Updated</Text>
              <Text style={styles.statusValue}>
                {new Date().toLocaleTimeString()}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.placeholderText}>
            {isLoading ? 'Loading status...' : 'Status not available'}
          </Text>
        )}
      </Card>
    )
  }, [cameraStatus, isLoading])

  const renderTabButtons = useCallback(() => {
    const tabs = [
      { id: 'controls' as const, label: 'Controls' },
      { id: 'settings' as const, label: 'Settings' },
      { id: 'status' as const, label: 'Status' }
    ]

    return (
      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[
              styles.tabButton,
              selectedTab === tab.id && styles.activeTabButton
            ]}
            onPress={() => setSelectedTab(tab.id)}
          >
            <Text style={[
              styles.tabButtonText,
              selectedTab === tab.id && styles.activeTabButtonText
            ]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    )
  }, [selectedTab])

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Screen style={styles.container} preset="fixed">
      <Header
        title="Camera Control"
        rightIcon="refresh"
        onRightPress={handleRefresh}
      />
      
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.palette.primary500}
          />
        }
      >
        <View style={styles.content}>
          {/* Connection Status */}
          {renderConnectionStatus()}
          
          {/* Quick Access Buttons */}
          {connectionState === ConnectionState.CONNECTED && renderQuickAccessButtons()}
          
          {/* Auto-Refresh Toggle */}
          {connectionState === ConnectionState.CONNECTED && (
            <Card style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Auto-Refresh</Text>
                  <Text style={styles.settingDescription}>
                    Automatically refresh camera status every 5 seconds
                  </Text>
                </View>
                <Toggle
                  value={autoRefresh}
                  onValueChange={setAutoRefresh}
                  variant="switch"
                />
              </View>
            </Card>
          )}
          
          {/* Tab Navigation */}
          {connectionState === ConnectionState.CONNECTED && renderTabButtons()}
          
          {/* Tab Content */}
          {renderTabContent()}
        </View>
      </ScrollView>
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

  scrollContainer: {
    flex: 1,
  } as ViewStyle,

  content: {
    padding: spacing.md,
    gap: spacing.md,
  } as ViewStyle,

  statusCard: {
    padding: spacing.md,
  } as ViewStyle,

  disconnectedContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  } as ViewStyle,

  disconnectedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  } as TextStyle,

  disconnectedMessage: {
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
  } as TextStyle,

  connectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  } as ViewStyle,

  deviceInfo: {
    flex: 1,
  } as ViewStyle,

  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xxs,
  } as TextStyle,

  deviceId: {
    fontSize: 12,
    color: colors.textDim,
    fontFamily: 'mono',
  } as TextStyle,

  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  } as ViewStyle,

  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.palette.success500,
  } as ViewStyle,

  connectedText: {
    fontSize: 12,
    color: colors.palette.success500,
    fontWeight: '500',
  } as TextStyle,

  liveStatusContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  } as ViewStyle,

  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  } as ViewStyle,

  statusItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  } as ViewStyle,

  statusLabel: {
    fontSize: 12,
    color: colors.textDim,
    marginBottom: spacing.xxs,
  } as TextStyle,

  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  } as TextStyle,

  quickAccessCard: {
    padding: spacing.md,
  } as ViewStyle,

  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  } as ViewStyle,

  quickAccessButton: {
    width: cardWidth,
    height: 60,
    backgroundColor: colors.palette.neutral300,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  quickAccessButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.palette.neutral800,
  } as TextStyle,

  settingsCard: {
    padding: spacing.md,
  } as ViewStyle,

  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,

  settingText: {
    flex: 1,
    marginRight: spacing.md,
  } as ViewStyle,

  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xxs,
  } as TextStyle,

  settingDescription: {
    fontSize: 12,
    color: colors.textDim,
  } as TextStyle,

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.palette.neutral200,
    borderRadius: 8,
    padding: 4,
  } as ViewStyle,

  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 4,
  } as ViewStyle,

  activeTabButton: {
    backgroundColor: colors.palette.primary500,
  } as ViewStyle,

  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textDim,
  } as TextStyle,

  activeTabButtonText: {
    color: colors.palette.neutral100,
  } as TextStyle,

  settingsGrid: {
    gap: spacing.md,
  } as ViewStyle,

  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  } as ViewStyle,

  settingLabel: {
    fontSize: 14,
    color: colors.textDim,
  } as TextStyle,

  settingValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  } as TextStyle,

  statusDetails: {
    gap: spacing.sm,
  } as ViewStyle,

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  } as ViewStyle,

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  } as TextStyle,

  placeholderText: {
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: spacing.lg,
  } as TextStyle,
})