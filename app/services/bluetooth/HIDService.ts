/**
 * HID Service Implementation
 * 
 * Implements Human Interface Device service for camera control commands
 * UUID: 0x1812
 */

import {
  IHIDService,
  BLACKMAGIC_SERVICE_UUIDS,
  GATT_CHARACTERISTICS,
  HIDReport,
  CameraControlCommand,
  BlackmagicBluetoothUtils
} from './types/BlackmagicTypes'
import type { IBlackmagicBluetoothService } from './types/BlackmagicTypes'

export class HIDService implements IHIDService {
  private bluetoothManager: IBlackmagicBluetoothService
  private reportSubscriptions: Map<string, () => void> = new Map()

  constructor(bluetoothManager: IBlackmagicBluetoothService) {
    this.bluetoothManager = bluetoothManager
  }

  // ============================================================================
  // HID INFORMATION
  // ============================================================================

  async readHIDInformation(deviceId: string): Promise<{
    bcdHID: number
    bCountryCode: number
    flags: number
  }> {
    try {
      const data = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.HUMAN_INTERFACE_DEVICE,
        GATT_CHARACTERISTICS.HID_INFORMATION
      )

      const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
      const view = new DataView(buffer)

      return {
        bcdHID: view.getUint16(0, true), // Little endian
        bCountryCode: view.getUint8(2),
        flags: view.getUint8(3)
      }
    } catch (error) {
      console.error('Failed to read HID information:', error)
      throw new Error(`Failed to read HID information: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // REPORT MAP
  // ============================================================================

  async readReportMap(deviceId: string): Promise<Uint8Array> {
    try {
      const data = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.HUMAN_INTERFACE_DEVICE,
        GATT_CHARACTERISTICS.HID_REPORT_MAP
      )

      const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
      return new Uint8Array(buffer)
    } catch (error) {
      console.error('Failed to read HID report map:', error)
      throw new Error(`Failed to read HID report map: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // PROTOCOL MODE
  // ============================================================================

  async readProtocolMode(deviceId: string): Promise<number> {
    try {
      const data = await this.bluetoothManager.readCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.HUMAN_INTERFACE_DEVICE,
        GATT_CHARACTERISTICS.HID_PROTOCOL_MODE
      )

      const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
      const uint8Array = new Uint8Array(buffer)
      return uint8Array[0]
    } catch (error) {
      console.error('Failed to read HID protocol mode:', error)
      throw new Error(`Failed to read HID protocol mode: ${(error as Error).message}`)
    }
  }

  async setProtocolMode(deviceId: string, mode: number): Promise<void> {
    try {
      const buffer = new ArrayBuffer(1)
      const uint8Array = new Uint8Array(buffer)
      uint8Array[0] = mode

      const base64Data = BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)

      await this.bluetoothManager.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.HUMAN_INTERFACE_DEVICE,
        GATT_CHARACTERISTICS.HID_PROTOCOL_MODE,
        base64Data
      )
    } catch (error) {
      console.error('Failed to set HID protocol mode:', error)
      throw new Error(`Failed to set HID protocol mode: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // HID REPORTS
  // ============================================================================

  async sendReport(deviceId: string, report: HIDReport): Promise<void> {
    try {
      // Create report buffer: [reportId, command, data...]
      const dataLength = report.data ? report.data.length : 0
      const buffer = new ArrayBuffer(2 + dataLength)
      const uint8Array = new Uint8Array(buffer)

      uint8Array[0] = report.reportId
      uint8Array[1] = report.command

      if (report.data && dataLength > 0) {
        uint8Array.set(report.data, 2)
      }

      const base64Data = BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)

      await this.bluetoothManager.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.HUMAN_INTERFACE_DEVICE,
        GATT_CHARACTERISTICS.HID_REPORT,
        base64Data
      )

      console.log(`HID Report sent: reportId=${report.reportId}, command=0x${report.command.toString(16)}`)
    } catch (error) {
      console.error('Failed to send HID report:', error)
      throw new Error(`Failed to send HID report: ${(error as Error).message}`)
    }
  }

  async subscribeToReports(
    deviceId: string,
    callback: (report: HIDReport) => void
  ): Promise<() => void> {
    try {
      const subscriptionKey = `${deviceId}_reports`

      // Remove existing subscription if any
      const existingUnsub = this.reportSubscriptions.get(subscriptionKey)
      if (existingUnsub) {
        existingUnsub()
        this.reportSubscriptions.delete(subscriptionKey)
      }

      const unsubscribe = await this.bluetoothManager.subscribeToCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.HUMAN_INTERFACE_DEVICE,
        GATT_CHARACTERISTICS.HID_REPORT,
        (error, data) => {
          if (error) {
            console.error('HID report subscription error:', error)
            return
          }

          if (data) {
            try {
              const buffer = BlackmagicBluetoothUtils.base64ToArrayBuffer(data)
              const uint8Array = new Uint8Array(buffer)

              if (uint8Array.length >= 2) {
                const report: HIDReport = {
                  reportId: uint8Array[0],
                  command: uint8Array[1] as CameraControlCommand,
                  data: uint8Array.length > 2 ? uint8Array.slice(2) : undefined
                }

                callback(report)
              }
            } catch (parseError) {
              console.error('Failed to parse HID report:', parseError)
            }
          }
        }
      )

      const wrappedUnsubscribe = () => {
        unsubscribe()
        this.reportSubscriptions.delete(subscriptionKey)
      }

      this.reportSubscriptions.set(subscriptionKey, wrappedUnsubscribe)
      return wrappedUnsubscribe

    } catch (error) {
      console.error('Failed to subscribe to HID reports:', error)
      throw new Error(`Failed to subscribe to HID reports: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // CONTROL POINT
  // ============================================================================

  async sendControlCommand(deviceId: string, command: number): Promise<void> {
    try {
      const buffer = new ArrayBuffer(1)
      const uint8Array = new Uint8Array(buffer)
      uint8Array[0] = command

      const base64Data = BlackmagicBluetoothUtils.arrayBufferToBase64(buffer)

      await this.bluetoothManager.writeCharacteristic(
        deviceId,
        BLACKMAGIC_SERVICE_UUIDS.HUMAN_INTERFACE_DEVICE,
        GATT_CHARACTERISTICS.HID_CONTROL_POINT,
        base64Data
      )

      console.log(`HID Control command sent: 0x${command.toString(16)}`)
    } catch (error) {
      console.error('Failed to send HID control command:', error)
      throw new Error(`Failed to send HID control command: ${(error as Error).message}`)
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Create a camera control report
   */
  createCameraControlReport(command: CameraControlCommand, data?: Uint8Array): HIDReport {
    return {
      reportId: 0x01, // Camera control report ID
      command,
      data
    }
  }

  /**
   * Create report with numeric value (for settings like ISO, exposure, etc.)
   */
  createValueReport(command: CameraControlCommand, value: number): HIDReport {
    const buffer = new ArrayBuffer(4)
    const view = new DataView(buffer)
    view.setUint32(0, value, true) // Little endian

    return {
      reportId: 0x02, // Value report ID
      command,
      data: new Uint8Array(buffer)
    }
  }

  /**
   * Create report with string value (for codec, resolution, etc.)
   */
  createStringReport(command: CameraControlCommand, value: string): HIDReport {
    const encoder = new TextEncoder()
    const data = encoder.encode(value)

    return {
      reportId: 0x03, // String report ID
      command,
      data
    }
  }

  /**
   * Parse report response for status
   */
  parseStatusReport(data: Uint8Array): {
    success: boolean
    errorCode?: number
    message?: string
  } {
    if (data.length === 0) {
      return { success: false, message: 'Empty response' }
    }

    const status = data[0]
    if (status === 0x00) {
      return { success: true }
    } else {
      return {
        success: false,
        errorCode: status,
        message: this.getErrorMessage(status)
      }
    }
  }

  /**
   * Get human-readable error message for error codes
   */
  private getErrorMessage(errorCode: number): string {
    const errorMessages: Record<number, string> = {
      0x01: 'Invalid command',
      0x02: 'Command not supported',
      0x03: 'Invalid parameter',
      0x04: 'Camera busy',
      0x05: 'Recording in progress',
      0x06: 'Not recording',
      0x07: 'Storage full',
      0x08: 'Low battery',
      0x09: 'Temperature warning',
      0x0A: 'Hardware error',
      0xFF: 'Unknown error'
    }

    return errorMessages[errorCode] || `Unknown error (0x${errorCode.toString(16)})`
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Clean up all subscriptions for a device
   */
  cleanupDevice(deviceId: string): void {
    const subscriptionsToRemove: string[] = []

    for (const [key, unsubscribe] of this.reportSubscriptions) {
      if (key.startsWith(deviceId)) {
        unsubscribe()
        subscriptionsToRemove.push(key)
      }
    }

    subscriptionsToRemove.forEach(key => {
      this.reportSubscriptions.delete(key)
    })

    console.log(`Cleaned up HID subscriptions for device: ${deviceId}`)
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    for (const unsubscribe of this.reportSubscriptions.values()) {
      unsubscribe()
    }
    this.reportSubscriptions.clear()
    console.log('HID Service cleanup completed')
  }
}