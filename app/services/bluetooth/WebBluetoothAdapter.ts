/**
 * Web Bluetooth Adapter
 * 
 * Provides web-compatible mock implementation for Bluetooth functionality
 * when running in browser environment (React DOM)
 */

import { Platform } from 'react-native'
import {
  BluetoothAdapterState,
  BluetoothPermissionState,
  ConnectionState,
  ScanState,
  ScannedDevice,
  BlackmagicDeviceInfo,
  DeviceConnectionEvent,
  BlackmagicBluetoothError
} from './types/BlackmagicTypes'

// Mock device data for web development
const MOCK_DEVICES: ScannedDevice[] = [
  {
    id: 'mock-device-1',
    localName: 'Blackmagic URSA Mini Pro 12K',
    name: 'URSA Mini Pro 12K',
    rssi: -45,
    isConnectable: true,
    serviceUUIDs: ['1800', '180A', '180F'],
    manufacturerData: null,
    serviceData: {},
    txPowerLevel: null,
    mtu: 23,
    overflowServiceUUIDs: []
  },
  {
    id: 'mock-device-2', 
    localName: 'Blackmagic Pocket Cinema Camera 6K',
    name: 'Pocket Cinema Camera 6K',
    rssi: -62,
    isConnectable: true,
    serviceUUIDs: ['1800', '180A', '180F', '1812'],
    manufacturerData: null,
    serviceData: {},
    txPowerLevel: null,
    mtu: 23,
    overflowServiceUUIDs: []
  },
  {
    id: 'mock-device-3',
    localName: 'Blackmagic Studio Camera 4K Plus',
    name: 'Studio Camera 4K Plus',
    rssi: -58,
    isConnectable: true,
    serviceUUIDs: ['1800', '180A', '180F', '1812'],
    manufacturerData: null,
    serviceData: {},
    txPowerLevel: null,
    mtu: 23,
    overflowServiceUUIDs: []
  }
]

export class WebBluetoothAdapter {
  private static instance: WebBluetoothAdapter
  
  private bluetoothState = BluetoothAdapterState.POWERED_ON
  private scanState = ScanState.STOPPED
  private connectedDevices: Map<string, BlackmagicDeviceInfo> = new Map()
  private connectionStates: Map<string, ConnectionState> = new Map()
  
  // Event callbacks
  private deviceFoundCallbacks: ((device: ScannedDevice) => void)[] = []
  private connectionStateCallbacks: ((event: DeviceConnectionEvent) => void)[] = []
  private bluetoothStateCallbacks: ((state: BluetoothAdapterState) => void)[] = []
  
  private scanTimeout?: NodeJS.Timeout

  static getInstance(): WebBluetoothAdapter {
    if (!this.instance) {
      this.instance = new WebBluetoothAdapter()
    }
    return this.instance
  }

  static isWebEnvironment(): boolean {
    return Platform.OS === 'web' || typeof window !== 'undefined'
  }

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  isScanning(): boolean {
    return this.scanState === ScanState.SCANNING
  }

  getBluetoothState(): BluetoothAdapterState {
    return this.bluetoothState
  }

  getConnectionState(deviceId?: string): ConnectionState {
    if (deviceId) {
      return this.connectionStates.get(deviceId) || ConnectionState.DISCONNECTED
    }
    // Return overall connection state
    const connectedCount = Array.from(this.connectionStates.values())
      .filter(state => state === ConnectionState.CONNECTED).length
    return connectedCount > 0 ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED
  }

  getConnectedDevices(): BlackmagicDeviceInfo[] {
    return Array.from(this.connectedDevices.values())
  }

  getConnectedDevice(): BlackmagicDeviceInfo | null {
    const devices = this.getConnectedDevices()
    return devices.length > 0 ? devices[0] : null
  }

  // ============================================================================
  // PERMISSIONS
  // ============================================================================

  async checkPermissions(): Promise<BluetoothPermissionState> {
    // Web environment always has "permissions" granted for mock functionality
    return BluetoothPermissionState.GRANTED
  }

  async requestPermissions(): Promise<BluetoothPermissionState> {
    return BluetoothPermissionState.GRANTED
  }

  // ============================================================================
  // SCANNING
  // ============================================================================

  async startScan(timeout: number = 30000): Promise<void> {
    if (this.isScanning()) {
      throw new BlackmagicBluetoothError('Already scanning')
    }

    this.scanState = ScanState.SCANNING
    console.log('[WebBluetoothAdapter] Starting mock scan for', timeout, 'ms')

    // Simulate discovering devices over time
    let deviceIndex = 0
    const discoverDevice = () => {
      if (deviceIndex < MOCK_DEVICES.length && this.isScanning()) {
        const device = MOCK_DEVICES[deviceIndex]
        console.log('[WebBluetoothAdapter] Mock discovered device:', device.name)
        this.deviceFoundCallbacks.forEach(callback => callback(device))
        deviceIndex++
        
        // Schedule next device discovery
        if (deviceIndex < MOCK_DEVICES.length) {
          setTimeout(discoverDevice, 2000 + Math.random() * 3000) // Random delay 2-5s
        }
      }
    }

    // Start discovering devices
    setTimeout(discoverDevice, 1000) // First device after 1s

    // Set scan timeout
    this.scanTimeout = setTimeout(() => {
      this.stopScan()
    }, timeout)
  }

  async stopScan(): Promise<void> {
    if (!this.isScanning()) {
      return
    }

    this.scanState = ScanState.STOPPED
    
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout)
      this.scanTimeout = undefined
    }

    console.log('[WebBluetoothAdapter] Mock scan stopped')
  }

  // ============================================================================
  // CONNECTION
  // ============================================================================

  async connect(deviceId: string): Promise<void> {
    console.log('[WebBluetoothAdapter] Mock connecting to device:', deviceId)
    
    // Find device in mock data
    const mockDevice = MOCK_DEVICES.find(d => d.id === deviceId)
    if (!mockDevice) {
      throw new BlackmagicBluetoothError(`Device not found: ${deviceId}`)
    }

    // Simulate connection process
    this.connectionStates.set(deviceId, ConnectionState.CONNECTING)
    this.connectionStateCallbacks.forEach(callback => 
      callback({
        device: this.convertToDeviceInfo(mockDevice),
        state: ConnectionState.CONNECTING
      })
    )

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))

    // Simulate successful connection
    const deviceInfo = this.convertToDeviceInfo(mockDevice)
    this.connectedDevices.set(deviceId, deviceInfo)
    this.connectionStates.set(deviceId, ConnectionState.CONNECTED)
    
    this.connectionStateCallbacks.forEach(callback => 
      callback({
        device: deviceInfo,
        state: ConnectionState.CONNECTED
      })
    )

    console.log('[WebBluetoothAdapter] Mock connected to:', mockDevice.name)
  }

  async disconnect(deviceId: string): Promise<void> {
    console.log('[WebBluetoothAdapter] Mock disconnecting from device:', deviceId)
    
    const deviceInfo = this.connectedDevices.get(deviceId)
    if (!deviceInfo) {
      throw new BlackmagicBluetoothError(`Device not connected: ${deviceId}`)
    }

    // Simulate disconnection
    this.connectedDevices.delete(deviceId)
    this.connectionStates.set(deviceId, ConnectionState.DISCONNECTED)
    
    this.connectionStateCallbacks.forEach(callback => 
      callback({
        device: deviceInfo,
        state: ConnectionState.DISCONNECTED
      })
    )

    console.log('[WebBluetoothAdapter] Mock disconnected from:', deviceInfo.name)
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  onDeviceFound(callback: (device: ScannedDevice) => void): () => void {
    this.deviceFoundCallbacks.push(callback)
    return () => {
      const index = this.deviceFoundCallbacks.indexOf(callback)
      if (index > -1) {
        this.deviceFoundCallbacks.splice(index, 1)
      }
    }
  }

  onConnectionStateChange(callback: (event: DeviceConnectionEvent) => void): () => void {
    this.connectionStateCallbacks.push(callback)
    return () => {
      const index = this.connectionStateCallbacks.indexOf(callback)
      if (index > -1) {
        this.connectionStateCallbacks.splice(index, 1)
      }
    }
  }

  onBluetoothStateChange(callback: (state: BluetoothAdapterState) => void): () => void {
    this.bluetoothStateCallbacks.push(callback)
    return () => {
      const index = this.bluetoothStateCallbacks.indexOf(callback)
      if (index > -1) {
        this.bluetoothStateCallbacks.splice(index, 1)
      }
    }
  }

  // ============================================================================
  // DEVICE SERVICES (Mock implementations)
  // ============================================================================

  async getDeviceInformation(deviceId: string): Promise<any> {
    console.log('[WebBluetoothAdapter] Mock getting device info for:', deviceId)
    
    // Return mock device information
    return {
      manufacturerName: 'Blackmagic Design',
      modelNumber: 'URSA Mini Pro 12K',
      serialNumber: 'BMD-MOCK-12345',
      hardwareRevision: '1.0',
      firmwareRevision: '7.9.1',
      softwareRevision: '7.9.1'
    }
  }

  async getBatteryLevel(deviceId: string): Promise<number> {
    console.log('[WebBluetoothAdapter] Mock getting battery level for:', deviceId)
    // Return random battery level for demo
    return Math.floor(Math.random() * 100)
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private convertToDeviceInfo(scannedDevice: ScannedDevice): BlackmagicDeviceInfo {
    return {
      id: scannedDevice.id,
      name: scannedDevice.name || scannedDevice.localName || 'Unknown Device',
      localName: scannedDevice.localName,
      rssi: scannedDevice.rssi,
      isConnectable: scannedDevice.isConnectable,
      serviceUUIDs: scannedDevice.serviceUUIDs || [],
      manufacturerData: scannedDevice.manufacturerData,
      serviceData: scannedDevice.serviceData || {},
      mtu: scannedDevice.mtu,
      isConnected: true
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async destroy(): Promise<void> {
    await this.stopScan()
    
    // Disconnect all devices
    const deviceIds = Array.from(this.connectedDevices.keys())
    for (const deviceId of deviceIds) {
      await this.disconnect(deviceId)
    }
    
    // Clear all callbacks
    this.deviceFoundCallbacks = []
    this.connectionStateCallbacks = []
    this.bluetoothStateCallbacks = []
  }
}

// Export singleton instance
export const webBluetoothAdapter = WebBluetoothAdapter.getInstance()