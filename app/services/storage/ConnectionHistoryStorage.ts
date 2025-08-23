/**
 * Connection History Storage Service
 * 
 * Manages device connection history and device information caching
 */

import { storage, load, save } from '../utils/storage'
import { BlackmagicDeviceInfo, ConnectionState } from '../services/bluetooth'

// Extended device info with connection metadata
export interface DeviceConnectionRecord extends BlackmagicDeviceInfo {
  // Connection history
  firstConnected: Date
  lastConnected: Date
  totalConnections: number
  successfulConnections: number
  failedConnections: number
  averageConnectionTime: number
  
  // Device characteristics
  lastKnownBatteryLevel?: number
  lastKnownStorageUsage?: number
  lastKnownFirmwareVersion?: string
  supportedFeatures: string[]
  
  // Connection preferences
  autoConnectPriority: number
  customName?: string
  isFavorite: boolean
  connectionNotes?: string
}

// Connection session record
export interface ConnectionSession {
  id: string
  deviceId: string
  startTime: Date
  endTime?: Date
  duration?: number
  disconnectReason?: 'user' | 'device' | 'error' | 'timeout'
  dataTransferred: number
  filesTransferred: number
  errors: string[]
}

// Connection statistics
export interface ConnectionStats {
  totalDevices: number
  totalConnections: number
  successRate: number
  averageConnectionTime: number
  totalDataTransferred: number
  mostUsedDevice?: DeviceConnectionRecord
  recentActivity: ConnectionSession[]
}

// Storage keys
const STORAGE_KEYS = {
  CONNECTION_HISTORY: 'connection.history',
  DEVICE_CACHE: 'device.cache',
  SESSION_RECORDS: 'connection.sessions',
  CONNECTION_STATS: 'connection.stats',
  FAVORITE_DEVICES: 'connection.favorites'
} as const

export class ConnectionHistoryStorage {
  
  /**
   * Add or update device connection record
   */
  static updateDeviceRecord(
    device: BlackmagicDeviceInfo,
    connectionSuccess: boolean,
    connectionTime?: number
  ): DeviceConnectionRecord {
    const history = this.getConnectionHistory()
    const existingRecord = history.find(record => record.id === device.id)
    
    const now = new Date()
    
    if (existingRecord) {
      // Update existing record
      const updatedRecord: DeviceConnectionRecord = {
        ...existingRecord,
        ...device, // Update device info
        lastConnected: now,
        totalConnections: existingRecord.totalConnections + 1,
        successfulConnections: connectionSuccess 
          ? existingRecord.successfulConnections + 1 
          : existingRecord.successfulConnections,
        failedConnections: connectionSuccess 
          ? existingRecord.failedConnections 
          : existingRecord.failedConnections + 1,
        averageConnectionTime: connectionTime && connectionSuccess
          ? (existingRecord.averageConnectionTime * existingRecord.successfulConnections + connectionTime) / (existingRecord.successfulConnections + 1)
          : existingRecord.averageConnectionTime
      }
      
      // Update history
      const updatedHistory = history.map(record => 
        record.id === device.id ? updatedRecord : record
      )
      
      save(STORAGE_KEYS.CONNECTION_HISTORY, updatedHistory)
      return updatedRecord
      
    } else {
      // Create new record
      const newRecord: DeviceConnectionRecord = {
        ...device,
        firstConnected: now,
        lastConnected: now,
        totalConnections: 1,
        successfulConnections: connectionSuccess ? 1 : 0,
        failedConnections: connectionSuccess ? 0 : 1,
        averageConnectionTime: connectionTime || 0,
        supportedFeatures: [],
        autoConnectPriority: 0,
        isFavorite: false
      }
      
      const updatedHistory = [newRecord, ...history].slice(0, 50) // Keep last 50 devices
      save(STORAGE_KEYS.CONNECTION_HISTORY, updatedHistory)
      return newRecord
    }
  }
  
  /**
   * Get connection history
   */
  static getConnectionHistory(): DeviceConnectionRecord[] {
    const history = load<DeviceConnectionRecord[]>(STORAGE_KEYS.CONNECTION_HISTORY) || []
    
    // Convert date strings back to Date objects
    return history.map(record => ({
      ...record,
      firstConnected: new Date(record.firstConnected),
      lastConnected: new Date(record.lastConnected)
    }))
  }
  
  /**
   * Get device by ID from history
   */
  static getDeviceRecord(deviceId: string): DeviceConnectionRecord | null {
    const history = this.getConnectionHistory()
    return history.find(record => record.id === deviceId) || null
  }
  
  /**
   * Get recent devices (connected in last 30 days)
   */
  static getRecentDevices(dayLimit: number = 30): DeviceConnectionRecord[] {
    const history = this.getConnectionHistory()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - dayLimit)
    
    return history
      .filter(record => record.lastConnected > cutoffDate)
      .sort((a, b) => b.lastConnected.getTime() - a.lastConnected.getTime())
  }
  
  /**
   * Get favorite devices
   */
  static getFavoriteDevices(): DeviceConnectionRecord[] {
    const history = this.getConnectionHistory()
    return history
      .filter(record => record.isFavorite)
      .sort((a, b) => b.autoConnectPriority - a.autoConnectPriority)
  }
  
  /**
   * Set device as favorite
   */
  static setDeviceFavorite(deviceId: string, isFavorite: boolean): boolean {
    const history = this.getConnectionHistory()
    const updatedHistory = history.map(record => 
      record.id === deviceId ? { ...record, isFavorite } : record
    )
    
    return save(STORAGE_KEYS.CONNECTION_HISTORY, updatedHistory)
  }
  
  /**
   * Update device custom name
   */
  static updateDeviceName(deviceId: string, customName: string): boolean {
    const history = this.getConnectionHistory()
    const updatedHistory = history.map(record => 
      record.id === deviceId ? { ...record, customName } : record
    )
    
    return save(STORAGE_KEYS.CONNECTION_HISTORY, updatedHistory)
  }
  
  /**
   * Update auto-connect priority
   */
  static updateAutoConnectPriority(deviceId: string, priority: number): boolean {
    const history = this.getConnectionHistory()
    const updatedHistory = history.map(record => 
      record.id === deviceId ? { ...record, autoConnectPriority: priority } : record
    )
    
    return save(STORAGE_KEYS.CONNECTION_HISTORY, updatedHistory)
  }
  
  /**
   * Update device characteristics
   */
  static updateDeviceCharacteristics(
    deviceId: string,
    characteristics: {
      batteryLevel?: number
      storageUsage?: number
      firmwareVersion?: string
      supportedFeatures?: string[]
    }
  ): boolean {
    const history = this.getConnectionHistory()
    const updatedHistory = history.map(record => {
      if (record.id === deviceId) {
        return {
          ...record,
          lastKnownBatteryLevel: characteristics.batteryLevel ?? record.lastKnownBatteryLevel,
          lastKnownStorageUsage: characteristics.storageUsage ?? record.lastKnownStorageUsage,
          lastKnownFirmwareVersion: characteristics.firmwareVersion ?? record.lastKnownFirmwareVersion,
          supportedFeatures: characteristics.supportedFeatures ?? record.supportedFeatures
        }
      }
      return record
    })
    
    return save(STORAGE_KEYS.CONNECTION_HISTORY, updatedHistory)
  }
  
  /**
   * Start connection session
   */
  static startConnectionSession(deviceId: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const session: ConnectionSession = {
      id: sessionId,
      deviceId,
      startTime: new Date(),
      dataTransferred: 0,
      filesTransferred: 0,
      errors: []
    }
    
    const sessions = load<ConnectionSession[]>(STORAGE_KEYS.SESSION_RECORDS) || []
    sessions.unshift(session)
    save(STORAGE_KEYS.SESSION_RECORDS, sessions.slice(0, 100)) // Keep last 100 sessions
    
    return sessionId
  }
  
  /**
   * End connection session
   */
  static endConnectionSession(
    sessionId: string,
    disconnectReason?: 'user' | 'device' | 'error' | 'timeout'
  ): boolean {
    const sessions = load<ConnectionSession[]>(STORAGE_KEYS.SESSION_RECORDS) || []
    const sessionIndex = sessions.findIndex(s => s.id === sessionId)
    
    if (sessionIndex === -1) return false
    
    const session = sessions[sessionIndex]
    const endTime = new Date()
    const duration = endTime.getTime() - session.startTime.getTime()
    
    sessions[sessionIndex] = {
      ...session,
      endTime,
      duration,
      disconnectReason
    }
    
    return save(STORAGE_KEYS.SESSION_RECORDS, sessions)
  }
  
  /**
   * Update session data transfer stats
   */
  static updateSessionStats(
    sessionId: string,
    dataTransferred: number,
    filesTransferred: number
  ): boolean {
    const sessions = load<ConnectionSession[]>(STORAGE_KEYS.SESSION_RECORDS) || []
    const sessionIndex = sessions.findIndex(s => s.id === sessionId)
    
    if (sessionIndex === -1) return false
    
    sessions[sessionIndex] = {
      ...sessions[sessionIndex],
      dataTransferred,
      filesTransferred
    }
    
    return save(STORAGE_KEYS.SESSION_RECORDS, sessions)
  }
  
  /**
   * Add session error
   */
  static addSessionError(sessionId: string, error: string): boolean {
    const sessions = load<ConnectionSession[]>(STORAGE_KEYS.SESSION_RECORDS) || []
    const sessionIndex = sessions.findIndex(s => s.id === sessionId)
    
    if (sessionIndex === -1) return false
    
    sessions[sessionIndex] = {
      ...sessions[sessionIndex],
      errors: [...sessions[sessionIndex].errors, error]
    }
    
    return save(STORAGE_KEYS.SESSION_RECORDS, sessions)
  }
  
  /**
   * Get connection statistics
   */
  static getConnectionStats(): ConnectionStats {
    const history = this.getConnectionHistory()
    const sessions = load<ConnectionSession[]>(STORAGE_KEYS.SESSION_RECORDS) || []
    
    const totalConnections = history.reduce((sum, record) => sum + record.totalConnections, 0)
    const successfulConnections = history.reduce((sum, record) => sum + record.successfulConnections, 0)
    const totalDataTransferred = sessions.reduce((sum, session) => sum + session.dataTransferred, 0)
    const averageConnectionTime = history.length > 0 
      ? history.reduce((sum, record) => sum + record.averageConnectionTime, 0) / history.length
      : 0
    
    const mostUsedDevice = history.reduce((max, record) => 
      record.totalConnections > (max?.totalConnections || 0) ? record : max
    , undefined)
    
    const recentActivity = sessions
      .slice(0, 10)
      .map(session => ({
        ...session,
        startTime: new Date(session.startTime),
        endTime: session.endTime ? new Date(session.endTime) : undefined
      }))
    
    return {
      totalDevices: history.length,
      totalConnections,
      successRate: totalConnections > 0 ? (successfulConnections / totalConnections) * 100 : 0,
      averageConnectionTime,
      totalDataTransferred,
      mostUsedDevice,
      recentActivity
    }
  }
  
  /**
   * Clear connection history
   */
  static clearHistory(): boolean {
    storage.delete(STORAGE_KEYS.CONNECTION_HISTORY)
    storage.delete(STORAGE_KEYS.SESSION_RECORDS)
    return true
  }
  
  /**
   * Remove device from history
   */
  static removeDevice(deviceId: string): boolean {
    const history = this.getConnectionHistory()
    const updatedHistory = history.filter(record => record.id !== deviceId)
    
    // Also remove sessions for this device
    const sessions = load<ConnectionSession[]>(STORAGE_KEYS.SESSION_RECORDS) || []
    const updatedSessions = sessions.filter(session => session.deviceId !== deviceId)
    
    save(STORAGE_KEYS.CONNECTION_HISTORY, updatedHistory)
    save(STORAGE_KEYS.SESSION_RECORDS, updatedSessions)
    
    return true
  }
  
  /**
   * Export connection history
   */
  static exportHistory(): string {
    const history = this.getConnectionHistory()
    const sessions = load<ConnectionSession[]>(STORAGE_KEYS.SESSION_RECORDS) || []
    const stats = this.getConnectionStats()
    
    return JSON.stringify({
      history,
      sessions,
      stats,
      exportedAt: new Date().toISOString()
    }, null, 2)
  }
  
  /**
   * Import connection history
   */
  static importHistory(historyJson: string): boolean {
    try {
      const data = JSON.parse(historyJson)
      
      if (data.history && Array.isArray(data.history)) {
        save(STORAGE_KEYS.CONNECTION_HISTORY, data.history)
      }
      
      if (data.sessions && Array.isArray(data.sessions)) {
        save(STORAGE_KEYS.SESSION_RECORDS, data.sessions)
      }
      
      return true
    } catch (error) {
      console.error('Failed to import connection history:', error)
      return false
    }
  }
}

export default ConnectionHistoryStorage