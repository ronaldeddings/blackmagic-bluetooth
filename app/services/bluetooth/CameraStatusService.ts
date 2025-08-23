/**
 * Camera Status Monitoring Service
 * 
 * Provides comprehensive monitoring of camera status including:
 * - Recording status
 * - Storage status
 * - Temperature warnings
 * - Error states
 * - System health
 */

import { BlackmagicBluetoothManager } from './BlackmagicBluetoothManager'
import { 
  BLACKMAGIC_SERVICE_UUIDS, 
  BlackmagicBluetoothUtils,
  BlackmagicBluetoothError,
  RecordingState
} from './types/BlackmagicTypes'

// Status monitoring characteristics (using HID service for camera commands)
export const STATUS_SERVICE_UUID = BLACKMAGIC_SERVICE_UUIDS.HUMAN_INTERFACE_DEVICE

export const STATUS_CHARACTERISTICS = {
  RECORDING_STATUS: '12345678-1234-1234-1234-123456780001', // Recording state
  STORAGE_STATUS: '12345678-1234-1234-1234-123456780002',   // Storage info
  TEMPERATURE_STATUS: '12345678-1234-1234-1234-123456780003', // Temperature sensors
  ERROR_STATUS: '12345678-1234-1234-1234-123456780004',     // Error flags
  SYSTEM_STATUS: '12345678-1234-1234-1234-123456780005',    // General system health
  MEDIA_STATUS: '12345678-1234-1234-1234-123456780006',     // Media/card status
  POWER_STATUS: '12345678-1234-1234-1234-123456780007'      // Power/battery status
} as const

// Temperature zones
export enum TemperatureZone {
  SENSOR = 'sensor',
  PROCESSOR = 'processor', 
  BATTERY = 'battery',
  STORAGE = 'storage',
  AMBIENT = 'ambient'
}

// Temperature severity levels
export enum TemperatureSeverity {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency'
}

// Error categories
export enum ErrorCategory {
  SYSTEM = 'system',
  STORAGE = 'storage',
  RECORDING = 'recording',
  CONNECTIVITY = 'connectivity',
  POWER = 'power',
  TEMPERATURE = 'temperature',
  HARDWARE = 'hardware'
}

// System health levels
export enum SystemHealth {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  WARNING = 'warning',
  POOR = 'poor',
  CRITICAL = 'critical'
}

// Media status
export enum MediaStatus {
  NO_MEDIA = 'no_media',
  MEDIA_PRESENT = 'media_present',
  MEDIA_FULL = 'media_full',
  MEDIA_ERROR = 'media_error',
  MEDIA_WRITE_PROTECTED = 'media_write_protected'
}

export interface TemperatureReading {
  zone: TemperatureZone
  celsius: number
  fahrenheit: number
  severity: TemperatureSeverity
  threshold: {
    warning: number
    critical: number
    emergency: number
  }
  timestamp: Date
}

export interface ErrorState {
  category: ErrorCategory
  code: number
  message: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  timestamp: Date
  isResolved: boolean
  resolvedAt?: Date
}

export interface StorageInfo {
  totalSpace: number // bytes
  freeSpace: number // bytes
  usedSpace: number // bytes
  mediaCount: number
  mediaStatus: MediaStatus
  writeSpeed: number // MB/s
  readSpeed: number // MB/s
  health: 'excellent' | 'good' | 'warning' | 'poor'
  estimatedRecordingTime: number // minutes
  lastWrite: Date
}

export interface PowerStatus {
  batteryLevel: number // percentage
  isCharging: boolean
  powerSource: 'battery' | 'external' | 'usb'
  estimatedRuntime: number // minutes
  powerConsumption: number // watts
  temperature: number // celsius
  cycles: number // battery cycles
  health: 'excellent' | 'good' | 'warning' | 'poor'
}

export interface SystemStatus {
  health: SystemHealth
  uptime: number // seconds
  cpuUsage: number // percentage
  memoryUsage: number // percentage
  networkSignal?: number // dBm
  lastError?: ErrorState
  errorCount: number
  warningCount: number
  timestamp: Date
}

export interface CameraStatusSnapshot {
  deviceId: string
  recording: {
    state: RecordingState
    duration: number // seconds
    estimatedRemaining: number // seconds
    clipCount: number
  }
  storage: StorageInfo
  temperature: TemperatureReading[]
  errors: ErrorState[]
  system: SystemStatus
  power: PowerStatus
  timestamp: Date
}

export interface StatusMonitoringOptions {
  interval: number // milliseconds
  enableTemperatureMonitoring: boolean
  enableErrorMonitoring: boolean
  enableStorageMonitoring: boolean
  enablePowerMonitoring: boolean
  temperatureThresholds: {
    warning: number
    critical: number
    emergency: number
  }
  autoResolveErrors: boolean
}

export type StatusUpdateCallback = (snapshot: CameraStatusSnapshot) => void
export type ErrorCallback = (error: ErrorState) => void
export type TemperatureCallback = (reading: TemperatureReading) => void

export class CameraStatusService {
  private bluetoothManager: BlackmagicBluetoothManager
  private statusCallbacks: Map<string, StatusUpdateCallback> = new Map()
  private errorCallbacks: Map<string, ErrorCallback> = new Map()
  private temperatureCallbacks: Map<string, TemperatureCallback> = new Map()
  
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map()
  private statusCache: Map<string, CameraStatusSnapshot> = new Map()
  private errorHistory: Map<string, ErrorState[]> = new Map()
  
  private defaultOptions: StatusMonitoringOptions = {
    interval: 5000, // 5 seconds
    enableTemperatureMonitoring: true,
    enableErrorMonitoring: true,
    enableStorageMonitoring: true,
    enablePowerMonitoring: true,
    temperatureThresholds: {
      warning: 60,  // 60°C
      critical: 75, // 75°C
      emergency: 85 // 85°C
    },
    autoResolveErrors: true
  }

  constructor(bluetoothManager: BlackmagicBluetoothManager) {
    this.bluetoothManager = bluetoothManager
  }

  // ============================================================================
  // STATUS MONITORING
  // ============================================================================

  /**
   * Start comprehensive status monitoring for a device
   */
  async startStatusMonitoring(
    deviceId: string, 
    callback: StatusUpdateCallback,
    options: Partial<StatusMonitoringOptions> = {}
  ): Promise<void> {
    if (!(await this.isStatusServiceAvailable(deviceId))) {
      throw new Error('Status monitoring service not available on device')
    }

    const finalOptions = { ...this.defaultOptions, ...options }
    
    // Store callback
    this.statusCallbacks.set(deviceId, callback)

    // Clear existing monitoring
    this.stopStatusMonitoring(deviceId)

    // Start monitoring interval
    const interval = setInterval(async () => {
      try {
        const snapshot = await this.collectStatusSnapshot(deviceId, finalOptions)
        this.statusCache.set(deviceId, snapshot)
        callback(snapshot)
      } catch (error) {
        console.error(`Status monitoring error for device ${deviceId}:`, error)
      }
    }, finalOptions.interval)

    this.monitoringIntervals.set(deviceId, interval)

    // Collect initial snapshot
    try {
      const initialSnapshot = await this.collectStatusSnapshot(deviceId, finalOptions)
      this.statusCache.set(deviceId, initialSnapshot)
      callback(initialSnapshot)
    } catch (error) {
      console.error('Failed to collect initial status snapshot:', error)
    }
  }

  /**
   * Stop status monitoring for a device
   */
  stopStatusMonitoring(deviceId: string): void {
    const interval = this.monitoringIntervals.get(deviceId)
    if (interval) {
      clearInterval(interval)
      this.monitoringIntervals.delete(deviceId)
    }

    this.statusCallbacks.delete(deviceId)
  }

  /**
   * Get current status snapshot
   */
  async getCurrentStatus(deviceId: string): Promise<CameraStatusSnapshot> {
    if (!(await this.isStatusServiceAvailable(deviceId))) {
      throw new Error('Status monitoring service not available on device')
    }

    return this.collectStatusSnapshot(deviceId, this.defaultOptions)
  }

  /**
   * Get cached status snapshot
   */
  getCachedStatus(deviceId: string): CameraStatusSnapshot | null {
    return this.statusCache.get(deviceId) || null
  }

  // ============================================================================
  // SPECIFIC STATUS MONITORING
  // ============================================================================

  /**
   * Monitor recording status
   */
  async monitorRecordingStatus(deviceId: string): Promise<{
    state: RecordingState
    duration: number
    clipCount: number
    estimatedRemaining: number
  }> {
    try {
      const statusData = await this.bluetoothManager.readCharacteristic(
        deviceId,
        STATUS_SERVICE_UUID,
        STATUS_CHARACTERISTICS.RECORDING_STATUS
      )

      return this.parseRecordingStatus(statusData)
    } catch (error) {
      throw new Error(`Failed to read recording status: ${(error as Error).message}`)
    }
  }

  /**
   * Monitor storage status
   */
  async monitorStorageStatus(deviceId: string): Promise<StorageInfo> {
    try {
      const statusData = await this.bluetoothManager.readCharacteristic(
        deviceId,
        STATUS_SERVICE_UUID,
        STATUS_CHARACTERISTICS.STORAGE_STATUS
      )

      return this.parseStorageStatus(statusData)
    } catch (error) {
      throw new Error(`Failed to read storage status: ${(error as Error).message}`)
    }
  }

  /**
   * Monitor temperature readings
   */
  async monitorTemperature(deviceId: string): Promise<TemperatureReading[]> {
    try {
      const tempData = await this.bluetoothManager.readCharacteristic(
        deviceId,
        STATUS_SERVICE_UUID,
        STATUS_CHARACTERISTICS.TEMPERATURE_STATUS
      )

      return this.parseTemperatureData(tempData)
    } catch (error) {
      throw new Error(`Failed to read temperature: ${(error as Error).message}`)
    }
  }

  /**
   * Monitor error states
   */
  async monitorErrors(deviceId: string): Promise<ErrorState[]> {
    try {
      const errorData = await this.bluetoothManager.readCharacteristic(
        deviceId,
        STATUS_SERVICE_UUID,
        STATUS_CHARACTERISTICS.ERROR_STATUS
      )

      const currentErrors = this.parseErrorData(errorData)
      
      // Update error history
      const history = this.errorHistory.get(deviceId) || []
      for (const error of currentErrors) {
        if (!history.find(e => e.code === error.code && e.category === error.category)) {
          history.push(error)
        }
      }
      this.errorHistory.set(deviceId, history)

      return currentErrors
    } catch (error) {
      throw new Error(`Failed to read error status: ${(error as Error).message}`)
    }
  }

  /**
   * Monitor system health
   */
  async monitorSystemHealth(deviceId: string): Promise<SystemStatus> {
    try {
      const systemData = await this.bluetoothManager.readCharacteristic(
        deviceId,
        STATUS_SERVICE_UUID,
        STATUS_CHARACTERISTICS.SYSTEM_STATUS
      )

      return this.parseSystemStatus(systemData)
    } catch (error) {
      throw new Error(`Failed to read system status: ${(error as Error).message}`)
    }
  }

  /**
   * Monitor power status
   */
  async monitorPowerStatus(deviceId: string): Promise<PowerStatus> {
    try {
      const powerData = await this.bluetoothManager.readCharacteristic(
        deviceId,
        STATUS_SERVICE_UUID,
        STATUS_CHARACTERISTICS.POWER_STATUS
      )

      return this.parsePowerStatus(powerData)
    } catch (error) {
      throw new Error(`Failed to read power status: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // ERROR MANAGEMENT
  // ============================================================================

  /**
   * Subscribe to error notifications
   */
  async subscribeToErrors(
    deviceId: string,
    callback: ErrorCallback
  ): Promise<() => void> {
    if (!(await this.isStatusServiceAvailable(deviceId))) {
      throw new Error('Status monitoring service not available on device')
    }

    this.errorCallbacks.set(deviceId, callback)

    const unsubscribe = await this.bluetoothManager.subscribeToCharacteristic(
      deviceId,
      STATUS_SERVICE_UUID,
      STATUS_CHARACTERISTICS.ERROR_STATUS,
      (error, data) => {
        if (error) {
          console.error('Error subscription error:', error)
          return
        }

        if (data) {
          try {
            const errors = this.parseErrorData(data)
            for (const err of errors) {
              callback(err)
            }
          } catch (parseError) {
            console.error('Error parsing error data:', parseError)
          }
        }
      }
    )

    return () => {
      unsubscribe()
      this.errorCallbacks.delete(deviceId)
    }
  }

  /**
   * Subscribe to temperature alerts
   */
  async subscribeToTemperatureAlerts(
    deviceId: string,
    callback: TemperatureCallback
  ): Promise<() => void> {
    if (!(await this.isStatusServiceAvailable(deviceId))) {
      throw new Error('Status monitoring service not available on device')
    }

    this.temperatureCallbacks.set(deviceId, callback)

    const unsubscribe = await this.bluetoothManager.subscribeToCharacteristic(
      deviceId,
      STATUS_SERVICE_UUID,
      STATUS_CHARACTERISTICS.TEMPERATURE_STATUS,
      (error, data) => {
        if (error) {
          console.error('Temperature subscription error:', error)
          return
        }

        if (data) {
          try {
            const readings = this.parseTemperatureData(data)
            for (const reading of readings) {
              if (reading.severity !== TemperatureSeverity.NORMAL) {
                callback(reading)
              }
            }
          } catch (parseError) {
            console.error('Error parsing temperature data:', parseError)
          }
        }
      }
    )

    return () => {
      unsubscribe()
      this.temperatureCallbacks.delete(deviceId)
    }
  }

  /**
   * Clear resolved errors
   */
  async clearResolvedErrors(deviceId: string): Promise<void> {
    const history = this.errorHistory.get(deviceId) || []
    const unresolved = history.filter(error => !error.isResolved)
    this.errorHistory.set(deviceId, unresolved)
  }

  /**
   * Get error history
   */
  getErrorHistory(deviceId: string): ErrorState[] {
    return this.errorHistory.get(deviceId) || []
  }

  // ============================================================================
  // DATA PARSING
  // ============================================================================

  private async collectStatusSnapshot(
    deviceId: string, 
    options: StatusMonitoringOptions
  ): Promise<CameraStatusSnapshot> {
    const timestamp = new Date()

    // Collect all status data in parallel
    const [
      recordingStatus,
      storageInfo,
      temperatureReadings,
      errors,
      systemStatus,
      powerStatus
    ] = await Promise.all([
      this.monitorRecordingStatus(deviceId).catch(() => this.getDefaultRecordingStatus()),
      options.enableStorageMonitoring ? this.monitorStorageStatus(deviceId).catch(() => this.getDefaultStorageInfo()) : this.getDefaultStorageInfo(),
      options.enableTemperatureMonitoring ? this.monitorTemperature(deviceId).catch(() => []) : [],
      options.enableErrorMonitoring ? this.monitorErrors(deviceId).catch(() => []) : [],
      this.monitorSystemHealth(deviceId).catch(() => this.getDefaultSystemStatus()),
      options.enablePowerMonitoring ? this.monitorPowerStatus(deviceId).catch(() => this.getDefaultPowerStatus()) : this.getDefaultPowerStatus()
    ])

    return {
      deviceId,
      recording: recordingStatus,
      storage: storageInfo,
      temperature: temperatureReadings,
      errors,
      system: systemStatus,
      power: powerStatus,
      timestamp
    }
  }

  private parseRecordingStatus(data: string): {
    state: RecordingState
    duration: number
    clipCount: number
    estimatedRemaining: number
  } {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)

    const stateCode = view.getUint8(0)
    const duration = view.getUint32(1, true)
    const clipCount = view.getUint16(5, true)
    const estimatedRemaining = view.getUint32(7, true)

    const stateMap: { [key: number]: RecordingState } = {
      0: RecordingState.STOPPED,
      1: RecordingState.RECORDING,
      2: RecordingState.PAUSED
    }

    return {
      state: stateMap[stateCode] || RecordingState.STOPPED,
      duration,
      clipCount,
      estimatedRemaining
    }
  }

  private parseStorageStatus(data: string): StorageInfo {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)

    return {
      totalSpace: view.getBigUint64(0, true),
      freeSpace: view.getBigUint64(8, true),
      usedSpace: view.getBigUint64(16, true),
      mediaCount: view.getUint16(24, true),
      mediaStatus: this.parseMediaStatus(view.getUint8(26)),
      writeSpeed: view.getFloat32(27, true),
      readSpeed: view.getFloat32(31, true),
      health: this.parseStorageHealth(view.getUint8(35)),
      estimatedRecordingTime: view.getUint32(36, true),
      lastWrite: new Date(view.getBigUint64(40, true))
    } as StorageInfo
  }

  private parseTemperatureData(data: string): TemperatureReading[] {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)
    const readings: TemperatureReading[] = []

    const count = view.getUint8(0)
    let offset = 1

    for (let i = 0; i < count; i++) {
      const zone = this.parseTemperatureZone(view.getUint8(offset))
      const celsius = view.getFloat32(offset + 1, true)
      const fahrenheit = celsius * 9/5 + 32

      readings.push({
        zone,
        celsius,
        fahrenheit,
        severity: this.calculateTemperatureSeverity(celsius),
        threshold: {
          warning: this.defaultOptions.temperatureThresholds.warning,
          critical: this.defaultOptions.temperatureThresholds.critical,
          emergency: this.defaultOptions.temperatureThresholds.emergency
        },
        timestamp: new Date()
      })

      offset += 5 // zone(1) + temp(4)
    }

    return readings
  }

  private parseErrorData(data: string): ErrorState[] {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)
    const errors: ErrorState[] = []

    const count = view.getUint8(0)
    let offset = 1

    for (let i = 0; i < count; i++) {
      const category = this.parseErrorCategory(view.getUint8(offset))
      const code = view.getUint16(offset + 1, true)
      const severity = this.parseErrorSeverity(view.getUint8(offset + 3))
      const timestamp = new Date(view.getBigUint64(offset + 4, true))

      errors.push({
        category,
        code,
        message: this.getErrorMessage(category, code),
        severity,
        timestamp,
        isResolved: false
      })

      offset += 12 // category(1) + code(2) + severity(1) + timestamp(8)
    }

    return errors
  }

  private parseSystemStatus(data: string): SystemStatus {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)

    return {
      health: this.parseSystemHealth(view.getUint8(0)),
      uptime: view.getUint32(1, true),
      cpuUsage: view.getFloat32(5, true),
      memoryUsage: view.getFloat32(9, true),
      networkSignal: view.getInt16(13, true),
      errorCount: view.getUint16(15, true),
      warningCount: view.getUint16(17, true),
      timestamp: new Date()
    }
  }

  private parsePowerStatus(data: string): PowerStatus {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)

    return {
      batteryLevel: view.getUint8(0),
      isCharging: view.getUint8(1) === 1,
      powerSource: this.parsePowerSource(view.getUint8(2)),
      estimatedRuntime: view.getUint32(3, true),
      powerConsumption: view.getFloat32(7, true),
      temperature: view.getFloat32(11, true),
      cycles: view.getUint32(15, true),
      health: this.parsePowerHealth(view.getUint8(19))
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async isStatusServiceAvailable(deviceId: string): Promise<boolean> {
    try {
      const services = await this.bluetoothManager.discoverServices(deviceId)
      return services.includes(STATUS_SERVICE_UUID)
    } catch (error) {
      return false
    }
  }

  private parseMediaStatus(code: number): MediaStatus {
    const map: { [key: number]: MediaStatus } = {
      0: MediaStatus.NO_MEDIA,
      1: MediaStatus.MEDIA_PRESENT,
      2: MediaStatus.MEDIA_FULL,
      3: MediaStatus.MEDIA_ERROR,
      4: MediaStatus.MEDIA_WRITE_PROTECTED
    }
    return map[code] || MediaStatus.NO_MEDIA
  }

  private parseStorageHealth(code: number): 'excellent' | 'good' | 'warning' | 'poor' {
    const map: { [key: number]: 'excellent' | 'good' | 'warning' | 'poor' } = {
      0: 'excellent',
      1: 'good',
      2: 'warning',
      3: 'poor'
    }
    return map[code] || 'good'
  }

  private parseTemperatureZone(code: number): TemperatureZone {
    const map: { [key: number]: TemperatureZone } = {
      0: TemperatureZone.SENSOR,
      1: TemperatureZone.PROCESSOR,
      2: TemperatureZone.BATTERY,
      3: TemperatureZone.STORAGE,
      4: TemperatureZone.AMBIENT
    }
    return map[code] || TemperatureZone.SENSOR
  }

  private calculateTemperatureSeverity(celsius: number): TemperatureSeverity {
    const thresholds = this.defaultOptions.temperatureThresholds
    if (celsius >= thresholds.emergency) return TemperatureSeverity.EMERGENCY
    if (celsius >= thresholds.critical) return TemperatureSeverity.CRITICAL
    if (celsius >= thresholds.warning) return TemperatureSeverity.WARNING
    return TemperatureSeverity.NORMAL
  }

  private parseErrorCategory(code: number): ErrorCategory {
    const map: { [key: number]: ErrorCategory } = {
      0: ErrorCategory.SYSTEM,
      1: ErrorCategory.STORAGE,
      2: ErrorCategory.RECORDING,
      3: ErrorCategory.CONNECTIVITY,
      4: ErrorCategory.POWER,
      5: ErrorCategory.TEMPERATURE,
      6: ErrorCategory.HARDWARE
    }
    return map[code] || ErrorCategory.SYSTEM
  }

  private parseErrorSeverity(code: number): 'info' | 'warning' | 'error' | 'critical' {
    const map: { [key: number]: 'info' | 'warning' | 'error' | 'critical' } = {
      0: 'info',
      1: 'warning',
      2: 'error',
      3: 'critical'
    }
    return map[code] || 'error'
  }

  private parseSystemHealth(code: number): SystemHealth {
    const map: { [key: number]: SystemHealth } = {
      0: SystemHealth.EXCELLENT,
      1: SystemHealth.GOOD,
      2: SystemHealth.WARNING,
      3: SystemHealth.POOR,
      4: SystemHealth.CRITICAL
    }
    return map[code] || SystemHealth.GOOD
  }

  private parsePowerSource(code: number): 'battery' | 'external' | 'usb' {
    const map: { [key: number]: 'battery' | 'external' | 'usb' } = {
      0: 'battery',
      1: 'external',
      2: 'usb'
    }
    return map[code] || 'battery'
  }

  private parsePowerHealth(code: number): 'excellent' | 'good' | 'warning' | 'poor' {
    const map: { [key: number]: 'excellent' | 'good' | 'warning' | 'poor' } = {
      0: 'excellent',
      1: 'good',
      2: 'warning',
      3: 'poor'
    }
    return map[code] || 'good'
  }

  private getErrorMessage(category: ErrorCategory, code: number): string {
    // This would typically be loaded from a localization file
    const errorMessages: { [key: string]: string } = {
      [`${ErrorCategory.SYSTEM}_1`]: 'System initialization failed',
      [`${ErrorCategory.STORAGE}_1`]: 'Storage device not detected',
      [`${ErrorCategory.STORAGE}_2`]: 'Storage device full',
      [`${ErrorCategory.RECORDING}_1`]: 'Recording failed to start',
      [`${ErrorCategory.RECORDING}_2`]: 'Recording stopped unexpectedly',
      [`${ErrorCategory.CONNECTIVITY}_1`]: 'Network connection lost',
      [`${ErrorCategory.POWER}_1`]: 'Battery level critically low',
      [`${ErrorCategory.TEMPERATURE}_1`]: 'Temperature exceeds safe limits',
      [`${ErrorCategory.HARDWARE}_1`]: 'Hardware component failure detected'
    }

    return errorMessages[`${category}_${code}`] || `Unknown error: ${category} ${code}`
  }

  // Default status objects for fallback
  private getDefaultRecordingStatus() {
    return {
      state: RecordingState.STOPPED,
      duration: 0,
      clipCount: 0,
      estimatedRemaining: 0
    }
  }

  private getDefaultStorageInfo(): StorageInfo {
    return {
      totalSpace: 0,
      freeSpace: 0,
      usedSpace: 0,
      mediaCount: 0,
      mediaStatus: MediaStatus.NO_MEDIA,
      writeSpeed: 0,
      readSpeed: 0,
      health: 'good',
      estimatedRecordingTime: 0,
      lastWrite: new Date()
    }
  }

  private getDefaultSystemStatus(): SystemStatus {
    return {
      health: SystemHealth.GOOD,
      uptime: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      errorCount: 0,
      warningCount: 0,
      timestamp: new Date()
    }
  }

  private getDefaultPowerStatus(): PowerStatus {
    return {
      batteryLevel: 0,
      isCharging: false,
      powerSource: 'battery',
      estimatedRuntime: 0,
      powerConsumption: 0,
      temperature: 0,
      cycles: 0,
      health: 'good'
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanup(): void {
    // Clear all monitoring intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval)
    }

    this.monitoringIntervals.clear()
    this.statusCallbacks.clear()
    this.errorCallbacks.clear()
    this.temperatureCallbacks.clear()
    this.statusCache.clear()
    this.errorHistory.clear()
  }

  cleanupDevice(deviceId: string): void {
    this.stopStatusMonitoring(deviceId)
    this.statusCache.delete(deviceId)
    this.errorHistory.delete(deviceId)
    this.errorCallbacks.delete(deviceId)
    this.temperatureCallbacks.delete(deviceId)
  }
}