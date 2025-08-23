/**
 * User Preferences Storage Service
 * 
 * Manages user-specific preferences and customization settings
 */

import { storage, load, save } from '../utils/storage'

// User interface preferences
export interface UIPreferences {
  // Layout preferences
  compactMode: boolean
  showToolbars: boolean
  showStatusBar: boolean
  gridViewEnabled: boolean
  
  // Control preferences
  swipeGestures: boolean
  pinchToZoom: boolean
  doubleTapToFocus: boolean
  volumeButtonsForControl: boolean
  
  // Display preferences
  showBatteryIndicator: boolean
  showStorageIndicator: boolean
  showConnectionQuality: boolean
  showFrameRate: boolean
  showTimecode: boolean
  
  // Color and theme
  accentColor: string
  customThemeColors?: {
    primary: string
    secondary: string
    background: string
    surface: string
    text: string
  }
}

// Workflow preferences
export interface WorkflowPreferences {
  // Recording workflow
  quickRecordEnabled: boolean
  recordingPresets: RecordingPreset[]
  defaultPresetId?: string
  
  // File management
  autoOrganizeFiles: boolean
  fileNamingPattern: string
  createDateFolders: boolean
  
  // Transfer preferences
  autoTransferEnabled: boolean
  transferQuality: 'original' | 'proxy' | 'both'
  deleteAfterTransfer: boolean
  
  // Backup preferences
  autoBackupSettings: boolean
  cloudBackupEnabled: boolean
  backupSchedule: 'never' | 'daily' | 'weekly' | 'monthly'
}

// Recording preset
export interface RecordingPreset {
  id: string
  name: string
  format: 'ProRes' | 'Blackmagic RAW' | 'H.264'
  resolution: '4K' | '2.5K' | '1080p' | '720p'
  frameRate: 23.98 | 24 | 25 | 29.97 | 30 | 50 | 59.94 | 60
  codec?: string
  quality?: 'high' | 'medium' | 'low'
  iso?: number
  shutter?: number
  aperture?: number
  whiteBalance?: number
  isDefault: boolean
}

// Accessibility preferences
export interface AccessibilityPreferences {
  // Visual accessibility
  largeText: boolean
  highContrast: boolean
  reducedMotion: boolean
  colorBlindnessSupport: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'
  
  // Audio accessibility
  hapticFeedback: boolean
  audioFeedback: boolean
  voiceCommands: boolean
  
  // Control accessibility
  longPressDelay: number
  doubleTapSpeed: number
  minimumTouchTarget: number
}

// User profile
export interface UserProfile {
  // Basic info
  name?: string
  email?: string
  organization?: string
  role?: 'director' | 'cinematographer' | 'operator' | 'assistant' | 'other'
  
  // Experience level
  experienceLevel: 'beginner' | 'intermediate' | 'expert'
  showTips: boolean
  completedOnboarding: boolean
  
  // Usage stats
  totalRecordingTime: number
  totalFilesTransferred: number
  favoriteFeatures: string[]
  
  // Privacy
  analyticsEnabled: boolean
  crashReportingEnabled: boolean
  usageDataSharing: boolean
}

// Combined user preferences
export interface UserPreferences {
  ui: UIPreferences
  workflow: WorkflowPreferences
  accessibility: AccessibilityPreferences
  profile: UserProfile
  
  // Metadata
  version: string
  lastModified: Date
  deviceId?: string
}

// Default preferences
const DEFAULT_UI_PREFERENCES: UIPreferences = {
  compactMode: false,
  showToolbars: true,
  showStatusBar: true,
  gridViewEnabled: false,
  swipeGestures: true,
  pinchToZoom: true,
  doubleTapToFocus: true,
  volumeButtonsForControl: false,
  showBatteryIndicator: true,
  showStorageIndicator: true,
  showConnectionQuality: true,
  showFrameRate: true,
  showTimecode: false,
  accentColor: '#007AFF'
}

const DEFAULT_WORKFLOW_PREFERENCES: WorkflowPreferences = {
  quickRecordEnabled: true,
  recordingPresets: [
    {
      id: 'default-4k',
      name: '4K 24fps BRAW',
      format: 'Blackmagic RAW',
      resolution: '4K',
      frameRate: 24,
      isDefault: true
    }
  ],
  defaultPresetId: 'default-4k',
  autoOrganizeFiles: true,
  fileNamingPattern: 'YYYY-MM-DD_HH-mm-ss',
  createDateFolders: true,
  autoTransferEnabled: false,
  transferQuality: 'original',
  deleteAfterTransfer: false,
  autoBackupSettings: true,
  cloudBackupEnabled: false,
  backupSchedule: 'never'
}

const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  largeText: false,
  highContrast: false,
  reducedMotion: false,
  colorBlindnessSupport: 'none',
  hapticFeedback: true,
  audioFeedback: false,
  voiceCommands: false,
  longPressDelay: 500,
  doubleTapSpeed: 300,
  minimumTouchTarget: 44
}

const DEFAULT_USER_PROFILE: UserProfile = {
  experienceLevel: 'intermediate',
  showTips: true,
  completedOnboarding: false,
  totalRecordingTime: 0,
  totalFilesTransferred: 0,
  favoriteFeatures: [],
  analyticsEnabled: true,
  crashReportingEnabled: true,
  usageDataSharing: false
}

// Storage keys
const STORAGE_KEYS = {
  USER_PREFERENCES: 'user.preferences',
  UI_PREFERENCES: 'preferences.ui',
  WORKFLOW_PREFERENCES: 'preferences.workflow',
  ACCESSIBILITY_PREFERENCES: 'preferences.accessibility',
  USER_PROFILE: 'user.profile',
  RECORDING_PRESETS: 'preferences.presets'
} as const

export class UserPreferencesStorage {
  
  /**
   * Load all user preferences
   */
  static loadPreferences(): UserPreferences {
    const preferences = load<UserPreferences>(STORAGE_KEYS.USER_PREFERENCES)
    
    if (!preferences) {
      return this.getDefaultPreferences()
    }
    
    // Merge with defaults to ensure all properties exist
    return {
      ui: { ...DEFAULT_UI_PREFERENCES, ...preferences.ui },
      workflow: { ...DEFAULT_WORKFLOW_PREFERENCES, ...preferences.workflow },
      accessibility: { ...DEFAULT_ACCESSIBILITY_PREFERENCES, ...preferences.accessibility },
      profile: { ...DEFAULT_USER_PROFILE, ...preferences.profile },
      version: preferences.version || '1.0.0',
      lastModified: new Date(preferences.lastModified),
      deviceId: preferences.deviceId
    }
  }
  
  /**
   * Save user preferences
   */
  static savePreferences(preferences: UserPreferences): boolean {
    const preferencesToSave = {
      ...preferences,
      lastModified: new Date()
    }
    
    return save(STORAGE_KEYS.USER_PREFERENCES, preferencesToSave)
  }
  
  /**
   * Get default preferences
   */
  static getDefaultPreferences(): UserPreferences {
    return {
      ui: DEFAULT_UI_PREFERENCES,
      workflow: DEFAULT_WORKFLOW_PREFERENCES,
      accessibility: DEFAULT_ACCESSIBILITY_PREFERENCES,
      profile: DEFAULT_USER_PROFILE,
      version: '1.0.0',
      lastModified: new Date()
    }
  }
  
  /**
   * Update UI preferences
   */
  static updateUIPreferences(updates: Partial<UIPreferences>): boolean {
    const preferences = this.loadPreferences()
    preferences.ui = { ...preferences.ui, ...updates }
    return this.savePreferences(preferences)
  }
  
  /**
   * Update workflow preferences
   */
  static updateWorkflowPreferences(updates: Partial<WorkflowPreferences>): boolean {
    const preferences = this.loadPreferences()
    preferences.workflow = { ...preferences.workflow, ...updates }
    return this.savePreferences(preferences)
  }
  
  /**
   * Update accessibility preferences
   */
  static updateAccessibilityPreferences(updates: Partial<AccessibilityPreferences>): boolean {
    const preferences = this.loadPreferences()
    preferences.accessibility = { ...preferences.accessibility, ...updates }
    return this.savePreferences(preferences)
  }
  
  /**
   * Update user profile
   */
  static updateUserProfile(updates: Partial<UserProfile>): boolean {
    const preferences = this.loadPreferences()
    preferences.profile = { ...preferences.profile, ...updates }
    return this.savePreferences(preferences)
  }
  
  /**
   * Get recording presets
   */
  static getRecordingPresets(): RecordingPreset[] {
    const preferences = this.loadPreferences()
    return preferences.workflow.recordingPresets
  }
  
  /**
   * Add recording preset
   */
  static addRecordingPreset(preset: Omit<RecordingPreset, 'id'>): string {
    const presetId = `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newPreset: RecordingPreset = {
      ...preset,
      id: presetId
    }
    
    const preferences = this.loadPreferences()
    preferences.workflow.recordingPresets.push(newPreset)
    
    // If this is set as default, update other presets
    if (newPreset.isDefault) {
      preferences.workflow.recordingPresets = preferences.workflow.recordingPresets.map(p => 
        p.id === presetId ? p : { ...p, isDefault: false }
      )
      preferences.workflow.defaultPresetId = presetId
    }
    
    this.savePreferences(preferences)
    return presetId
  }
  
  /**
   * Update recording preset
   */
  static updateRecordingPreset(presetId: string, updates: Partial<RecordingPreset>): boolean {
    const preferences = this.loadPreferences()
    const presetIndex = preferences.workflow.recordingPresets.findIndex(p => p.id === presetId)
    
    if (presetIndex === -1) return false
    
    preferences.workflow.recordingPresets[presetIndex] = {
      ...preferences.workflow.recordingPresets[presetIndex],
      ...updates
    }
    
    // Handle default preset changes
    if (updates.isDefault) {
      preferences.workflow.recordingPresets = preferences.workflow.recordingPresets.map((p, index) => 
        index === presetIndex ? p : { ...p, isDefault: false }
      )
      preferences.workflow.defaultPresetId = presetId
    }
    
    return this.savePreferences(preferences)
  }
  
  /**
   * Delete recording preset
   */
  static deleteRecordingPreset(presetId: string): boolean {
    const preferences = this.loadPreferences()
    const presetIndex = preferences.workflow.recordingPresets.findIndex(p => p.id === presetId)
    
    if (presetIndex === -1) return false
    
    // Don't allow deletion of the last preset
    if (preferences.workflow.recordingPresets.length <= 1) return false
    
    const wasDefault = preferences.workflow.recordingPresets[presetIndex].isDefault
    preferences.workflow.recordingPresets.splice(presetIndex, 1)
    
    // If we deleted the default preset, make the first one default
    if (wasDefault && preferences.workflow.recordingPresets.length > 0) {
      preferences.workflow.recordingPresets[0].isDefault = true
      preferences.workflow.defaultPresetId = preferences.workflow.recordingPresets[0].id
    }
    
    return this.savePreferences(preferences)
  }
  
  /**
   * Get default recording preset
   */
  static getDefaultRecordingPreset(): RecordingPreset | null {
    const presets = this.getRecordingPresets()
    const preferences = this.loadPreferences()
    
    // Try to find by default ID
    if (preferences.workflow.defaultPresetId) {
      const preset = presets.find(p => p.id === preferences.workflow.defaultPresetId)
      if (preset) return preset
    }
    
    // Fallback to first preset marked as default
    const defaultPreset = presets.find(p => p.isDefault)
    if (defaultPreset) return defaultPreset
    
    // Fallback to first preset
    return presets[0] || null
  }
  
  /**
   * Update usage statistics
   */
  static updateUsageStats(stats: {
    recordingTime?: number
    filesTransferred?: number
    newFavoriteFeature?: string
  }): boolean {
    const preferences = this.loadPreferences()
    
    if (stats.recordingTime) {
      preferences.profile.totalRecordingTime += stats.recordingTime
    }
    
    if (stats.filesTransferred) {
      preferences.profile.totalFilesTransferred += stats.filesTransferred
    }
    
    if (stats.newFavoriteFeature && !preferences.profile.favoriteFeatures.includes(stats.newFavoriteFeature)) {
      preferences.profile.favoriteFeatures.push(stats.newFavoriteFeature)
      // Keep only top 10 favorite features
      if (preferences.profile.favoriteFeatures.length > 10) {
        preferences.profile.favoriteFeatures = preferences.profile.favoriteFeatures.slice(0, 10)
      }
    }
    
    return this.savePreferences(preferences)
  }
  
  /**
   * Reset preferences to defaults
   */
  static resetPreferences(): boolean {
    return this.savePreferences(this.getDefaultPreferences())
  }
  
  /**
   * Export preferences
   */
  static exportPreferences(): string {
    const preferences = this.loadPreferences()
    return JSON.stringify(preferences, null, 2)
  }
  
  /**
   * Import preferences
   */
  static importPreferences(preferencesJson: string): boolean {
    try {
      const importedPreferences = JSON.parse(preferencesJson) as UserPreferences
      
      // Validate structure
      if (!this.validatePreferences(importedPreferences)) {
        return false
      }
      
      return this.savePreferences(importedPreferences)
    } catch (error) {
      console.error('Failed to import preferences:', error)
      return false
    }
  }
  
  /**
   * Validate preferences structure
   */
  private static validatePreferences(preferences: UserPreferences): boolean {
    try {
      // Check required top-level properties
      if (!preferences.ui || !preferences.workflow || !preferences.accessibility || !preferences.profile) {
        return false
      }
      
      // Validate accent color format
      if (preferences.ui.accentColor && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(preferences.ui.accentColor)) {
        return false
      }
      
      // Validate experience level
      if (!['beginner', 'intermediate', 'expert'].includes(preferences.profile.experienceLevel)) {
        return false
      }
      
      // Validate recording presets
      if (!Array.isArray(preferences.workflow.recordingPresets)) {
        return false
      }
      
      for (const preset of preferences.workflow.recordingPresets) {
        if (!preset.id || !preset.name || !preset.format || !preset.resolution || !preset.frameRate) {
          return false
        }
      }
      
      return true
    } catch (error) {
      return false
    }
  }
  
  /**
   * Get preferences summary for debugging
   */
  static getPreferencesSummary(): {
    version: string
    lastModified: string
    presetCount: number
    experienceLevel: string
    onboardingComplete: boolean
  } {
    const preferences = this.loadPreferences()
    
    return {
      version: preferences.version,
      lastModified: preferences.lastModified.toISOString(),
      presetCount: preferences.workflow.recordingPresets.length,
      experienceLevel: preferences.profile.experienceLevel,
      onboardingComplete: preferences.profile.completedOnboarding
    }
  }
}

export default UserPreferencesStorage