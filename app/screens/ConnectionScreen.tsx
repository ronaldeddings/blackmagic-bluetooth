/**
 * Connection Screen
 * 
 * Comprehensive screen for managing Blackmagic camera Bluetooth connections
 * Phase 7.1 Implementation: Device scanner UI, connection status indicator,
 * auto-connect toggle, and forget device option
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  StyleSheet,
  Alert,
  RefreshControl,
  ViewStyle,
  TextStyle,
  Switch
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { Text } from '../components/Text'
import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { ListItem } from '../components/ListItem'
import { EmptyState } from '../components/EmptyState'
import { Header } from '../components/Header'
import { Card } from '../components/Card'
import { Toggle } from '../components/Toggle'

import { blackmagicBluetoothManager } from '../services/bluetooth/BlackmagicBluetoothManager'
import {
  ScannedDevice,
  BluetoothAdapterState,
  BluetoothPermissionState,
  BlackmagicBluetoothUtils,
  ConnectionState,
  ConnectedDevice
} from '../services/bluetooth/types/BlackmagicTypes'

import { colors, spacing } from '@/theme'

const STORAGE_KEYS = {
  AUTO_CONNECT: '@blackmagic_auto_connect',
  KNOWN_DEVICES: '@blackmagic_known_devices',
  LAST_CONNECTED_DEVICE: '@blackmagic_last_connected_device'
}

interface KnownDevice {
  id: string
  name: string
  lastConnected: Date
  autoConnect: boolean
}

export const ConnectionScreen: React.FC = () => {
  // Scanning State
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  
  // Bluetooth State
  const [bluetoothState, setBluetoothState] = useState<BluetoothAdapterState>(
    BluetoothAdapterState.UNKNOWN
  )
  const [permissionState, setPermissionState] = useState<BluetoothPermissionState>(
    BluetoothPermissionState.UNKNOWN
  )
  
  // Connection State
  const [connectedDevice, setConnectedDevice] = useState<ConnectedDevice | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  )
  const [isConnecting, setIsConnecting] = useState(false)
  
  // Settings State
  const [autoConnectEnabled, setAutoConnectEnabled] = useState(false)
  const [knownDevices, setKnownDevices] = useState<KnownDevice[]>([])

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    initializeScreen()
    return cleanup
  }, [])

  useEffect(() => {
    if (autoConnectEnabled && bluetoothState === BluetoothAdapterState.POWERED_ON) {
      handleAutoConnect()
    }
  }, [autoConnectEnabled, bluetoothState])

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initializeScreen = useCallback(async () => {
    try {
      // Load saved settings
      await loadSettings()
      
      // Check initial permissions
      const permissions = await blackmagicBluetoothManager.checkPermissions()
      setPermissionState(permissions)

      // Set up event listeners
      const unsubscribeDeviceFound = blackmagicBluetoothManager.onDeviceFound(handleDeviceFound)
      const unsubscribeBluetoothState = blackmagicBluetoothManager.onBluetoothStateChange(
        handleBluetoothStateChange
      )
      const unsubscribeConnectionState = blackmagicBluetoothManager.onConnectionStateChange(
        handleConnectionStateChange
      )

      // Get initial states
      const initialBluetoothState = blackmagicBluetoothManager.getBluetoothState()
      setBluetoothState(initialBluetoothState)
      
      const initialConnectionState = blackmagicBluetoothManager.getConnectionState()
      setConnectionState(initialConnectionState)
      
      const currentConnectedDevice = blackmagicBluetoothManager.getConnectedDevice()
      setConnectedDevice(currentConnectedDevice)

      // Store cleanup function
      cleanup.current = () => {
        unsubscribeDeviceFound()
        unsubscribeBluetoothState()
        unsubscribeConnectionState()
        if (isScanning) {
          blackmagicBluetoothManager.stopScan()
        }
      }
    } catch (error) {
      console.error('Failed to initialize connection screen:', error)
      Alert.alert('Error', 'Failed to initialize Bluetooth connection manager')
    }
  }, [])

  const cleanup = useCallback(() => {
    if (isScanning) {
      blackmagicBluetoothManager.stopScan()
    }
  }, [isScanning])

  // ============================================================================
  // STORAGE MANAGEMENT
  // ============================================================================

  const loadSettings = useCallback(async () => {
    try {
      const [autoConnect, knownDevicesJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_CONNECT),
        AsyncStorage.getItem(STORAGE_KEYS.KNOWN_DEVICES)
      ])

      if (autoConnect !== null) {
        setAutoConnectEnabled(JSON.parse(autoConnect))
      }

      if (knownDevicesJson) {
        const devices: KnownDevice[] = JSON.parse(knownDevicesJson)
        setKnownDevices(devices)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }, [])

  const saveAutoConnectSetting = useCallback(async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTO_CONNECT, JSON.stringify(enabled))
    } catch (error) {
      console.error('Failed to save auto-connect setting:', error)
    }
  }, [])

  const saveKnownDevices = useCallback(async (devices: KnownDevice[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.KNOWN_DEVICES, JSON.stringify(devices))
    } catch (error) {
      console.error('Failed to save known devices:', error)
    }
  }, [])

  const addToKnownDevices = useCallback(async (device: ScannedDevice | ConnectedDevice) => {
    const knownDevice: KnownDevice = {
      id: device.id,
      name: device.name || 'Unknown Device',
      lastConnected: new Date(),
      autoConnect: false
    }

    const updatedDevices = [
      ...knownDevices.filter(d => d.id !== device.id),
      knownDevice
    ].sort((a, b) => new Date(b.lastConnected).getTime() - new Date(a.lastConnected).getTime())

    setKnownDevices(updatedDevices)
    await saveKnownDevices(updatedDevices)
  }, [knownDevices, saveKnownDevices])

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleDeviceFound = useCallback((device: ScannedDevice) => {
    // Only show Blackmagic devices
    if (!BlackmagicBluetoothUtils.isBlackmagicDevice(device.name)) {
      return
    }

    setScannedDevices(prevDevices => {
      const existingIndex = prevDevices.findIndex(d => d.id === device.id)
      
      if (existingIndex >= 0) {
        const updatedDevices = [...prevDevices]
        updatedDevices[existingIndex] = { ...device, timestamp: new Date() }
        return updatedDevices
      } else {
        return [...prevDevices, device].sort((a, b) => (b.rssi || -100) - (a.rssi || -100))
      }
    })
  }, [])

  const handleBluetoothStateChange = useCallback((state: BluetoothAdapterState) => {
    setBluetoothState(state)
    
    if (state !== BluetoothAdapterState.POWERED_ON && isScanning) {
      handleStopScan()
    }
  }, [isScanning])

  const handleConnectionStateChange = useCallback((state: ConnectionState) => {
    setConnectionState(state)
    setIsConnecting(state === ConnectionState.CONNECTING)
    
    if (state === ConnectionState.CONNECTED) {
      const device = blackmagicBluetoothManager.getConnectedDevice()
      setConnectedDevice(device)
      if (device) {
        addToKnownDevices(device)
      }
    } else if (state === ConnectionState.DISCONNECTED) {
      setConnectedDevice(null)
    }
  }, [addToKnownDevices])

  const handleAutoConnect = useCallback(async () => {
    if (!autoConnectEnabled || connectionState === ConnectionState.CONNECTED) {
      return
    }

    try {
      const lastConnectedId = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CONNECTED_DEVICE)
      if (!lastConnectedId) return

      // Find the device in scanned devices first
      const scannedDevice = scannedDevices.find(d => d.id === lastConnectedId)
      if (scannedDevice) {
        await handleDeviceConnect(scannedDevice)
        return
      }

      // If not in scan results, start scanning to find it
      if (!isScanning) {
        await handleStartScan()
      }
    } catch (error) {
      console.error('Auto-connect failed:', error)
    }
  }, [autoConnectEnabled, connectionState, scannedDevices, isScanning])

  // ============================================================================
  // SCANNING ACTIONS
  // ============================================================================

  const handleStartScan = useCallback(async () => {
    try {
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

      if (bluetoothState !== BluetoothAdapterState.POWERED_ON) {
        Alert.alert(
          'Bluetooth Disabled',
          'Please turn on Bluetooth to scan for devices.'
        )
        return
      }

      setScannedDevices([])
      setIsScanning(true)

      await blackmagicBluetoothManager.startScan({
        allowDuplicates: false,
        timeoutMs: 30000,
        scanMode: 'balanced'
      })

      // Auto-stop after 30 seconds
      setTimeout(() => {
        if (blackmagicBluetoothManager.isScanning()) {
          handleStopScan()
        }
      }, 30000)

    } catch (error) {
      console.error('Failed to start scan:', error)
      setIsScanning(false)
      Alert.alert('Error', `Failed to start scanning: ${(error as Error).message}`)
    }
  }, [permissionState, bluetoothState])

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

  // ============================================================================
  // CONNECTION ACTIONS
  // ============================================================================

  const handleDeviceConnect = useCallback(async (device: ScannedDevice) => {
    try {
      setIsConnecting(true)
      await blackmagicBluetoothManager.connectToDevice(device.id)
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_CONNECTED_DEVICE, device.id)
    } catch (error) {
      console.error('Connection failed:', error)
      setIsConnecting(false)
      Alert.alert('Connection Failed', `Failed to connect to ${device.name || device.id}`)
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    try {
      await blackmagicBluetoothManager.disconnect()
    } catch (error) {
      console.error('Disconnect failed:', error)
      Alert.alert('Disconnect Failed', 'Failed to disconnect from device')
    }
  }, [])

  const handleForgetDevice = useCallback(async (deviceId: string) => {
    Alert.alert(
      'Forget Device',
      'Are you sure you want to forget this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedDevices = knownDevices.filter(d => d.id !== deviceId)
              setKnownDevices(updatedDevices)
              await saveKnownDevices(updatedDevices)
              
              // If this was the last connected device, clear that too
              const lastConnected = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CONNECTED_DEVICE)
              if (lastConnected === deviceId) {
                await AsyncStorage.removeItem(STORAGE_KEYS.LAST_CONNECTED_DEVICE)
              }
              
              // Disconnect if currently connected
              if (connectedDevice?.id === deviceId) {
                await handleDisconnect()
              }
            } catch (error) {
              console.error('Failed to forget device:', error)
              Alert.alert('Error', 'Failed to forget device')
            }
          }
        }
      ]
    )
  }, [knownDevices, connectedDevice, saveKnownDevices, handleDisconnect])

  const handleToggleAutoConnect = useCallback(async (enabled: boolean) => {
    setAutoConnectEnabled(enabled)
    await saveAutoConnectSetting(enabled)
  }, [saveAutoConnectSetting])

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderConnectionStatus = useCallback(() => {
    let statusColor = colors.palette.neutral400
    let statusText = 'Disconnected'
    
    switch (connectionState) {
      case ConnectionState.CONNECTING:
        statusColor = colors.palette.primary500
        statusText = 'Connecting...'
        break
      case ConnectionState.CONNECTED:
        statusColor = colors.palette.success500
        statusText = 'Connected'
        break
      case ConnectionState.DISCONNECTING:
        statusColor = colors.palette.neutral400
        statusText = 'Disconnecting...'
        break
    }

    return (
      <Card style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={styles.statusIndicatorContainer}>
            <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
          
          {connectedDevice && (
            <Button
              text="Disconnect"
              preset="default"
              size="xs"
              onPress={handleDisconnect}
              disabled={isConnecting}
            />
          )}
        </View>
        
        {connectedDevice && (
          <View style={styles.connectedDeviceInfo}>
            <Text style={styles.connectedDeviceName}>
              {connectedDevice.name || 'Unknown Device'}
            </Text>
            <Text style={styles.connectedDeviceId}>
              ID: {connectedDevice.id}
            </Text>
          </View>
        )}
      </Card>
    )
  }, [connectionState, connectedDevice, isConnecting, handleDisconnect])

  const renderDevice = useCallback(({ item: device }: { item: ScannedDevice }) => {
    const deviceName = device.name || device.localName || 'Unknown Device'
    const signalStrength = device.rssi ? `${device.rssi} dBm` : 'Unknown'
    const isConnected = connectedDevice?.id === device.id
    const knownDevice = knownDevices.find(d => d.id === device.id)
    
    return (
      <ListItem
        text={deviceName}
        bottomSeparator
        onPress={() => !isConnected && !isConnecting && handleDeviceConnect(device)}
        rightIcon={isConnected ? "check" : "caretRight"}
        style={[
          styles.listItem,
          isConnected && styles.connectedListItem
        ]}
        disabled={isConnecting}
      >
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceId} numberOfLines={1}>
            ID: {device.id}
          </Text>
          <Text style={styles.deviceSignal}>
            Signal: {signalStrength}
          </Text>
          <Text style={styles.deviceLastSeen}>
            Last seen: {device.timestamp.toLocaleTimeString()}
          </Text>
          {device.serviceUUIDs && device.serviceUUIDs.length > 0 && (
            <Text style={styles.deviceServices} numberOfLines={1}>
              Services: {device.serviceUUIDs.length}
            </Text>
          )}
          {knownDevice && (
            <View style={styles.knownDeviceActions}>
              <Text style={styles.knownDeviceText}>Known Device</Text>
              <Button
                text="Forget"
                preset="default"
                size="xs"
                onPress={() => handleForgetDevice(device.id)}
                style={styles.forgetButton}
              />
            </View>
          )}
        </View>
      </ListItem>
    )
  }, [connectedDevice, knownDevices, isConnecting, handleDeviceConnect, handleForgetDevice])

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
    <Screen style={styles.container} preset="fixed">
      <Header
        title="Camera Connection"
        rightIcon="settings"
        onRightPress={() => {
          // TODO: Navigate to settings
        }}
      />
      
      <View style={styles.content}>
        {/* Connection Status */}
        {renderConnectionStatus()}
        
        {/* Auto-Connect Settings */}
        <Card style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Auto-Connect</Text>
              <Text style={styles.settingDescription}>
                Automatically connect to the last used device when available
              </Text>
            </View>
            <Switch
              value={autoConnectEnabled}
              onValueChange={handleToggleAutoConnect}
              trackColor={{ false: colors.palette.neutral300, true: colors.palette.primary500 }}
              thumbColor={colors.palette.neutral100}
            />
          </View>
        </Card>

        {/* Scan Controls */}
        <Card style={styles.controlsCard}>
          <View style={styles.controls}>
            <Button
              text={isScanning ? 'Stop Scanning' : 'Scan for Devices'}
              onPress={isScanning ? handleStopScan : handleStartScan}
              disabled={bluetoothState !== BluetoothAdapterState.POWERED_ON}
              preset={isScanning ? 'default' : 'filled'}
              style={styles.scanButton}
            />
            
            <Text style={styles.statusInfoText}>
              Bluetooth: {bluetoothState} | Found: {scannedDevices.length} device{scannedDevices.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </Card>

        {/* Device List */}
        <View style={styles.deviceListContainer}>
          <Text style={styles.sectionTitle}>Available Devices</Text>
          <FlashList
            data={scannedDevices}
            renderItem={renderDevice}
            keyExtractor={(item) => item.id}
            estimatedItemSize={140}
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
    padding: spacing.md,
    gap: spacing.md,
  } as ViewStyle,

  statusCard: {
    padding: spacing.md,
  } as ViewStyle,

  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,

  statusIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  } as ViewStyle,

  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  } as ViewStyle,

  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  } as TextStyle,

  connectedDeviceInfo: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  } as ViewStyle,

  connectedDeviceName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  } as TextStyle,

  connectedDeviceId: {
    fontSize: 12,
    color: colors.textDim,
    fontFamily: 'mono',
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

  controlsCard: {
    padding: spacing.md,
  } as ViewStyle,

  controls: {
    gap: spacing.sm,
  } as ViewStyle,

  scanButton: {
    marginBottom: spacing.xs,
  } as ViewStyle,

  statusInfoText: {
    fontSize: 12,
    color: colors.textDim,
    textAlign: 'center',
  } as TextStyle,

  deviceListContainer: {
    flex: 1,
    minHeight: 200,
  } as ViewStyle,

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  } as TextStyle,

  listContainer: {
    paddingTop: spacing.xs,
  } as ViewStyle,

  listItem: {
    minHeight: 120,
  } as ViewStyle,

  connectedListItem: {
    backgroundColor: colors.palette.success100,
    borderColor: colors.palette.success500,
    borderWidth: 1,
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

  knownDeviceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  } as ViewStyle,

  knownDeviceText: {
    fontSize: 12,
    color: colors.palette.primary500,
    fontWeight: '500',
  } as TextStyle,

  forgetButton: {
    minWidth: 60,
  } as ViewStyle,

  emptyState: {
    paddingTop: spacing.xl,
  } as ViewStyle,
})