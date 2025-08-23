/**
 * Service Manager - Phase 2, 3 & 5 Implementation
 * 
 * Orchestrates Generic Access Profile (GAP), Device Information, Battery services,
 * HID/Camera Control services, and Audio services
 */

import { BlackmagicBluetoothManager } from './BlackmagicBluetoothManager'
import { GAPService, GAPDeviceInfo } from './GAPService'
import { DeviceInformationService, DeviceInformation } from './DeviceInformationService'
import { BatteryService, BatteryInfo, BatteryLevelCallback } from './BatteryService'
import { AudioSourceService } from './AudioSourceService'
import { AudioSinkService } from './AudioSinkService'
import { BlackmagicDeviceInfo, BlackmagicBluetoothUtils } from './types/BlackmagicTypes'

export interface CompleteDeviceInfo extends BlackmagicDeviceInfo {
  gap?: GAPDeviceInfo
  deviceInformation?: DeviceInformation
  batteryInfo?: BatteryInfo
}

export interface ServiceAvailability {
  gap: boolean
  deviceInformation: boolean
  battery: boolean
  hid: boolean
  fileTransfer: boolean
  objectPush: boolean
  audioSource: boolean
  audioSink: boolean
}

export class ServiceManager {
  private bluetoothManager: BlackmagicBluetoothManager
  private gapService: GAPService
  private deviceInformationService: DeviceInformationService
  private batteryService: BatteryService
  private audioSourceService: AudioSourceService
  private audioSinkService: AudioSinkService

  // Cache for device service availability
  private serviceAvailabilityCache: Map<string, ServiceAvailability> = new Map()

  constructor(bluetoothManager: BlackmagicBluetoothManager) {
    this.bluetoothManager = bluetoothManager
    this.gapService = new GAPService(bluetoothManager)
    this.deviceInformationService = new DeviceInformationService(bluetoothManager)
    this.batteryService = new BatteryService(bluetoothManager)
    this.audioSourceService = new AudioSourceService(bluetoothManager)
    this.audioSinkService = new AudioSinkService(bluetoothManager)
  }

  /**
   * Discover and check which services are available for a device
   */
  async discoverAvailableServices(deviceId: string): Promise<ServiceAvailability> {
    try {
      const services = await this.bluetoothManager.discoverServices(deviceId)
      const serviceUUIDs = new Set(services.map(uuid => uuid.toLowerCase()))

      const availability: ServiceAvailability = {
        gap: serviceUUIDs.has('00001800-0000-1000-8000-00805f9b34fb'),
        deviceInformation: serviceUUIDs.has('0000180a-0000-1000-8000-00805f9b34fb'),
        battery: serviceUUIDs.has('0000180f-0000-1000-8000-00805f9b34fb'),
        hid: serviceUUIDs.has('00001812-0000-1000-8000-00805f9b34fb'),
        fileTransfer: serviceUUIDs.has('00001106-0000-1000-8000-00805f9b34fb'),
        objectPush: serviceUUIDs.has('00001105-0000-1000-8000-00805f9b34fb'),
        audioSource: serviceUUIDs.has('0000110a-0000-1000-8000-00805f9b34fb'),
        audioSink: serviceUUIDs.has('0000110b-0000-1000-8000-00805f9b34fb')
      }

      // Cache the availability
      this.serviceAvailabilityCache.set(deviceId, availability)

      return availability
    } catch (error) {
      console.error('Error discovering services:', error)
      
      // Return default availability (assume all are available)
      const defaultAvailability: ServiceAvailability = {
        gap: true,
        deviceInformation: true,
        battery: true,
        hid: true,
        fileTransfer: true,
        objectPush: true,
        audioSource: true,
        audioSink: true
      }

      this.serviceAvailabilityCache.set(deviceId, defaultAvailability)
      return defaultAvailability
    }
  }

  /**
   * Get cached service availability or discover if not cached
   */
  async getServiceAvailability(deviceId: string): Promise<ServiceAvailability> {
    const cached = this.serviceAvailabilityCache.get(deviceId)
    if (cached) {
      return cached
    }

    return await this.discoverAvailableServices(deviceId)
  }

  /**
   * Read complete device information from all Phase 2 services
   */
  async readCompleteDeviceInfo(deviceId: string): Promise<CompleteDeviceInfo> {
    const baseDeviceInfo = await this.bluetoothManager.readDeviceInformation(deviceId)
    const completeInfo: CompleteDeviceInfo = { ...baseDeviceInfo }

    try {
      const availability = await this.getServiceAvailability(deviceId)

      // Read GAP information if available
      if (availability.gap) {
        try {
          completeInfo.gap = await this.gapService.readGAPInfo(deviceId)
        } catch (error) {
          console.warn('Failed to read GAP information:', error)
        }
      }

      // Read Device Information if available
      if (availability.deviceInformation) {
        try {
          completeInfo.deviceInformation = await this.deviceInformationService.readDeviceInformation(deviceId)
          
          // Update base device info with discovered information
          if (completeInfo.deviceInformation.manufacturerName) {
            completeInfo.manufacturerName = completeInfo.deviceInformation.manufacturerName
          }
          if (completeInfo.deviceInformation.modelNumber) {
            completeInfo.modelNumber = completeInfo.deviceInformation.modelNumber
          }
          if (completeInfo.deviceInformation.serialNumber) {
            completeInfo.serialNumber = completeInfo.deviceInformation.serialNumber
          }
          if (completeInfo.deviceInformation.firmwareRevision) {
            completeInfo.firmwareRevision = completeInfo.deviceInformation.firmwareRevision
          }
          if (completeInfo.deviceInformation.hardwareRevision) {
            completeInfo.hardwareRevision = completeInfo.deviceInformation.hardwareRevision
          }
          if (completeInfo.deviceInformation.softwareRevision) {
            completeInfo.softwareRevision = completeInfo.deviceInformation.softwareRevision
          }
        } catch (error) {
          console.warn('Failed to read device information:', error)
        }
      }

      // Read Battery information if available
      if (availability.battery) {
        try {
          const batteryLevel = await this.batteryService.readBatteryLevel(deviceId)
          completeInfo.batteryInfo = {
            level: batteryLevel,
            lastUpdated: new Date()
          }
          completeInfo.batteryLevel = batteryLevel
        } catch (error) {
          console.warn('Failed to read battery information:', error)
        }
      }

    } catch (error) {
      console.error('Error reading complete device information:', error)
    }

    return completeInfo
  }

  /**
   * Subscribe to battery level notifications
   */
  async subscribeToBatteryLevel(
    deviceId: string, 
    callback: BatteryLevelCallback
  ): Promise<() => void> {
    const availability = await this.getServiceAvailability(deviceId)
    
    if (!availability.battery) {
      throw new Error('Battery service is not available on this device')
    }

    return await this.batteryService.subscribeToBatteryLevel(deviceId, callback)
  }

  /**
   * Get cached battery information
   */
  getCachedBatteryInfo(deviceId: string): BatteryInfo | null {
    return this.batteryService.getCachedBatteryInfo(deviceId)
  }

  /**
   * Check if device is a confirmed Blackmagic camera
   */
  async isBlackmagicCamera(deviceId: string): Promise<boolean> {
    try {
      const availability = await this.getServiceAvailability(deviceId)
      
      // Check device name from GAP service
      if (availability.gap) {
        const gapInfo = await this.gapService.readGAPInfo(deviceId)
        if (gapInfo.deviceName) {
          if (BlackmagicBluetoothUtils.isBlackmagicDevice(gapInfo.deviceName)) {
            return true
          }
        }
      }

      // Check device information service
      if (availability.deviceInformation) {
        const deviceInfo = await this.deviceInformationService.readDeviceInformation(deviceId)
        return DeviceInformationService.isBlackmagicCamera(deviceInfo)
      }

      return false
    } catch (error) {
      console.error('Error checking if device is Blackmagic camera:', error)
      return false
    }
  }

  /**
   * Get human-readable device summary
   */
  async getDeviceSummary(deviceId: string): Promise<string> {
    try {
      const completeInfo = await this.readCompleteDeviceInfo(deviceId)
      const parts: string[] = []

      // Device name from GAP
      if (completeInfo.gap?.deviceName) {
        parts.push(`Name: ${completeInfo.gap.deviceName}`)
      }

      // Manufacturer and model
      if (completeInfo.manufacturerName && completeInfo.modelNumber) {
        parts.push(`Device: ${completeInfo.manufacturerName} ${completeInfo.modelNumber}`)
      }

      // Serial number
      if (completeInfo.serialNumber) {
        parts.push(`Serial: ${completeInfo.serialNumber}`)
      }

      // Firmware version
      if (completeInfo.firmwareRevision) {
        parts.push(`Firmware: ${completeInfo.firmwareRevision}`)
      }

      // Battery status
      if (completeInfo.batteryInfo) {
        const batteryStatus = BatteryService.formatBatteryInfo(completeInfo.batteryInfo)
        parts.push(`Battery: ${batteryStatus}`)
      }

      return parts.join('\n') || 'Device information not available'
    } catch (error) {
      console.error('Error getting device summary:', error)
      return 'Error retrieving device information'
    }
  }

  /**
   * Clean up resources for a specific device
   */
  cleanupDevice(deviceId: string): void {
    this.batteryService.cleanupDevice(deviceId)
    this.audioSourceService.cleanup()
    this.audioSinkService.cleanup()
    this.serviceAvailabilityCache.delete(deviceId)
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    this.batteryService.cleanup()
    this.audioSourceService.cleanup()
    this.audioSinkService.cleanup()
    this.serviceAvailabilityCache.clear()
  }

  // Expose service instances for direct access if needed
  get gap(): GAPService {
    return this.gapService
  }

  get deviceInformation(): DeviceInformationService {
    return this.deviceInformationService
  }

  get battery(): BatteryService {
    return this.batteryService
  }

  get audioSource(): AudioSourceService {
    return this.audioSourceService
  }

  get audioSink(): AudioSinkService {
    return this.audioSinkService
  }
}