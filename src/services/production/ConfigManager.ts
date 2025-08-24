import { EventEmitter } from 'events';
import { EncryptionManager } from '../security/EncryptionManager';

export interface ConfigurationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    default?: any;
    required?: boolean;
    validation?: (value: any) => boolean | string;
    description?: string;
    sensitive?: boolean;
    readonly?: boolean;
    deprecated?: boolean;
    environment?: string; // Environment variable name
  };
}

export interface ConfigurationProfile {
  id: string;
  name: string;
  description: string;
  environment: 'development' | 'staging' | 'production';
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  parent?: string; // For inheritance
}

export interface ConfigurationChange {
  id: string;
  profileId: string;
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  userId?: string;
  reason?: string;
  validated: boolean;
}

export interface ConfigurationError {
  key: string;
  error: string;
  severity: 'warning' | 'error';
  suggestion?: string;
}

export interface ConfigurationValidationResult {
  valid: boolean;
  errors: ConfigurationError[];
  warnings: ConfigurationError[];
}

export interface ConfigurationBackup {
  id: string;
  profileId: string;
  config: Record<string, any>;
  timestamp: Date;
  automatic: boolean;
  description?: string;
}

export class ConfigurationManager extends EventEmitter {
  private encryptionManager: EncryptionManager;
  private schema: ConfigurationSchema = {};
  private profiles: Map<string, ConfigurationProfile> = new Map();
  private activeProfile: string | null = null;
  private configCache: Map<string, any> = new Map();
  private changeHistory: ConfigurationChange[] = [];
  private backups: Map<string, ConfigurationBackup> = new Map();
  private watchers: Map<string, ((value: any) => void)[]> = new Map();
  private isInitialized = false;
  private autoSaveInterval?: NodeJS.Timeout;
  private backupInterval?: NodeJS.Timeout;

  constructor(encryptionManager: EncryptionManager) {
    super();
    this.encryptionManager = encryptionManager;
    this.setupDefaultSchema();
    this.startAutoSave();
    this.startAutoBackup();
  }

  private setupDefaultSchema(): void {
    this.schema = {
      // Application Configuration
      'app.name': {
        type: 'string',
        default: 'Blackmagic Bluetooth Controller',
        required: true,
        description: 'Application name'
      },
      'app.version': {
        type: 'string',
        default: '1.0.0',
        required: true,
        readonly: true,
        description: 'Application version'
      },
      'app.debug': {
        type: 'boolean',
        default: false,
        description: 'Enable debug mode',
        environment: 'DEBUG'
      },
      'app.logLevel': {
        type: 'string',
        default: 'info',
        validation: (value) => ['debug', 'info', 'warn', 'error'].includes(value) || 'Must be one of: debug, info, warn, error',
        description: 'Logging level'
      },

      // Bluetooth Configuration
      'bluetooth.enabled': {
        type: 'boolean',
        default: true,
        description: 'Enable Bluetooth connectivity'
      },
      'bluetooth.scanTimeout': {
        type: 'number',
        default: 30000,
        validation: (value) => value > 0 && value <= 120000 || 'Must be between 1 and 120000ms',
        description: 'Device scan timeout in milliseconds'
      },
      'bluetooth.connectionRetries': {
        type: 'number',
        default: 3,
        validation: (value) => value >= 0 && value <= 10 || 'Must be between 0 and 10',
        description: 'Number of connection retry attempts'
      },
      'bluetooth.autoReconnect': {
        type: 'boolean',
        default: true,
        description: 'Automatically reconnect to known devices'
      },

      // Security Configuration
      'security.encryptionEnabled': {
        type: 'boolean',
        default: true,
        sensitive: true,
        description: 'Enable data encryption'
      },
      'security.sessionTimeout': {
        type: 'number',
        default: 28800000, // 8 hours
        validation: (value) => value > 0 && value <= 86400000 || 'Must be between 1ms and 24 hours',
        description: 'Session timeout in milliseconds'
      },
      'security.maxLoginAttempts': {
        type: 'number',
        default: 5,
        validation: (value) => value > 0 && value <= 20 || 'Must be between 1 and 20',
        description: 'Maximum login attempts before lockout'
      },
      'security.requireStrongPasswords': {
        type: 'boolean',
        default: true,
        description: 'Require strong password policy'
      },

      // Performance Configuration
      'performance.memoryLimit': {
        type: 'number',
        default: 512 * 1024 * 1024, // 512MB
        validation: (value) => value > 0 || 'Must be positive',
        description: 'Memory limit in bytes'
      },
      'performance.hardwareAcceleration': {
        type: 'boolean',
        default: true,
        description: 'Enable hardware acceleration'
      },
      'performance.connectionPoolSize': {
        type: 'number',
        default: 10,
        validation: (value) => value > 0 && value <= 50 || 'Must be between 1 and 50',
        description: 'Maximum connection pool size'
      },

      // Camera Configuration
      'camera.defaultFormat': {
        type: 'string',
        default: 'ProRes',
        validation: (value) => ['ProRes', 'H.264', 'H.265', 'RAW'].includes(value) || 'Must be a supported format',
        description: 'Default recording format'
      },
      'camera.defaultResolution': {
        type: 'string',
        default: '3840x2160',
        validation: (value) => /^\d+x\d+$/.test(value) || 'Must be in format WIDTHxHEIGHT',
        description: 'Default recording resolution'
      },
      'camera.maxSimultaneous': {
        type: 'number',
        default: 4,
        validation: (value) => value > 0 && value <= 20 || 'Must be between 1 and 20',
        description: 'Maximum simultaneous camera connections'
      },

      // Network Configuration
      'network.timeout': {
        type: 'number',
        default: 10000,
        validation: (value) => value > 0 && value <= 60000 || 'Must be between 1 and 60000ms',
        description: 'Network operation timeout in milliseconds'
      },
      'network.retryAttempts': {
        type: 'number',
        default: 3,
        validation: (value) => value >= 0 && value <= 10 || 'Must be between 0 and 10',
        description: 'Network retry attempts'
      },

      // Storage Configuration
      'storage.maxCacheSize': {
        type: 'number',
        default: 100 * 1024 * 1024, // 100MB
        validation: (value) => value > 0 || 'Must be positive',
        description: 'Maximum cache size in bytes'
      },
      'storage.autoCleanup': {
        type: 'boolean',
        default: true,
        description: 'Enable automatic cleanup of old files'
      },

      // API Keys and Secrets
      'api.encryptionKey': {
        type: 'string',
        sensitive: true,
        description: 'API encryption key',
        environment: 'API_ENCRYPTION_KEY'
      },
      'api.serviceUrl': {
        type: 'string',
        default: 'https://api.blackmagicdesign.com',
        description: 'Service API base URL',
        environment: 'API_SERVICE_URL'
      }
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadProfiles();
      await this.loadEnvironmentVariables();
      
      // Create default profile if none exist
      if (this.profiles.size === 0) {
        await this.createDefaultProfile();
      }

      // Activate the first profile if none is active
      if (!this.activeProfile && this.profiles.size > 0) {
        const firstProfile = Array.from(this.profiles.values())[0];
        await this.activateProfile(firstProfile.id);
      }

      this.isInitialized = true;
      this.emit('initialized');

    } catch (error) {
      this.emit('initialization_error', error);
      throw error;
    }
  }

  private async createDefaultProfile(): Promise<void> {
    const defaultConfig: Record<string, any> = {};
    
    // Set default values from schema
    for (const [key, definition] of Object.entries(this.schema)) {
      if (definition.default !== undefined) {
        defaultConfig[key] = definition.default;
      }
    }

    const profile: ConfigurationProfile = {
      id: 'default',
      name: 'Default Configuration',
      description: 'Default application configuration',
      environment: 'development',
      config: defaultConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    this.profiles.set(profile.id, profile);
    await this.saveProfiles();
  }

  private async loadEnvironmentVariables(): Promise<void> {
    // Load configuration values from environment variables
    for (const [key, definition] of Object.entries(this.schema)) {
      if (definition.environment) {
        const envValue = process.env[definition.environment];
        if (envValue !== undefined) {
          let value: any = envValue;
          
          // Type conversion
          switch (definition.type) {
            case 'boolean':
              value = envValue.toLowerCase() === 'true';
              break;
            case 'number':
              value = parseFloat(envValue);
              break;
            case 'object':
            case 'array':
              try {
                value = JSON.parse(envValue);
              } catch {
                console.warn(`Failed to parse environment variable ${definition.environment} as ${definition.type}`);
                continue;
              }
              break;
          }

          // Update all profiles with environment value
          for (const profile of this.profiles.values()) {
            profile.config[key] = value;
          }
        }
      }
    }
  }

  async createProfile(
    name: string,
    description: string,
    environment: 'development' | 'staging' | 'production',
    baseConfig?: Record<string, any>
  ): Promise<string> {
    const profileId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const profile: ConfigurationProfile = {
      id: profileId,
      name,
      description,
      environment,
      config: baseConfig || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: false
    };

    // Validate configuration
    const validation = this.validateConfiguration(profile.config);
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.error).join(', ')}`);
    }

    this.profiles.set(profileId, profile);
    await this.saveProfiles();
    
    this.emit('profile_created', profile);
    return profileId;
  }

  async activateProfile(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Deactivate current profile
    if (this.activeProfile) {
      const currentProfile = this.profiles.get(this.activeProfile);
      if (currentProfile) {
        currentProfile.isActive = false;
      }
    }

    // Activate new profile
    profile.isActive = true;
    this.activeProfile = profileId;

    // Clear cache and reload
    this.configCache.clear();
    await this.loadConfiguration(profile);
    
    await this.saveProfiles();
    this.emit('profile_activated', profile);
  }

  private async loadConfiguration(profile: ConfigurationProfile): Promise<void> {
    // Load configuration into cache
    for (const [key, value] of Object.entries(profile.config)) {
      this.configCache.set(key, value);
    }

    // Notify watchers
    for (const [key, value] of Object.entries(profile.config)) {
      const keyWatchers = this.watchers.get(key) || [];
      for (const watcher of keyWatchers) {
        watcher(value);
      }
    }
  }

  get<T = any>(key: string, defaultValue?: T): T {
    if (!this.isInitialized) {
      throw new Error('Configuration manager not initialized');
    }

    // Check cache first
    if (this.configCache.has(key)) {
      return this.configCache.get(key);
    }

    // Check schema default
    const schemaItem = this.schema[key];
    if (schemaItem && schemaItem.default !== undefined) {
      return schemaItem.default;
    }

    // Return provided default or undefined
    return defaultValue as T;
  }

  async set(key: string, value: any, userId?: string, reason?: string): Promise<void> {
    if (!this.isInitialized || !this.activeProfile) {
      throw new Error('Configuration manager not initialized or no active profile');
    }

    const profile = this.profiles.get(this.activeProfile);
    if (!profile) {
      throw new Error('Active profile not found');
    }

    // Check if readonly
    const schemaItem = this.schema[key];
    if (schemaItem && schemaItem.readonly) {
      throw new Error(`Configuration key '${key}' is readonly`);
    }

    // Validate value
    if (schemaItem) {
      const validationResult = this.validateValue(key, value, schemaItem);
      if (validationResult !== true) {
        throw new Error(`Validation failed for '${key}': ${validationResult}`);
      }
    }

    const oldValue = profile.config[key];

    // Record change
    const change: ConfigurationChange = {
      id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      profileId: profile.id,
      key,
      oldValue,
      newValue: value,
      timestamp: new Date(),
      userId,
      reason,
      validated: true
    };

    // Update configuration
    profile.config[key] = value;
    profile.updatedAt = new Date();
    this.configCache.set(key, value);

    // Record change
    this.changeHistory.push(change);
    if (this.changeHistory.length > 1000) {
      this.changeHistory = this.changeHistory.slice(-1000);
    }

    await this.saveProfiles();

    // Notify watchers
    const watchers = this.watchers.get(key) || [];
    for (const watcher of watchers) {
      watcher(value);
    }

    this.emit('config_changed', { key, oldValue, newValue: value, change });
  }

  watch(key: string, callback: (value: any) => void): () => void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, []);
    }
    
    this.watchers.get(key)!.push(callback);

    // Call immediately with current value
    callback(this.get(key));

    // Return unwatch function
    return () => {
      const watchers = this.watchers.get(key);
      if (watchers) {
        const index = watchers.indexOf(callback);
        if (index > -1) {
          watchers.splice(index, 1);
        }
      }
    };
  }

  private validateConfiguration(config: Record<string, any>): ConfigurationValidationResult {
    const errors: ConfigurationError[] = [];
    const warnings: ConfigurationError[] = [];

    // Check required fields
    for (const [key, definition] of Object.entries(this.schema)) {
      if (definition.required && !(key in config)) {
        errors.push({
          key,
          error: 'Required field is missing',
          severity: 'error'
        });
      }
    }

    // Validate existing values
    for (const [key, value] of Object.entries(config)) {
      const schemaItem = this.schema[key];
      
      if (!schemaItem) {
        warnings.push({
          key,
          error: 'Unknown configuration key',
          severity: 'warning',
          suggestion: 'Remove this key or add it to the schema'
        });
        continue;
      }

      if (schemaItem.deprecated) {
        warnings.push({
          key,
          error: 'This configuration key is deprecated',
          severity: 'warning'
        });
      }

      const validationResult = this.validateValue(key, value, schemaItem);
      if (validationResult !== true) {
        errors.push({
          key,
          error: validationResult,
          severity: 'error'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateValue(key: string, value: any, definition: ConfigurationSchema[string]): true | string {
    // Type validation
    if (typeof value !== definition.type && definition.type !== 'array') {
      return `Expected ${definition.type}, got ${typeof value}`;
    }

    if (definition.type === 'array' && !Array.isArray(value)) {
      return 'Expected array';
    }

    // Custom validation
    if (definition.validation) {
      const result = definition.validation(value);
      if (result !== true) {
        return typeof result === 'string' ? result : 'Validation failed';
      }
    }

    return true;
  }

  async exportConfiguration(profileId?: string, includeDefaults = false): Promise<Record<string, any>> {
    const profile = profileId ? this.profiles.get(profileId) : this.profiles.get(this.activeProfile!);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const config = { ...profile.config };

    if (includeDefaults) {
      // Include default values for missing keys
      for (const [key, definition] of Object.entries(this.schema)) {
        if (!(key in config) && definition.default !== undefined) {
          config[key] = definition.default;
        }
      }
    }

    // Remove sensitive values
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(config)) {
      const schemaItem = this.schema[key];
      if (schemaItem && schemaItem.sensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  async importConfiguration(config: Record<string, any>, profileId?: string): Promise<void> {
    const profile = profileId ? this.profiles.get(profileId) : this.profiles.get(this.activeProfile!);
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Validate imported configuration
    const validation = this.validateConfiguration(config);
    if (!validation.valid) {
      throw new Error(`Import validation failed: ${validation.errors.map(e => e.error).join(', ')}`);
    }

    // Backup current configuration
    await this.createBackup(profile.id, false, 'Pre-import backup');

    // Apply configuration
    profile.config = { ...config };
    profile.updatedAt = new Date();

    // Reload if this is the active profile
    if (profile.id === this.activeProfile) {
      this.configCache.clear();
      await this.loadConfiguration(profile);
    }

    await this.saveProfiles();
    this.emit('configuration_imported', { profileId: profile.id, config });
  }

  async createBackup(profileId: string, automatic = true, description?: string): Promise<string> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const backup: ConfigurationBackup = {
      id: backupId,
      profileId,
      config: { ...profile.config },
      timestamp: new Date(),
      automatic,
      description
    };

    this.backups.set(backupId, backup);
    await this.saveBackups();

    // Limit backup count
    const profileBackups = Array.from(this.backups.values())
      .filter(b => b.profileId === profileId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (profileBackups.length > 50) {
      const oldBackups = profileBackups.slice(50);
      for (const oldBackup of oldBackups) {
        this.backups.delete(oldBackup.id);
      }
    }

    this.emit('backup_created', backup);
    return backupId;
  }

  async restoreBackup(backupId: string): Promise<void> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    const profile = this.profiles.get(backup.profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Create backup of current state
    await this.createBackup(profile.id, false, 'Pre-restore backup');

    // Restore configuration
    profile.config = { ...backup.config };
    profile.updatedAt = new Date();

    // Reload if this is the active profile
    if (profile.id === this.activeProfile) {
      this.configCache.clear();
      await this.loadConfiguration(profile);
    }

    await this.saveProfiles();
    this.emit('backup_restored', { backupId, profileId: profile.id });
  }

  private async loadProfiles(): Promise<void> {
    try {
      const data = localStorage.getItem('config_profiles');
      if (data) {
        const encrypted = this.encryptionManager.decrypt(data);
        const profiles = JSON.parse(encrypted);
        
        this.profiles = new Map(profiles.map((p: any) => [p.id, {
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt)
        }]));

        // Find active profile
        for (const profile of this.profiles.values()) {
          if (profile.isActive) {
            this.activeProfile = profile.id;
            break;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load configuration profiles:', error);
    }
  }

  private async saveProfiles(): Promise<void> {
    try {
      const profiles = Array.from(this.profiles.values());
      const data = JSON.stringify(profiles);
      const encrypted = this.encryptionManager.encrypt(data);
      localStorage.setItem('config_profiles', encrypted);
    } catch (error) {
      console.error('Failed to save configuration profiles:', error);
    }
  }

  private async saveBackups(): Promise<void> {
    try {
      const backups = Array.from(this.backups.values());
      const data = JSON.stringify(backups);
      const encrypted = this.encryptionManager.encrypt(data);
      localStorage.setItem('config_backups', encrypted);
    } catch (error) {
      console.error('Failed to save configuration backups:', error);
    }
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(async () => {
      if (this.profiles.size > 0) {
        await this.saveProfiles();
      }
    }, 30000); // Save every 30 seconds
  }

  private startAutoBackup(): void {
    this.backupInterval = setInterval(async () => {
      if (this.activeProfile) {
        await this.createBackup(this.activeProfile, true, 'Automatic backup');
      }
    }, 6 * 60 * 60 * 1000); // Backup every 6 hours
  }

  // Public API methods
  getProfiles(): ConfigurationProfile[] {
    return Array.from(this.profiles.values());
  }

  getActiveProfile(): ConfigurationProfile | null {
    return this.activeProfile ? this.profiles.get(this.activeProfile) || null : null;
  }

  getSchema(): ConfigurationSchema {
    return { ...this.schema };
  }

  getChangeHistory(profileId?: string, limit = 100): ConfigurationChange[] {
    let changes = this.changeHistory;
    
    if (profileId) {
      changes = changes.filter(c => c.profileId === profileId);
    }
    
    return changes.slice(-limit);
  }

  getBackups(profileId?: string): ConfigurationBackup[] {
    let backups = Array.from(this.backups.values());
    
    if (profileId) {
      backups = backups.filter(b => b.profileId === profileId);
    }
    
    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async deleteProfile(profileId: string): Promise<boolean> {
    if (profileId === this.activeProfile) {
      throw new Error('Cannot delete active profile');
    }

    const deleted = this.profiles.delete(profileId);
    
    if (deleted) {
      // Delete associated backups
      const profileBackups = Array.from(this.backups.values()).filter(b => b.profileId === profileId);
      for (const backup of profileBackups) {
        this.backups.delete(backup.id);
      }

      await this.saveProfiles();
      await this.saveBackups();
      
      this.emit('profile_deleted', profileId);
    }
    
    return deleted;
  }

  addSchemaDefinition(key: string, definition: ConfigurationSchema[string]): void {
    this.schema[key] = definition;
    this.emit('schema_updated', { key, definition });
  }

  removeSchemaDefinition(key: string): boolean {
    const deleted = delete this.schema[key];
    if (deleted) {
      this.emit('schema_updated', { key, deleted: true });
    }
    return deleted;
  }

  reset(): void {
    this.configCache.clear();
    this.watchers.clear();
    this.activeProfile = null;
  }

  destroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = undefined;
    }

    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = undefined;
    }

    this.reset();
    this.removeAllListeners();
  }
}