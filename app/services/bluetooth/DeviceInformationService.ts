/**
 * Device Information Service Implementation
 * 
 * UUID: 0x180A
 * Handles manufacturer, model, serial, hardware/firmware/software versions
 */

import { BlackmagicBluetoothManager } from './BlackmagicBluetoothManager'
import { 
  BLACKMAGIC_SERVICE_UUIDS, 
  GATT_CHARACTERISTICS, 
  BlackmagicBluetoothError,
  BlackmagicBluetoothUtils
} from './types/BlackmagicTypes'

export interface DeviceInformation {
  manufacturerName?: string
  modelNumber?: string
  serialNumber?: string
  hardwareRevision?: string
  firmwareRevision?: string
  softwareRevision?: string
}

export class DeviceInformationService {
  private bluetoothManager: BlackmagicBluetoothManager

  constructor(bluetoothManager: BlackmagicBluetoothManager) {
    this.bluetoothManager = bluetoothManager
  }

  /**
   * Read manufacturer name string
   */
  async readManufacturerName(deviceId: string): Promise<string | null> {
    try {
      const value = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.DEVICE_INFORMATION_SERVICE,
        GATT_CHARACTERISTICS.MANUFACTURER_NAME_STRING
      )
      
      if (!value) return null
      
      return this.decodeUtf8String(value)
    } catch (error) {
      console.warn('Could not read manufacturer name:', error)
      return null
    }
  }

  /**
   * Read model number string
   */
  async readModelNumber(deviceId: string): Promise<string | null> {
    try {
      const value = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.DEVICE_INFORMATION_SERVICE,
        GATT_CHARACTERISTICS.MODEL_NUMBER_STRING
      )
      
      if (!value) return null
      
      return this.decodeUtf8String(value)
    } catch (error) {
      console.warn('Could not read model number:', error)
      return null
    }
  }

  /**
   * Read serial number string
   */
  async readSerialNumber(deviceId: string): Promise<string | null> {
    try {
      const value = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.DEVICE_INFORMATION_SERVICE,
        GATT_CHARACTERISTICS.SERIAL_NUMBER_STRING
      )
      
      if (!value) return null
      
      return this.decodeUtf8String(value)
    } catch (error) {
      console.warn('Could not read serial number:', error)
      return null
    }
  }

  /**
   * Read hardware revision string
   */
  async readHardwareRevision(deviceId: string): Promise<string | null> {
    try {
      const value = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.DEVICE_INFORMATION_SERVICE,
        GATT_CHARACTERISTICS.HARDWARE_REVISION_STRING
      )
      
      if (!value) return null
      
      return this.decodeUtf8String(value)
    } catch (error) {
      console.warn('Could not read hardware revision:', error)
      return null
    }
  }

  /**
   * Read firmware revision string
   */
  async readFirmwareRevision(deviceId: string): Promise<string | null> {
    try {
      const value = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.DEVICE_INFORMATION_SERVICE,
        GATT_CHARACTERISTICS.FIRMWARE_REVISION_STRING
      )
      
      if (!value) return null
      
      return this.decodeUtf8String(value)
    } catch (error) {
      console.warn('Could not read firmware revision:', error)
      return null
    }
  }

  /**
   * Read software revision string
   */
  async readSoftwareRevision(deviceId: string): Promise<string | null> {
    try {
      const value = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.DEVICE_INFORMATION_SERVICE,
        GATT_CHARACTERISTICS.SOFTWARE_REVISION_STRING
      )
      
      if (!value) return null
      
      return this.decodeUtf8String(value)
    } catch (error) {
      console.warn('Could not read software revision:', error)
      return null
    }
  }

  /**
   * Read all device information
   */
  async readDeviceInformation(deviceId: string): Promise<DeviceInformation> {
    const deviceInfo: DeviceInformation = {}

    try {
      // Read all device information characteristics in parallel
      const [
        manufacturerName,
        modelNumber,
        serialNumber,
        hardwareRevision,
        firmwareRevision,
        softwareRevision
      ] = await Promise.allSettled([
        this.readManufacturerName(deviceId),
        this.readModelNumber(deviceId),
        this.readSerialNumber(deviceId),
        this.readHardwareRevision(deviceId),
        this.readFirmwareRevision(deviceId),
        this.readSoftwareRevision(deviceId)
      ])

      // Extract results from settled promises
      if (manufacturerName.status === 'fulfilled' && manufacturerName.value) {
        deviceInfo.manufacturerName = manufacturerName.value
      }

      if (modelNumber.status === 'fulfilled' && modelNumber.value) {
        deviceInfo.modelNumber = modelNumber.value
      }

      if (serialNumber.status === 'fulfilled' && serialNumber.value) {
        deviceInfo.serialNumber = serialNumber.value
      }

      if (hardwareRevision.status === 'fulfilled' && hardwareRevision.value) {
        deviceInfo.hardwareRevision = hardwareRevision.value
      }

      if (firmwareRevision.status === 'fulfilled' && firmwareRevision.value) {
        deviceInfo.firmwareRevision = firmwareRevision.value
      }

      if (softwareRevision.status === 'fulfilled' && softwareRevision.value) {
        deviceInfo.softwareRevision = softwareRevision.value
      }

    } catch (error) {
      console.error('Error reading device information:', error)
    }

    return deviceInfo
  }

  /**
   * Check if device is a Blackmagic camera based on device information
   */
  static isBlackmagicCamera(deviceInfo: DeviceInformation): boolean {
    const manufacturerName = deviceInfo.manufacturerName?.toLowerCase() || ''
    const modelNumber = deviceInfo.modelNumber?.toLowerCase() || ''
    
    // Check manufacturer name
    if (manufacturerName.includes('blackmagic')) {
      return true
    }
    
    // Check model number for common Blackmagic camera patterns
    const blackmagicPatterns = [
      'bmpcc',      // Blackmagic Pocket Cinema Camera
      'ursa',       // Ursa cameras
      'studio',     // Studio cameras
      'micro',      // Micro cameras
      'blackmagic'  // General Blackmagic pattern
    ]
    
    return blackmagicPatterns.some(pattern => 
      modelNumber.includes(pattern)
    )
  }

  /**
   * Get camera model category from model number
   */
  static getCameraCategory(modelNumber?: string): string {
    if (!modelNumber) return 'Unknown'
    
    const model = modelNumber.toLowerCase()
    
    if (model.includes('bmpcc')) return 'Pocket Cinema Camera'
    if (model.includes('ursa mini pro')) return 'URSA Mini Pro'
    if (model.includes('ursa mini')) return 'URSA Mini'
    if (model.includes('ursa broadcast')) return 'URSA Broadcast'
    if (model.includes('ursa')) return 'URSA'
    if (model.includes('studio camera')) return 'Studio Camera'
    if (model.includes('micro')) return 'Micro Camera'
    if (model.includes('web presenter')) return 'Web Presenter'
    
    return 'Blackmagic Camera'
  }

  /**
   * Format device information for display
   */
  static formatDeviceInfo(deviceInfo: DeviceInformation): string {
    const parts: string[] = []
    
    if (deviceInfo.manufacturerName) {
      parts.push(`Manufacturer: ${deviceInfo.manufacturerName}`)
    }
    
    if (deviceInfo.modelNumber) {
      parts.push(`Model: ${deviceInfo.modelNumber}`)
    }
    
    if (deviceInfo.serialNumber) {
      parts.push(`Serial: ${deviceInfo.serialNumber}`)
    }
    
    if (deviceInfo.firmwareRevision) {
      parts.push(`Firmware: ${deviceInfo.firmwareRevision}`)
    }
    
    if (deviceInfo.hardwareRevision) {
      parts.push(`Hardware: ${deviceInfo.hardwareRevision}`)
    }
    
    if (deviceInfo.softwareRevision) {
      parts.push(`Software: ${deviceInfo.softwareRevision}`)
    }
    
    return parts.join('\n')
  }

  /**
   * Decode UTF-8 string from base64 value
   */
  private decodeUtf8String(base64Value: string): string {
    try {
      const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(base64Value)
      const decoder = new TextDecoder('utf-8')
      return decoder.decode(buffer).replace(/\0/g, '') // Remove null terminators
    } catch (error) {
      console.warn('Error decoding UTF-8 string:', error)
      return ''
    }
  }
}