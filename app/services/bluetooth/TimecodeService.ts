/**
 * Timecode Synchronization Service
 * 
 * Handles timecode operations for Blackmagic cameras
 * Supports SMPTE timecode formats and multi-camera synchronization
 */

import { BlackmagicBluetoothManager } from './BlackmagicBluetoothManager'
import { 
  BLACKMAGIC_SERVICE_UUIDS, 
  BlackmagicBluetoothUtils,
  BlackmagicBluetoothError 
} from './types/BlackmagicTypes'

// Timecode Service UUIDs (using standard services for timecode data)
export const TIMECODE_SERVICE_UUID = BLACKMAGIC_SERVICE_UUIDS.HUMAN_INTERFACE_DEVICE // HID service for timecode commands

// Custom timecode characteristics (would be defined in Blackmagic's implementation)
export const TIMECODE_CHARACTERISTICS = {
  CURRENT_TIMECODE: '12345678-1234-1234-1234-123456789001', // Read current timecode
  SET_TIMECODE: '12345678-1234-1234-1234-123456789002',     // Set timecode
  TIMECODE_FORMAT: '12345678-1234-1234-1234-123456789003', // Timecode format settings
  SYNC_SOURCE: '12345678-1234-1234-1234-123456789004',     // Sync source configuration
  FRAME_RATE: '12345678-1234-1234-1234-123456789005'       // Frame rate for timecode
} as const

// Timecode formats
export enum TimecodeFormat {
  SMPTE_24 = '24fps',
  SMPTE_25 = '25fps', 
  SMPTE_30 = '30fps',
  SMPTE_30_DROP = '30fps_drop',
  SMPTE_50 = '50fps',
  SMPTE_60 = '60fps',
  SMPTE_60_DROP = '60fps_drop'
}

// Sync source types
export enum SyncSource {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  GENLOCK = 'genlock',
  WORD_CLOCK = 'word_clock',
  BLUETOOTH = 'bluetooth'
}

export interface Timecode {
  hours: number
  minutes: number
  seconds: number
  frames: number
  dropFrame: boolean
  format: TimecodeFormat
  isRunning: boolean
  timestamp: Date
}

export interface TimecodeSettings {
  format: TimecodeFormat
  syncSource: SyncSource
  autoSync: boolean
  jamSyncEnabled: boolean
  freeRunEnabled: boolean
  userBits?: number
}

export interface TimecodeStatus {
  currentTimecode: Timecode
  isLocked: boolean
  syncSource: SyncSource
  frameRate: number
  lastUpdate: Date
  errorCount: number
}

export interface MultiCameraSync {
  masterId: string
  slaveIds: string[]
  syncTolerance: number // milliseconds
  syncStatus: Map<string, {
    deviceId: string
    isInSync: boolean
    offset: number // milliseconds
    lastSync: Date
  }>
}

export class TimecodeService {
  private bluetoothManager: BlackmagicBluetoothManager
  private timecodeCallbacks: Map<string, (timecode: Timecode) => void> = new Map()
  private syncSessions: Map<string, MultiCameraSync> = new Map()
  private timecodeCache: Map<string, TimecodeStatus> = new Map()
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map()

  constructor(bluetoothManager: BlackmagicBluetoothManager) {
    this.bluetoothManager = bluetoothManager
  }

  // ============================================================================
  // TIMECODE READING
  // ============================================================================

  /**
   * Read current timecode from camera
   */
  async readCurrentTimecode(deviceId: string): Promise<Timecode> {
    try {
      // Check if timecode service is available
      if (!(await this.isTimecodeServiceAvailable(deviceId))) {
        throw new Error('Timecode service not available on device')
      }

      const timecodeData = await this.bluetoothManager.readCharacteristic(
        deviceId,
        TIMECODE_SERVICE_UUID,
        TIMECODE_CHARACTERISTICS.CURRENT_TIMECODE
      )

      const timecode = this.parseTimecodeData(timecodeData)
      
      // Update cache
      const status = this.timecodeCache.get(deviceId) || this.createEmptyTimecodeStatus()
      status.currentTimecode = timecode
      status.lastUpdate = new Date()
      this.timecodeCache.set(deviceId, status)

      return timecode
    } catch (error) {
      throw new Error(`Failed to read timecode: ${(error as Error).message}`)
    }
  }

  /**
   * Subscribe to continuous timecode updates
   */
  async subscribeToTimecode(
    deviceId: string,
    callback: (timecode: Timecode) => void
  ): Promise<() => void> {
    if (!(await this.isTimecodeServiceAvailable(deviceId))) {
      throw new Error('Timecode service not available on device')
    }

    // Store callback
    this.timecodeCallbacks.set(deviceId, callback)

    // Subscribe to timecode characteristic
    const unsubscribe = await this.bluetoothManager.subscribeToCharacteristic(
      deviceId,
      TIMECODE_SERVICE_UUID,
      TIMECODE_CHARACTERISTICS.CURRENT_TIMECODE,
      (error, data) => {
        if (error) {
          console.error('Timecode subscription error:', error)
          return
        }

        if (data) {
          try {
            const timecode = this.parseTimecodeData(data)
            
            // Update cache
            const status = this.timecodeCache.get(deviceId) || this.createEmptyTimecodeStatus()
            status.currentTimecode = timecode
            status.lastUpdate = new Date()
            this.timecodeCache.set(deviceId, status)

            // Call user callback
            callback(timecode)
          } catch (parseError) {
            console.error('Error parsing timecode data:', parseError)
          }
        }
      }
    )

    return () => {
      unsubscribe()
      this.timecodeCallbacks.delete(deviceId)
    }
  }

  // ============================================================================
  // TIMECODE SETTING
  // ============================================================================

  /**
   * Set camera timecode
   */
  async setTimecode(deviceId: string, timecode: Partial<Timecode>): Promise<void> {
    if (!(await this.isTimecodeServiceAvailable(deviceId))) {
      throw new Error('Timecode service not available on device')
    }

    try {
      const timecodeData = this.encodeTimecodeData(timecode)
      
      await this.bluetoothManager.writeCharacteristic(
        deviceId,
        TIMECODE_SERVICE_UUID,
        TIMECODE_CHARACTERISTICS.SET_TIMECODE,
        timecodeData
      )

      // Update cache
      const status = this.timecodeCache.get(deviceId) || this.createEmptyTimecodeStatus()
      status.currentTimecode = { ...status.currentTimecode, ...timecode } as Timecode
      status.lastUpdate = new Date()
      this.timecodeCache.set(deviceId, status)

    } catch (error) {
      throw new Error(`Failed to set timecode: ${(error as Error).message}`)
    }
  }

  /**
   * Set timecode to current system time
   */
  async setTimecodeToNow(deviceId: string, format: TimecodeFormat = TimecodeFormat.SMPTE_30): Promise<void> {
    const now = new Date()
    const timecode: Partial<Timecode> = {
      hours: now.getHours(),
      minutes: now.getMinutes(), 
      seconds: now.getSeconds(),
      frames: Math.floor(now.getMilliseconds() / (1000 / this.getFrameRateFromFormat(format))),
      format,
      dropFrame: format.includes('drop'),
      isRunning: true,
      timestamp: now
    }

    await this.setTimecode(deviceId, timecode)
  }

  // ============================================================================
  // TIMECODE CONFIGURATION
  // ============================================================================

  /**
   * Configure timecode settings
   */
  async configureTimecode(deviceId: string, settings: TimecodeSettings): Promise<void> {
    if (!(await this.isTimecodeServiceAvailable(deviceId))) {
      throw new Error('Timecode service not available on device')
    }

    try {
      // Set timecode format
      const formatData = this.encodeTimecodeFormat(settings.format)
      await this.bluetoothManager.writeCharacteristic(
        deviceId,
        TIMECODE_SERVICE_UUID,
        TIMECODE_CHARACTERISTICS.TIMECODE_FORMAT,
        formatData
      )

      // Set sync source
      const syncData = this.encodeSyncSource(settings.syncSource)
      await this.bluetoothManager.writeCharacteristic(
        deviceId,
        TIMECODE_SERVICE_UUID,
        TIMECODE_CHARACTERISTICS.SYNC_SOURCE,
        syncData
      )

      // Set frame rate
      const frameRateData = this.encodeFrameRate(this.getFrameRateFromFormat(settings.format))
      await this.bluetoothManager.writeCharacteristic(
        deviceId,
        TIMECODE_SERVICE_UUID,
        TIMECODE_CHARACTERISTICS.FRAME_RATE,
        frameRateData
      )

      // Update cache
      const status = this.timecodeCache.get(deviceId) || this.createEmptyTimecodeStatus()
      status.syncSource = settings.syncSource
      status.frameRate = this.getFrameRateFromFormat(settings.format)
      status.lastUpdate = new Date()
      this.timecodeCache.set(deviceId, status)

    } catch (error) {
      throw new Error(`Failed to configure timecode: ${(error as Error).message}`)
    }
  }

  /**
   * Get current timecode settings
   */
  async getTimecodeSettings(deviceId: string): Promise<TimecodeSettings> {
    if (!(await this.isTimecodeServiceAvailable(deviceId))) {
      throw new Error('Timecode service not available on device')
    }

    try {
      const [formatData, syncData] = await Promise.all([
        this.bluetoothManager.readCharacteristic(deviceId, TIMECODE_SERVICE_UUID, TIMECODE_CHARACTERISTICS.TIMECODE_FORMAT),
        this.bluetoothManager.readCharacteristic(deviceId, TIMECODE_SERVICE_UUID, TIMECODE_CHARACTERISTICS.SYNC_SOURCE)
      ])

      const format = this.parseTimecodeFormat(formatData)
      const syncSource = this.parseSyncSource(syncData)

      return {
        format,
        syncSource,
        autoSync: syncSource !== SyncSource.INTERNAL,
        jamSyncEnabled: syncSource === SyncSource.EXTERNAL,
        freeRunEnabled: syncSource === SyncSource.INTERNAL
      }
    } catch (error) {
      throw new Error(`Failed to get timecode settings: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // MULTI-CAMERA SYNCHRONIZATION
  // ============================================================================

  /**
   * Create a multi-camera sync session
   */
  async createSyncSession(
    sessionId: string,
    masterId: string, 
    slaveIds: string[],
    syncTolerance: number = 100
  ): Promise<void> {
    // Verify all devices support timecode
    const allDeviceIds = [masterId, ...slaveIds]
    for (const deviceId of allDeviceIds) {
      if (!(await this.isTimecodeServiceAvailable(deviceId))) {
        throw new Error(`Timecode service not available on device ${deviceId}`)
      }
    }

    // Create sync session
    const syncSession: MultiCameraSync = {
      masterId,
      slaveIds,
      syncTolerance,
      syncStatus: new Map()
    }

    // Initialize sync status for all devices
    for (const deviceId of allDeviceIds) {
      syncSession.syncStatus.set(deviceId, {
        deviceId,
        isInSync: false,
        offset: 0,
        lastSync: new Date()
      })
    }

    this.syncSessions.set(sessionId, syncSession)

    // Start sync monitoring
    await this.startSyncMonitoring(sessionId)
  }

  /**
   * Sync all cameras to master timecode
   */
  async syncCameras(sessionId: string): Promise<void> {
    const session = this.syncSessions.get(sessionId)
    if (!session) {
      throw new Error(`Sync session ${sessionId} not found`)
    }

    try {
      // Read master timecode
      const masterTimecode = await this.readCurrentTimecode(session.masterId)

      // Set all slave cameras to master timecode
      const syncPromises = session.slaveIds.map(async (slaveId) => {
        try {
          await this.setTimecode(slaveId, masterTimecode)
          
          // Update sync status
          const status = session.syncStatus.get(slaveId)
          if (status) {
            status.isInSync = true
            status.offset = 0
            status.lastSync = new Date()
          }
        } catch (error) {
          console.error(`Failed to sync camera ${slaveId}:`, error)
          
          const status = session.syncStatus.get(slaveId)
          if (status) {
            status.isInSync = false
          }
        }
      })

      await Promise.all(syncPromises)
    } catch (error) {
      throw new Error(`Failed to sync cameras: ${(error as Error).message}`)
    }
  }

  /**
   * Start continuous sync monitoring
   */
  private async startSyncMonitoring(sessionId: string): Promise<void> {
    const session = this.syncSessions.get(sessionId)
    if (!session) return

    // Clear existing interval
    const existingInterval = this.syncIntervals.get(sessionId)
    if (existingInterval) {
      clearInterval(existingInterval)
    }

    // Start monitoring interval (every 5 seconds)
    const interval = setInterval(async () => {
      await this.checkSyncStatus(sessionId)
    }, 5000)

    this.syncIntervals.set(sessionId, interval)
  }

  /**
   * Check sync status of all cameras in session
   */
  private async checkSyncStatus(sessionId: string): Promise<void> {
    const session = this.syncSessions.get(sessionId)
    if (!session) return

    try {
      // Read master timecode
      const masterTimecode = await this.readCurrentTimecode(session.masterId)

      // Check all slave cameras
      for (const slaveId of session.slaveIds) {
        try {
          const slaveTimecode = await this.readCurrentTimecode(slaveId)
          const offset = this.calculateTimecodeOffset(masterTimecode, slaveTimecode)

          const status = session.syncStatus.get(slaveId)
          if (status) {
            status.offset = offset
            status.isInSync = Math.abs(offset) <= session.syncTolerance
            status.lastSync = new Date()
          }
        } catch (error) {
          console.warn(`Failed to check sync for camera ${slaveId}:`, error)
          
          const status = session.syncStatus.get(slaveId)
          if (status) {
            status.isInSync = false
          }
        }
      }
    } catch (error) {
      console.error(`Failed to check sync status for session ${sessionId}:`, error)
    }
  }

  /**
   * Get sync status for a session
   */
  getSyncStatus(sessionId: string): MultiCameraSync | null {
    return this.syncSessions.get(sessionId) || null
  }

  /**
   * Stop sync session
   */
  async stopSyncSession(sessionId: string): Promise<void> {
    const interval = this.syncIntervals.get(sessionId)
    if (interval) {
      clearInterval(interval)
      this.syncIntervals.delete(sessionId)
    }

    this.syncSessions.delete(sessionId)
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if timecode service is available on device
   */
  async isTimecodeServiceAvailable(deviceId: string): Promise<boolean> {
    try {
      const services = await this.bluetoothManager.discoverServices(deviceId)
      return services.includes(TIMECODE_SERVICE_UUID)
    } catch (error) {
      return false
    }
  }

  /**
   * Parse timecode data from device
   */
  private parseTimecodeData(data: string): Timecode {
    try {
      const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
      const view = new DataView(buffer)

      // SMPTE timecode format: [hours, minutes, seconds, frames, format_flags]
      const hours = view.getUint8(0)
      const minutes = view.getUint8(1)
      const seconds = view.getUint8(2)
      const frames = view.getUint8(3)
      const flags = view.getUint8(4)

      // Parse format from flags
      const dropFrame = (flags & 0x01) !== 0
      const isRunning = (flags & 0x02) !== 0
      const formatCode = (flags >> 2) & 0x07

      const formatMap: { [key: number]: TimecodeFormat } = {
        0: TimecodeFormat.SMPTE_24,
        1: TimecodeFormat.SMPTE_25,
        2: TimecodeFormat.SMPTE_30,
        3: TimecodeFormat.SMPTE_30_DROP,
        4: TimecodeFormat.SMPTE_50,
        5: TimecodeFormat.SMPTE_60,
        6: TimecodeFormat.SMPTE_60_DROP
      }

      return {
        hours,
        minutes,
        seconds,
        frames,
        dropFrame,
        format: formatMap[formatCode] || TimecodeFormat.SMPTE_30,
        isRunning,
        timestamp: new Date()
      }
    } catch (error) {
      throw new Error('Invalid timecode data format')
    }
  }

  /**
   * Encode timecode data for device
   */
  private encodeTimecodeData(timecode: Partial<Timecode>): string {
    const buffer = new ArrayBuffer(5)
    const view = new DataView(buffer)

    view.setUint8(0, timecode.hours || 0)
    view.setUint8(1, timecode.minutes || 0)
    view.setUint8(2, timecode.seconds || 0)
    view.setUint8(3, timecode.frames || 0)

    // Encode flags
    let flags = 0
    if (timecode.dropFrame) flags |= 0x01
    if (timecode.isRunning !== false) flags |= 0x02

    // Format code
    const formatMap: { [key in TimecodeFormat]: number } = {
      [TimecodeFormat.SMPTE_24]: 0,
      [TimecodeFormat.SMPTE_25]: 1,
      [TimecodeFormat.SMPTE_30]: 2,
      [TimecodeFormat.SMPTE_30_DROP]: 3,
      [TimecodeFormat.SMPTE_50]: 4,
      [TimecodeFormat.SMPTE_60]: 5,
      [TimecodeFormat.SMPTE_60_DROP]: 6
    }

    if (timecode.format) {
      flags |= (formatMap[timecode.format] << 2)
    }

    view.setUint8(4, flags)

    return BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)
  }

  private encodeTimecodeFormat(format: TimecodeFormat): string {
    const formatMap: { [key in TimecodeFormat]: number } = {
      [TimecodeFormat.SMPTE_24]: 0,
      [TimecodeFormat.SMPTE_25]: 1,
      [TimecodeFormat.SMPTE_30]: 2,
      [TimecodeFormat.SMPTE_30_DROP]: 3,
      [TimecodeFormat.SMPTE_50]: 4,
      [TimecodeFormat.SMPTE_60]: 5,
      [TimecodeFormat.SMPTE_60_DROP]: 6
    }

    const buffer = new ArrayBuffer(1)
    const view = new DataView(buffer)
    view.setUint8(0, formatMap[format])
    
    return BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)
  }

  private parseTimecodeFormat(data: string): TimecodeFormat {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)
    const formatCode = view.getUint8(0)

    const formatMap: { [key: number]: TimecodeFormat } = {
      0: TimecodeFormat.SMPTE_24,
      1: TimecodeFormat.SMPTE_25,
      2: TimecodeFormat.SMPTE_30,
      3: TimecodeFormat.SMPTE_30_DROP,
      4: TimecodeFormat.SMPTE_50,
      5: TimecodeFormat.SMPTE_60,
      6: TimecodeFormat.SMPTE_60_DROP
    }

    return formatMap[formatCode] || TimecodeFormat.SMPTE_30
  }

  private encodeSyncSource(source: SyncSource): string {
    const sourceMap: { [key in SyncSource]: number } = {
      [SyncSource.INTERNAL]: 0,
      [SyncSource.EXTERNAL]: 1,
      [SyncSource.GENLOCK]: 2,
      [SyncSource.WORD_CLOCK]: 3,
      [SyncSource.BLUETOOTH]: 4
    }

    const buffer = new ArrayBuffer(1)
    const view = new DataView(buffer)
    view.setUint8(0, sourceMap[source])
    
    return BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)
  }

  private parseSyncSource(data: string): SyncSource {
    const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
    const view = new DataView(buffer)
    const sourceCode = view.getUint8(0)

    const sourceMap: { [key: number]: SyncSource } = {
      0: SyncSource.INTERNAL,
      1: SyncSource.EXTERNAL,
      2: SyncSource.GENLOCK,
      3: SyncSource.WORD_CLOCK,
      4: SyncSource.BLUETOOTH
    }

    return sourceMap[sourceCode] || SyncSource.INTERNAL
  }

  private encodeFrameRate(frameRate: number): string {
    const buffer = new ArrayBuffer(4)
    const view = new DataView(buffer)
    view.setFloat32(0, frameRate, true)
    
    return BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)
  }

  private getFrameRateFromFormat(format: TimecodeFormat): number {
    const frameRateMap: { [key in TimecodeFormat]: number } = {
      [TimecodeFormat.SMPTE_24]: 24,
      [TimecodeFormat.SMPTE_25]: 25,
      [TimecodeFormat.SMPTE_30]: 30,
      [TimecodeFormat.SMPTE_30_DROP]: 29.97,
      [TimecodeFormat.SMPTE_50]: 50,
      [TimecodeFormat.SMPTE_60]: 60,
      [TimecodeFormat.SMPTE_60_DROP]: 59.94
    }

    return frameRateMap[format] || 30
  }

  private calculateTimecodeOffset(master: Timecode, slave: Timecode): number {
    // Convert both timecodes to milliseconds
    const masterMs = this.timecodeToMilliseconds(master)
    const slaveMs = this.timecodeToMilliseconds(slave)
    
    return slaveMs - masterMs
  }

  private timecodeToMilliseconds(timecode: Timecode): number {
    const frameRate = this.getFrameRateFromFormat(timecode.format)
    const msPerFrame = 1000 / frameRate
    
    return (
      timecode.hours * 3600000 +
      timecode.minutes * 60000 +
      timecode.seconds * 1000 +
      timecode.frames * msPerFrame
    )
  }

  private createEmptyTimecodeStatus(): TimecodeStatus {
    return {
      currentTimecode: {
        hours: 0,
        minutes: 0,
        seconds: 0,
        frames: 0,
        dropFrame: false,
        format: TimecodeFormat.SMPTE_30,
        isRunning: false,
        timestamp: new Date()
      },
      isLocked: false,
      syncSource: SyncSource.INTERNAL,
      frameRate: 30,
      lastUpdate: new Date(),
      errorCount: 0
    }
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  getCachedTimecode(deviceId: string): Timecode | null {
    const status = this.timecodeCache.get(deviceId)
    return status?.currentTimecode || null
  }

  getTimecodeStatus(deviceId: string): TimecodeStatus | null {
    return this.timecodeCache.get(deviceId) || null
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanup(): void {
    // Clear all intervals
    for (const interval of this.syncIntervals.values()) {
      clearInterval(interval)
    }

    this.syncIntervals.clear()
    this.syncSessions.clear()
    this.timecodeCallbacks.clear()
    this.timecodeCache.clear()
  }

  cleanupDevice(deviceId: string): void {
    this.timecodeCallbacks.delete(deviceId)
    this.timecodeCache.delete(deviceId)

    // Remove device from any sync sessions
    for (const [sessionId, session] of this.syncSessions.entries()) {
      if (session.masterId === deviceId) {
        this.stopSyncSession(sessionId)
      } else if (session.slaveIds.includes(deviceId)) {
        session.slaveIds = session.slaveIds.filter(id => id !== deviceId)
        session.syncStatus.delete(deviceId)
      }
    }
  }
}