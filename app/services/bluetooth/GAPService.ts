/**
 * Generic Access Profile (GAP) Service Implementation
 * 
 * UUID: 0x1800
 * Handles device name, appearance, and connection parameters
 */

import { BlackmagicBluetoothManager } from './BlackmagicBluetoothManager'
import { 
  BLACKMAGIC_SERVICE_UUIDS, 
  GATT_CHARACTERISTICS, 
  BlackmagicBluetoothError,
  BlackmagicBluetoothUtils
} from './types/BlackmagicTypes'

export interface GAPDeviceInfo {
  deviceName?: string
  appearance?: number
  peripheralConnectionParameters?: {
    minConnectionInterval: number
    maxConnectionInterval: number
    slaveLatency: number
    connectionSupervisionTimeout: number
  }
}

export class GAPService {
  private bluetoothManager: BlackmagicBluetoothManager

  constructor(bluetoothManager: BlackmagicBluetoothManager) {
    this.bluetoothManager = bluetoothManager
  }

  /**
   * Read device name characteristic
   */
  async readDeviceName(deviceId: string): Promise<string | null> {
    try {
      const value = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.GENERIC_ACCESS_PROFILE,
        GATT_CHARACTERISTICS.DEVICE_NAME
      )
      
      if (!value) return null
      
      // Decode base64 to string
      const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(value)
      const decoder = new TextDecoder('utf-8')
      return decoder.decode(buffer)
    } catch (error) {
      console.warn('Could not read device name:', error)
      return null
    }
  }

  /**
   * Read appearance characteristic
   */
  async readAppearance(deviceId: string): Promise<number | null> {
    try {
      const value = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.GENERIC_ACCESS_PROFILE,
        GATT_CHARACTERISTICS.APPEARANCE
      )
      
      if (!value) return null
      
      // Decode base64 to Uint16 (appearance is a 16-bit value)
      const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(value)
      const dataView = new DataView(buffer)
      return dataView.getUint16(0, true) // little-endian
    } catch (error) {
      console.warn('Could not read appearance:', error)
      return null
    }
  }

  /**
   * Read peripheral connection parameters
   */
  async readPeripheralConnectionParameters(deviceId: string): Promise<GAPDeviceInfo['peripheralConnectionParameters'] | null> {
    try {
      const value = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.GENERIC_ACCESS_PROFILE,
        GATT_CHARACTERISTICS.PERIPHERAL_CONNECTION_PARAMETERS
      )
      
      if (!value) return null
      
      // Decode connection parameters (8 bytes total)
      const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(value)
      const dataView = new DataView(buffer)
      
      return {
        minConnectionInterval: dataView.getUint16(0, true), // 2 bytes, little-endian
        maxConnectionInterval: dataView.getUint16(2, true), // 2 bytes, little-endian
        slaveLatency: dataView.getUint16(4, true), // 2 bytes, little-endian
        connectionSupervisionTimeout: dataView.getUint16(6, true) // 2 bytes, little-endian
      }
    } catch (error) {
      console.warn('Could not read connection parameters:', error)
      return null
    }
  }

  /**
   * Read all GAP information for a device
   */
  async readGAPInfo(deviceId: string): Promise<GAPDeviceInfo> {
    const gapInfo: GAPDeviceInfo = {}

    try {
      // Read device name
      gapInfo.deviceName = await this.readDeviceName(deviceId)
      
      // Read appearance
      gapInfo.appearance = await this.readAppearance(deviceId)
      
      // Read connection parameters
      gapInfo.peripheralConnectionParameters = await this.readPeripheralConnectionParameters(deviceId)
      
    } catch (error) {
      console.error('Error reading GAP information:', error)
    }

    return gapInfo
  }

  /**
   * Get human-readable device appearance description
   */
  static getAppearanceDescription(appearance: number): string {
    // BLE Appearance values (from Bluetooth SIG specifications)
    const appearanceMap: { [key: number]: string } = {
      0: 'Unknown',
      64: 'Generic Phone',
      128: 'Generic Computer',
      192: 'Generic Watch',
      193: 'Sports Watch',
      256: 'Generic Clock',
      320: 'Generic Display',
      384: 'Generic Remote Control',
      448: 'Generic Eye-glasses',
      512: 'Generic Tag',
      576: 'Generic Keyring',
      640: 'Generic Media Player',
      704: 'Generic Barcode Scanner',
      768: 'Generic Thermometer',
      769: 'Thermometer: Ear',
      832: 'Generic Heart rate Sensor',
      833: 'Heart Rate Sensor: Heart Rate Belt',
      896: 'Generic Blood Pressure',
      897: 'Blood Pressure: Arm',
      898: 'Blood Pressure: Wrist',
      960: 'Human Interface Device (HID)',
      961: 'Keyboard',
      962: 'Mouse',
      963: 'Joystick',
      964: 'Gamepad',
      965: 'Digitizer Tablet',
      966: 'Card Reader',
      967: 'Digital Pen',
      968: 'Barcode Scanner',
      1024: 'Generic Glucose Meter',
      1088: 'Generic: Running Walking Sensor',
      1089: 'Running Walking Sensor: In-Shoe',
      1090: 'Running Walking Sensor: On-Shoe',
      1091: 'Running Walking Sensor: On-Hip',
      1152: 'Generic: Cycling',
      1153: 'Cycling: Cycling Computer',
      1154: 'Cycling: Speed Sensor',
      1155: 'Cycling: Cadence Sensor',
      1156: 'Cycling: Power Sensor',
      1157: 'Cycling: Speed and Cadence Sensor',
      3136: 'Generic: Pulse Oximeter',
      3137: 'Fingertip',
      3138: 'Wrist Worn',
      3200: 'Generic: Weight Scale',
      3264: 'Generic',
      3265: 'Powered Device',
      3266: 'Drone',
      5184: 'Generic: Outdoor Sports Activity',
      5185: 'Location Display Device',
      5186: 'Location and Navigation Display Device',
      5187: 'Location Pod',
      5188: 'Location and Navigation Pod'
    }

    return appearanceMap[appearance] || `Unknown (${appearance})`
  }
}