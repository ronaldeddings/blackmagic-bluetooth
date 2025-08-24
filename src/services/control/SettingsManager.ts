import { EventEmitter } from 'events';
import type { CameraCommand } from '../../types';

export interface CameraSetting {
  id: string;
  name: string;
  category: 'video' | 'audio' | 'system' | 'network' | 'storage';
  type: 'number' | 'string' | 'boolean' | 'enum' | 'range';
  value: any;
  defaultValue: any;
  readonly: boolean;
  options?: any[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  description: string;
  dependencies?: string[];
  validation?: (value: any) => boolean;
}

export interface SettingsProfile {
  id: string;
  name: string;
  description: string;
  category: 'preset' | 'user' | 'custom';
  settings: Record<string, any>;
  createdAt: Date;
  modifiedAt: Date;
  isDefault?: boolean;
}

export interface SettingsGroup {
  id: string;
  name: string;
  settings: CameraSetting[];
  collapsed?: boolean;
}

const CAMERA_SETTINGS: SettingsGroup[] = [
  {
    id: 'video',
    name: 'Video Settings',
    settings: [
      {
        id: 'resolution',
        name: 'Resolution',
        category: 'video',
        type: 'enum',
        value: '1920x1080',
        defaultValue: '1920x1080',
        readonly: false,
        options: [
          { value: '640x360', label: '640×360 (360p)' },
          { value: '854x480', label: '854×480 (480p)' },
          { value: '1280x720', label: '1280×720 (720p)' },
          { value: '1920x1080', label: '1920×1080 (1080p)' },
          { value: '2560x1440', label: '2560×1440 (1440p)' },
          { value: '3840x2160', label: '3840×2160 (4K UHD)' },
          { value: '4096x2160', label: '4096×2160 (4K DCI)' }
        ],
        description: 'Video recording resolution'
      },
      {
        id: 'framerate',
        name: 'Frame Rate',
        category: 'video',
        type: 'enum',
        value: 30,
        defaultValue: 30,
        readonly: false,
        options: [
          { value: 23.98, label: '23.98 fps' },
          { value: 24, label: '24 fps' },
          { value: 25, label: '25 fps' },
          { value: 29.97, label: '29.97 fps' },
          { value: 30, label: '30 fps' },
          { value: 48, label: '48 fps' },
          { value: 50, label: '50 fps' },
          { value: 59.94, label: '59.94 fps' },
          { value: 60, label: '60 fps' }
        ],
        unit: 'fps',
        description: 'Video recording frame rate'
      },
      {
        id: 'codec',
        name: 'Recording Codec',
        category: 'video',
        type: 'enum',
        value: 'h264',
        defaultValue: 'h264',
        readonly: false,
        options: [
          { value: 'h264', label: 'H.264' },
          { value: 'h265', label: 'H.265/HEVC' },
          { value: 'prores', label: 'Apple ProRes' },
          { value: 'blackmagic_raw', label: 'Blackmagic RAW' },
          { value: 'dnxhd', label: 'Avid DNxHD' }
        ],
        description: 'Video recording codec'
      },
      {
        id: 'quality',
        name: 'Recording Quality',
        category: 'video',
        type: 'enum',
        value: 'high',
        defaultValue: 'high',
        readonly: false,
        options: [
          { value: 'proxy', label: 'Proxy (Low)' },
          { value: 'lt', label: 'LT (Medium)' },
          { value: 'standard', label: 'Standard (High)' },
          { value: 'hq', label: 'HQ (Very High)' },
          { value: '444', label: '4:4:4 (Maximum)' }
        ],
        description: 'Video recording quality/compression level',
        dependencies: ['codec']
      }
    ]
  },
  {
    id: 'exposure',
    name: 'Exposure & Color',
    settings: [
      {
        id: 'iso',
        name: 'ISO',
        category: 'video',
        type: 'enum',
        value: 800,
        defaultValue: 800,
        readonly: false,
        options: [
          { value: 100, label: 'ISO 100' },
          { value: 200, label: 'ISO 200' },
          { value: 400, label: 'ISO 400' },
          { value: 800, label: 'ISO 800' },
          { value: 1600, label: 'ISO 1600' },
          { value: 3200, label: 'ISO 3200' },
          { value: 6400, label: 'ISO 6400' },
          { value: 12800, label: 'ISO 12800' }
        ],
        description: 'Sensor sensitivity to light'
      },
      {
        id: 'aperture',
        name: 'Aperture',
        category: 'video',
        type: 'range',
        value: 2.8,
        defaultValue: 2.8,
        readonly: false,
        min: 1.2,
        max: 22,
        step: 0.1,
        unit: 'f/',
        description: 'Lens aperture setting (depth of field)'
      },
      {
        id: 'shutter_angle',
        name: 'Shutter Angle',
        category: 'video',
        type: 'range',
        value: 180,
        defaultValue: 180,
        readonly: false,
        min: 45,
        max: 360,
        step: 1,
        unit: '°',
        description: 'Shutter angle (motion blur)'
      },
      {
        id: 'white_balance',
        name: 'White Balance',
        category: 'video',
        type: 'enum',
        value: 5600,
        defaultValue: 5600,
        readonly: false,
        options: [
          { value: 2500, label: '2500K (Tungsten)' },
          { value: 3200, label: '3200K (Warm White)' },
          { value: 4000, label: '4000K (Cool White)' },
          { value: 5600, label: '5600K (Daylight)' },
          { value: 6500, label: '6500K (Cloudy)' },
          { value: 7500, label: '7500K (Shade)' },
          { value: 'auto', label: 'Auto' }
        ],
        unit: 'K',
        description: 'White balance color temperature'
      },
      {
        id: 'tint',
        name: 'Tint',
        category: 'video',
        type: 'range',
        value: 0,
        defaultValue: 0,
        readonly: false,
        min: -50,
        max: 50,
        step: 1,
        description: 'White balance tint adjustment (green/magenta)'
      }
    ]
  },
  {
    id: 'audio',
    name: 'Audio Settings',
    settings: [
      {
        id: 'audio_input',
        name: 'Audio Input',
        category: 'audio',
        type: 'enum',
        value: 'internal',
        defaultValue: 'internal',
        readonly: false,
        options: [
          { value: 'internal', label: 'Internal Microphone' },
          { value: 'external', label: 'External Microphone' },
          { value: 'line', label: 'Line Input' },
          { value: 'none', label: 'No Audio' }
        ],
        description: 'Audio input source'
      },
      {
        id: 'audio_level',
        name: 'Audio Level',
        category: 'audio',
        type: 'range',
        value: 0,
        defaultValue: 0,
        readonly: false,
        min: -60,
        max: 12,
        step: 1,
        unit: 'dB',
        description: 'Audio recording level'
      },
      {
        id: 'audio_channels',
        name: 'Audio Channels',
        category: 'audio',
        type: 'enum',
        value: 'stereo',
        defaultValue: 'stereo',
        readonly: false,
        options: [
          { value: 'mono', label: 'Mono' },
          { value: 'stereo', label: 'Stereo' }
        ],
        description: 'Audio channel configuration'
      },
      {
        id: 'phantom_power',
        name: 'Phantom Power',
        category: 'audio',
        type: 'boolean',
        value: false,
        defaultValue: false,
        readonly: false,
        description: 'Enable phantom power for external microphones'
      }
    ]
  },
  {
    id: 'system',
    name: 'System Settings',
    settings: [
      {
        id: 'timecode',
        name: 'Timecode',
        category: 'system',
        type: 'enum',
        value: 'internal',
        defaultValue: 'internal',
        readonly: false,
        options: [
          { value: 'internal', label: 'Internal' },
          { value: 'external', label: 'External' },
          { value: 'jam_sync', label: 'Jam Sync' }
        ],
        description: 'Timecode source'
      },
      {
        id: 'recording_format',
        name: 'Recording Format',
        category: 'system',
        type: 'enum',
        value: 'mov',
        defaultValue: 'mov',
        readonly: false,
        options: [
          { value: 'mov', label: 'QuickTime (.mov)' },
          { value: 'mp4', label: 'MP4 (.mp4)' },
          { value: 'mxf', label: 'MXF (.mxf)' }
        ],
        description: 'Recording file format'
      },
      {
        id: 'auto_record',
        name: 'Auto Record',
        category: 'system',
        type: 'boolean',
        value: false,
        defaultValue: false,
        readonly: false,
        description: 'Automatically start recording on power up'
      },
      {
        id: 'lcd_brightness',
        name: 'LCD Brightness',
        category: 'system',
        type: 'range',
        value: 50,
        defaultValue: 50,
        readonly: false,
        min: 0,
        max: 100,
        step: 5,
        unit: '%',
        description: 'LCD screen brightness'
      }
    ]
  },
  {
    id: 'network',
    name: 'Network & Streaming',
    settings: [
      {
        id: 'wifi_enabled',
        name: 'Wi-Fi',
        category: 'network',
        type: 'boolean',
        value: true,
        defaultValue: true,
        readonly: false,
        description: 'Enable Wi-Fi connectivity'
      },
      {
        id: 'bluetooth_enabled',
        name: 'Bluetooth',
        category: 'network',
        type: 'boolean',
        value: true,
        defaultValue: true,
        readonly: false,
        description: 'Enable Bluetooth connectivity'
      },
      {
        id: 'streaming_quality',
        name: 'Streaming Quality',
        category: 'network',
        type: 'enum',
        value: 'medium',
        defaultValue: 'medium',
        readonly: false,
        options: [
          { value: 'low', label: 'Low (720p30)' },
          { value: 'medium', label: 'Medium (1080p30)' },
          { value: 'high', label: 'High (1080p60)' }
        ],
        description: 'Live streaming quality',
        dependencies: ['wifi_enabled']
      }
    ]
  }
];

const DEFAULT_PROFILES: SettingsProfile[] = [
  {
    id: 'interview',
    name: 'Interview',
    description: 'Optimized for talking head interviews',
    category: 'preset',
    settings: {
      resolution: '1920x1080',
      framerate: 24,
      codec: 'h264',
      quality: 'high',
      iso: 400,
      aperture: 2.8,
      shutter_angle: 180,
      white_balance: 5600
    },
    createdAt: new Date(),
    modifiedAt: new Date(),
    isDefault: true
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: '4K cinematic recording with RAW codec',
    category: 'preset',
    settings: {
      resolution: '3840x2160',
      framerate: 24,
      codec: 'blackmagic_raw',
      quality: '444',
      iso: 200,
      aperture: 1.8,
      shutter_angle: 180,
      white_balance: 5600
    },
    createdAt: new Date(),
    modifiedAt: new Date()
  },
  {
    id: 'event',
    name: 'Event Coverage',
    description: 'Run and gun event recording',
    category: 'preset',
    settings: {
      resolution: '1920x1080',
      framerate: 30,
      codec: 'h264',
      quality: 'standard',
      iso: 800,
      aperture: 4.0,
      white_balance: 'auto',
      auto_record: true
    },
    createdAt: new Date(),
    modifiedAt: new Date()
  },
  {
    id: 'streaming',
    name: 'Live Streaming',
    description: 'Optimized for live streaming',
    category: 'preset',
    settings: {
      resolution: '1920x1080',
      framerate: 30,
      codec: 'h264',
      quality: 'standard',
      streaming_quality: 'medium',
      iso: 400,
      white_balance: 5000
    },
    createdAt: new Date(),
    modifiedAt: new Date()
  }
];

export class SettingsManager extends EventEmitter {
  private settingsGroups: SettingsGroup[] = [...CAMERA_SETTINGS];
  private profiles: SettingsProfile[] = [...DEFAULT_PROFILES];
  private currentSettings: Map<string, Map<string, any>> = new Map(); // deviceId -> settings
  private activeProfiles: Map<string, string> = new Map(); // deviceId -> profileId

  constructor() {
    super();
    console.log('⚙️ SettingsManager initialized');
  }

  /**
   * Get all settings groups
   */
  getSettingsGroups(): SettingsGroup[] {
    return [...this.settingsGroups];
  }

  /**
   * Get settings for a specific group
   */
  getSettingsGroup(groupId: string): SettingsGroup | undefined {
    return this.settingsGroups.find(group => group.id === groupId);
  }

  /**
   * Get a specific setting definition
   */
  getSetting(settingId: string): CameraSetting | undefined {
    for (const group of this.settingsGroups) {
      const setting = group.settings.find(s => s.id === settingId);
      if (setting) return setting;
    }
    return undefined;
  }

  /**
   * Get current value of a setting for a device
   */
  getSettingValue(deviceId: string, settingId: string): any {
    const deviceSettings = this.currentSettings.get(deviceId);
    if (!deviceSettings) return this.getSettingDefault(settingId);
    
    return deviceSettings.get(settingId) ?? this.getSettingDefault(settingId);
  }

  /**
   * Set value of a setting for a device
   */
  async setSettingValue(deviceId: string, settingId: string, value: any): Promise<void> {
    const setting = this.getSetting(settingId);
    if (!setting) {
      throw new Error(`Setting ${settingId} not found`);
    }

    if (setting.readonly) {
      throw new Error(`Setting ${settingId} is readonly`);
    }

    // Validate value
    if (!this.validateSettingValue(setting, value)) {
      throw new Error(`Invalid value for setting ${settingId}`);
    }

    // Check dependencies
    if (setting.dependencies) {
      for (const dep of setting.dependencies) {
        const depValue = this.getSettingValue(deviceId, dep);
        if (!this.checkDependency(setting, dep, depValue)) {
          throw new Error(`Setting ${settingId} depends on ${dep}`);
        }
      }
    }

    // Update local state
    if (!this.currentSettings.has(deviceId)) {
      this.currentSettings.set(deviceId, new Map());
    }
    this.currentSettings.get(deviceId)!.set(settingId, value);

    // Emit change event
    this.emit('setting-changed', { deviceId, setting: settingId, value, oldValue: setting.value });

    console.log(`⚙️ Setting ${settingId} = ${value} for device ${deviceId}`);
  }

  /**
   * Get all current settings for a device
   */
  getAllSettings(deviceId: string): Map<string, any> {
    const deviceSettings = this.currentSettings.get(deviceId);
    if (!deviceSettings) {
      // Return defaults
      const defaults = new Map<string, any>();
      for (const group of this.settingsGroups) {
        for (const setting of group.settings) {
          defaults.set(setting.id, setting.defaultValue);
        }
      }
      return defaults;
    }
    
    return new Map(deviceSettings);
  }

  /**
   * Reset setting to default value
   */
  async resetSetting(deviceId: string, settingId: string): Promise<void> {
    const defaultValue = this.getSettingDefault(settingId);
    if (defaultValue !== undefined) {
      await this.setSettingValue(deviceId, settingId, defaultValue);
    }
  }

  /**
   * Reset all settings to defaults
   */
  async resetAllSettings(deviceId: string): Promise<void> {
    for (const group of this.settingsGroups) {
      for (const setting of group.settings) {
        if (!setting.readonly) {
          await this.resetSetting(deviceId, setting.id);
        }
      }
    }
    console.log(`🔄 Reset all settings for device ${deviceId}`);
  }

  /**
   * Get all available profiles
   */
  getProfiles(): SettingsProfile[] {
    return [...this.profiles];
  }

  /**
   * Get profiles by category
   */
  getProfilesByCategory(category: SettingsProfile['category']): SettingsProfile[] {
    return this.profiles.filter(profile => profile.category === category);
  }

  /**
   * Get a specific profile
   */
  getProfile(profileId: string): SettingsProfile | undefined {
    return this.profiles.find(profile => profile.id === profileId);
  }

  /**
   * Apply a profile to a device
   */
  async applyProfile(deviceId: string, profileId: string): Promise<void> {
    const profile = this.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    // Apply all settings from profile
    for (const [settingId, value] of Object.entries(profile.settings)) {
      try {
        await this.setSettingValue(deviceId, settingId, value);
      } catch (error) {
        console.warn(`Failed to apply setting ${settingId} from profile ${profileId}:`, error);
      }
    }

    this.activeProfiles.set(deviceId, profileId);
    this.emit('profile-applied', { deviceId, profileId, profile });
    console.log(`📋 Applied profile ${profile.name} to device ${deviceId}`);
  }

  /**
   * Get active profile for a device
   */
  getActiveProfile(deviceId: string): string | undefined {
    return this.activeProfiles.get(deviceId);
  }

  /**
   * Create a new custom profile from current settings
   */
  async createProfile(name: string, description: string, deviceId: string): Promise<SettingsProfile> {
    const currentSettings = this.getAllSettings(deviceId);
    const settingsObj: Record<string, any> = {};
    
    for (const [key, value] of currentSettings.entries()) {
      settingsObj[key] = value;
    }

    const profile: SettingsProfile = {
      id: this.generateProfileId(),
      name,
      description,
      category: 'custom',
      settings: settingsObj,
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    this.profiles.push(profile);
    this.emit('profile-created', profile);
    console.log(`📋 Created custom profile: ${name}`);
    
    return profile;
  }

  /**
   * Update an existing profile
   */
  async updateProfile(profileId: string, updates: Partial<SettingsProfile>): Promise<void> {
    const profile = this.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    if (profile.category === 'preset') {
      throw new Error('Cannot modify preset profiles');
    }

    // Update profile
    Object.assign(profile, updates, { modifiedAt: new Date() });
    this.emit('profile-updated', profile);
    console.log(`📋 Updated profile: ${profile.name}`);
  }

  /**
   * Delete a custom profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    const profileIndex = this.profiles.findIndex(p => p.id === profileId);
    if (profileIndex === -1) {
      throw new Error(`Profile ${profileId} not found`);
    }

    const profile = this.profiles[profileIndex];
    if (profile.category === 'preset') {
      throw new Error('Cannot delete preset profiles');
    }

    this.profiles.splice(profileIndex, 1);
    
    // Remove from active profiles
    for (const [deviceId, activeProfileId] of this.activeProfiles.entries()) {
      if (activeProfileId === profileId) {
        this.activeProfiles.delete(deviceId);
      }
    }

    this.emit('profile-deleted', profile);
    console.log(`🗑️ Deleted profile: ${profile.name}`);
  }

  /**
   * Export settings as JSON
   */
  exportSettings(deviceId: string): string {
    const settings = this.getAllSettings(deviceId);
    const settingsObj: Record<string, any> = {};
    
    for (const [key, value] of settings.entries()) {
      settingsObj[key] = value;
    }

    return JSON.stringify({
      deviceId,
      timestamp: new Date().toISOString(),
      settings: settingsObj
    }, null, 2);
  }

  /**
   * Import settings from JSON
   */
  async importSettings(deviceId: string, jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.settings) {
        throw new Error('Invalid settings format');
      }

      for (const [settingId, value] of Object.entries(data.settings)) {
        try {
          await this.setSettingValue(deviceId, settingId, value);
        } catch (error) {
          console.warn(`Failed to import setting ${settingId}:`, error);
        }
      }

      this.emit('settings-imported', { deviceId, settings: data.settings });
      console.log(`📥 Imported settings for device ${deviceId}`);
    } catch (error) {
      throw new Error(`Failed to import settings: ${(error as Error).message}`);
    }
  }

  /**
   * Validate setting value
   */
  private validateSettingValue(setting: CameraSetting, value: any): boolean {
    // Type validation
    switch (setting.type) {
      case 'boolean':
        if (typeof value !== 'boolean') return false;
        break;
      case 'number':
      case 'range':
        if (typeof value !== 'number') return false;
        if (setting.min !== undefined && value < setting.min) return false;
        if (setting.max !== undefined && value > setting.max) return false;
        break;
      case 'string':
        if (typeof value !== 'string') return false;
        break;
      case 'enum':
        if (setting.options) {
          const validValues = setting.options.map(opt => 
            typeof opt === 'object' ? opt.value : opt
          );
          if (!validValues.includes(value)) return false;
        }
        break;
    }

    // Custom validation
    if (setting.validation) {
      return setting.validation(value);
    }

    return true;
  }

  /**
   * Check setting dependency
   */
  private checkDependency(setting: CameraSetting, dependencyId: string, dependencyValue: any): boolean {
    // Basic dependency checking
    // In a real implementation, this would have more sophisticated logic
    
    if (setting.id === 'streaming_quality' && dependencyId === 'wifi_enabled') {
      return dependencyValue === true;
    }

    if (setting.id === 'quality' && dependencyId === 'codec') {
      // Some quality options only available for certain codecs
      return true; // Simplified for demo
    }

    return true;
  }

  /**
   * Get default value for a setting
   */
  private getSettingDefault(settingId: string): any {
    const setting = this.getSetting(settingId);
    return setting?.defaultValue;
  }

  /**
   * Generate unique profile ID
   */
  private generateProfileId(): string {
    return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.currentSettings.clear();
    this.activeProfiles.clear();
    this.removeAllListeners();
    console.log('🧹 SettingsManager destroyed');
  }
}

export default SettingsManager;