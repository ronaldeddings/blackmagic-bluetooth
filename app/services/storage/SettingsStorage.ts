/**
 * Settings Storage Service
 * 
 * Manages application settings persistence using MMKV storage
 */

import { storage, load, save } from '../utils/storage'

// Settings categories
export interface AppSettings {
  // Camera settings
  defaultRecordingFormat: 'ProRes' | 'Blackmagic RAW' | 'H.264'
  defaultRecordingResolution: '4K' | '2.5K' | '1080p' | '720p'
  defaultFrameRate: 23.98 | 24 | 25 | 29.97 | 30 | 50 | 59.94 | 60
  autoStartRecording: boolean
  recordingTimecodeEnabled: boolean
  
  // Bluetooth settings
  autoConnectEnabled: boolean
  connectionTimeout: number
  scanDuration: number
  maxRetryAttempts: number
  
  // File transfer settings
  maxConcurrentTransfers: number
  autoRetryEnabled: boolean
  maxRetryCount: number
  downloadQuality: 'original' | 'proxy' | 'thumbnail'
  
  // UI preferences
  theme: 'light' | 'dark' | 'auto'
  language: 'en' | 'es' | 'fr' | 'de' | 'ja'
  showAdvancedControls: boolean
  enableHapticFeedback: boolean
  
  // Notifications
  enablePushNotifications: boolean
  transferCompleteNotifications: boolean
  lowBatteryNotifications: boolean
  connectionStatusNotifications: boolean
  
  // Storage preferences
  autoCleanupEnabled: boolean
  cleanupThresholdDays: number
  maxStorageUsageGB: number
}

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  // Camera defaults
  defaultRecordingFormat: 'Blackmagic RAW',
  defaultRecordingResolution: '4K',
  defaultFrameRate: 24,
  autoStartRecording: false,
  recordingTimecodeEnabled: true,
  
  // Bluetooth defaults
  autoConnectEnabled: true,
  connectionTimeout: 10000,
  scanDuration: 30000,
  maxRetryAttempts: 3,
  
  // File transfer defaults
  maxConcurrentTransfers: 3,
  autoRetryEnabled: true,
  maxRetryCount: 3,
  downloadQuality: 'original',
  
  // UI defaults
  theme: 'auto',
  language: 'en',
  showAdvancedControls: false,
  enableHapticFeedback: true,
  
  // Notification defaults
  enablePushNotifications: true,
  transferCompleteNotifications: true,
  lowBatteryNotifications: true,
  connectionStatusNotifications: false,
  
  // Storage defaults
  autoCleanupEnabled: true,
  cleanupThresholdDays: 30,
  maxStorageUsageGB: 32
}

// Storage keys
const STORAGE_KEYS = {
  APP_SETTINGS: 'app.settings',
  CAMERA_SETTINGS: 'settings.camera',
  BLUETOOTH_SETTINGS: 'settings.bluetooth',
  TRANSFER_SETTINGS: 'settings.transfer',
  UI_SETTINGS: 'settings.ui',
  NOTIFICATION_SETTINGS: 'settings.notifications',
  STORAGE_SETTINGS: 'settings.storage'
} as const

export class SettingsStorage {
  
  /**
   * Load all application settings
   */
  static loadSettings(): AppSettings {
    const settings = load<AppSettings>(STORAGE_KEYS.APP_SETTINGS)
    return {
      ...DEFAULT_SETTINGS,
      ...settings
    }
  }
  
  /**
   * Save all application settings
   */
  static saveSettings(settings: AppSettings): boolean {
    return save(STORAGE_KEYS.APP_SETTINGS, settings)
  }
  
  /**
   * Update specific setting
   */
  static updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): boolean {
    const currentSettings = this.loadSettings()
    const updatedSettings = {
      ...currentSettings,
      [key]: value
    }
    return this.saveSettings(updatedSettings)
  }
  
  /**
   * Get specific setting value
   */
  static getSetting<K extends keyof AppSettings>(
    key: K
  ): AppSettings[K] {
    const settings = this.loadSettings()
    return settings[key]
  }
  
  /**
   * Reset settings to defaults
   */
  static resetSettings(): boolean {
    return this.saveSettings(DEFAULT_SETTINGS)
  }
  
  /**
   * Reset specific category to defaults
   */
  static resetCategory(category: 'camera' | 'bluetooth' | 'transfer' | 'ui' | 'notifications' | 'storage'): boolean {
    const currentSettings = this.loadSettings()
    
    switch (category) {
      case 'camera':
        return this.saveSettings({
          ...currentSettings,
          defaultRecordingFormat: DEFAULT_SETTINGS.defaultRecordingFormat,
          defaultRecordingResolution: DEFAULT_SETTINGS.defaultRecordingResolution,
          defaultFrameRate: DEFAULT_SETTINGS.defaultFrameRate,
          autoStartRecording: DEFAULT_SETTINGS.autoStartRecording,
          recordingTimecodeEnabled: DEFAULT_SETTINGS.recordingTimecodeEnabled
        })
        
      case 'bluetooth':
        return this.saveSettings({
          ...currentSettings,
          autoConnectEnabled: DEFAULT_SETTINGS.autoConnectEnabled,
          connectionTimeout: DEFAULT_SETTINGS.connectionTimeout,
          scanDuration: DEFAULT_SETTINGS.scanDuration,
          maxRetryAttempts: DEFAULT_SETTINGS.maxRetryAttempts
        })
        
      case 'transfer':
        return this.saveSettings({
          ...currentSettings,
          maxConcurrentTransfers: DEFAULT_SETTINGS.maxConcurrentTransfers,
          autoRetryEnabled: DEFAULT_SETTINGS.autoRetryEnabled,
          maxRetryCount: DEFAULT_SETTINGS.maxRetryCount,
          downloadQuality: DEFAULT_SETTINGS.downloadQuality
        })
        
      case 'ui':
        return this.saveSettings({
          ...currentSettings,
          theme: DEFAULT_SETTINGS.theme,
          language: DEFAULT_SETTINGS.language,
          showAdvancedControls: DEFAULT_SETTINGS.showAdvancedControls,
          enableHapticFeedback: DEFAULT_SETTINGS.enableHapticFeedback
        })
        
      case 'notifications':
        return this.saveSettings({
          ...currentSettings,
          enablePushNotifications: DEFAULT_SETTINGS.enablePushNotifications,
          transferCompleteNotifications: DEFAULT_SETTINGS.transferCompleteNotifications,
          lowBatteryNotifications: DEFAULT_SETTINGS.lowBatteryNotifications,
          connectionStatusNotifications: DEFAULT_SETTINGS.connectionStatusNotifications
        })
        
      case 'storage':
        return this.saveSettings({
          ...currentSettings,
          autoCleanupEnabled: DEFAULT_SETTINGS.autoCleanupEnabled,
          cleanupThresholdDays: DEFAULT_SETTINGS.cleanupThresholdDays,
          maxStorageUsageGB: DEFAULT_SETTINGS.maxStorageUsageGB
        })
        
      default:
        return false
    }
  }
  
  /**
   * Export settings for backup
   */
  static exportSettings(): string {
    const settings = this.loadSettings()
    return JSON.stringify(settings, null, 2)
  }
  
  /**
   * Import settings from backup
   */
  static importSettings(settingsJson: string): boolean {
    try {
      const importedSettings = JSON.parse(settingsJson) as Partial<AppSettings>
      const currentSettings = this.loadSettings()
      
      // Merge with current settings, validating each field
      const mergedSettings: AppSettings = {
        ...currentSettings,
        ...importedSettings
      }
      
      // Validate imported settings
      if (!this.validateSettings(mergedSettings)) {
        return false
      }
      
      return this.saveSettings(mergedSettings)
    } catch (error) {
      console.error('Failed to import settings:', error)
      return false
    }
  }
  
  /**
   * Validate settings structure and values
   */
  private static validateSettings(settings: AppSettings): boolean {
    try {
      // Validate recording format
      if (!['ProRes', 'Blackmagic RAW', 'H.264'].includes(settings.defaultRecordingFormat)) {
        return false
      }
      
      // Validate resolution
      if (!['4K', '2.5K', '1080p', '720p'].includes(settings.defaultRecordingResolution)) {
        return false
      }
      
      // Validate frame rate
      const validFrameRates = [23.98, 24, 25, 29.97, 30, 50, 59.94, 60]
      if (!validFrameRates.includes(settings.defaultFrameRate)) {
        return false
      }
      
      // Validate theme
      if (!['light', 'dark', 'auto'].includes(settings.theme)) {
        return false
      }
      
      // Validate language
      if (!['en', 'es', 'fr', 'de', 'ja'].includes(settings.language)) {
        return false
      }
      
      // Validate download quality
      if (!['original', 'proxy', 'thumbnail'].includes(settings.downloadQuality)) {
        return false
      }
      
      // Validate numeric ranges
      if (settings.connectionTimeout < 1000 || settings.connectionTimeout > 60000) {
        return false
      }
      
      if (settings.scanDuration < 5000 || settings.scanDuration > 120000) {
        return false
      }
      
      if (settings.maxRetryAttempts < 0 || settings.maxRetryAttempts > 10) {
        return false
      }
      
      if (settings.maxConcurrentTransfers < 1 || settings.maxConcurrentTransfers > 10) {
        return false
      }
      
      if (settings.maxRetryCount < 0 || settings.maxRetryCount > 10) {
        return false
      }
      
      if (settings.cleanupThresholdDays < 1 || settings.cleanupThresholdDays > 365) {
        return false
      }
      
      if (settings.maxStorageUsageGB < 1 || settings.maxStorageUsageGB > 1024) {
        return false
      }
      
      return true
    } catch (error) {
      return false
    }
  }
  
  /**
   * Get settings migration info
   */
  static getMigrationInfo(): { version: string; lastMigration: string | null } {
    const version = storage.getString('settings.version') || '1.0.0'
    const lastMigration = storage.getString('settings.lastMigration')
    
    return { version, lastMigration }
  }
  
  /**
   * Perform settings migration
   */
  static migrateSettings(fromVersion: string, toVersion: string): boolean {
    try {
      // Future migration logic can be added here
      storage.set('settings.version', toVersion)
      storage.set('settings.lastMigration', new Date().toISOString())
      return true
    } catch (error) {
      console.error('Settings migration failed:', error)
      return false
    }
  }
}

export default SettingsStorage