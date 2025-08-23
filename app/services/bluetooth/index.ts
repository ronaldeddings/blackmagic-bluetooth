/**
 * Bluetooth Services Export Index
 */

// Phase 1 & 2 Services
export { BlackmagicBluetoothManager, blackmagicBluetoothManager } from './BlackmagicBluetoothManager'
export { ServiceManager, CompleteDeviceInfo } from './ServiceManager'
export { GAPService, GAPDeviceInfo } from './GAPService'
export { DeviceInformationService, DeviceInformation } from './DeviceInformationService'
export { BatteryService, BatteryInfo, BatteryLevelCallback } from './BatteryService'

// Phase 3 Services
export { HIDService } from './HIDService'
export { CameraControlService, CameraSettingsCallback } from './CameraControlService'

// Phase 4 Services
export { FileTransferService } from './FileTransferService'
export { ObjectPushService } from './ObjectPushService'

// Types
export * from './types/BlackmagicTypes'