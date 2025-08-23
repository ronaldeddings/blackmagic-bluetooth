/**
 * Blackmagic Camera Bluetooth Types
 * 
 * TypeScript type definitions for Blackmagic Camera Bluetooth interface
 * Based on verified firmware binary analysis
 */

// ============================================================================
// VERIFIED BLUETOOTH SERVICE UUIDS
// ============================================================================

export const BLACKMAGIC_SERVICE_UUIDS = {
  // Generic Access Profile - CONFIRMED
  GENERIC_ACCESS_PROFILE: '00001800-0000-1000-8000-00805f9b34fb',
  
  // Generic Attribute Profile - CONFIRMED
  GENERIC_ATTRIBUTE_PROFILE: '00001801-0000-1000-8000-00805f9b34fb',
  
  // Device Information Service - CONFIRMED
  DEVICE_INFORMATION_SERVICE: '0000180a-0000-1000-8000-00805f9b34fb',
  
  // Battery Service - CONFIRMED
  BATTERY_SERVICE: '0000180f-0000-1000-8000-00805f9b34fb',
  
  // Human Interface Device - CONFIRMED
  HUMAN_INTERFACE_DEVICE: '00001812-0000-1000-8000-00805f9b34fb',
  
  // Audio Source - CONFIRMED
  AUDIO_SOURCE: '0000110a-0000-1000-8000-00805f9b34fb',
  
  // Audio Sink - CONFIRMED
  AUDIO_SINK: '0000110b-0000-1000-8000-00805f9b34fb',
  
  // Object Push Profile - CONFIRMED
  OBJECT_PUSH_PROFILE: '00001105-0000-1000-8000-00805f9b34fb',
  
  // File Transfer Profile - CONFIRMED
  FILE_TRANSFER_PROFILE: '00001106-0000-1000-8000-00805f9b34fb',
  
  // Nordic DFU Service - CONFIRMED
  NORDIC_DFU_SERVICE: '0000fe59-0000-1000-8000-00805f9b34fb'
} as const

// ============================================================================
// GATT CHARACTERISTICS
// ============================================================================

export const GATT_CHARACTERISTICS = {
  DEVICE_NAME: '00002a00-0000-1000-8000-00805f9b34fb',
  APPEARANCE: '00002a01-0000-1000-8000-00805f9b34fb',
  PERIPHERAL_CONNECTION_PARAMETERS: '00002a04-0000-1000-8000-00805f9b34fb',
  SERVICE_CHANGED: '00002a05-0000-1000-8000-00805f9b34fb',
  MANUFACTURER_NAME_STRING: '00002a29-0000-1000-8000-00805f9b34fb',
  MODEL_NUMBER_STRING: '00002a24-0000-1000-8000-00805f9b34fb',
  SERIAL_NUMBER_STRING: '00002a25-0000-1000-8000-00805f9b34fb',
  HARDWARE_REVISION_STRING: '00002a27-0000-1000-8000-00805f9b34fb',
  FIRMWARE_REVISION_STRING: '00002a26-0000-1000-8000-00805f9b34fb',
  SOFTWARE_REVISION_STRING: '00002a28-0000-1000-8000-00805f9b34fb',
  BATTERY_LEVEL: '00002a19-0000-1000-8000-00805f9b34fb',
  
  // HID Service characteristics
  HID_INFORMATION: '00002a4a-0000-1000-8000-00805f9b34fb',
  HID_REPORT_MAP: '00002a4b-0000-1000-8000-00805f9b34fb',
  HID_CONTROL_POINT: '00002a4c-0000-1000-8000-00805f9b34fb',
  HID_REPORT: '00002a4d-0000-1000-8000-00805f9b34fb',
  HID_PROTOCOL_MODE: '00002a4e-0000-1000-8000-00805f9b34fb'
} as const

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ServiceUUID = typeof BLACKMAGIC_SERVICE_UUIDS[keyof typeof BLACKMAGIC_SERVICE_UUIDS]
export type CharacteristicUUID = typeof GATT_CHARACTERISTICS[keyof typeof GATT_CHARACTERISTICS]

/**
 * Blackmagic Camera Device Information
 */
export interface BlackmagicDeviceInfo {
  id: string
  name?: string
  manufacturerName?: string
  modelNumber?: string
  serialNumber?: string
  hardwareRevision?: string
  firmwareRevision?: string
  softwareRevision?: string
  batteryLevel?: number
  rssi?: number
  isConnected: boolean
  lastSeen: Date
}

/**
 * Connection state for Blackmagic devices
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting'
}

/**
 * Scanning state for BLE devices
 */
export enum ScanState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  SCANNING = 'scanning',
  STOPPING = 'stopping'
}

/**
 * Bluetooth permission state
 */
export enum BluetoothPermissionState {
  UNKNOWN = 'unknown',
  GRANTED = 'granted',
  DENIED = 'denied',
  BLOCKED = 'blocked'
}

/**
 * Bluetooth adapter state
 */
export enum BluetoothAdapterState {
  UNKNOWN = 'Unknown',
  RESETTING = 'Resetting',
  UNSUPPORTED = 'Unsupported',
  UNAUTHORIZED = 'Unauthorized',
  POWERED_OFF = 'PoweredOff',
  POWERED_ON = 'PoweredOn'
}

/**
 * Error codes for Blackmagic Bluetooth operations
 */
export enum BlackmagicBluetoothError {
  PERMISSIONS_NOT_GRANTED = 'PERMISSIONS_NOT_GRANTED',
  BLUETOOTH_DISABLED = 'BLUETOOTH_DISABLED',
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  SERVICE_DISCOVERY_FAILED = 'SERVICE_DISCOVERY_FAILED',
  CHARACTERISTIC_READ_FAILED = 'CHARACTERISTIC_READ_FAILED',
  CHARACTERISTIC_WRITE_FAILED = 'CHARACTERISTIC_WRITE_FAILED',
  DEVICE_ALREADY_CONNECTED = 'DEVICE_ALREADY_CONNECTED',
  DEVICE_NOT_CONNECTED = 'DEVICE_NOT_CONNECTED',
  SCAN_FAILED = 'SCAN_FAILED',
  TIMEOUT = 'TIMEOUT'
}

/**
 * Configuration options for scanning
 */
export interface ScanOptions {
  allowDuplicates?: boolean
  scanMode?: 'opportunistic' | 'lowPower' | 'balanced' | 'lowLatency'
  timeoutMs?: number
  serviceUUIDs?: string[]
}

/**
 * Configuration options for connection
 */
export interface ConnectionOptions {
  autoConnect?: boolean
  requestMTU?: number
  refreshGatt?: boolean
  timeout?: number
}

/**
 * Scanned device result
 */
export interface ScannedDevice {
  id: string
  name?: string
  localName?: string
  rssi?: number
  manufacturerData?: ArrayBuffer
  serviceData?: Record<string, ArrayBuffer>
  serviceUUIDs?: string[]
  isConnectable?: boolean
  timestamp: Date
}

/**
 * Device connection event
 */
export interface DeviceConnectionEvent {
  device: BlackmagicDeviceInfo
  state: ConnectionState
  error?: Error
}

/**
 * Bluetooth service manager interface
 */
export interface IBlackmagicBluetoothService {
  // State management
  isScanning(): boolean
  getBluetoothState(): BluetoothAdapterState
  getConnectionState(deviceId: string): ConnectionState
  getConnectedDevices(): BlackmagicDeviceInfo[]
  
  // Permissions
  checkPermissions(): Promise<BluetoothPermissionState>
  requestPermissions(): Promise<boolean>
  
  // Scanning
  startScan(options?: ScanOptions): Promise<void>
  stopScan(): Promise<void>
  
  // Connection
  connectToDevice(deviceId: string, options?: ConnectionOptions): Promise<BlackmagicDeviceInfo>
  disconnectFromDevice(deviceId: string): Promise<void>
  
  // Service discovery
  discoverServices(deviceId: string): Promise<string[]>
  discoverCharacteristics(deviceId: string, serviceUUID: string): Promise<string[]>
  
  // Data operations
  readCharacteristic(deviceId: string, serviceUUID: string, characteristicUUID: string): Promise<string>
  writeCharacteristic(deviceId: string, serviceUUID: string, characteristicUUID: string, value: string): Promise<void>
  subscribeToCharacteristic(
    deviceId: string, 
    serviceUUID: string, 
    characteristicUUID: string, 
    callback: (error: Error | null, data: string | null) => void
  ): Promise<() => void>
  
  // Device information
  readDeviceInformation(deviceId: string): Promise<Partial<BlackmagicDeviceInfo>>
  readBatteryLevel(deviceId: string): Promise<number>
  
  // Event listeners
  onDeviceFound(callback: (device: ScannedDevice) => void): () => void
  onConnectionStateChange(callback: (event: DeviceConnectionEvent) => void): () => void
  onBluetoothStateChange(callback: (state: BluetoothAdapterState) => void): () => void
  
  // Cleanup
  destroy(): Promise<void>
}

/**
 * Utility class for Blackmagic Bluetooth operations
 */
export class BlackmagicBluetoothUtils {
  /**
   * Check if device is likely a Blackmagic camera based on name
   */
  static isBlackmagicDevice(name?: string): boolean {
    if (!name) return false
    const lowerName = name.toLowerCase()
    return lowerName.includes('blackmagic') || 
           lowerName.includes('bmpcc') ||
           lowerName.includes('ursa') ||
           lowerName.includes('studio')
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Parse manufacturer data to extract device information
   */
  static parseManufacturerData(data: ArrayBuffer): Record<string, any> {
    // This would contain parsing logic for Blackmagic-specific manufacturer data
    // Implementation would depend on actual manufacturer data format
    return {}
  }

  /**
   * Generate a timeout promise
   */
  static createTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      })
    ])
  }

  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  /**
   * Convert short UUID to full UUID
   */
  static expandUUID(shortUUID: string): string {
    if (shortUUID.length === 4) {
      return `0000${shortUUID}-0000-1000-8000-00805f9b34fb`
    }
    return shortUUID
  }
}

// ============================================================================
// PHASE 3: CAMERA CONTROL TYPES
// ============================================================================

/**
 * Camera recording states
 */
export enum RecordingState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RECORDING = 'recording',
  STOPPING = 'stopping',
  PAUSED = 'paused'
}

/**
 * Camera control commands for HID service
 */
export enum CameraControlCommand {
  // Recording controls
  RECORD_START = 0x01,
  RECORD_STOP = 0x02,
  RECORD_TOGGLE = 0x03,
  RECORD_PAUSE = 0x04,
  
  // Focus controls
  FOCUS_AUTO = 0x10,
  FOCUS_MANUAL = 0x11,
  FOCUS_PUSH_AUTO = 0x12,
  FOCUS_NEAR = 0x13,
  FOCUS_FAR = 0x14,
  
  // Exposure controls
  EXPOSURE_AUTO = 0x20,
  EXPOSURE_MANUAL = 0x21,
  EXPOSURE_UP = 0x22,
  EXPOSURE_DOWN = 0x23,
  
  // ISO controls
  ISO_AUTO = 0x30,
  ISO_100 = 0x31,
  ISO_200 = 0x32,
  ISO_400 = 0x33,
  ISO_800 = 0x34,
  ISO_1600 = 0x35,
  ISO_3200 = 0x36,
  ISO_6400 = 0x37,
  
  // White balance controls
  WB_AUTO = 0x40,
  WB_DAYLIGHT = 0x41,
  WB_TUNGSTEN = 0x42,
  WB_FLUORESCENT = 0x43,
  WB_CLOUDY = 0x44,
  WB_SHADE = 0x45
}

/**
 * Camera settings for custom commands
 */
export interface CameraSettings {
  // Recording settings
  frameRate?: number
  resolution?: string
  codec?: string
  colorSpace?: string
  
  // Image settings
  iso?: number
  exposure?: number
  whiteBalance?: string
  focus?: number
  
  // Status
  recordingState: RecordingState
  batteryLevel?: number
  storageRemaining?: number
  temperature?: number
}

/**
 * Frame rate options
 */
export enum FrameRate {
  FPS_24 = 24,
  FPS_25 = 25,
  FPS_30 = 30,
  FPS_50 = 50,
  FPS_60 = 60,
  FPS_120 = 120
}

/**
 * Resolution options
 */
export enum Resolution {
  HD_720P = '1280x720',
  FHD_1080P = '1920x1080',
  UHD_4K = '3840x2160',
  DCI_4K = '4096x2160'
}

/**
 * Codec options
 */
export enum Codec {
  H264 = 'H.264',
  H265 = 'H.265',
  PRORES = 'ProRes',
  BRAW = 'Blackmagic RAW'
}

/**
 * Color space options
 */
export enum ColorSpace {
  REC709 = 'Rec. 709',
  REC2020 = 'Rec. 2020',
  P3D65 = 'P3-D65'
}

/**
 * HID report structure for camera commands
 */
export interface HIDReport {
  reportId: number
  command: CameraControlCommand
  data?: Uint8Array
}

/**
 * Camera control service interface
 */
export interface ICameraControlService {
  // Recording controls
  startRecording(deviceId: string): Promise<void>
  stopRecording(deviceId: string): Promise<void>
  toggleRecording(deviceId: string): Promise<void>
  getRecordingStatus(deviceId: string): Promise<RecordingState>
  
  // Focus controls
  setAutoFocus(deviceId: string): Promise<void>
  setManualFocus(deviceId: string, value: number): Promise<void>
  pushAutoFocus(deviceId: string): Promise<void>
  adjustFocus(deviceId: string, direction: 'near' | 'far'): Promise<void>
  
  // Exposure controls
  setAutoExposure(deviceId: string): Promise<void>
  setManualExposure(deviceId: string, value: number): Promise<void>
  adjustExposure(deviceId: string, direction: 'up' | 'down'): Promise<void>
  
  // ISO controls
  setAutoISO(deviceId: string): Promise<void>
  setISO(deviceId: string, iso: number): Promise<void>
  
  // White balance controls
  setAutoWhiteBalance(deviceId: string): Promise<void>
  setWhiteBalance(deviceId: string, preset: string): Promise<void>
  
  // Settings
  setFrameRate(deviceId: string, frameRate: FrameRate): Promise<void>
  setResolution(deviceId: string, resolution: Resolution): Promise<void>
  setCodec(deviceId: string, codec: Codec): Promise<void>
  setColorSpace(deviceId: string, colorSpace: ColorSpace): Promise<void>
  
  // Status monitoring
  getCameraSettings(deviceId: string): Promise<CameraSettings>
  subscribeToCameraSettings(
    deviceId: string,
    callback: (settings: CameraSettings) => void
  ): Promise<() => void>
}

/**
 * HID Service interface
 */
export interface IHIDService {
  // HID Information
  readHIDInformation(deviceId: string): Promise<{
    bcdHID: number
    bCountryCode: number
    flags: number
  }>
  
  // Report Map
  readReportMap(deviceId: string): Promise<Uint8Array>
  
  // Protocol Mode
  readProtocolMode(deviceId: string): Promise<number>
  setProtocolMode(deviceId: string, mode: number): Promise<void>
  
  // HID Reports
  sendReport(deviceId: string, report: HIDReport): Promise<void>
  subscribeToReports(
    deviceId: string,
    callback: (report: HIDReport) => void
  ): Promise<() => void>
  
  // Control Point
  sendControlCommand(deviceId: string, command: number): Promise<void>
}

/**
 * Camera control event types
 */
export interface CameraControlEvent {
  deviceId: string
  type: 'recordingStateChanged' | 'settingsChanged' | 'error'
  data: any
  timestamp: Date
}

/**
 * Button mapping for camera controls
 */
export interface ButtonMapping {
  id: string
  name: string
  command: CameraControlCommand
  icon?: string
  description?: string
  category: 'recording' | 'focus' | 'exposure' | 'iso' | 'whiteBalance' | 'settings'
}

/**
 * Default button mappings for common camera controls
 */
export const DEFAULT_BUTTON_MAPPINGS: ButtonMapping[] = [
  {
    id: 'record_toggle',
    name: 'Record Toggle',
    command: CameraControlCommand.RECORD_TOGGLE,
    icon: 'record',
    description: 'Start/stop recording',
    category: 'recording'
  },
  {
    id: 'focus_auto',
    name: 'Auto Focus',
    command: CameraControlCommand.FOCUS_AUTO,
    icon: 'focus',
    description: 'Enable auto focus',
    category: 'focus'
  },
  {
    id: 'exposure_auto',
    name: 'Auto Exposure',
    command: CameraControlCommand.EXPOSURE_AUTO,
    icon: 'exposure',
    description: 'Enable auto exposure',
    category: 'exposure'
  },
  {
    id: 'iso_auto',
    name: 'Auto ISO',
    command: CameraControlCommand.ISO_AUTO,
    icon: 'iso',
    description: 'Enable auto ISO',
    category: 'iso'
  },
  {
    id: 'wb_auto',
    name: 'Auto White Balance',
    command: CameraControlCommand.WB_AUTO,
    icon: 'wb',
    description: 'Enable auto white balance',
    category: 'whiteBalance'
  }
]