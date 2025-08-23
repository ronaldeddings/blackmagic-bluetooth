/**
 * Blackmagic Bluetooth Manager
 * 
 * Main service class for managing Bluetooth connections to Blackmagic cameras
 */

import { BleManager, Device, BleError, State, Subscription } from 'react-native-ble-plx'
import { Platform, PermissionsAndroid } from 'react-native'
import { check, request, PERMISSIONS, RESULTS, PermissionStatus } from 'react-native-permissions'
import { WebBluetoothAdapter, webBluetoothAdapter } from './WebBluetoothAdapter'
import {
  IBlackmagicBluetoothService,
  BlackmagicDeviceInfo,
  ConnectionState,
  ScanState,
  BluetoothPermissionState,
  BluetoothAdapterState,
  BlackmagicBluetoothError,
  ScanOptions,
  ConnectionOptions,
  ScannedDevice,
  DeviceConnectionEvent,
  BLACKMAGIC_SERVICE_UUIDS,
  GATT_CHARACTERISTICS,
  BlackmagicBluetoothUtils
} from './types/BlackmagicTypes'
import { ServiceManager, CompleteDeviceInfo } from './ServiceManager'
import { CameraControlService, CameraSettingsCallback } from './CameraControlService'
import { FileTransferService } from './FileTransferService'
import { ObjectPushService } from './ObjectPushService'
import { AudioSourceService } from './AudioSourceService'
import { AudioSinkService } from './AudioSinkService'
import { DFUService } from './DFUService'
import { TimecodeService } from './TimecodeService'  
import { CameraStatusService } from './CameraStatusService'
import {
  RecordingState,
  CameraSettings,
  FrameRate,
  Resolution,
  Codec,
  ColorSpace,
  CameraControlCommand,
  ICameraControlService
} from './types/BlackmagicTypes'
import {
  IFileTransferService,
  IObjectPushService,
  DirectoryListing,
  FileTransferOptions,
  ObjectPushOptions,
  ObjectPushResult,
  ObjectPushProgress,
  LUTInfo,
  PresetInfo,
  IAudioSourceService,
  IAudioSinkService,
  AudioConfig,
  AudioStreamInfo,
  AudioInputSettings,
  AudioOutputSettings,
  AudioMeterData,
  AudioCapabilities,
  AudioCodec,
  AudioDataCallback,
  AudioLevelCallback
} from './types/BlackmagicTypes'

export class BlackmagicBluetoothManager implements IBlackmagicBluetoothService {
  private bleManager?: BleManager
  private webAdapter?: WebBluetoothAdapter
  private isWebEnvironment: boolean = Platform.OS === 'web' || typeof window !== 'undefined'
  private scanState: ScanState = ScanState.STOPPED
  private connectedDevices: Map<string, BlackmagicDeviceInfo> = new Map()
  private connectionStates: Map<string, ConnectionState> = new Map()
  private bluetoothState: BluetoothAdapterState = BluetoothAdapterState.UNKNOWN
  
  // Phase 2 Services
  private serviceManager: ServiceManager
  
  // Phase 3 Services  
  private cameraControlService: CameraControlService
  
  // Phase 4 Services
  private fileTransferService: FileTransferService
  private objectPushService: ObjectPushService
  
  // Phase 5 Services
  private audioSourceService: AudioSourceService
  private audioSinkService: AudioSinkService
  
  // Phase 6 Services
  private dfuService: DFUService
  private timecodeService: TimecodeService
  private cameraStatusService: CameraStatusService
  
  // Event listeners
  private deviceFoundCallbacks: ((device: ScannedDevice) => void)[] = []
  private connectionStateCallbacks: ((event: DeviceConnectionEvent) => void)[] = []
  private bluetoothStateCallbacks: ((state: BluetoothAdapterState) => void)[] = []
  
  // Subscriptions
  private bluetoothStateSubscription?: Subscription
  private scanTimeout?: NodeJS.Timeout
  
  constructor() {
    // Initialize appropriate Bluetooth manager based on environment
    if (this.isWebEnvironment) {
      console.log('[BlackmagicBluetoothManager] Initializing web environment with mock adapter')
      this.webAdapter = webBluetoothAdapter
    } else {
      console.log('[BlackmagicBluetoothManager] Initializing native environment with BLE manager')
      this.bleManager = new BleManager()
    }
    
    this.serviceManager = new ServiceManager(this)
    this.cameraControlService = new CameraControlService(this)
    this.fileTransferService = new FileTransferService(this)
    this.objectPushService = new ObjectPushService(this)
    this.audioSourceService = new AudioSourceService(this)
    this.audioSinkService = new AudioSinkService(this)
    this.dfuService = new DFUService(this)
    this.timecodeService = new TimecodeService(this)
    this.cameraStatusService = new CameraStatusService(this)
    this.initializeBluetoothStateListener()
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private initializeBluetoothStateListener(): void {
    if (this.isWebEnvironment && this.webAdapter) {
      // For web environment, use web adapter's state listener
      this.webAdapter.onBluetoothStateChange((state) => {
        this.bluetoothState = state
        this.bluetoothStateCallbacks.forEach(callback => callback(this.bluetoothState))
      })
      // Set initial state for web
      this.bluetoothState = this.webAdapter.getBluetoothState()
    } else if (this.bleManager) {
      // For native environment, use BLE manager's state listener
      this.bluetoothStateSubscription = this.bleManager.onStateChange((state) => {
        this.bluetoothState = state as BluetoothAdapterState
        this.bluetoothStateCallbacks.forEach(callback => callback(this.bluetoothState))
      }, true)
    }
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
    
    // If no deviceId provided, return overall connection state
    if (this.isWebEnvironment && this.webAdapter) {
      return this.webAdapter.getConnectionState()
    }
    
    const connectedCount = Array.from(this.connectionStates.values())
      .filter(state => state === ConnectionState.CONNECTED).length
    return connectedCount > 0 ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED
  }

  getConnectedDevices(): BlackmagicDeviceInfo[] {
    if (this.isWebEnvironment && this.webAdapter) {
      return this.webAdapter.getConnectedDevices()
    }
    return Array.from(this.connectedDevices.values())
  }

  getConnectedDevice(): BlackmagicDeviceInfo | null {
    if (this.isWebEnvironment && this.webAdapter) {
      return this.webAdapter.getConnectedDevice()
    }
    const devices = this.getConnectedDevices()
    return devices.length > 0 ? devices[0] : null
  }

  // ============================================================================
  // PERMISSIONS
  // ============================================================================

  async checkPermissions(): Promise<BluetoothPermissionState> {
    try {
      // Web environment always has "permissions" granted for mock functionality
      if (this.isWebEnvironment) {
        return BluetoothPermissionState.GRANTED
      }

      if (Platform.OS === 'ios') {
        const bluetoothStatus = await check(PERMISSIONS.IOS.BLUETOOTH)
        return this.mapPermissionStatus(bluetoothStatus)
      } else if (Platform.OS === 'android') {
        const apiLevel = parseInt(Platform.Version.toString(), 10)
        
        if (apiLevel >= 31) {
          // Android 12+ permissions
          const scanStatus = await check(PERMISSIONS.ANDROID.BLUETOOTH_SCAN)
          const connectStatus = await check(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT)
          
          if (scanStatus === RESULTS.GRANTED && connectStatus === RESULTS.GRANTED) {
            return BluetoothPermissionState.GRANTED
          } else if (scanStatus === RESULTS.BLOCKED || connectStatus === RESULTS.BLOCKED) {
            return BluetoothPermissionState.BLOCKED
          } else {
            return BluetoothPermissionState.DENIED
          }
        } else {
          // Android < 12 permissions
          const locationStatus = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)
          return this.mapPermissionStatus(locationStatus)
        }
      }
      
      return BluetoothPermissionState.UNKNOWN
    } catch (error) {
      console.error('Error checking Bluetooth permissions:', error)
      return BluetoothPermissionState.UNKNOWN
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      // Web environment always has "permissions" granted for mock functionality
      if (this.isWebEnvironment) {
        return true
      }

      if (Platform.OS === 'ios') {
        const bluetoothStatus = await request(PERMISSIONS.IOS.BLUETOOTH)
        return bluetoothStatus === RESULTS.GRANTED
      } else if (Platform.OS === 'android') {
        const apiLevel = parseInt(Platform.Version.toString(), 10)
        
        if (apiLevel >= 31) {
          // Android 12+ permissions
          const result = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          ])
          
          return (
            result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
            result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
            result['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
          )
        } else {
          // Android < 12 permissions
          const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
          return granted === PermissionsAndroid.RESULTS.GRANTED
        }
      }
      
      return false
    } catch (error) {
      console.error('Error requesting Bluetooth permissions:', error)
      return false
    }
  }

  private mapPermissionStatus(status: PermissionStatus): BluetoothPermissionState {
    switch (status) {
      case RESULTS.GRANTED:
        return BluetoothPermissionState.GRANTED
      case RESULTS.BLOCKED:
        return BluetoothPermissionState.BLOCKED
      case RESULTS.DENIED:
        return BluetoothPermissionState.DENIED
      default:
        return BluetoothPermissionState.UNKNOWN
    }
  }

  // ============================================================================
  // SCANNING
  // ============================================================================

  async startScan(options: ScanOptions = {}): Promise<void> {
    if (this.scanState === ScanState.SCANNING) {
      await this.stopScan()
    }

    // Check permissions first
    const hasPermissions = await this.requestPermissions()
    if (!hasPermissions) {
      throw new Error(BlackmagicBluetoothError.PERMISSIONS_NOT_GRANTED)
    }

    // Check if Bluetooth is enabled
    if (this.bluetoothState !== BluetoothAdapterState.POWERED_ON) {
      throw new Error(BlackmagicBluetoothError.BLUETOOTH_DISABLED)
    }

    this.scanState = ScanState.STARTING

    try {
      if (this.isWebEnvironment && this.webAdapter) {
        // Use web adapter for web environment
        await this.webAdapter.startScan(options.timeoutMs || 30000)
        this.scanState = ScanState.SCANNING
      } else if (this.bleManager) {
        // Use native BLE manager for native environment
        const serviceUUIDs = options.serviceUUIDs || Object.values(BLACKMAGIC_SERVICE_UUIDS)
        
        this.bleManager.startDeviceScan(
          serviceUUIDs,
          {
            allowDuplicates: options.allowDuplicates || false,
            scanMode: this.mapScanMode(options.scanMode)
          },
          this.handleDeviceFound.bind(this)
        )

        this.scanState = ScanState.SCANNING

        // Set up scan timeout if specified
        if (options.timeoutMs) {
          this.scanTimeout = setTimeout(() => {
            this.stopScan()
          }, options.timeoutMs)
        }
      } else {
        throw new Error('No Bluetooth manager available')
      }

    } catch (error) {
      this.scanState = ScanState.STOPPED
      throw new Error(`${BlackmagicBluetoothError.SCAN_FAILED}: ${(error as Error).message}`)
    }
  }

  async stopScan(): Promise<void> {
    if (this.scanState === ScanState.STOPPED) {
      return
    }

    this.scanState = ScanState.STOPPING

    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout)
      this.scanTimeout = undefined
    }

    try {
      if (this.isWebEnvironment && this.webAdapter) {
        // Use web adapter for web environment
        await this.webAdapter.stopScan()
      } else if (this.bleManager) {
        // Use native BLE manager for native environment
        this.bleManager.stopDeviceScan()
      }
      
      this.scanState = ScanState.STOPPED
    } catch (error) {
      console.error('Error stopping scan:', error)
      this.scanState = ScanState.STOPPED
    }
  }

  private handleDeviceFound(error: BleError | null, device: Device | null): void {
    if (error) {
      console.error('Device scan error:', error)
      this.scanState = ScanState.STOPPED
      return
    }

    if (device) {
      const scannedDevice: ScannedDevice = {
        id: device.id,
        name: device.name || undefined,
        localName: device.localName || undefined,
        rssi: device.rssi || undefined,
        serviceUUIDs: device.serviceUUIDs || undefined,
        isConnectable: device.isConnectable || undefined,
        timestamp: new Date()
      }

      this.deviceFoundCallbacks.forEach(callback => callback(scannedDevice))
    }
  }

  private mapScanMode(scanMode?: string): any {
    // Map our scan mode strings to react-native-ble-plx scan modes
    // This would need to be implemented based on the actual library constants
    return undefined // Default mode
  }

  // ============================================================================
  // CONNECTION
  // ============================================================================

  async connectToDevice(deviceId: string, options: ConnectionOptions = {}): Promise<BlackmagicDeviceInfo> {
    const currentState = this.getConnectionState(deviceId)
    
    if (currentState === ConnectionState.CONNECTED) {
      throw new Error(BlackmagicBluetoothError.DEVICE_ALREADY_CONNECTED)
    }

    if (currentState === ConnectionState.CONNECTING) {
      throw new Error('Device is already connecting')
    }

    this.setConnectionState(deviceId, ConnectionState.CONNECTING)

    try {
      if (this.isWebEnvironment && this.webAdapter) {
        // Use web adapter for web environment
        await this.webAdapter.connect(deviceId)
        const deviceInfo = this.webAdapter.getConnectedDevice()
        if (!deviceInfo) {
          throw new Error('Failed to get connected device info')
        }
        
        this.connectedDevices.set(deviceId, deviceInfo)
        this.setConnectionState(deviceId, ConnectionState.CONNECTED)
        return deviceInfo
        
      } else if (this.bleManager) {
        // Use native BLE manager for native environment
        const connectPromise = this.bleManager.connectToDevice(deviceId, {
          autoConnect: options.autoConnect,
          requestMTU: options.requestMTU,
          refreshGatt: options.refreshGatt,
          timeout: options.timeout || 10000
        })

        const device = options.timeout
          ? await BlackmagicBluetoothUtils.createTimeout(
              connectPromise,
              options.timeout,
              BlackmagicBluetoothError.TIMEOUT
            )
          : await connectPromise

        // Discover services and characteristics
        await device.discoverAllServicesAndCharacteristics()

        // Read device information
        const deviceInfo = await this.createDeviceInfo(device)
        
        this.connectedDevices.set(deviceId, deviceInfo)
        this.setConnectionState(deviceId, ConnectionState.CONNECTED)

        return deviceInfo
      } else {
        throw new Error('No Bluetooth manager available')
      }

    } catch (error) {
      this.setConnectionState(deviceId, ConnectionState.DISCONNECTED)
      throw new Error(`${BlackmagicBluetoothError.CONNECTION_FAILED}: ${(error as Error).message}`)
    }
  }

  async disconnectFromDevice(deviceId: string): Promise<void> {
    const currentState = this.getConnectionState(deviceId)
    
    if (currentState === ConnectionState.DISCONNECTED) {
      return
    }

    this.setConnectionState(deviceId, ConnectionState.DISCONNECTING)

    try {
      if (this.isWebEnvironment && this.webAdapter) {
        // Use web adapter for web environment
        await this.webAdapter.disconnect(deviceId)
      } else if (this.bleManager) {
        // Use native BLE manager for native environment
        await this.bleManager.cancelDeviceConnection(deviceId)
      }
      this.connectedDevices.delete(deviceId)
      this.setConnectionState(deviceId, ConnectionState.DISCONNECTED)
      
      // Clean up Phase 2 service resources for this device
      this.serviceManager.cleanupDevice(deviceId)
      
      // Clean up Phase 3 service resources for this device
      this.cameraControlService.cleanupDevice(deviceId)
      
      // Clean up Phase 4 service resources for this device
      this.fileTransferService.cleanupDevice(deviceId)
      this.objectPushService.cleanupDevice(deviceId)
      
      // Clean up Phase 5 service resources for this device
      this.audioSourceService.cleanup(deviceId)
      this.audioSinkService.cleanup(deviceId)
      
      // Clean up Phase 6 service resources for this device
      this.dfuService.cleanupDevice(deviceId)
      this.timecodeService.cleanupDevice(deviceId)
      this.cameraStatusService.cleanupDevice(deviceId)
    } catch (error) {
      console.error('Error disconnecting device:', error)
      this.setConnectionState(deviceId, ConnectionState.DISCONNECTED)
      
      // Clean up service resources even on error
      this.serviceManager.cleanupDevice(deviceId)
      this.cameraControlService.cleanupDevice(deviceId)
      this.fileTransferService.cleanupDevice(deviceId)
      this.objectPushService.cleanupDevice(deviceId)
      this.audioSourceService.cleanup(deviceId)
      this.audioSinkService.cleanup(deviceId)
      this.dfuService.cleanupDevice(deviceId)
      this.timecodeService.cleanupDevice(deviceId)
      this.cameraStatusService.cleanupDevice(deviceId)
    }
  }

  private setConnectionState(deviceId: string, state: ConnectionState): void {
    const previousState = this.connectionStates.get(deviceId)
    this.connectionStates.set(deviceId, state)

    if (previousState !== state) {
      const device = this.connectedDevices.get(deviceId)
      if (device) {
        const event: DeviceConnectionEvent = { device, state }
        this.connectionStateCallbacks.forEach(callback => callback(event))
      }
    }
  }

  private async createDeviceInfo(device: Device): Promise<BlackmagicDeviceInfo> {
    const deviceInfo: BlackmagicDeviceInfo = {
      id: device.id,
      name: device.name || undefined,
      rssi: device.rssi || undefined,
      isConnected: true,
      lastSeen: new Date()
    }

    try {
      // Try to read device information
      const additionalInfo = await this.readDeviceInformation(device.id)
      Object.assign(deviceInfo, additionalInfo)
    } catch (error) {
      console.warn('Could not read device information:', error)
    }

    return deviceInfo
  }

  // ============================================================================
  // SERVICE DISCOVERY
  // ============================================================================

  async discoverServices(deviceId: string): Promise<string[]> {
    try {
      const services = await this.bleManager.servicesForDevice(deviceId)
      return services.map(service => service.uuid)
    } catch (error) {
      throw new Error(`${BlackmagicBluetoothError.SERVICE_DISCOVERY_FAILED}: ${(error as Error).message}`)
    }
  }

  async discoverCharacteristics(deviceId: string, serviceUUID: string): Promise<string[]> {
    try {
      const characteristics = await this.bleManager.characteristicsForDevice(deviceId, serviceUUID)
      return characteristics.map(char => char.uuid)
    } catch (error) {
      throw new Error(`${BlackmagicBluetoothError.SERVICE_DISCOVERY_FAILED}: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // DATA OPERATIONS
  // ============================================================================

  async readCharacteristic(deviceId: string, serviceUUID: string, characteristicUUID: string): Promise<string> {
    try {
      const characteristic = await this.bleManager.readCharacteristicForDevice(
        deviceId,
        serviceUUID,
        characteristicUUID
      )
      return characteristic.value || ''
    } catch (error) {
      throw new Error(`${BlackmagicBluetoothError.CHARACTERISTIC_READ_FAILED}: ${(error as Error).message}`)
    }
  }

  async writeCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    value: string
  ): Promise<void> {
    try {
      await this.bleManager.writeCharacteristicWithResponseForDevice(
        deviceId,
        serviceUUID,
        characteristicUUID,
        value
      )
    } catch (error) {
      throw new Error(`${BlackmagicBluetoothError.CHARACTERISTIC_WRITE_FAILED}: ${(error as Error).message}`)
    }
  }

  async subscribeToCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    callback: (error: Error | null, data: string | null) => void
  ): Promise<() => void> {
    try {
      const subscription = this.bleManager.monitorCharacteristicForDevice(
        deviceId,
        serviceUUID,
        characteristicUUID,
        (error, characteristic) => {
          if (error) {
            callback(error, null)
          } else {
            callback(null, characteristic?.value || null)
          }
        }
      )

      return () => subscription.remove()
    } catch (error) {
      throw new Error(`Failed to subscribe to characteristic: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // DEVICE INFORMATION
  // ============================================================================

  async readDeviceInformation(deviceId: string): Promise<Partial<BlackmagicDeviceInfo>> {
    const info: Partial<BlackmagicDeviceInfo> = {}

    try {
      // Read manufacturer name
      try {
        const manufacturerName = await this.readCharacteristic(
          deviceId,
          BLACKMAGIC_SERVICE_UUIDS.DEVICE_INFORMATION_SERVICE,
          GATT_CHARACTERISTICS.MANUFACTURER_NAME_STRING
        )
        info.manufacturerName = atob(manufacturerName)
      } catch (error) {
        console.warn('Could not read manufacturer name:', error)
      }

      // Read model number
      try {
        const modelNumber = await this.readCharacteristic(
          deviceId,
          BLACKMAGIC_SERVICE_UUIDS.DEVICE_INFORMATION_SERVICE,
          GATT_CHARACTERISTICS.MODEL_NUMBER_STRING
        )
        info.modelNumber = atob(modelNumber)
      } catch (error) {
        console.warn('Could not read model number:', error)
      }

      // Read serial number
      try {
        const serialNumber = await this.readCharacteristic(
          deviceId,
          BLACKMAGIC_SERVICE_UUIDS.DEVICE_INFORMATION_SERVICE,
          GATT_CHARACTERISTICS.SERIAL_NUMBER_STRING
        )
        info.serialNumber = atob(serialNumber)
      } catch (error) {
        console.warn('Could not read serial number:', error)
      }

      // Read firmware revision
      try {
        const firmwareRevision = await this.readCharacteristic(
          deviceId,
          BLACKMAGIC_SERVICE_UUIDS.DEVICE_INFORMATION_SERVICE,
          GATT_CHARACTERISTICS.FIRMWARE_REVISION_STRING
        )
        info.firmwareRevision = atob(firmwareRevision)
      } catch (error) {
        console.warn('Could not read firmware revision:', error)
      }

    } catch (error) {
      console.warn('Error reading device information:', error)
    }

    return info
  }

  async readBatteryLevel(deviceId: string): Promise<number> {
    try {
      const batteryValue = await this.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.BATTERY_SERVICE,
        GATT_CHARACTERISTICS.BATTERY_LEVEL
      )
      
      // Battery level is typically a single byte (0-100)
      const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(batteryValue)
      const uint8Array = new Uint8Array(buffer)
      return uint8Array[0] || 0
    } catch (error) {
      throw new Error(`Failed to read battery level: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // CONVENIENCE METHODS (Aliases for compatibility)
  // ============================================================================

  async connect(deviceId: string, options?: ConnectionOptions): Promise<BlackmagicDeviceInfo> {
    return this.connectToDevice(deviceId, options)
  }

  async disconnect(deviceId?: string): Promise<void> {
    if (deviceId) {
      return this.disconnectFromDevice(deviceId)
    }
    
    // If no deviceId provided, disconnect the first connected device
    const connectedDevices = this.getConnectedDevices()
    if (connectedDevices.length > 0) {
      return this.disconnectFromDevice(connectedDevices[0].id)
    }
  }

  // Note: startScan and stopScan are already the main methods, no aliases needed

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  onDeviceFound(callback: (device: ScannedDevice) => void): () => void {
    this.deviceFoundCallbacks.push(callback)
    
    // For web environment, also register with web adapter
    let webUnsubscribe: (() => void) | undefined
    if (this.isWebEnvironment && this.webAdapter) {
      webUnsubscribe = this.webAdapter.onDeviceFound(callback)
    }
    
    return () => {
      const index = this.deviceFoundCallbacks.indexOf(callback)
      if (index > -1) {
        this.deviceFoundCallbacks.splice(index, 1)
      }
      if (webUnsubscribe) {
        webUnsubscribe()
      }
    }
  }

  onConnectionStateChange(callback: (event: DeviceConnectionEvent) => void): () => void {
    this.connectionStateCallbacks.push(callback)
    
    // For web environment, also register with web adapter
    let webUnsubscribe: (() => void) | undefined
    if (this.isWebEnvironment && this.webAdapter) {
      webUnsubscribe = this.webAdapter.onConnectionStateChange(callback)
    }
    
    return () => {
      const index = this.connectionStateCallbacks.indexOf(callback)
      if (index > -1) {
        this.connectionStateCallbacks.splice(index, 1)
      }
      if (webUnsubscribe) {
        webUnsubscribe()
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
  // PHASE 2 SERVICE METHODS
  // ============================================================================

  /**
   * Read complete device information including GAP, Device Info, and Battery
   */
  async readCompleteDeviceInfo(deviceId: string): Promise<CompleteDeviceInfo> {
    return await this.serviceManager.readCompleteDeviceInfo(deviceId)
  }

  /**
   * Subscribe to battery level notifications
   */
  async subscribeToBatteryLevel(
    deviceId: string, 
    callback: (batteryInfo: { level: number; lastUpdated: Date }) => void
  ): Promise<() => void> {
    return await this.serviceManager.subscribeToBatteryLevel(deviceId, callback)
  }

  /**
   * Get cached battery information
   */
  getCachedBatteryInfo(deviceId: string): { level: number; lastUpdated: Date } | null {
    return this.serviceManager.getCachedBatteryInfo(deviceId)
  }

  /**
   * Check if device is a confirmed Blackmagic camera
   */
  async isBlackmagicCamera(deviceId: string): Promise<boolean> {
    return await this.serviceManager.isBlackmagicCamera(deviceId)
  }

  /**
   * Get human-readable device summary
   */
  async getDeviceSummary(deviceId: string): Promise<string> {
    return await this.serviceManager.getDeviceSummary(deviceId)
  }

  /**
   * Discover available services for a device
   */
  async discoverAvailableServices(deviceId: string): Promise<{
    gap: boolean
    deviceInformation: boolean
    battery: boolean
    hid: boolean
  }> {
    return await this.serviceManager.discoverAvailableServices(deviceId)
  }

  /**
   * Access to individual service managers
   */
  get services() {
    return {
      gap: this.serviceManager.gap,
      deviceInformation: this.serviceManager.deviceInformation,
      battery: this.serviceManager.battery,
      cameraControl: this.cameraControlService,
      fileTransfer: this.fileTransferService,
      objectPush: this.objectPushService
    }
  }

  // ============================================================================
  // PHASE 3 CAMERA CONTROL METHODS
  // ============================================================================

  /**
   * Recording Controls
   */
  async startRecording(deviceId: string): Promise<void> {
    return await this.cameraControlService.startRecording(deviceId)
  }

  async stopRecording(deviceId: string): Promise<void> {
    return await this.cameraControlService.stopRecording(deviceId)
  }

  async toggleRecording(deviceId: string): Promise<void> {
    return await this.cameraControlService.toggleRecording(deviceId)
  }

  async getRecordingStatus(deviceId: string): Promise<RecordingState> {
    return await this.cameraControlService.getRecordingStatus(deviceId)
  }

  /**
   * Focus Controls
   */
  async setAutoFocus(deviceId: string): Promise<void> {
    return await this.cameraControlService.setAutoFocus(deviceId)
  }

  async setManualFocus(deviceId: string, value: number): Promise<void> {
    return await this.cameraControlService.setManualFocus(deviceId, value)
  }

  async pushAutoFocus(deviceId: string): Promise<void> {
    return await this.cameraControlService.pushAutoFocus(deviceId)
  }

  async adjustFocus(deviceId: string, direction: 'near' | 'far'): Promise<void> {
    return await this.cameraControlService.adjustFocus(deviceId, direction)
  }

  /**
   * Exposure Controls
   */
  async setAutoExposure(deviceId: string): Promise<void> {
    return await this.cameraControlService.setAutoExposure(deviceId)
  }

  async setManualExposure(deviceId: string, value: number): Promise<void> {
    return await this.cameraControlService.setManualExposure(deviceId, value)
  }

  async adjustExposure(deviceId: string, direction: 'up' | 'down'): Promise<void> {
    return await this.cameraControlService.adjustExposure(deviceId, direction)
  }

  /**
   * ISO Controls
   */
  async setAutoISO(deviceId: string): Promise<void> {
    return await this.cameraControlService.setAutoISO(deviceId)
  }

  async setISO(deviceId: string, iso: number): Promise<void> {
    return await this.cameraControlService.setISO(deviceId, iso)
  }

  /**
   * White Balance Controls
   */
  async setAutoWhiteBalance(deviceId: string): Promise<void> {
    return await this.cameraControlService.setAutoWhiteBalance(deviceId)
  }

  async setWhiteBalance(deviceId: string, preset: string): Promise<void> {
    return await this.cameraControlService.setWhiteBalance(deviceId, preset)
  }

  /**
   * Camera Settings Controls
   */
  async setFrameRate(deviceId: string, frameRate: FrameRate): Promise<void> {
    return await this.cameraControlService.setFrameRate(deviceId, frameRate)
  }

  async setResolution(deviceId: string, resolution: Resolution): Promise<void> {
    return await this.cameraControlService.setResolution(deviceId, resolution)
  }

  async setCodec(deviceId: string, codec: Codec): Promise<void> {
    return await this.cameraControlService.setCodec(deviceId, codec)
  }

  async setColorSpace(deviceId: string, colorSpace: ColorSpace): Promise<void> {
    return await this.cameraControlService.setColorSpace(deviceId, colorSpace)
  }

  /**
   * Camera Status Monitoring
   */
  async getCameraSettings(deviceId: string): Promise<CameraSettings> {
    return await this.cameraControlService.getCameraSettings(deviceId)
  }

  async subscribeToCameraSettings(
    deviceId: string,
    callback: CameraSettingsCallback
  ): Promise<() => void> {
    return await this.cameraControlService.subscribeToCameraSettings(deviceId, callback)
  }

  /**
   * Convenience methods for common operations
   */
  async isRecording(deviceId: string): Promise<boolean> {
    const status = await this.getRecordingStatus(deviceId)
    return status === RecordingState.RECORDING
  }

  async getCameraStatus(deviceId: string): Promise<{
    isRecording: boolean
    settings: CameraSettings
    batteryLevel?: number
  }> {
    const [isRecording, settings, batteryInfo] = await Promise.all([
      this.isRecording(deviceId),
      this.getCameraSettings(deviceId),
      this.getCachedBatteryInfo(deviceId)
    ])

    return {
      isRecording,
      settings,
      batteryLevel: batteryInfo?.level
    }
  }

  // ============================================================================
  // PHASE 4 FILE TRANSFER METHODS
  // ============================================================================

  /**
   * File Transfer Profile (FTP) Operations
   */
  async listDirectory(deviceId: string, path: string = '/'): Promise<DirectoryListing> {
    return await this.fileTransferService.listDirectory(deviceId, path)
  }

  async downloadFile(deviceId: string, remotePath: string, options?: FileTransferOptions): Promise<ArrayBuffer> {
    return await this.fileTransferService.downloadFile(deviceId, remotePath, options)
  }

  async deleteFile(deviceId: string, filePath: string): Promise<void> {
    return await this.fileTransferService.deleteFile(deviceId, filePath)
  }

  async getStorageInfo(deviceId: string): Promise<{totalSpace: number, freeSpace: number, usedSpace: number}> {
    return await this.fileTransferService.getStorageInfo(deviceId)
  }

  /**
   * Object Push Profile (OPP) Operations
   */
  async uploadFile(deviceId: string, fileName: string, data: ArrayBuffer, remotePath: string, options?: ObjectPushOptions): Promise<ObjectPushResult> {
    return await this.objectPushService.uploadFile(deviceId, fileName, data, remotePath, options)
  }

  async uploadLUT(deviceId: string, lut: LUTInfo, data: ArrayBuffer, options?: ObjectPushOptions): Promise<ObjectPushResult> {
    return await this.objectPushService.uploadLUT(deviceId, lut, data, options)
  }

  async uploadPreset(deviceId: string, preset: PresetInfo, options?: ObjectPushOptions): Promise<ObjectPushResult> {
    return await this.objectPushService.uploadPreset(deviceId, preset, options)
  }

  async uploadConfigFile(deviceId: string, fileName: string, configData: any, options?: ObjectPushOptions): Promise<ObjectPushResult> {
    return await this.objectPushService.uploadConfigFile(deviceId, fileName, configData, options)
  }

  /**
   * File Transfer Progress Monitoring
   */
  onFileTransferProgress(deviceId: string, callback: (progress: ObjectPushProgress) => void): () => void {
    return this.objectPushService.onProgress(deviceId, callback)
  }

  /**
   * Batch File Operations
   */
  async uploadMultipleFiles(deviceId: string, files: Array<{fileName: string, data: ArrayBuffer, remotePath: string}>, options?: ObjectPushOptions): Promise<ObjectPushResult[]> {
    return await this.objectPushService.uploadMultipleFiles(deviceId, files, options)
  }

  /**
   * Queue Management
   */
  getUploadQueueStatus(deviceId: string): {pending: number, inProgress: number, completed: number, failed: number} {
    return this.objectPushService.getQueueStatus(deviceId)
  }

  async clearUploadQueue(deviceId: string): Promise<void> {
    return await this.objectPushService.clearQueue(deviceId)
  }

  async pauseUploads(deviceId: string): Promise<void> {
    return await this.objectPushService.pauseUploads(deviceId)
  }

  async resumeUploads(deviceId: string): Promise<void> {
    return await this.objectPushService.resumeUploads(deviceId)
  }

  // ============================================================================
  // PHASE 5 AUDIO METHODS
  // ============================================================================

  // Audio Source Service methods (UUID 0x110A)

  /**
   * Start streaming audio from camera
   */
  async startAudioStream(deviceId: string, config: AudioConfig): Promise<string> {
    return this.audioSourceService.startAudioStream(deviceId, config)
  }

  /**
   * Stop audio stream
   */
  async stopAudioStream(deviceId: string, streamId: string): Promise<void> {
    return this.audioSourceService.stopAudioStream(deviceId, streamId)
  }

  /**
   * Pause audio stream
   */
  async pauseAudioStream(deviceId: string, streamId: string): Promise<void> {
    return this.audioSourceService.pauseAudioStream(deviceId, streamId)
  }

  /**
   * Resume audio stream
   */
  async resumeAudioStream(deviceId: string, streamId: string): Promise<void> {
    return this.audioSourceService.resumeAudioStream(deviceId, streamId)
  }

  /**
   * Get active audio streams
   */
  async getActiveAudioStreams(deviceId: string): Promise<AudioStreamInfo[]> {
    return this.audioSourceService.getActiveStreams(deviceId)
  }

  /**
   * Get audio stream information
   */
  async getAudioStreamInfo(deviceId: string, streamId: string): Promise<AudioStreamInfo> {
    return this.audioSourceService.getStreamInfo(deviceId, streamId)
  }

  /**
   * Configure audio input settings
   */
  async configureAudioInput(deviceId: string, settings: AudioInputSettings): Promise<void> {
    return this.audioSourceService.configureAudioInput(deviceId, settings)
  }

  /**
   * Get audio input settings
   */
  async getAudioInputSettings(deviceId: string): Promise<AudioInputSettings> {
    return this.audioSourceService.getAudioInputSettings(deviceId)
  }

  /**
   * Subscribe to real-time audio level updates
   */
  async subscribeToAudioLevels(
    deviceId: string,
    callback: AudioLevelCallback
  ): Promise<() => void> {
    return this.audioSourceService.subscribeToAudioLevels(deviceId, callback)
  }

  /**
   * Get current audio levels (one-time read)
   */
  async getAudioLevels(deviceId: string): Promise<AudioMeterData> {
    return this.audioSourceService.getAudioLevels(deviceId)
  }

  /**
   * Subscribe to raw audio data stream
   */
  async subscribeToAudioData(
    deviceId: string,
    streamId: string,
    callback: AudioDataCallback
  ): Promise<() => void> {
    return this.audioSourceService.subscribeToAudioData(deviceId, streamId, callback)
  }

  /**
   * Get audio capabilities of the device
   */
  async getAudioCapabilities(deviceId: string): Promise<AudioCapabilities> {
    return this.audioSourceService.getAudioCapabilities(deviceId)
  }

  // Audio Sink Service methods (UUID 0x110B)

  /**
   * Send raw audio data to camera
   */
  async sendAudioData(deviceId: string, audioData: ArrayBuffer): Promise<void> {
    return this.audioSinkService.sendAudioData(deviceId, audioData)
  }

  /**
   * Start talkback session (send audio to camera)
   */
  async startTalkback(deviceId: string, config: AudioConfig): Promise<string> {
    return this.audioSinkService.startTalkback(deviceId, config)
  }

  /**
   * Stop talkback session
   */
  async stopTalkback(deviceId: string, talkbackId: string): Promise<void> {
    return this.audioSinkService.stopTalkback(deviceId, talkbackId)
  }

  /**
   * Configure audio output settings
   */
  async configureAudioOutput(deviceId: string, settings: AudioOutputSettings): Promise<void> {
    return this.audioSinkService.configureAudioOutput(deviceId, settings)
  }

  /**
   * Get audio output settings
   */
  async getAudioOutputSettings(deviceId: string): Promise<AudioOutputSettings> {
    return this.audioSinkService.getAudioOutputSettings(deviceId)
  }

  /**
   * Get supported audio codecs for sink
   */
  async getSupportedAudioCodecs(deviceId: string): Promise<AudioCodec[]> {
    return this.audioSinkService.getSupportedCodecs(deviceId)
  }

  /**
   * Negotiate audio codec with camera
   */
  async negotiateAudioCodec(deviceId: string, preferredCodec: AudioCodec): Promise<AudioCodec> {
    return this.audioSinkService.negotiateCodec(deviceId, preferredCodec)
  }

  /**
   * Get active talkback sessions
   */
  async getTalkbackSessions(deviceId: string): Promise<string[]> {
    return this.audioSinkService.getTalkbackSessions(deviceId)
  }

  /**
   * Configure talkback settings
   */
  async configureTalkback(deviceId: string, settings: {
    level: number
    codec: AudioCodec
    quality: any
  }): Promise<void> {
    return this.audioSinkService.configureTalkback(deviceId, settings)
  }

  // ============================================================================
  // PHASE 6 ADVANCED FEATURES METHODS
  // ============================================================================

  // DFU (Device Firmware Update) Service Methods

  /**
   * Detect firmware version and device information
   */
  async detectFirmwareVersion(deviceId: string) {
    return await this.dfuService.detectFirmwareVersion(deviceId)
  }

  /**
   * Check if DFU service is available on device
   */
  async isDFUServiceAvailable(deviceId: string): Promise<boolean> {
    return await this.dfuService.isDFUServiceAvailable(deviceId)
  }

  /**
   * Check for available firmware updates
   */
  async checkForFirmwareUpdates(deviceId: string) {
    return await this.dfuService.checkForUpdates(deviceId)
  }

  /**
   * Perform Device Firmware Update
   */
  async performDFUUpdate(deviceId: string, firmwareFile: any, options: any = {}) {
    return await this.dfuService.performDFUUpdate(deviceId, firmwareFile, options)
  }

  /**
   * Get DFU update progress
   */
  getDFUProgress(deviceId: string) {
    return this.dfuService.getUpdateProgress(deviceId)
  }

  /**
   * Cancel firmware update
   */
  async cancelFirmwareUpdate(deviceId: string): Promise<void> {
    return await this.dfuService.cancelUpdate(deviceId)
  }

  // Timecode Service Methods

  /**
   * Read current timecode from camera
   */
  async readCurrentTimecode(deviceId: string) {
    return await this.timecodeService.readCurrentTimecode(deviceId)
  }

  /**
   * Set camera timecode
   */
  async setTimecode(deviceId: string, timecode: any): Promise<void> {
    return await this.timecodeService.setTimecode(deviceId, timecode)
  }

  /**
   * Set timecode to current system time
   */
  async setTimecodeToNow(deviceId: string, format?: any): Promise<void> {
    return await this.timecodeService.setTimecodeToNow(deviceId, format)
  }

  /**
   * Configure timecode settings
   */
  async configureTimecode(deviceId: string, settings: any): Promise<void> {
    return await this.timecodeService.configureTimecode(deviceId, settings)
  }

  /**
   * Get current timecode settings
   */
  async getTimecodeSettings(deviceId: string) {
    return await this.timecodeService.getTimecodeSettings(deviceId)
  }

  /**
   * Subscribe to continuous timecode updates
   */
  async subscribeToTimecode(deviceId: string, callback: (timecode: any) => void): Promise<() => void> {
    return await this.timecodeService.subscribeToTimecode(deviceId, callback)
  }

  /**
   * Create multi-camera sync session
   */
  async createTimecodeSync(sessionId: string, masterId: string, slaveIds: string[], syncTolerance?: number): Promise<void> {
    return await this.timecodeService.createSyncSession(sessionId, masterId, slaveIds, syncTolerance)
  }

  /**
   * Sync all cameras to master timecode
   */
  async syncCameras(sessionId: string): Promise<void> {
    return await this.timecodeService.syncCameras(sessionId)
  }

  /**
   * Get sync status for session
   */
  getTimeccodeSyncStatus(sessionId: string) {
    return this.timecodeService.getSyncStatus(sessionId)
  }

  /**
   * Stop sync session
   */
  async stopTimecodeSync(sessionId: string): Promise<void> {
    return await this.timecodeService.stopSyncSession(sessionId)
  }

  /**
   * Get cached timecode
   */
  getCachedTimecode(deviceId: string) {
    return this.timecodeService.getCachedTimecode(deviceId)
  }

  // Camera Status Monitoring Service Methods

  /**
   * Start comprehensive status monitoring
   */
  async startStatusMonitoring(deviceId: string, callback: any, options: any = {}): Promise<void> {
    return await this.cameraStatusService.startStatusMonitoring(deviceId, callback, options)
  }

  /**
   * Stop status monitoring
   */
  stopStatusMonitoring(deviceId: string): void {
    return this.cameraStatusService.stopStatusMonitoring(deviceId)
  }

  /**
   * Get current status snapshot
   */
  async getCurrentCameraStatus(deviceId: string) {
    return await this.cameraStatusService.getCurrentStatus(deviceId)
  }

  /**
   * Get cached status snapshot
   */
  getCachedCameraStatus(deviceId: string) {
    return this.cameraStatusService.getCachedStatus(deviceId)
  }

  /**
   * Monitor recording status
   */
  async monitorRecordingStatus(deviceId: string) {
    return await this.cameraStatusService.monitorRecordingStatus(deviceId)
  }

  /**
   * Monitor storage status  
   */
  async monitorStorageStatus(deviceId: string) {
    return await this.cameraStatusService.monitorStorageStatus(deviceId)
  }

  /**
   * Monitor temperature readings
   */
  async monitorTemperature(deviceId: string) {
    return await this.cameraStatusService.monitorTemperature(deviceId)
  }

  /**
   * Monitor error states
   */
  async monitorCameraErrors(deviceId: string) {
    return await this.cameraStatusService.monitorErrors(deviceId)
  }

  /**
   * Monitor system health
   */
  async monitorSystemHealth(deviceId: string) {
    return await this.cameraStatusService.monitorSystemHealth(deviceId)
  }

  /**
   * Monitor power status
   */
  async monitorPowerStatus(deviceId: string) {
    return await this.cameraStatusService.monitorPowerStatus(deviceId)
  }

  /**
   * Subscribe to error notifications
   */
  async subscribeToErrors(deviceId: string, callback: any): Promise<() => void> {
    return await this.cameraStatusService.subscribeToErrors(deviceId, callback)
  }

  /**
   * Subscribe to temperature alerts
   */
  async subscribeToTemperatureAlerts(deviceId: string, callback: any): Promise<() => void> {
    return await this.cameraStatusService.subscribeToTemperatureAlerts(deviceId, callback)
  }

  /**
   * Get error history
   */
  getErrorHistory(deviceId: string) {
    return this.cameraStatusService.getErrorHistory(deviceId)
  }

  /**
   * Clear resolved errors
   */
  async clearResolvedErrors(deviceId: string): Promise<void> {
    return await this.cameraStatusService.clearResolvedErrors(deviceId)
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async destroy(): Promise<void> {
    // Stop scanning
    if (this.isScanning()) {
      await this.stopScan()
    }

    // Disconnect all devices
    const connectedDeviceIds = Array.from(this.connectedDevices.keys())
    await Promise.all(
      connectedDeviceIds.map(deviceId => this.disconnectFromDevice(deviceId))
    )

    // Clean up Phase 2 services
    this.serviceManager.cleanup()
    
    // Clean up Phase 3 services
    this.cameraControlService.cleanup()
    
    // Clean up Phase 4 services
    this.fileTransferService.cleanup()
    this.objectPushService.cleanup()
    
    // Clean up Phase 5 services
    this.audioSourceService.cleanup()
    this.audioSinkService.cleanup()
    
    // Clean up Phase 6 services
    this.dfuService.cleanup()
    this.timecodeService.cleanup()
    this.cameraStatusService.cleanup()

    // Clean up subscriptions
    if (this.bluetoothStateSubscription) {
      this.bluetoothStateSubscription.remove()
    }

    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout)
    }

    // Clear callbacks
    this.deviceFoundCallbacks = []
    this.connectionStateCallbacks = []
    this.bluetoothStateCallbacks = []

    // Destroy BLE manager
    this.bleManager.destroy()
  }
}

// Export singleton instance
export const blackmagicBluetoothManager = new BlackmagicBluetoothManager()