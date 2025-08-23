/**
 * Camera Control Service Implementation
 * 
 * High-level camera control interface using HID service
 * Implements recording controls, camera settings, and status monitoring
 */

import {
  ICameraControlService,
  RecordingState,
  CameraSettings,
  FrameRate,
  Resolution,
  Codec,
  ColorSpace,
  CameraControlCommand,
  CameraControlEvent
} from './types/BlackmagicTypes'
import { HIDService } from './HIDService'
import type { IBlackmagicBluetoothService } from './types/BlackmagicTypes'

export interface CameraSettingsCallback {
  (settings: CameraSettings): void
}

export class CameraControlService implements ICameraControlService {
  private bluetoothManager: IBlackmagicBluetoothService
  private hidService: HIDService
  
  // State management
  private deviceSettings: Map<string, CameraSettings> = new Map()
  private settingsCallbacks: Map<string, CameraSettingsCallback[]> = new Map()
  private settingsSubscriptions: Map<string, () => void> = new Map()

  constructor(bluetoothManager: IBlackmagicBluetoothService) {
    this.bluetoothManager = bluetoothManager
    this.hidService = new HIDService(bluetoothManager)
  }

  // ============================================================================
  // RECORDING CONTROLS
  // ============================================================================

  async startRecording(deviceId: string): Promise<void> {
    try {
      const report = this.hidService.createCameraControlReport(CameraControlCommand.RECORD_START)
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateRecordingState(deviceId, RecordingState.STARTING)
      
      // Wait a moment for camera to start recording
      setTimeout(async () => {
        await this.updateRecordingState(deviceId, RecordingState.RECORDING)
      }, 1000)

      console.log(`Started recording on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to start recording:', error)
      throw new Error(`Failed to start recording: ${(error as Error).message}`)
    }
  }

  async stopRecording(deviceId: string): Promise<void> {
    try {
      const report = this.hidService.createCameraControlReport(CameraControlCommand.RECORD_STOP)
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateRecordingState(deviceId, RecordingState.STOPPING)
      
      // Wait a moment for camera to stop recording
      setTimeout(async () => {
        await this.updateRecordingState(deviceId, RecordingState.STOPPED)
      }, 1000)

      console.log(`Stopped recording on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to stop recording:', error)
      throw new Error(`Failed to stop recording: ${(error as Error).message}`)
    }
  }

  async toggleRecording(deviceId: string): Promise<void> {
    try {
      const currentSettings = this.deviceSettings.get(deviceId)
      const currentState = currentSettings?.recordingState || RecordingState.STOPPED

      if (currentState === RecordingState.RECORDING) {
        await this.stopRecording(deviceId)
      } else if (currentState === RecordingState.STOPPED) {
        await this.startRecording(deviceId)
      } else {
        console.warn(`Cannot toggle recording - camera is in state: ${currentState}`)
      }
    } catch (error) {
      console.error('Failed to toggle recording:', error)
      throw new Error(`Failed to toggle recording: ${(error as Error).message}`)
    }
  }

  async getRecordingStatus(deviceId: string): Promise<RecordingState> {
    try {
      // For now, return cached state. In a real implementation,
      // we would query the camera for current recording status
      const settings = this.deviceSettings.get(deviceId)
      return settings?.recordingState || RecordingState.STOPPED
    } catch (error) {
      console.error('Failed to get recording status:', error)
      return RecordingState.STOPPED
    }
  }

  // ============================================================================
  // FOCUS CONTROLS
  // ============================================================================

  async setAutoFocus(deviceId: string): Promise<void> {
    try {
      const report = this.hidService.createCameraControlReport(CameraControlCommand.FOCUS_AUTO)
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateCameraSetting(deviceId, 'focus', -1) // -1 indicates auto focus
      console.log(`Set auto focus on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to set auto focus:', error)
      throw new Error(`Failed to set auto focus: ${(error as Error).message}`)
    }
  }

  async setManualFocus(deviceId: string, value: number): Promise<void> {
    try {
      const report = this.hidService.createValueReport(CameraControlCommand.FOCUS_MANUAL, value)
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateCameraSetting(deviceId, 'focus', value)
      console.log(`Set manual focus to ${value} on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to set manual focus:', error)
      throw new Error(`Failed to set manual focus: ${(error as Error).message}`)
    }
  }

  async pushAutoFocus(deviceId: string): Promise<void> {
    try {
      const report = this.hidService.createCameraControlReport(CameraControlCommand.FOCUS_PUSH_AUTO)
      await this.hidService.sendReport(deviceId, report)
      
      console.log(`Push auto focus on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to push auto focus:', error)
      throw new Error(`Failed to push auto focus: ${(error as Error).message}`)
    }
  }

  async adjustFocus(deviceId: string, direction: 'near' | 'far'): Promise<void> {
    try {
      const command = direction === 'near' ? CameraControlCommand.FOCUS_NEAR : CameraControlCommand.FOCUS_FAR
      const report = this.hidService.createCameraControlReport(command)
      await this.hidService.sendReport(deviceId, report)
      
      console.log(`Adjust focus ${direction} on device: ${deviceId}`)
    } catch (error) {
      console.error(`Failed to adjust focus ${direction}:`, error)
      throw new Error(`Failed to adjust focus ${direction}: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // EXPOSURE CONTROLS
  // ============================================================================

  async setAutoExposure(deviceId: string): Promise<void> {
    try {
      const report = this.hidService.createCameraControlReport(CameraControlCommand.EXPOSURE_AUTO)
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateCameraSetting(deviceId, 'exposure', -1) // -1 indicates auto exposure
      console.log(`Set auto exposure on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to set auto exposure:', error)
      throw new Error(`Failed to set auto exposure: ${(error as Error).message}`)
    }
  }

  async setManualExposure(deviceId: string, value: number): Promise<void> {
    try {
      const report = this.hidService.createValueReport(CameraControlCommand.EXPOSURE_MANUAL, value)
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateCameraSetting(deviceId, 'exposure', value)
      console.log(`Set manual exposure to ${value} on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to set manual exposure:', error)
      throw new Error(`Failed to set manual exposure: ${(error as Error).message}`)
    }
  }

  async adjustExposure(deviceId: string, direction: 'up' | 'down'): Promise<void> {
    try {
      const command = direction === 'up' ? CameraControlCommand.EXPOSURE_UP : CameraControlCommand.EXPOSURE_DOWN
      const report = this.hidService.createCameraControlReport(command)
      await this.hidService.sendReport(deviceId, report)
      
      console.log(`Adjust exposure ${direction} on device: ${deviceId}`)
    } catch (error) {
      console.error(`Failed to adjust exposure ${direction}:`, error)
      throw new Error(`Failed to adjust exposure ${direction}: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // ISO CONTROLS
  // ============================================================================

  async setAutoISO(deviceId: string): Promise<void> {
    try {
      const report = this.hidService.createCameraControlReport(CameraControlCommand.ISO_AUTO)
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateCameraSetting(deviceId, 'iso', -1) // -1 indicates auto ISO
      console.log(`Set auto ISO on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to set auto ISO:', error)
      throw new Error(`Failed to set auto ISO: ${(error as Error).message}`)
    }
  }

  async setISO(deviceId: string, iso: number): Promise<void> {
    try {
      // Map ISO values to command codes
      const isoCommandMap: Record<number, CameraControlCommand> = {
        100: CameraControlCommand.ISO_100,
        200: CameraControlCommand.ISO_200,
        400: CameraControlCommand.ISO_400,
        800: CameraControlCommand.ISO_800,
        1600: CameraControlCommand.ISO_1600,
        3200: CameraControlCommand.ISO_3200,
        6400: CameraControlCommand.ISO_6400
      }

      const command = isoCommandMap[iso]
      if (!command) {
        throw new Error(`Unsupported ISO value: ${iso}`)
      }

      const report = this.hidService.createCameraControlReport(command)
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateCameraSetting(deviceId, 'iso', iso)
      console.log(`Set ISO to ${iso} on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to set ISO:', error)
      throw new Error(`Failed to set ISO: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // WHITE BALANCE CONTROLS
  // ============================================================================

  async setAutoWhiteBalance(deviceId: string): Promise<void> {
    try {
      const report = this.hidService.createCameraControlReport(CameraControlCommand.WB_AUTO)
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateCameraSetting(deviceId, 'whiteBalance', 'auto')
      console.log(`Set auto white balance on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to set auto white balance:', error)
      throw new Error(`Failed to set auto white balance: ${(error as Error).message}`)
    }
  }

  async setWhiteBalance(deviceId: string, preset: string): Promise<void> {
    try {
      // Map preset strings to command codes
      const wbCommandMap: Record<string, CameraControlCommand> = {
        'daylight': CameraControlCommand.WB_DAYLIGHT,
        'tungsten': CameraControlCommand.WB_TUNGSTEN,
        'fluorescent': CameraControlCommand.WB_FLUORESCENT,
        'cloudy': CameraControlCommand.WB_CLOUDY,
        'shade': CameraControlCommand.WB_SHADE
      }

      const command = wbCommandMap[preset.toLowerCase()]
      if (!command) {
        throw new Error(`Unsupported white balance preset: ${preset}`)
      }

      const report = this.hidService.createCameraControlReport(command)
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateCameraSetting(deviceId, 'whiteBalance', preset)
      console.log(`Set white balance to ${preset} on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to set white balance:', error)
      throw new Error(`Failed to set white balance: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // SETTINGS CONTROLS
  // ============================================================================

  async setFrameRate(deviceId: string, frameRate: FrameRate): Promise<void> {
    try {
      const report = this.hidService.createValueReport(0x50, frameRate) // Custom frame rate command
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateCameraSetting(deviceId, 'frameRate', frameRate)
      console.log(`Set frame rate to ${frameRate}fps on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to set frame rate:', error)
      throw new Error(`Failed to set frame rate: ${(error as Error).message}`)
    }
  }

  async setResolution(deviceId: string, resolution: Resolution): Promise<void> {
    try {
      const report = this.hidService.createStringReport(0x51, resolution) // Custom resolution command
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateCameraSetting(deviceId, 'resolution', resolution)
      console.log(`Set resolution to ${resolution} on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to set resolution:', error)
      throw new Error(`Failed to set resolution: ${(error as Error).message}`)
    }
  }

  async setCodec(deviceId: string, codec: Codec): Promise<void> {
    try {
      const report = this.hidService.createStringReport(0x52, codec) // Custom codec command
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateCameraSetting(deviceId, 'codec', codec)
      console.log(`Set codec to ${codec} on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to set codec:', error)
      throw new Error(`Failed to set codec: ${(error as Error).message}`)
    }
  }

  async setColorSpace(deviceId: string, colorSpace: ColorSpace): Promise<void> {
    try {
      const report = this.hidService.createStringReport(0x53, colorSpace) // Custom color space command
      await this.hidService.sendReport(deviceId, report)
      
      await this.updateCameraSetting(deviceId, 'colorSpace', colorSpace)
      console.log(`Set color space to ${colorSpace} on device: ${deviceId}`)
    } catch (error) {
      console.error('Failed to set color space:', error)
      throw new Error(`Failed to set color space: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // STATUS MONITORING
  // ============================================================================

  async getCameraSettings(deviceId: string): Promise<CameraSettings> {
    const cachedSettings = this.deviceSettings.get(deviceId)
    
    if (cachedSettings) {
      return { ...cachedSettings }
    }

    // Initialize with default settings
    const defaultSettings: CameraSettings = {
      recordingState: RecordingState.STOPPED,
      frameRate: FrameRate.FPS_30,
      resolution: Resolution.FHD_1080P,
      codec: Codec.H264,
      colorSpace: ColorSpace.REC709,
      iso: -1, // Auto
      exposure: -1, // Auto
      whiteBalance: 'auto',
      focus: -1 // Auto
    }

    this.deviceSettings.set(deviceId, defaultSettings)
    return { ...defaultSettings }
  }

  async subscribeToCameraSettings(
    deviceId: string,
    callback: CameraSettingsCallback
  ): Promise<() => void> {
    // Add callback to list
    if (!this.settingsCallbacks.has(deviceId)) {
      this.settingsCallbacks.set(deviceId, [])
    }
    this.settingsCallbacks.get(deviceId)!.push(callback)

    // Set up HID report subscription if not already done
    const subscriptionKey = deviceId
    if (!this.settingsSubscriptions.has(subscriptionKey)) {
      const unsubscribe = await this.hidService.subscribeToReports(
        deviceId,
        (report) => {
          this.handleCameraStatusReport(deviceId, report)
        }
      )

      this.settingsSubscriptions.set(subscriptionKey, unsubscribe)
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.settingsCallbacks.get(deviceId)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }

        // If no more callbacks, clean up subscription
        if (callbacks.length === 0) {
          const unsubscribe = this.settingsSubscriptions.get(subscriptionKey)
          if (unsubscribe) {
            unsubscribe()
            this.settingsSubscriptions.delete(subscriptionKey)
          }
          this.settingsCallbacks.delete(deviceId)
        }
      }
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async updateRecordingState(deviceId: string, state: RecordingState): Promise<void> {
    const settings = await this.getCameraSettings(deviceId)
    settings.recordingState = state
    this.deviceSettings.set(deviceId, settings)
    
    this.notifySettingsChange(deviceId, settings)
  }

  private async updateCameraSetting(
    deviceId: string,
    key: keyof CameraSettings,
    value: any
  ): Promise<void> {
    const settings = await this.getCameraSettings(deviceId)
    settings[key] = value
    this.deviceSettings.set(deviceId, settings)
    
    this.notifySettingsChange(deviceId, settings)
  }

  private notifySettingsChange(deviceId: string, settings: CameraSettings): void {
    const callbacks = this.settingsCallbacks.get(deviceId)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(settings)
        } catch (error) {
          console.error('Error in settings callback:', error)
        }
      })
    }
  }

  private handleCameraStatusReport(deviceId: string, report: any): void {
    console.log(`Received camera status report for ${deviceId}:`, report)
    // Handle incoming status reports from camera
    // This would parse camera status and update local settings
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Clean up all subscriptions and cached data for a device
   */
  cleanupDevice(deviceId: string): void {
    // Clean up HID subscriptions
    this.hidService.cleanupDevice(deviceId)

    // Clean up settings subscriptions
    const unsubscribe = this.settingsSubscriptions.get(deviceId)
    if (unsubscribe) {
      unsubscribe()
      this.settingsSubscriptions.delete(deviceId)
    }

    // Clear cached data
    this.deviceSettings.delete(deviceId)
    this.settingsCallbacks.delete(deviceId)

    console.log(`Cleaned up camera control data for device: ${deviceId}`)
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Clean up all HID resources
    this.hidService.cleanup()

    // Clean up all subscriptions
    for (const unsubscribe of this.settingsSubscriptions.values()) {
      unsubscribe()
    }
    this.settingsSubscriptions.clear()

    // Clear all cached data
    this.deviceSettings.clear()
    this.settingsCallbacks.clear()

    console.log('Camera Control Service cleanup completed')
  }
}