/**
 * DeviceScanner Component
 * 
 * React Native component for scanning and displaying Blackmagic Bluetooth devices
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  StyleSheet,
  Alert,
  RefreshControl,
  ViewStyle,
  TextStyle
} from 'react-native'
import { FlashList } from '@shopify/flash-list'

import { Text } from '../Text'
import { Button } from '../Button'
import { Screen } from '../Screen'
import { ListItem } from '../ListItem'
import { EmptyState } from '../EmptyState'
import { Header } from '../Header'

import { blackmagicBluetoothManager } from '../../services/bluetooth/BlackmagicBluetoothManager'
import {
  ScannedDevice,
  ScanState,
  BluetoothAdapterState,
  BluetoothPermissionState,
  BlackmagicBluetoothUtils
} from '../../services/bluetooth/types/BlackmagicTypes'

import { colors, spacing } from '../../theme'

export interface DeviceScannerProps {
  onDeviceSelected?: (device: ScannedDevice) => void
  autoScan?: boolean
  scanDurationMs?: number
  showOnlyBlackmagicDevices?: boolean
  style?: ViewStyle
}

export const DeviceScanner: React.FC<DeviceScannerProps> = ({
  onDeviceSelected,
  autoScan = false,
  scanDurationMs = 30000,
  showOnlyBlackmagicDevices = true,
  style
}) => {
  // State
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [bluetoothState, setBluetoothState] = useState<BluetoothAdapterState>(
    BluetoothAdapterState.UNKNOWN
  )
  const [permissionState, setPermissionState] = useState<BluetoothPermissionState>(
    BluetoothPermissionState.UNKNOWN
  )
  const [refreshing, setRefreshing] = useState(false)

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    initializeScanner()
    return cleanup
  }, [])

  useEffect(() => {
    if (autoScan && bluetoothState === BluetoothAdapterState.POWERED_ON) {
      handleStartScan()
    }
  }, [autoScan, bluetoothState])

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initializeScanner = useCallback(async () => {
    try {
      // Check initial permissions
      const permissions = await blackmagicBluetoothManager.checkPermissions()
      setPermissionState(permissions)

      // Set up event listeners
      const unsubscribeDeviceFound = blackmagicBluetoothManager.onDeviceFound(handleDeviceFound)
      const unsubscribeBluetoothState = blackmagicBluetoothManager.onBluetoothStateChange(
        handleBluetoothStateChange
      )

      // Get initial Bluetooth state
      const initialState = blackmagicBluetoothManager.getBluetoothState()
      setBluetoothState(initialState)

      // Store cleanup functions
      cleanup.current = () => {
        unsubscribeDeviceFound()
        unsubscribeBluetoothState()
      }
    } catch (error) {
      console.error('Failed to initialize device scanner:', error)
      Alert.alert('Error', 'Failed to initialize Bluetooth scanner')
    }
  }, [])

  const cleanup = useCallback(() => {
    if (isScanning) {
      blackmagicBluetoothManager.stopScan()
    }
  }, [isScanning])

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleDeviceFound = useCallback((device: ScannedDevice) => {
    // Filter Blackmagic devices if requested
    if (showOnlyBlackmagicDevices && !BlackmagicBluetoothUtils.isBlackmagicDevice(device.name)) {
      return
    }

    setScannedDevices(prevDevices => {
      // Check if device already exists (update or add)
      const existingIndex = prevDevices.findIndex(d => d.id === device.id)
      
      if (existingIndex >= 0) {
        // Update existing device
        const updatedDevices = [...prevDevices]
        updatedDevices[existingIndex] = { ...device, timestamp: new Date() }
        return updatedDevices
      } else {
        // Add new device
        return [...prevDevices, device].sort((a, b) => (b.rssi || -100) - (a.rssi || -100))
      }
    })
  }, [showOnlyBlackmagicDevices])

  const handleBluetoothStateChange = useCallback((state: BluetoothAdapterState) => {
    setBluetoothState(state)
    
    if (state !== BluetoothAdapterState.POWERED_ON && isScanning) {
      handleStopScan()
    }
  }, [isScanning])

  const handleStartScan = useCallback(async () => {
    try {
      // Check permissions first
      let permissions = permissionState
      if (permissions !== BluetoothPermissionState.GRANTED) {
        const hasPermissions = await blackmagicBluetoothManager.requestPermissions()
        if (!hasPermissions) {
          Alert.alert(
            'Permissions Required',
            'Bluetooth and location permissions are required to scan for devices.'
          )
          return
        }
        permissions = BluetoothPermissionState.GRANTED
        setPermissionState(permissions)
      }

      // Check Bluetooth state
      if (bluetoothState !== BluetoothAdapterState.POWERED_ON) {
        Alert.alert(
          'Bluetooth Disabled',
          'Please turn on Bluetooth to scan for devices.'
        )
        return
      }

      // Clear previous results
      setScannedDevices([])
      setIsScanning(true)

      // Start scanning
      await blackmagicBluetoothManager.startScan({
        allowDuplicates: false,
        timeoutMs: scanDurationMs,
        scanMode: 'balanced'
      })

      // Set up timeout to stop scanning
      setTimeout(() => {
        if (blackmagicBluetoothManager.isScanning()) {
          handleStopScan()
        }
      }, scanDurationMs)

    } catch (error) {
      console.error('Failed to start scan:', error)
      setIsScanning(false)
      Alert.alert('Error', `Failed to start scanning: ${(error as Error).message}`)
    }
  }, [permissionState, bluetoothState, scanDurationMs])

  const handleStopScan = useCallback(async () => {
    try {
      await blackmagicBluetoothManager.stopScan()
    } catch (error) {
      console.error('Failed to stop scan:', error)
    } finally {
      setIsScanning(false)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setScannedDevices([])
    
    if (isScanning) {
      await handleStopScan()
    }
    
    await handleStartScan()
    setRefreshing(false)
  }, [isScanning, handleStopScan, handleStartScan])

  const handleDevicePress = useCallback((device: ScannedDevice) => {
    onDeviceSelected?.(device)
  }, [onDeviceSelected])

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderDevice = useCallback(({ item: device }: { item: ScannedDevice }) => {
    const deviceName = device.name || device.localName || 'Unknown Device'
    const signalStrength = device.rssi ? `${device.rssi} dBm` : 'Unknown'
    const lastSeen = `Last seen: ${device.timestamp.toLocaleTimeString()}`
    
    return (
      <ListItem
        text={deviceName}
        bottomSeparator
        onPress={() => handleDevicePress(device)}
        rightIcon="caretRight"
        style={styles.listItem}
      >
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceId} numberOfLines={1}>
            ID: {device.id}
          </Text>
          <Text style={styles.deviceSignal}>
            Signal: {signalStrength}
          </Text>
          <Text style={styles.deviceLastSeen}>
            {lastSeen}
          </Text>
          {device.serviceUUIDs && device.serviceUUIDs.length > 0 && (
            <Text style={styles.deviceServices} numberOfLines={1}>
              Services: {device.serviceUUIDs.length}
            </Text>
          )}
        </View>
      </ListItem>
    )
  }, [handleDevicePress])

  const renderEmptyState = useCallback(() => {
    let title = 'No devices found'
    let content = 'Make sure your Blackmagic camera is powered on and in pairing mode.'
    
    if (bluetoothState !== BluetoothAdapterState.POWERED_ON) {
      title = 'Bluetooth Disabled'
      content = 'Please turn on Bluetooth to scan for devices.'
    } else if (permissionState !== BluetoothPermissionState.GRANTED) {
      title = 'Permissions Required'
      content = 'Bluetooth and location permissions are required to scan for devices.'
    } else if (isScanning) {
      title = 'Scanning...'
      content = 'Looking for nearby Blackmagic devices.'
    }

    return (
      <EmptyState
        preset="generic"
        style={styles.emptyState}
        headingText={title}
        content={content}
        button={
          !isScanning && bluetoothState === BluetoothAdapterState.POWERED_ON ? (
            <Button
              text="Start Scan"
              onPress={handleStartScan}
              preset="reversed"
            />
          ) : undefined
        }
      />
    )
  }, [bluetoothState, permissionState, isScanning, handleStartScan])

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Screen style={[styles.container, style]} preset="fixed">
      <Header
        title="Bluetooth Devices"
        rightIcon="settings"
        onRightPress={() => {
          // TODO: Open Bluetooth settings
        }}
      />
      
      <View style={styles.content}>
        <View style={styles.controls}>
          <Button
            text={isScanning ? 'Stop Scanning' : 'Start Scan'}
            onPress={isScanning ? handleStopScan : handleStartScan}
            disabled={bluetoothState !== BluetoothAdapterState.POWERED_ON}
            preset={isScanning ? 'default' : 'filled'}
            style={styles.scanButton}
          />
          
          <Text style={styles.statusText}>
            Bluetooth: {bluetoothState} | Found: {scannedDevices.length} device{scannedDevices.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <FlashList
          data={scannedDevices}
          renderItem={renderDevice}
          keyExtractor={(item) => item.id}
          estimatedItemSize={120}
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
      </View>
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

  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  } as ViewStyle,

  controls: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  } as ViewStyle,

  scanButton: {
    marginBottom: spacing.xs,
  } as ViewStyle,

  statusText: {
    fontSize: 12,
    color: colors.textDim,
    textAlign: 'center',
  } as TextStyle,

  listContainer: {
    paddingTop: spacing.sm,
  } as ViewStyle,

  listItem: {
    minHeight: 100,
  } as ViewStyle,

  deviceInfo: {
    flex: 1,
    gap: spacing.xxs,
    marginTop: spacing.xs,
  } as ViewStyle,

  deviceId: {
    fontSize: 12,
    color: colors.textDim,
    fontFamily: 'mono',
  } as TextStyle,

  deviceSignal: {
    fontSize: 12,
    color: colors.textDim,
  } as TextStyle,

  deviceLastSeen: {
    fontSize: 11,
    color: colors.textDim,
    fontStyle: 'italic',
  } as TextStyle,

  deviceServices: {
    fontSize: 11,
    color: colors.palette.primary300,
  } as TextStyle,

  emptyState: {
    paddingTop: spacing.xl,
  } as ViewStyle,
})