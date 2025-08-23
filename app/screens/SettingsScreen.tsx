/**
 * Settings Screen
 * 
 * Phase 7.4 - Settings Screen Implementation
 * - Bluetooth settings and configuration
 * - Camera preferences and defaults
 * - App preferences and behavior settings
 * - About section with device/app information
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  StyleSheet,
  Alert,
  Switch,
  ScrollView,
  ViewStyle,
  TextStyle,
  Linking,
  Share,
  Platform
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import DeviceInfo from 'react-native-device-info'

import { Screen } from '../components/Screen'
import { Header } from '../components/Header'
import { Text } from '../components/Text'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ListItem } from '../components/ListItem'

import { blackmagicBluetoothManager } from '../services/bluetooth/BlackmagicBluetoothManager'
import {
  BlackmagicDeviceInfo,
  BluetoothAdapterState,
  BluetoothPermissionState,
  CameraSettings,
  FrameRate,
  Resolution,
  Codec
} from '../services/bluetooth/types/BlackmagicTypes'

import { colors, spacing } from '../theme'

// Storage keys
const STORAGE_KEYS = {
  BLUETOOTH_SETTINGS: 'settings_bluetooth',
  CAMERA_PREFERENCES: 'settings_camera',
  APP_PREFERENCES: 'settings_app',
  ANALYTICS_ENABLED: 'settings_analytics',
  CRASH_REPORTING: 'settings_crashReporting'
}

// Types
interface BluetoothSettings {
  autoConnect: boolean
  autoScan: boolean
  scanDuration: number // seconds
  connectionTimeout: number // seconds
  keepConnectedInBackground: boolean
  showAllDevices: boolean
  enableDebugLogging: boolean
}

interface CameraPreferences {
  defaultFrameRate: FrameRate
  defaultResolution: Resolution
  defaultCodec: Codec
  autoStartRecording: boolean
  autoStopRecording: boolean
  recordingTimeout: number // minutes
  enableTimecode: boolean
  timecodeFormat: '24' | '25' | '29.97' | '30'
  audioRecording: boolean
  audioSampleRate: 48000 | 96000
}

interface AppPreferences {
  theme: 'light' | 'dark' | 'system'
  language: 'en' | 'es' | 'fr' | 'de' | 'ja'
  hapticFeedback: boolean
  soundEffects: boolean
  showTutorials: boolean
  enableAnalytics: boolean
  enableCrashReporting: boolean
  autoUpdateCheck: boolean
  downloadQuality: 'original' | 'optimized'
}

interface DeviceInfoData {
  appName: string
  appVersion: string
  buildNumber: string
  bundleId: string
  systemName: string
  systemVersion: string
  deviceModel: string
  deviceId: string
  isEmulator: boolean
  hasNotch: boolean
  batteryLevel: number
  diskSpace: {
    free: number
    total: number
  }
}

export const SettingsScreen: React.FC = () => {
  // State
  const [connectedDevice, setConnectedDevice] = useState<BlackmagicDeviceInfo | undefined>()
  const [isConnected, setIsConnected] = useState(false)
  const [bluetoothState, setBluetoothState] = useState<BluetoothAdapterState>(BluetoothAdapterState.UNKNOWN)
  const [permissionState, setPermissionState] = useState<BluetoothPermissionState>(BluetoothPermissionState.UNKNOWN)
  
  const [bluetoothSettings, setBluetoothSettings] = useState<BluetoothSettings>({
    autoConnect: true,
    autoScan: false,
    scanDuration: 30,
    connectionTimeout: 10,
    keepConnectedInBackground: true,
    showAllDevices: false,
    enableDebugLogging: false
  })
  
  const [cameraPreferences, setCameraPreferences] = useState<CameraPreferences>({
    defaultFrameRate: FrameRate.FPS_24,
    defaultResolution: Resolution.UHD_4K,
    defaultCodec: Codec.PRORES_422,
    autoStartRecording: false,
    autoStopRecording: false,
    recordingTimeout: 60,
    enableTimecode: true,
    timecodeFormat: '24',
    audioRecording: true,
    audioSampleRate: 48000
  })
  
  const [appPreferences, setAppPreferences] = useState<AppPreferences>({
    theme: 'system',
    language: 'en',
    hapticFeedback: true,
    soundEffects: true,
    showTutorials: true,
    enableAnalytics: true,
    enableCrashReporting: true,
    autoUpdateCheck: true,
    downloadQuality: 'original'
  })
  
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfoData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    initializeSettings()
    loadDeviceInfo()
    
    return cleanup
  }, [])

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initializeSettings = useCallback(async () => {
    try {
      // Get current connection state
      const currentDevice = blackmagicBluetoothManager.getConnectedDevice()
      const connectionState = blackmagicBluetoothManager.isConnected()
      const btState = blackmagicBluetoothManager.getBluetoothState()
      const permissions = await blackmagicBluetoothManager.checkPermissions()
      
      setConnectedDevice(currentDevice)
      setIsConnected(connectionState)
      setBluetoothState(btState)
      setPermissionState(permissions)

      // Load saved settings
      await loadSettings()

      // Set up event listeners
      const unsubscribeConnectionChange = blackmagicBluetoothManager.onConnectionStateChange(
        handleConnectionStateChange
      )
      
      const unsubscribeDeviceChange = blackmagicBluetoothManager.onDeviceChange(
        handleDeviceChange
      )
      
      const unsubscribeBluetoothStateChange = blackmagicBluetoothManager.onBluetoothStateChange(
        handleBluetoothStateChange
      )

      cleanup.current = () => {
        unsubscribeConnectionChange()
        unsubscribeDeviceChange()
        unsubscribeBluetoothStateChange()
      }
    } catch (error) {
      console.error('Failed to initialize settings:', error)
    }
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      const [savedBluetooth, savedCamera, savedApp] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.BLUETOOTH_SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.CAMERA_PREFERENCES),
        AsyncStorage.getItem(STORAGE_KEYS.APP_PREFERENCES)
      ])

      if (savedBluetooth) {
        setBluetoothSettings({ ...bluetoothSettings, ...JSON.parse(savedBluetooth) })
      }
      
      if (savedCamera) {
        setCameraPreferences({ ...cameraPreferences, ...JSON.parse(savedCamera) })
      }
      
      if (savedApp) {
        setAppPreferences({ ...appPreferences, ...JSON.parse(savedApp) })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }, [])

  const loadDeviceInfo = useCallback(async () => {
    try {
      const [
        appName,
        appVersion,
        buildNumber,
        bundleId,
        systemName,
        systemVersion,
        deviceModel,
        deviceId,
        isEmulator,
        hasNotch,
        batteryLevel,
        freeDiskStorage,
        totalDiskCapacity
      ] = await Promise.all([
        DeviceInfo.getApplicationName(),
        DeviceInfo.getVersion(),
        DeviceInfo.getBuildNumber(),
        DeviceInfo.getBundleId(),
        DeviceInfo.getSystemName(),
        DeviceInfo.getSystemVersion(),
        DeviceInfo.getModel(),
        DeviceInfo.getUniqueId(),
        DeviceInfo.isEmulator(),
        DeviceInfo.hasNotch(),
        DeviceInfo.getBatteryLevel(),
        DeviceInfo.getFreeDiskStorage(),
        DeviceInfo.getTotalDiskCapacity()
      ])

      setDeviceInfo({
        appName,
        appVersion,
        buildNumber,
        bundleId,
        systemName,
        systemVersion,
        deviceModel,
        deviceId,
        isEmulator,
        hasNotch,
        batteryLevel: batteryLevel * 100,
        diskSpace: {
          free: freeDiskStorage,
          total: totalDiskCapacity
        }
      })
    } catch (error) {
      console.error('Failed to load device info:', error)
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
  }, [])

  const handleDeviceChange = useCallback((device: BlackmagicDeviceInfo | undefined) => {
    setConnectedDevice(device)
  }, [])

  const handleBluetoothStateChange = useCallback((state: BluetoothAdapterState) => {
    setBluetoothState(state)
  }, [])

  // ============================================================================
  // SETTINGS HANDLERS
  // ============================================================================

  const updateBluetoothSetting = useCallback(async <K extends keyof BluetoothSettings>(
    key: K,
    value: BluetoothSettings[K]
  ) => {
    const newSettings = { ...bluetoothSettings, [key]: value }
    setBluetoothSettings(newSettings)
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.BLUETOOTH_SETTINGS, JSON.stringify(newSettings))
    } catch (error) {
      console.error('Failed to save Bluetooth settings:', error)
    }
  }, [bluetoothSettings])

  const updateCameraPreference = useCallback(async <K extends keyof CameraPreferences>(
    key: K,
    value: CameraPreferences[K]
  ) => {
    const newPreferences = { ...cameraPreferences, [key]: value }
    setCameraPreferences(newPreferences)
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CAMERA_PREFERENCES, JSON.stringify(newPreferences))
    } catch (error) {
      console.error('Failed to save camera preferences:', error)
    }
  }, [cameraPreferences])

  const updateAppPreference = useCallback(async <K extends keyof AppPreferences>(
    key: K,
    value: AppPreferences[K]
  ) => {
    const newPreferences = { ...appPreferences, [key]: value }
    setAppPreferences(newPreferences)
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.APP_PREFERENCES, JSON.stringify(newPreferences))
    } catch (error) {
      console.error('Failed to save app preferences:', error)
    }
  }, [appPreferences])

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  const handleResetBluetoothSettings = useCallback(() => {
    Alert.alert(
      'Reset Bluetooth Settings',
      'This will reset all Bluetooth settings to default values. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const defaultSettings: BluetoothSettings = {
              autoConnect: true,
              autoScan: false,
              scanDuration: 30,
              connectionTimeout: 10,
              keepConnectedInBackground: true,
              showAllDevices: false,
              enableDebugLogging: false
            }
            
            setBluetoothSettings(defaultSettings)
            await AsyncStorage.setItem(STORAGE_KEYS.BLUETOOTH_SETTINGS, JSON.stringify(defaultSettings))
          }
        }
      ]
    )
  }, [])

  const handleResetCameraPreferences = useCallback(() => {
    Alert.alert(
      'Reset Camera Preferences',
      'This will reset all camera preferences to default values. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const defaultPreferences: CameraPreferences = {
              defaultFrameRate: FrameRate.FPS_24,
              defaultResolution: Resolution.UHD_4K,
              defaultCodec: Codec.PRORES_422,
              autoStartRecording: false,
              autoStopRecording: false,
              recordingTimeout: 60,
              enableTimecode: true,
              timecodeFormat: '24',
              audioRecording: true,
              audioSampleRate: 48000
            }
            
            setCameraPreferences(defaultPreferences)
            await AsyncStorage.setItem(STORAGE_KEYS.CAMERA_PREFERENCES, JSON.stringify(defaultPreferences))
          }
        }
      ]
    )
  }, [])

  const handleResetAppPreferences = useCallback(() => {
    Alert.alert(
      'Reset App Preferences',
      'This will reset all app preferences to default values. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const defaultPreferences: AppPreferences = {
              theme: 'system',
              language: 'en',
              hapticFeedback: true,
              soundEffects: true,
              showTutorials: true,
              enableAnalytics: true,
              enableCrashReporting: true,
              autoUpdateCheck: true,
              downloadQuality: 'original'
            }
            
            setAppPreferences(defaultPreferences)
            await AsyncStorage.setItem(STORAGE_KEYS.APP_PREFERENCES, JSON.stringify(defaultPreferences))
          }
        }
      ]
    )
  }, [])

  const handleClearCache = useCallback(async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data including thumbnails and temporary files. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true)
              // Clear various cached data
              const cacheKeys = await AsyncStorage.getAllKeys()
              const tempKeys = cacheKeys.filter(key => 
                key.startsWith('cache_') || 
                key.startsWith('thumbnail_') ||
                key.startsWith('temp_')
              )
              
              await AsyncStorage.multiRemove(tempKeys)
              Alert.alert('Success', 'Cache cleared successfully')
            } catch (error) {
              console.error('Failed to clear cache:', error)
              Alert.alert('Error', 'Failed to clear cache')
            } finally {
              setIsLoading(false)
            }
          }
        }
      ]
    )
  }, [])

  const handleExportSettings = useCallback(async () => {
    try {
      const settingsData = {
        bluetoothSettings,
        cameraPreferences,
        appPreferences,
        exportDate: new Date().toISOString(),
        appVersion: deviceInfo?.appVersion
      }
      
      const settingsJson = JSON.stringify(settingsData, null, 2)
      
      await Share.share({
        message: settingsJson,
        title: 'Blackmagic Bluetooth Settings Export'
      })
    } catch (error) {
      console.error('Failed to export settings:', error)
      Alert.alert('Error', 'Failed to export settings')
    }
  }, [bluetoothSettings, cameraPreferences, appPreferences, deviceInfo])

  const handleRequestPermissions = useCallback(async () => {
    try {
      setIsLoading(true)
      const granted = await blackmagicBluetoothManager.requestPermissions()
      
      if (granted) {
        const newPermissionState = await blackmagicBluetoothManager.checkPermissions()
        setPermissionState(newPermissionState)
        Alert.alert('Success', 'Bluetooth permissions granted')
      } else {
        Alert.alert('Permissions Denied', 'Bluetooth permissions are required for the app to function properly.')
      }
    } catch (error) {
      console.error('Failed to request permissions:', error)
      Alert.alert('Error', 'Failed to request permissions')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleOpenBluetoothSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('App-Prefs:Bluetooth')
    } else {
      Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS')
    }
  }, [])

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const bluetoothStatusColor = useMemo(() => {
    switch (bluetoothState) {
      case BluetoothAdapterState.POWERED_ON:
        return colors.success
      case BluetoothAdapterState.POWERED_OFF:
        return colors.error
      default:
        return colors.palette.orange400
    }
  }, [bluetoothState])

  const permissionStatusColor = useMemo(() => {
    switch (permissionState) {
      case BluetoothPermissionState.GRANTED:
        return colors.success
      case BluetoothPermissionState.DENIED:
        return colors.error
      default:
        return colors.palette.orange400
    }
  }, [permissionState])

  const formatFileSize = useCallback((bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }, [])

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderSettingSwitch = useCallback((
    title: string,
    description: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    disabled = false
  ) => (
    <ListItem
      text={title}
      bottomSeparator
      disabled={disabled}
      style={disabled && styles.disabledItem}
    >
      <View style={styles.settingContent}>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, disabled && styles.disabledText]}>{title}</Text>
          <Text style={[styles.settingDescription, disabled && styles.disabledText]}>
            {description}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: colors.palette.neutral300, true: colors.palette.primary300 }}
          thumbColor={value ? colors.palette.primary600 : colors.palette.neutral500}
        />
      </View>
    </ListItem>
  ), [])

  const renderStatusIndicator = useCallback((label: string, status: string, color: string) => (
    <View style={styles.statusIndicator}>
      <Text style={styles.statusLabel}>{label}</Text>
      <View style={styles.statusBadge}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusText, { color }]}>{status}</Text>
      </View>
    </View>
  ), [])

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Screen style={styles.container} preset="scroll">
      <Header
        title="Settings"
        leftIcon="back"
        rightIcon="share"
        onRightPress={handleExportSettings}
      />

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Bluetooth Settings Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bluetooth Settings</Text>
            <Button
              text="Reset"
              preset="default"
              style={styles.resetButton}
              onPress={handleResetBluetoothSettings}
            />
          </View>

          {/* Bluetooth Status */}
          <View style={styles.statusContainer}>
            {renderStatusIndicator(
              'Bluetooth State',
              bluetoothState.replace('_', ' '),
              bluetoothStatusColor
            )}
            {renderStatusIndicator(
              'Permissions',
              permissionState.replace('_', ' '),
              permissionStatusColor
            )}
          </View>

          {/* Connection Status */}
          {isConnected && connectedDevice && (
            <View style={styles.connectionStatus}>
              <Text style={styles.connectionLabel}>Connected Device</Text>
              <Text style={styles.connectionDevice}>
                {connectedDevice.name || connectedDevice.id}
              </Text>
              {connectedDevice.batteryLevel !== undefined && (
                <Text style={styles.connectionBattery}>
                  Battery: {connectedDevice.batteryLevel}%
                </Text>
              )}
            </View>
          )}

          {/* Bluetooth Settings Controls */}
          {renderSettingSwitch(
            'Auto Connect',
            'Automatically connect to the last connected device',
            bluetoothSettings.autoConnect,
            (value) => updateBluetoothSetting('autoConnect', value)
          )}

          {renderSettingSwitch(
            'Auto Scan',
            'Automatically scan for devices when opening the app',
            bluetoothSettings.autoScan,
            (value) => updateBluetoothSetting('autoScan', value)
          )}

          {renderSettingSwitch(
            'Keep Connected in Background',
            'Maintain connection when app is in background',
            bluetoothSettings.keepConnectedInBackground,
            (value) => updateBluetoothSetting('keepConnectedInBackground', value)
          )}

          {renderSettingSwitch(
            'Show All Devices',
            'Show all Bluetooth devices, not just Blackmagic cameras',
            bluetoothSettings.showAllDevices,
            (value) => updateBluetoothSetting('showAllDevices', value)
          )}

          {renderSettingSwitch(
            'Debug Logging',
            'Enable detailed logging for troubleshooting',
            bluetoothSettings.enableDebugLogging,
            (value) => updateBluetoothSetting('enableDebugLogging', value)
          )}

          {/* Bluetooth Actions */}
          <View style={styles.actionButtons}>
            <Button
              text="Request Permissions"
              preset="default"
              style={styles.actionButton}
              onPress={handleRequestPermissions}
              disabled={isLoading || permissionState === BluetoothPermissionState.GRANTED}
            />
            <Button
              text="Open Bluetooth Settings"
              preset="default"
              style={styles.actionButton}
              onPress={handleOpenBluetoothSettings}
            />
          </View>
        </Card>

        {/* Camera Preferences Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Camera Preferences</Text>
            <Button
              text="Reset"
              preset="default"
              style={styles.resetButton}
              onPress={handleResetCameraPreferences}
            />
          </View>

          {renderSettingSwitch(
            'Auto Start Recording',
            'Automatically start recording when connecting to camera',
            cameraPreferences.autoStartRecording,
            (value) => updateCameraPreference('autoStartRecording', value)
          )}

          {renderSettingSwitch(
            'Auto Stop Recording',
            'Automatically stop recording after timeout',
            cameraPreferences.autoStopRecording,
            (value) => updateCameraPreference('autoStopRecording', value)
          )}

          {renderSettingSwitch(
            'Enable Timecode',
            'Enable timecode synchronization',
            cameraPreferences.enableTimecode,
            (value) => updateCameraPreference('enableTimecode', value)
          )}

          {renderSettingSwitch(
            'Audio Recording',
            'Enable audio recording by default',
            cameraPreferences.audioRecording,
            (value) => updateCameraPreference('audioRecording', value)
          )}
        </Card>

        {/* App Preferences Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>App Preferences</Text>
            <Button
              text="Reset"
              preset="default"
              style={styles.resetButton}
              onPress={handleResetAppPreferences}
            />
          </View>

          {renderSettingSwitch(
            'Haptic Feedback',
            'Enable haptic feedback for interactions',
            appPreferences.hapticFeedback,
            (value) => updateAppPreference('hapticFeedback', value)
          )}

          {renderSettingSwitch(
            'Sound Effects',
            'Enable sound effects for actions',
            appPreferences.soundEffects,
            (value) => updateAppPreference('soundEffects', value)
          )}

          {renderSettingSwitch(
            'Show Tutorials',
            'Show tutorial hints and tips',
            appPreferences.showTutorials,
            (value) => updateAppPreference('showTutorials', value)
          )}

          {renderSettingSwitch(
            'Auto Update Check',
            'Automatically check for app updates',
            appPreferences.autoUpdateCheck,
            (value) => updateAppPreference('autoUpdateCheck', value)
          )}

          {renderSettingSwitch(
            'Analytics',
            'Help improve the app by sharing anonymous usage data',
            appPreferences.enableAnalytics,
            (value) => updateAppPreference('enableAnalytics', value)
          )}

          {renderSettingSwitch(
            'Crash Reporting',
            'Automatically report crashes to help fix issues',
            appPreferences.enableCrashReporting,
            (value) => updateAppPreference('enableCrashReporting', value)
          )}

          <View style={styles.actionButtons}>
            <Button
              text="Clear Cache"
              preset="default"
              style={styles.actionButton}
              onPress={handleClearCache}
              disabled={isLoading}
            />
          </View>
        </Card>

        {/* About Section */}
        {deviceInfo && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>About</Text>

            <View style={styles.aboutGrid}>
              <View style={styles.aboutItem}>
                <Text style={styles.aboutLabel}>App Name</Text>
                <Text style={styles.aboutValue}>{deviceInfo.appName}</Text>
              </View>
              
              <View style={styles.aboutItem}>
                <Text style={styles.aboutLabel}>Version</Text>
                <Text style={styles.aboutValue}>
                  {deviceInfo.appVersion} ({deviceInfo.buildNumber})
                </Text>
              </View>
              
              <View style={styles.aboutItem}>
                <Text style={styles.aboutLabel}>System</Text>
                <Text style={styles.aboutValue}>
                  {deviceInfo.systemName} {deviceInfo.systemVersion}
                </Text>
              </View>
              
              <View style={styles.aboutItem}>
                <Text style={styles.aboutLabel}>Device</Text>
                <Text style={styles.aboutValue}>
                  {deviceInfo.deviceModel} {deviceInfo.isEmulator ? '(Simulator)' : ''}
                </Text>
              </View>
              
              <View style={styles.aboutItem}>
                <Text style={styles.aboutLabel}>Battery</Text>
                <Text style={styles.aboutValue}>{Math.round(deviceInfo.batteryLevel)}%</Text>
              </View>
              
              <View style={styles.aboutItem}>
                <Text style={styles.aboutLabel}>Storage</Text>
                <Text style={styles.aboutValue}>
                  {formatFileSize(deviceInfo.diskSpace.free)} free of {formatFileSize(deviceInfo.diskSpace.total)}
                </Text>
              </View>
            </View>

            <View style={styles.aboutActions}>
              <Button
                text="Privacy Policy"
                preset="default"
                style={styles.aboutButton}
                onPress={() => Linking.openURL('https://blackmagicdesign.com/privacy')}
              />
              <Button
                text="Support"
                preset="default"
                style={styles.aboutButton}
                onPress={() => Linking.openURL('https://blackmagicdesign.com/support')}
              />
            </View>
          </Card>
        )}
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

  sectionCard: {
    margin: spacing.md,
    marginBottom: spacing.sm,
  } as ViewStyle,

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  } as ViewStyle,

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  } as TextStyle,

  resetButton: {
    minWidth: 80,
    paddingHorizontal: spacing.sm,
  } as ViewStyle,

  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.palette.neutral50,
    borderRadius: 8,
  } as ViewStyle,

  statusIndicator: {
    alignItems: 'center',
  } as ViewStyle,

  statusLabel: {
    fontSize: 12,
    color: colors.textDim,
    marginBottom: spacing.xs,
  } as TextStyle,

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  } as ViewStyle,

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  } as ViewStyle,

  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  } as TextStyle,

  connectionStatus: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.palette.primary50,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.palette.primary600,
  } as ViewStyle,

  connectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.palette.primary700,
    textTransform: 'uppercase',
  } as TextStyle,

  connectionDevice: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: spacing.xs,
  } as TextStyle,

  connectionBattery: {
    fontSize: 14,
    color: colors.textDim,
    marginTop: spacing.xs,
  } as TextStyle,

  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  } as ViewStyle,

  settingText: {
    flex: 1,
    marginRight: spacing.md,
  } as ViewStyle,

  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: spacing.xs,
  } as TextStyle,

  settingDescription: {
    fontSize: 14,
    color: colors.textDim,
  } as TextStyle,

  disabledItem: {
    opacity: 0.5,
  } as ViewStyle,

  disabledText: {
    color: colors.textDim,
  } as TextStyle,

  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  } as ViewStyle,

  actionButton: {
    flex: 1,
  } as ViewStyle,

  aboutGrid: {
    gap: spacing.md,
  } as ViewStyle,

  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  } as ViewStyle,

  aboutLabel: {
    fontSize: 14,
    color: colors.textDim,
  } as TextStyle,

  aboutValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: spacing.md,
  } as TextStyle,

  aboutActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  } as ViewStyle,

  aboutButton: {
    flex: 1,
  } as ViewStyle,
})