/**
 * Camera Control Panel Component
 * 
 * Provides camera control interface for connected Blackmagic cameras
 */

import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { Button } from '../Button'
import { Text } from '../Text'
import { 
  RecordingState, 
  CameraSettings,
  FrameRate,
  Resolution,
  Codec,
  ColorSpace,
  DEFAULT_BUTTON_MAPPINGS,
  BlackmagicDeviceInfo
} from '../../services/bluetooth'
import { colors, spacing } from '../../theme'

export interface CameraControlPanelProps {
  device?: BlackmagicDeviceInfo
  isConnected: boolean
  onStartRecording?: (deviceId: string) => Promise<void>
  onStopRecording?: (deviceId: string) => Promise<void>
  onToggleRecording?: (deviceId: string) => Promise<void>
  onSetAutoFocus?: (deviceId: string) => Promise<void>
  onSetAutoExposure?: (deviceId: string) => Promise<void>
  onSetAutoISO?: (deviceId: string) => Promise<void>
  onSetAutoWhiteBalance?: (deviceId: string) => Promise<void>
  onGetCameraSettings?: (deviceId: string) => Promise<CameraSettings>
  settings?: CameraSettings
}

export const CameraControlPanel: React.FC<CameraControlPanelProps> = ({
  device,
  isConnected,
  onStartRecording,
  onStopRecording,
  onToggleRecording,
  onSetAutoFocus,
  onSetAutoExposure,
  onSetAutoISO,
  onSetAutoWhiteBalance,
  onGetCameraSettings,
  settings
}) => {
  const [cameraSettings, setCameraSettings] = useState<CameraSettings | undefined>(settings)
  const [isLoading, setIsLoading] = useState(false)

  // Update internal state when props change
  useEffect(() => {
    setCameraSettings(settings)
  }, [settings])

  // Load camera settings when device connects
  useEffect(() => {
    if (device && isConnected && onGetCameraSettings && !cameraSettings) {
      loadCameraSettings()
    }
  }, [device, isConnected])

  const loadCameraSettings = async () => {
    if (!device?.id || !onGetCameraSettings) return

    try {
      setIsLoading(true)
      const settings = await onGetCameraSettings(device.id)
      setCameraSettings(settings)
    } catch (error) {
      console.error('Failed to load camera settings:', error)
      Alert.alert('Error', 'Failed to load camera settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecordingControl = async (action: 'start' | 'stop' | 'toggle') => {
    if (!device?.id || !isConnected) {
      Alert.alert('Error', 'No camera connected')
      return
    }

    try {
      setIsLoading(true)
      
      switch (action) {
        case 'start':
          await onStartRecording?.(device.id)
          break
        case 'stop':
          await onStopRecording?.(device.id)
          break
        case 'toggle':
          await onToggleRecording?.(device.id)
          break
      }

      // Refresh settings after recording action
      await loadCameraSettings()
    } catch (error) {
      console.error(`Failed to ${action} recording:`, error)
      Alert.alert('Error', `Failed to ${action} recording`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAutoControl = async (control: 'focus' | 'exposure' | 'iso' | 'whiteBalance') => {
    if (!device?.id || !isConnected) {
      Alert.alert('Error', 'No camera connected')
      return
    }

    try {
      setIsLoading(true)

      switch (control) {
        case 'focus':
          await onSetAutoFocus?.(device.id)
          break
        case 'exposure':
          await onSetAutoExposure?.(device.id)
          break
        case 'iso':
          await onSetAutoISO?.(device.id)
          break
        case 'whiteBalance':
          await onSetAutoWhiteBalance?.(device.id)
          break
      }

      // Refresh settings after control action
      await loadCameraSettings()
    } catch (error) {
      console.error(`Failed to set auto ${control}:`, error)
      Alert.alert('Error', `Failed to set auto ${control}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getRecordingButtonStyle = () => {
    const isRecording = cameraSettings?.recordingState === RecordingState.RECORDING
    const isStarting = cameraSettings?.recordingState === RecordingState.STARTING
    
    if (isRecording) {
      return { backgroundColor: colors.error }
    } else if (isStarting) {
      return { backgroundColor: colors.palette.orange400 }
    } else {
      return { backgroundColor: colors.palette.primary600 }
    }
  }

  const getRecordingButtonText = () => {
    switch (cameraSettings?.recordingState) {
      case RecordingState.RECORDING:
        return 'Stop Recording'
      case RecordingState.STARTING:
        return 'Starting...'
      case RecordingState.STOPPING:
        return 'Stopping...'
      default:
        return 'Start Recording'
    }
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera Control</Text>
        <Text style={styles.message}>No camera selected</Text>
      </View>
    )
  }

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera Control</Text>
        <Text style={styles.deviceName}>{device.name || device.id}</Text>
        <Text style={styles.message}>Camera not connected</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Camera Control</Text>
      <Text style={styles.deviceName}>{device.name || device.id}</Text>

      {/* Recording Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recording</Text>
        <View style={styles.buttonRow}>
          <Button
            style={[styles.button, getRecordingButtonStyle()]}
            textStyle={styles.buttonText}
            onPress={() => handleRecordingControl('toggle')}
            disabled={isLoading || cameraSettings?.recordingState === RecordingState.STARTING || cameraSettings?.recordingState === RecordingState.STOPPING}
          >
            {getRecordingButtonText()}
          </Button>
        </View>
      </View>

      {/* Auto Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Auto Controls</Text>
        <View style={styles.buttonGrid}>
          <Button
            style={styles.autoButton}
            textStyle={styles.autoButtonText}
            onPress={() => handleAutoControl('focus')}
            disabled={isLoading}
          >
            Auto Focus
          </Button>
          <Button
            style={styles.autoButton}
            textStyle={styles.autoButtonText}
            onPress={() => handleAutoControl('exposure')}
            disabled={isLoading}
          >
            Auto Exposure
          </Button>
          <Button
            style={styles.autoButton}
            textStyle={styles.autoButtonText}
            onPress={() => handleAutoControl('iso')}
            disabled={isLoading}
          >
            Auto ISO
          </Button>
          <Button
            style={styles.autoButton}
            textStyle={styles.autoButtonText}
            onPress={() => handleAutoControl('whiteBalance')}
            disabled={isLoading}
          >
            Auto WB
          </Button>
        </View>
      </View>

      {/* Camera Status */}
      {cameraSettings && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Recording:</Text>
            <Text style={[styles.statusValue, getRecordingStatusStyle()]}>
              {cameraSettings.recordingState.toUpperCase()}
            </Text>
          </View>
          {cameraSettings.frameRate && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Frame Rate:</Text>
              <Text style={styles.statusValue}>{cameraSettings.frameRate} fps</Text>
            </View>
          )}
          {cameraSettings.resolution && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Resolution:</Text>
              <Text style={styles.statusValue}>{cameraSettings.resolution}</Text>
            </View>
          )}
          {cameraSettings.codec && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Codec:</Text>
              <Text style={styles.statusValue}>{cameraSettings.codec}</Text>
            </View>
          )}
          {device.batteryLevel !== undefined && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Battery:</Text>
              <Text style={styles.statusValue}>{device.batteryLevel}%</Text>
            </View>
          )}
        </View>
      )}

      {/* Refresh Button */}
      <View style={styles.section}>
        <Button
          style={styles.refreshButton}
          textStyle={styles.refreshButtonText}
          onPress={loadCameraSettings}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh Settings'}
        </Button>
      </View>
    </View>
  )

  function getRecordingStatusStyle() {
    switch (cameraSettings?.recordingState) {
      case RecordingState.RECORDING:
        return { color: colors.error }
      case RecordingState.STARTING:
      case RecordingState.STOPPING:
        return { color: colors.palette.orange400 }
      default:
        return { color: colors.text }
    }
  }
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
    margin: spacing.sm
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
    textAlign: 'center'
  },
  deviceName: {
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    marginBottom: spacing.md
  },
  message: {
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    fontStyle: 'italic'
  },
  section: {
    marginBottom: spacing.lg
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.text
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  button: {
    minWidth: 140,
    paddingVertical: spacing.sm
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600'
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  autoButton: {
    width: '48%',
    marginBottom: spacing.xs,
    backgroundColor: colors.palette.neutral300
  },
  autoButtonText: {
    fontSize: 14,
    color: colors.palette.neutral800
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs
  },
  statusLabel: {
    fontSize: 14,
    color: colors.textDim
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text
  },
  refreshButton: {
    backgroundColor: colors.palette.secondary500
  },
  refreshButtonText: {
    color: colors.palette.secondary100
  }
})