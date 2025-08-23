/**
 * ConnectionManager Component
 * 
 * React Native component for managing Bluetooth connections to Blackmagic devices
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  StyleSheet,
  Alert,
  ViewStyle,
  TextStyle,
  ActivityIndicator
} from 'react-native'

import { Text } from '../Text'
import { Button } from '../Button'
import { Card } from '../Card'
import { ListItem } from '../ListItem'

import { blackmagicBluetoothManager } from '../../services/bluetooth/BlackmagicBluetoothManager'
import {
  BlackmagicDeviceInfo,
  ConnectionState,
  DeviceConnectionEvent,
  ScannedDevice
} from '../../services/bluetooth/types/BlackmagicTypes'

import { colors, spacing } from '../../theme'

export interface ConnectionManagerProps {
  device?: ScannedDevice | BlackmagicDeviceInfo
  onConnectionStateChange?: (state: ConnectionState, device?: BlackmagicDeviceInfo) => void
  onDeviceInfoUpdate?: (deviceInfo: BlackmagicDeviceInfo) => void
  autoConnect?: boolean
  showDeviceInfo?: boolean
  style?: ViewStyle
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  device,
  onConnectionStateChange,
  onDeviceInfoUpdate,
  autoConnect = false,
  showDeviceInfo = true,
  style
}) => {
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED)
  const [deviceInfo, setDeviceInfo] = useState<BlackmagicDeviceInfo | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (!device) return

    // Initialize connection state
    const initialState = blackmagicBluetoothManager.getConnectionState(device.id)
    setConnectionState(initialState)

    // Get connected device info if already connected
    const connectedDevices = blackmagicBluetoothManager.getConnectedDevices()
    const connectedDevice = connectedDevices.find(d => d.id === device.id)
    if (connectedDevice) {
      setDeviceInfo(connectedDevice)
    }

    // Set up connection state listener
    const unsubscribeConnection = blackmagicBluetoothManager.onConnectionStateChange(
      handleConnectionStateChange
    )

    // Auto-connect if requested
    if (autoConnect && initialState === ConnectionState.DISCONNECTED) {
      handleConnect()
    }

    return () => {
      unsubscribeConnection()
    }
  }, [device, autoConnect])

  useEffect(() => {
    onConnectionStateChange?.(connectionState, deviceInfo || undefined)
  }, [connectionState, deviceInfo, onConnectionStateChange])

  useEffect(() => {
    if (deviceInfo) {
      onDeviceInfoUpdate?.(deviceInfo)
    }
  }, [deviceInfo, onDeviceInfoUpdate])

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleConnectionStateChange = useCallback((event: DeviceConnectionEvent) => {
    if (!device || event.device.id !== device.id) return

    setConnectionState(event.state)
    setIsConnecting(event.state === ConnectionState.CONNECTING)

    if (event.state === ConnectionState.CONNECTED) {
      setDeviceInfo(event.device)
      setConnectionError(null)
    } else if (event.state === ConnectionState.DISCONNECTED) {
      setDeviceInfo(null)
      if (event.error) {
        setConnectionError(event.error.message)
      }
    }
  }, [device])

  const handleConnect = useCallback(async () => {
    if (!device || connectionState !== ConnectionState.DISCONNECTED) {
      return
    }

    setIsConnecting(true)
    setConnectionError(null)

    try {
      const connectedDevice = await blackmagicBluetoothManager.connectToDevice(device.id, {
        timeout: 15000, // 15 second timeout
        autoConnect: false,
        requestMTU: 512
      })

      setDeviceInfo(connectedDevice)
      
    } catch (error) {
      const errorMessage = (error as Error).message
      setConnectionError(errorMessage)
      Alert.alert(
        'Connection Failed',
        `Could not connect to ${device.name || 'device'}: ${errorMessage}`
      )
    } finally {
      setIsConnecting(false)
    }
  }, [device, connectionState])

  const handleDisconnect = useCallback(async () => {
    if (!device || connectionState === ConnectionState.DISCONNECTED) {
      return
    }

    try {
      await blackmagicBluetoothManager.disconnectFromDevice(device.id)
    } catch (error) {
      console.error('Failed to disconnect:', error)
      Alert.alert(
        'Disconnect Failed',
        `Could not disconnect from ${device.name || 'device'}: ${(error as Error).message}`
      )
    }
  }, [device, connectionState])

  const handleRetryConnection = useCallback(() => {
    setConnectionError(null)
    handleConnect()
  }, [handleConnect])

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderConnectionStatus = useCallback(() => {
    const deviceName = device?.name || 'Unknown Device'
    
    let statusText = 'Disconnected'
    let statusColor = colors.textDim
    let showSpinner = false

    switch (connectionState) {
      case ConnectionState.CONNECTING:
        statusText = 'Connecting...'
        statusColor = colors.palette.primary500
        showSpinner = true
        break
      case ConnectionState.CONNECTED:
        statusText = 'Connected'
        statusColor = colors.palette.success500
        break
      case ConnectionState.DISCONNECTING:
        statusText = 'Disconnecting...'
        statusColor = colors.palette.warning500
        showSpinner = true
        break
      default:
        statusText = 'Disconnected'
        statusColor = colors.textDim
        break
    }

    return (
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={styles.deviceName} numberOfLines={1}>
            {deviceName}
          </Text>
          <View style={styles.statusIndicator}>
            {showSpinner && (
              <ActivityIndicator
                size="small"
                color={statusColor}
                style={styles.spinner}
              />
            )}
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusText}
            </Text>
          </View>
        </View>
        
        {device && (
          <Text style={styles.deviceId} numberOfLines={1}>
            {device.id}
          </Text>
        )}
      </View>
    )
  }, [device, connectionState])

  const renderConnectionControls = useCallback(() => {
    if (!device) return null

    const isConnected = connectionState === ConnectionState.CONNECTED
    const canConnect = connectionState === ConnectionState.DISCONNECTED
    const canDisconnect = isConnected || connectionState === ConnectionState.CONNECTING

    return (
      <View style={styles.controlsContainer}>
        {canConnect && (
          <Button
            text="Connect"
            onPress={handleConnect}
            disabled={isConnecting}
            preset="filled"
            style={styles.controlButton}
          />
        )}
        
        {canDisconnect && (
          <Button
            text={isConnected ? 'Disconnect' : 'Cancel'}
            onPress={handleDisconnect}
            preset="default"
            style={styles.controlButton}
          />
        )}
        
        {connectionError && (
          <Button
            text="Retry"
            onPress={handleRetryConnection}
            preset="reversed"
            style={styles.controlButton}
          />
        )}
      </View>
    )
  }, [device, connectionState, isConnecting, connectionError, handleConnect, handleDisconnect, handleRetryConnection])

  const renderDeviceInfo = useCallback(() => {
    if (!showDeviceInfo || !deviceInfo || connectionState !== ConnectionState.CONNECTED) {
      return null
    }

    const infoItems = [
      { label: 'Manufacturer', value: deviceInfo.manufacturerName },
      { label: 'Model', value: deviceInfo.modelNumber },
      { label: 'Serial Number', value: deviceInfo.serialNumber },
      { label: 'Firmware', value: deviceInfo.firmwareRevision },
      { label: 'Battery Level', value: deviceInfo.batteryLevel ? `${deviceInfo.batteryLevel}%` : undefined },
      { label: 'Signal Strength', value: deviceInfo.rssi ? `${deviceInfo.rssi} dBm` : undefined }
    ].filter(item => item.value)

    if (infoItems.length === 0) {
      return null
    }

    return (
      <Card style={styles.deviceInfoCard} contentStyle={styles.deviceInfoContent}>
        <Text style={styles.deviceInfoTitle}>Device Information</Text>
        {infoItems.map((item, index) => (
          <ListItem
            key={index}
            text={item.label}
            rightText={item.value}
            bottomSeparator={index < infoItems.length - 1}
            style={styles.infoItem}
            textStyle={styles.infoLabel}
            rightTextStyle={styles.infoValue}
          />
        ))}
      </Card>
    )
  }, [showDeviceInfo, deviceInfo, connectionState])

  const renderError = useCallback(() => {
    if (!connectionError) return null

    return (
      <Card
        style={styles.errorCard}
        contentStyle={styles.errorContent}
      >
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorMessage}>{connectionError}</Text>
      </Card>
    )
  }, [connectionError])

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!device) {
    return (
      <View style={[styles.container, style]}>
        <Card style={styles.card} contentStyle={styles.cardContent}>
          <Text style={styles.noDeviceText}>No device selected</Text>
        </Card>
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      <Card style={styles.card} contentStyle={styles.cardContent}>
        {renderConnectionStatus()}
        {renderConnectionControls()}
      </Card>
      
      {renderError()}
      {renderDeviceInfo()}
    </View>
  )
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  } as ViewStyle,

  card: {
    // Card styles handled by Card component
  } as ViewStyle,

  cardContent: {
    gap: spacing.md,
  } as ViewStyle,

  statusContainer: {
    gap: spacing.xs,
  } as ViewStyle,

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  } as ViewStyle,

  deviceName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  } as TextStyle,

  deviceId: {
    fontSize: 12,
    color: colors.textDim,
    fontFamily: 'monospace',
  } as TextStyle,

  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  } as ViewStyle,

  statusText: {
    fontSize: 14,
    fontWeight: '500',
  } as TextStyle,

  spinner: {
    // ActivityIndicator styles
  } as ViewStyle,

  controlsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  } as ViewStyle,

  controlButton: {
    flex: 1,
  } as ViewStyle,

  deviceInfoCard: {
    // Card styles handled by Card component
  } as ViewStyle,

  deviceInfoContent: {
    padding: 0, // Override default card padding for ListItems
  } as ViewStyle,

  deviceInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  } as TextStyle,

  infoItem: {
    paddingHorizontal: spacing.md,
    minHeight: 44,
  } as ViewStyle,

  infoLabel: {
    fontSize: 14,
    color: colors.text,
  } as TextStyle,

  infoValue: {
    fontSize: 14,
    color: colors.textDim,
    fontWeight: '500',
  } as TextStyle,

  errorCard: {
    backgroundColor: colors.errorBackground,
    borderColor: colors.error,
    borderWidth: 1,
  } as ViewStyle,

  errorContent: {
    gap: spacing.xs,
  } as ViewStyle,

  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
  } as TextStyle,

  errorMessage: {
    fontSize: 13,
    color: colors.error,
    lineHeight: 18,
  } as TextStyle,

  noDeviceText: {
    textAlign: 'center',
    color: colors.textDim,
    fontStyle: 'italic',
  } as TextStyle,
})