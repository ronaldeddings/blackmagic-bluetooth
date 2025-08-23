/**
 * Bluetooth Connection Context
 * 
 * Manages Bluetooth connection state, device discovery, and connection persistence
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  blackmagicBluetoothManager,
  BlackmagicDeviceInfo,
  ConnectionState
} from '../services/bluetooth'
import { storage, load, save } from '../utils/storage'

interface BluetoothConnectionContextType {
  // Connection state
  isScanning: boolean
  isConnecting: boolean
  connectionState: ConnectionState
  
  // Device management
  discoveredDevices: BlackmagicDeviceInfo[]
  connectedDevices: BlackmagicDeviceInfo[]
  connectionHistory: BlackmagicDeviceInfo[]
  
  // Auto-connect settings
  autoConnectEnabled: boolean
  lastConnectedDeviceId: string | null
  
  // Methods
  startScanning: () => Promise<void>
  stopScanning: () => Promise<void>
  connectToDevice: (device: BlackmagicDeviceInfo) => Promise<void>
  disconnectFromDevice: (deviceId: string) => Promise<void>
  forgetDevice: (deviceId: string) => Promise<void>
  
  // Settings
  setAutoConnectEnabled: (enabled: boolean) => void
  clearConnectionHistory: () => void
  
  // Utility methods
  getDeviceById: (deviceId: string) => BlackmagicDeviceInfo | null
  isDeviceConnected: (deviceId: string) => boolean
  getConnectionStatus: (deviceId: string) => ConnectionState
}

const BluetoothConnectionContext = createContext<BluetoothConnectionContextType | undefined>(undefined)

export const useBluetoothConnection = () => {
  const context = useContext(BluetoothConnectionContext)
  if (!context) {
    throw new Error('useBluetoothConnection must be used within a BluetoothConnectionProvider')
  }
  return context
}

interface BluetoothConnectionProviderProps {
  children: React.ReactNode
}

// Storage keys
const STORAGE_KEYS = {
  CONNECTION_HISTORY: 'bluetooth.connectionHistory',
  AUTO_CONNECT_ENABLED: 'bluetooth.autoConnectEnabled',
  LAST_CONNECTED_DEVICE: 'bluetooth.lastConnectedDevice',
  DEVICE_PREFERENCES: 'bluetooth.devicePreferences'
} as const

export const BluetoothConnectionProvider: React.FC<BluetoothConnectionProviderProps> = ({ children }) => {
  const [isScanning, setIsScanning] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED)
  const [discoveredDevices, setDiscoveredDevices] = useState<BlackmagicDeviceInfo[]>([])
  const [connectedDevices, setConnectedDevices] = useState<BlackmagicDeviceInfo[]>([])
  const [connectionHistory, setConnectionHistory] = useState<BlackmagicDeviceInfo[]>([])
  const [autoConnectEnabled, setAutoConnectEnabled] = useState(true)
  const [lastConnectedDeviceId, setLastConnectedDeviceId] = useState<string | null>(null)

  // Load persisted data on mount
  useEffect(() => {
    const loadPersistedData = () => {
      // Load connection history
      const history = load<BlackmagicDeviceInfo[]>(STORAGE_KEYS.CONNECTION_HISTORY) || []
      setConnectionHistory(history)
      
      // Load auto-connect preference
      const autoConnect = storage.getBoolean(STORAGE_KEYS.AUTO_CONNECT_ENABLED) ?? true
      setAutoConnectEnabled(autoConnect)
      
      // Load last connected device
      const lastDevice = storage.getString(STORAGE_KEYS.LAST_CONNECTED_DEVICE)
      setLastConnectedDeviceId(lastDevice)
      
      // Load currently connected devices
      const connected = blackmagicBluetoothManager.getConnectedDevices()
      setConnectedDevices(connected)
      
      if (connected.length > 0) {
        setConnectionState(ConnectionState.CONNECTED)
      }
    }
    
    loadPersistedData()
  }, [])

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribeConnection = blackmagicBluetoothManager.onConnectionStateChange((event) => {
      const { device, state } = event
      
      setConnectionState(state)
      
      if (state === ConnectionState.CONNECTING) {
        setIsConnecting(true)
      } else {
        setIsConnecting(false)
      }
      
      if (state === ConnectionState.CONNECTED) {
        setConnectedDevices(prev => {
          const exists = prev.find(d => d.id === device.id)
          if (exists) return prev
          return [...prev, device]
        })
        
        // Update connection history
        updateConnectionHistory(device)
        
        // Save last connected device
        setLastConnectedDeviceId(device.id)
        storage.set(STORAGE_KEYS.LAST_CONNECTED_DEVICE, device.id)
        
      } else if (state === ConnectionState.DISCONNECTED) {
        setConnectedDevices(prev => prev.filter(d => d.id !== device.id))
        
        if (connectedDevices.length <= 1) {
          setConnectionState(ConnectionState.DISCONNECTED)
        }
      }
    })

    return unsubscribeConnection
  }, [connectedDevices])

  // Subscribe to device discovery
  useEffect(() => {
    const unsubscribeDiscovery = blackmagicBluetoothManager.onDeviceDiscovered((device) => {
      setDiscoveredDevices(prev => {
        const exists = prev.find(d => d.id === device.id)
        if (exists) {
          // Update existing device
          return prev.map(d => d.id === device.id ? { ...d, ...device } : d)
        }
        return [...prev, device]
      })
    })

    return unsubscribeDiscovery
  }, [])

  // Auto-connect logic
  useEffect(() => {
    if (autoConnectEnabled && lastConnectedDeviceId && connectedDevices.length === 0) {
      const historyDevice = connectionHistory.find(d => d.id === lastConnectedDeviceId)
      if (historyDevice) {
        // Try to auto-connect after a short delay
        const timeout = setTimeout(() => {
          connectToDevice(historyDevice).catch(error => {
            console.log('Auto-connect failed:', error)
          })
        }, 2000)
        
        return () => clearTimeout(timeout)
      }
    }
  }, [autoConnectEnabled, lastConnectedDeviceId, connectedDevices, connectionHistory])

  const updateConnectionHistory = useCallback((device: BlackmagicDeviceInfo) => {
    setConnectionHistory(prev => {
      const filtered = prev.filter(d => d.id !== device.id)
      const updated = [device, ...filtered].slice(0, 10) // Keep only last 10 devices
      save(STORAGE_KEYS.CONNECTION_HISTORY, updated)
      return updated
    })
  }, [])

  const startScanning = useCallback(async () => {
    try {
      setIsScanning(true)
      setDiscoveredDevices([]) // Clear previous results
      await blackmagicBluetoothManager.startScanning()
    } catch (error) {
      console.error('Failed to start scanning:', error)
      setIsScanning(false)
      throw error
    }
  }, [])

  const stopScanning = useCallback(async () => {
    try {
      await blackmagicBluetoothManager.stopScanning()
    } finally {
      setIsScanning(false)
    }
  }, [])

  const connectToDevice = useCallback(async (device: BlackmagicDeviceInfo) => {
    try {
      setIsConnecting(true)
      await blackmagicBluetoothManager.connect(device.id)
      
      // Stop scanning after successful connection
      if (isScanning) {
        await stopScanning()
      }
    } catch (error) {
      console.error('Failed to connect to device:', error)
      setIsConnecting(false)
      throw error
    }
  }, [isScanning, stopScanning])

  const disconnectFromDevice = useCallback(async (deviceId: string) => {
    try {
      await blackmagicBluetoothManager.disconnect(deviceId)
    } catch (error) {
      console.error('Failed to disconnect from device:', error)
      throw error
    }
  }, [])

  const forgetDevice = useCallback(async (deviceId: string) => {
    try {
      // Disconnect if currently connected
      const isConnected = connectedDevices.some(d => d.id === deviceId)
      if (isConnected) {
        await disconnectFromDevice(deviceId)
      }
      
      // Remove from connection history
      setConnectionHistory(prev => {
        const updated = prev.filter(d => d.id !== deviceId)
        save(STORAGE_KEYS.CONNECTION_HISTORY, updated)
        return updated
      })
      
      // Clear last connected device if it's the forgotten one
      if (lastConnectedDeviceId === deviceId) {
        setLastConnectedDeviceId(null)
        storage.delete(STORAGE_KEYS.LAST_CONNECTED_DEVICE)
      }
      
      // Remove from discovered devices
      setDiscoveredDevices(prev => prev.filter(d => d.id !== deviceId))
      
    } catch (error) {
      console.error('Failed to forget device:', error)
      throw error
    }
  }, [connectedDevices, disconnectFromDevice, lastConnectedDeviceId])

  const setAutoConnect = useCallback((enabled: boolean) => {
    setAutoConnectEnabled(enabled)
    storage.set(STORAGE_KEYS.AUTO_CONNECT_ENABLED, enabled)
  }, [])

  const clearConnectionHistory = useCallback(() => {
    setConnectionHistory([])
    setLastConnectedDeviceId(null)
    save(STORAGE_KEYS.CONNECTION_HISTORY, [])
    storage.delete(STORAGE_KEYS.LAST_CONNECTED_DEVICE)
  }, [])

  const getDeviceById = useCallback((deviceId: string): BlackmagicDeviceInfo | null => {
    // Check connected devices first
    const connected = connectedDevices.find(d => d.id === deviceId)
    if (connected) return connected
    
    // Check discovered devices
    const discovered = discoveredDevices.find(d => d.id === deviceId)
    if (discovered) return discovered
    
    // Check connection history
    const history = connectionHistory.find(d => d.id === deviceId)
    if (history) return history
    
    return null
  }, [connectedDevices, discoveredDevices, connectionHistory])

  const isDeviceConnected = useCallback((deviceId: string): boolean => {
    return connectedDevices.some(d => d.id === deviceId)
  }, [connectedDevices])

  const getConnectionStatus = useCallback((deviceId: string): ConnectionState => {
    if (connectedDevices.some(d => d.id === deviceId)) {
      return ConnectionState.CONNECTED
    }
    return ConnectionState.DISCONNECTED
  }, [connectedDevices])

  const contextValue: BluetoothConnectionContextType = {
    isScanning,
    isConnecting,
    connectionState,
    discoveredDevices,
    connectedDevices,
    connectionHistory,
    autoConnectEnabled,
    lastConnectedDeviceId,
    startScanning,
    stopScanning,
    connectToDevice,
    disconnectFromDevice,
    forgetDevice,
    setAutoConnectEnabled: setAutoConnect,
    clearConnectionHistory,
    getDeviceById,
    isDeviceConnected,
    getConnectionStatus
  }

  return (
    <BluetoothConnectionContext.Provider value={contextValue}>
      {children}
    </BluetoothConnectionContext.Provider>
  )
}