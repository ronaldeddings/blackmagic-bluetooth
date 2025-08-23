/**
 * Battery Service Implementation
 * 
 * UUID: 0x180F
 * Handles battery level monitoring and notifications
 */

import { BlackmagicBluetoothManager } from './BlackmagicBluetoothManager'
import { 
  BLACKMAGIC_SERVICE_UUIDS, 
  GATT_CHARACTERISTICS, 
  BlackmagicBluetoothError,
  BlackmagicBluetoothUtils
} from './types/BlackmagicTypes'

export interface BatteryInfo {
  level: number // 0-100 percentage
  isCharging?: boolean
  lastUpdated: Date
}

export interface BatteryLevelCallback {
  (batteryInfo: BatteryInfo): void
}

export class BatteryService {
  private bluetoothManager: BlackmagicBluetoothManager
  private batterySubscriptions: Map<string, () => void> = new Map()
  private lastBatteryLevel: Map<string, BatteryInfo> = new Map()

  constructor(bluetoothManager: BlackmagicBluetoothManager) {
    this.bluetoothManager = bluetoothManager
  }

  /**
   * Read battery level characteristic
   */
  async readBatteryLevel(deviceId: string): Promise<number> {
    try {
      const value = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.BATTERY_SERVICE,
        GATT_CHARACTERISTICS.BATTERY_LEVEL
      )
      
      if (!value) {
        throw new Error('No battery level value received')
      }
      
      // Battery level is a single byte (0-100)
      const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(value)
      const uint8Array = new Uint8Array(buffer)
      const level = uint8Array[0]
      
      // Validate battery level range
      if (level > 100) {
        console.warn(`Invalid battery level received: ${level}, capping to 100`)
        return 100
      }
      
      // Update cached battery info
      const batteryInfo: BatteryInfo = {
        level,
        lastUpdated: new Date()
      }
      this.lastBatteryLevel.set(deviceId, batteryInfo)
      
      return level
    } catch (error) {
      console.error('Failed to read battery level:', error)
      throw new Error(`Failed to read battery level: ${(error as Error).message}`)
    }
  }

  /**
   * Subscribe to battery level notifications
   */
  async subscribeToBatteryLevel(
    deviceId: string, 
    callback: BatteryLevelCallback
  ): Promise<() => void> {
    try {
      // Unsubscribe from any existing subscription for this device
      this.unsubscribeFromBatteryLevel(deviceId)

      const unsubscribe = await this.bluetoothManager.subscribeToCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.BATTERY_SERVICE,
        GATT_CHARACTERISTICS.BATTERY_LEVEL,
        (error, data) => {
          if (error) {
            console.error('Battery level subscription error:', error)
            callback({
              level: this.getLastKnownBatteryLevel(deviceId),
              lastUpdated: new Date()
            })
            return
          }

          if (data) {
            try {
              const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
              const uint8Array = new Uint8Array(buffer)
              let level = uint8Array[0]
              
              // Validate and clamp battery level
              if (level > 100) {
                console.warn(`Invalid battery level received: ${level}, capping to 100`)
                level = 100
              }
              
              const batteryInfo: BatteryInfo = {
                level,
                lastUpdated: new Date()
              }
              
              // Cache the battery info
              this.lastBatteryLevel.set(deviceId, batteryInfo)
              
              // Notify callback
              callback(batteryInfo)
            } catch (parseError) {
              console.error('Error parsing battery level data:', parseError)
            }
          }
        }
      )

      // Store the unsubscribe function
      this.batterySubscriptions.set(deviceId, unsubscribe)

      return unsubscribe
    } catch (error) {
      console.error('Failed to subscribe to battery level:', error)
      throw new Error(`Failed to subscribe to battery level: ${(error as Error).message}`)
    }
  }

  /**
   * Unsubscribe from battery level notifications
   */
  unsubscribeFromBatteryLevel(deviceId: string): void {
    const unsubscribe = this.batterySubscriptions.get(deviceId)
    if (unsubscribe) {
      try {
        unsubscribe()
        this.batterySubscriptions.delete(deviceId)
      } catch (error) {
        console.error('Error unsubscribing from battery level:', error)
      }
    }
  }

  /**
   * Get cached battery information
   */
  getCachedBatteryInfo(deviceId: string): BatteryInfo | null {
    return this.lastBatteryLevel.get(deviceId) || null
  }

  /**
   * Get last known battery level or default to 0
   */
  getLastKnownBatteryLevel(deviceId: string): number {
    const cachedInfo = this.lastBatteryLevel.get(deviceId)
    return cachedInfo?.level || 0
  }

  /**
   * Check if battery level data is stale (older than 5 minutes)
   */
  isBatteryDataStale(deviceId: string): boolean {
    const cachedInfo = this.lastBatteryLevel.get(deviceId)
    if (!cachedInfo) return true

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    return cachedInfo.lastUpdated < fiveMinutesAgo
  }

  /**
   * Refresh battery level data
   */
  async refreshBatteryLevel(deviceId: string): Promise<BatteryInfo> {
    const level = await this.readBatteryLevel(deviceId)
    const batteryInfo: BatteryInfo = {
      level,
      lastUpdated: new Date()
    }
    
    this.lastBatteryLevel.set(deviceId, batteryInfo)
    return batteryInfo
  }

  /**
   * Get battery status description
   */
  static getBatteryStatusDescription(level: number): {
    status: string
    color: 'green' | 'yellow' | 'orange' | 'red'
    icon: string
  } {
    if (level > 75) {
      return { status: 'High', color: 'green', icon: '🔋' }
    } else if (level > 50) {
      return { status: 'Medium', color: 'yellow', icon: '🔋' }
    } else if (level > 25) {
      return { status: 'Low', color: 'orange', icon: '🪫' }
    } else if (level > 10) {
      return { status: 'Very Low', color: 'red', icon: '🪫' }
    } else {
      return { status: 'Critical', color: 'red', icon: '🪫' }
    }
  }

  /**
   * Format battery info for display
   */
  static formatBatteryInfo(batteryInfo: BatteryInfo): string {
    const { status, icon } = BatteryService.getBatteryStatusDescription(batteryInfo.level)
    const timeAgo = BatteryService.getTimeAgoString(batteryInfo.lastUpdated)
    
    return `${icon} ${batteryInfo.level}% (${status}) - Updated ${timeAgo}`
  }

  /**
   * Get human readable time difference
   */
  static getTimeAgoString(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)

    if (diffSeconds < 60) {
      return 'just now'
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else {
      const diffDays = Math.floor(diffHours / 24)
      return `${diffDays}d ago`
    }
  }

  /**
   * Clean up subscriptions for a device
   */
  cleanupDevice(deviceId: string): void {
    this.unsubscribeFromBatteryLevel(deviceId)
    this.lastBatteryLevel.delete(deviceId)
  }

  /**
   * Clean up all subscriptions
   */
  cleanup(): void {
    // Unsubscribe from all battery notifications
    for (const [deviceId] of this.batterySubscriptions) {
      this.unsubscribeFromBatteryLevel(deviceId)
    }

    // Clear all cached data
    this.lastBatteryLevel.clear()
  }
}