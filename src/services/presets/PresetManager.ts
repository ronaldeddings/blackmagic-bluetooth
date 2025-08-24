import { EventEmitter } from 'events';
import type { CameraCommand } from '../../types';

export interface ConfigurationPreset {
  id: string;
  name: string;
  description: string;
  category: 'production' | 'documentary' | 'commercial' | 'event' | 'custom';
  settings: PresetSettings;
  metadata: PresetMetadata;
  createdAt: Date;
  modifiedAt: Date;
  version: string;
  isDefault?: boolean;
  tags: string[];
}

export interface PresetSettings {
  video: {
    resolution: string;
    framerate: number;
    codec: string;
    quality: string;
    bitrate?: number;
  };
  exposure: {
    iso: number;
    aperture: number;
    shutterAngle: number;
    whiteBalance: number | 'auto';
    tint?: number;
  };
  audio: {
    input: string;
    level: number;
    channels: 'mono' | 'stereo';
    phantomPower?: boolean;
  };
  system: {
    timecode: string;
    recordingFormat: string;
    autoRecord?: boolean;
    lcdBrightness?: number;
  };
  custom?: Record<string, any>;
}

export interface PresetMetadata {
  author: string;
  organization?: string;
  purpose: string;
  equipment: string[];
  environment: 'studio' | 'outdoor' | 'event' | 'documentary' | 'mixed';
  lighting: 'natural' | 'artificial' | 'mixed' | 'low';
  usage_notes?: string;
  version_notes?: string;
}

export interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  settings: Partial<PresetSettings>;
  requirements: string[];
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'enum';
  defaultValue: any;
  options?: any[];
  description: string;
  validation?: (value: any) => boolean;
}

const PROFESSIONAL_PRESETS: ConfigurationPreset[] = [
  {
    id: 'narrative_film',
    name: 'Narrative Film',
    description: 'Cinematic settings for narrative filmmaking',
    category: 'production',
    settings: {
      video: {
        resolution: '4096x2160',
        framerate: 24,
        codec: 'blackmagic_raw',
        quality: '444',
        bitrate: 120000
      },
      exposure: {
        iso: 200,
        aperture: 1.8,
        shutterAngle: 180,
        whiteBalance: 5600,
        tint: 0
      },
      audio: {
        input: 'external',
        level: -18,
        channels: 'stereo',
        phantomPower: true
      },
      system: {
        timecode: 'internal',
        recordingFormat: 'mov',
        autoRecord: false,
        lcdBrightness: 75
      }
    },
    metadata: {
      author: 'Blackmagic Design',
      purpose: 'High-end narrative filmmaking with maximum quality',
      equipment: ['External Audio Recorder', 'Professional Lenses', 'Tripod'],
      environment: 'studio',
      lighting: 'artificial',
      usage_notes: 'Requires high-capacity storage media'
    },
    createdAt: new Date('2023-01-01'),
    modifiedAt: new Date('2023-01-01'),
    version: '1.0',
    isDefault: true,
    tags: ['cinema', 'narrative', 'high-quality', 'raw']
  },
  {
    id: 'documentary',
    name: 'Documentary',
    description: 'Versatile settings for documentary work',
    category: 'documentary',
    settings: {
      video: {
        resolution: '1920x1080',
        framerate: 30,
        codec: 'h264',
        quality: 'standard'
      },
      exposure: {
        iso: 800,
        aperture: 4.0,
        shutterAngle: 180,
        whiteBalance: 'auto'
      },
      audio: {
        input: 'internal',
        level: -12,
        channels: 'stereo'
      },
      system: {
        timecode: 'internal',
        recordingFormat: 'mp4',
        autoRecord: false
      }
    },
    metadata: {
      author: 'Documentary Collective',
      purpose: 'Balanced settings for run-and-gun documentary shooting',
      equipment: ['Handheld Rig', 'Lavalier Microphones'],
      environment: 'mixed',
      lighting: 'natural',
      usage_notes: 'Auto settings for unpredictable conditions'
    },
    createdAt: new Date('2023-02-01'),
    modifiedAt: new Date('2023-02-01'),
    version: '1.0',
    tags: ['documentary', 'run-and-gun', 'versatile', 'auto']
  }
];

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'interview_template',
    name: 'Interview Template',
    description: 'Configurable interview setup',
    settings: {
      video: {
        resolution: '1920x1080',
        framerate: 24,
        codec: 'h264'
      },
      exposure: {
        aperture: 2.8,
        shutterAngle: 180
      }
    },
    requirements: ['External Audio'],
    variables: [
      {
        name: 'lighting_type',
        type: 'enum',
        defaultValue: 'natural',
        options: ['natural', 'tungsten', 'led'],
        description: 'Primary lighting type'
      },
      {
        name: 'iso_base',
        type: 'number',
        defaultValue: 400,
        description: 'Base ISO setting'
      }
    ]
  }
];

export class PresetManager extends EventEmitter {
  private presets: ConfigurationPreset[] = [...PROFESSIONAL_PRESETS];
  private templates: PresetTemplate[] = [...PRESET_TEMPLATES];
  private favoritePresets: Set<string> = new Set();
  private recentPresets: string[] = [];
  private maxRecentPresets = 10;

  constructor() {
    super();
    this.loadFavorites();
    console.log('📋 PresetManager initialized');
  }

  /**
   * Get all presets
   */
  getPresets(): ConfigurationPreset[] {
    return [...this.presets];
  }

  /**
   * Get presets by category
   */
  getPresetsByCategory(category: ConfigurationPreset['category']): ConfigurationPreset[] {
    return this.presets.filter(preset => preset.category === category);
  }

  /**
   * Get preset by ID
   */
  getPreset(presetId: string): ConfigurationPreset | undefined {
    return this.presets.find(preset => preset.id === presetId);
  }

  /**
   * Search presets
   */
  searchPresets(query: string, filters?: {
    category?: ConfigurationPreset['category'];
    tags?: string[];
    environment?: string;
  }): ConfigurationPreset[] {
    let results = this.presets;

    // Text search
    if (query) {
      const searchTerm = query.toLowerCase();
      results = results.filter(preset =>
        preset.name.toLowerCase().includes(searchTerm) ||
        preset.description.toLowerCase().includes(searchTerm) ||
        preset.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Category filter
    if (filters?.category) {
      results = results.filter(preset => preset.category === filters.category);
    }

    // Tags filter
    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter(preset =>
        filters.tags!.some(tag => preset.tags.includes(tag))
      );
    }

    // Environment filter
    if (filters?.environment) {
      results = results.filter(preset => 
        preset.metadata.environment === filters.environment
      );
    }

    return results;
  }

  /**
   * Create new preset
   */
  async createPreset(
    name: string,
    description: string,
    settings: PresetSettings,
    metadata: Partial<PresetMetadata>
  ): Promise<ConfigurationPreset> {
    const preset: ConfigurationPreset = {
      id: this.generatePresetId(),
      name,
      description,
      category: 'custom',
      settings,
      metadata: {
        author: metadata.author || 'User',
        purpose: metadata.purpose || 'Custom configuration',
        equipment: metadata.equipment || [],
        environment: metadata.environment || 'studio',
        lighting: metadata.lighting || 'mixed',
        ...metadata
      },
      createdAt: new Date(),
      modifiedAt: new Date(),
      version: '1.0',
      tags: []
    };

    this.presets.push(preset);
    this.emit('preset-created', preset);
    console.log(`📋 Created preset: ${name}`);
    
    return preset;
  }

  /**
   * Update existing preset
   */
  async updatePreset(presetId: string, updates: Partial<ConfigurationPreset>): Promise<void> {
    const preset = this.getPreset(presetId);
    if (!preset) {
      throw new Error(`Preset ${presetId} not found`);
    }

    if (preset.isDefault) {
      throw new Error('Cannot modify default presets');
    }

    // Update preset
    Object.assign(preset, updates, { 
      modifiedAt: new Date(),
      version: this.incrementVersion(preset.version)
    });

    this.emit('preset-updated', preset);
    console.log(`📋 Updated preset: ${preset.name}`);
  }

  /**
   * Delete preset
   */
  async deletePreset(presetId: string): Promise<void> {
    const presetIndex = this.presets.findIndex(p => p.id === presetId);
    if (presetIndex === -1) {
      throw new Error(`Preset ${presetId} not found`);
    }

    const preset = this.presets[presetIndex];
    if (preset.isDefault) {
      throw new Error('Cannot delete default presets');
    }

    this.presets.splice(presetIndex, 1);
    this.favoritePresets.delete(presetId);
    this.recentPresets = this.recentPresets.filter(id => id !== presetId);

    this.emit('preset-deleted', preset);
    console.log(`🗑️ Deleted preset: ${preset.name}`);
  }

  /**
   * Duplicate preset
   */
  async duplicatePreset(presetId: string, newName?: string): Promise<ConfigurationPreset> {
    const originalPreset = this.getPreset(presetId);
    if (!originalPreset) {
      throw new Error(`Preset ${presetId} not found`);
    }

    const duplicatedPreset: ConfigurationPreset = {
      ...originalPreset,
      id: this.generatePresetId(),
      name: newName || `${originalPreset.name} (Copy)`,
      category: 'custom',
      isDefault: false,
      createdAt: new Date(),
      modifiedAt: new Date(),
      version: '1.0',
      metadata: {
        ...originalPreset.metadata,
        author: 'User',
        version_notes: `Duplicated from ${originalPreset.name}`
      }
    };

    this.presets.push(duplicatedPreset);
    this.emit('preset-created', duplicatedPreset);
    console.log(`📋 Duplicated preset: ${originalPreset.name} -> ${duplicatedPreset.name}`);
    
    return duplicatedPreset;
  }

  /**
   * Apply preset to device
   */
  async applyPreset(deviceId: string, presetId: string): Promise<CameraCommand[]> {
    const preset = this.getPreset(presetId);
    if (!preset) {
      throw new Error(`Preset ${presetId} not found`);
    }

    // Track recent usage
    this.addToRecent(presetId);

    // Convert preset to camera commands
    const commands = this.presetToCommands(preset);
    
    this.emit('preset-applied', { deviceId, presetId, preset, commands });
    console.log(`📋 Applied preset ${preset.name} to device ${deviceId}`);
    
    return commands;
  }

  /**
   * Convert preset to camera commands
   */
  private presetToCommands(preset: ConfigurationPreset): CameraCommand[] {
    const commands: CameraCommand[] = [];
    const { settings } = preset;

    // Video settings
    if (settings.video) {
      if (settings.video.resolution) {
        commands.push({
          commandId: 'SET_RESOLUTION' as any,
          parameters: { resolution: settings.video.resolution },
          priority: 'NORMAL' as any
        });
      }
      if (settings.video.framerate) {
        commands.push({
          commandId: 'SET_FRAMERATE' as any,
          parameters: { framerate: settings.video.framerate },
          priority: 'NORMAL' as any
        });
      }
      if (settings.video.codec) {
        commands.push({
          commandId: 'SET_CODEC' as any,
          parameters: { codec: settings.video.codec },
          priority: 'NORMAL' as any
        });
      }
    }

    // Exposure settings
    if (settings.exposure) {
      if (settings.exposure.iso) {
        commands.push({
          commandId: 'SET_ISO' as any,
          parameters: { iso: settings.exposure.iso },
          priority: 'NORMAL' as any
        });
      }
      if (settings.exposure.aperture) {
        commands.push({
          commandId: 'SET_APERTURE' as any,
          parameters: { aperture: settings.exposure.aperture },
          priority: 'NORMAL' as any
        });
      }
      if (settings.exposure.shutterAngle) {
        commands.push({
          commandId: 'SET_SHUTTER_ANGLE' as any,
          parameters: { angle: settings.exposure.shutterAngle },
          priority: 'NORMAL' as any
        });
      }
      if (settings.exposure.whiteBalance) {
        commands.push({
          commandId: 'SET_WHITE_BALANCE' as any,
          parameters: { temperature: settings.exposure.whiteBalance },
          priority: 'NORMAL' as any
        });
      }
    }

    // Audio settings
    if (settings.audio) {
      commands.push({
        commandId: 'SET_AUDIO_CONFIG' as any,
        parameters: settings.audio,
        priority: 'NORMAL' as any
      });
    }

    // System settings
    if (settings.system) {
      commands.push({
        commandId: 'SET_SYSTEM_CONFIG' as any,
        parameters: settings.system,
        priority: 'LOW' as any
      });
    }

    return commands;
  }

  /**
   * Get preset templates
   */
  getTemplates(): PresetTemplate[] {
    return [...this.templates];
  }

  /**
   * Create preset from template
   */
  async createFromTemplate(
    templateId: string,
    variables: Record<string, any>,
    name: string,
    description?: string
  ): Promise<ConfigurationPreset> {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate variables
    for (const variable of template.variables) {
      const value = variables[variable.name];
      if (value === undefined) {
        variables[variable.name] = variable.defaultValue;
      } else if (variable.validation && !variable.validation(value)) {
        throw new Error(`Invalid value for ${variable.name}`);
      }
    }

    // Apply variables to template settings
    const settings = this.applyVariablesToSettings(template.settings, variables);

    return await this.createPreset(
      name,
      description || template.description,
      settings as PresetSettings,
      {
        author: 'Template Generator',
        purpose: `Generated from ${template.name} template`,
        equipment: template.requirements,
        environment: 'mixed'
      }
    );
  }

  /**
   * Apply variables to template settings
   */
  private applyVariablesToSettings(
    settings: Partial<PresetSettings>,
    variables: Record<string, any>
  ): Partial<PresetSettings> {
    const result = JSON.parse(JSON.stringify(settings));

    // Apply variable substitutions
    if (variables.lighting_type && variables.lighting_type !== 'natural') {
      if (result.exposure) {
        result.exposure.whiteBalance = variables.lighting_type === 'tungsten' ? 3200 : 5600;
      }
    }

    if (variables.iso_base && result.exposure) {
      result.exposure.iso = variables.iso_base;
    }

    return result;
  }

  /**
   * Export preset as JSON
   */
  exportPreset(presetId: string): string {
    const preset = this.getPreset(presetId);
    if (!preset) {
      throw new Error(`Preset ${presetId} not found`);
    }

    return JSON.stringify(preset, null, 2);
  }

  /**
   * Import preset from JSON
   */
  async importPreset(jsonData: string): Promise<ConfigurationPreset> {
    try {
      const presetData = JSON.parse(jsonData);
      
      // Validate structure
      if (!presetData.name || !presetData.settings) {
        throw new Error('Invalid preset format');
      }

      // Create new preset with imported data
      const preset: ConfigurationPreset = {
        ...presetData,
        id: this.generatePresetId(),
        category: 'custom',
        isDefault: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      this.presets.push(preset);
      this.emit('preset-imported', preset);
      console.log(`📥 Imported preset: ${preset.name}`);
      
      return preset;
    } catch (error) {
      throw new Error(`Failed to import preset: ${(error as Error).message}`);
    }
  }

  /**
   * Add preset to favorites
   */
  addToFavorites(presetId: string): void {
    if (!this.getPreset(presetId)) {
      throw new Error(`Preset ${presetId} not found`);
    }

    this.favoritePresets.add(presetId);
    this.saveFavorites();
    this.emit('favorites-updated', Array.from(this.favoritePresets));
  }

  /**
   * Remove preset from favorites
   */
  removeFromFavorites(presetId: string): void {
    this.favoritePresets.delete(presetId);
    this.saveFavorites();
    this.emit('favorites-updated', Array.from(this.favoritePresets));
  }

  /**
   * Get favorite presets
   */
  getFavoritePresets(): ConfigurationPreset[] {
    return Array.from(this.favoritePresets)
      .map(id => this.getPreset(id))
      .filter((preset): preset is ConfigurationPreset => preset !== undefined);
  }

  /**
   * Get recently used presets
   */
  getRecentPresets(): ConfigurationPreset[] {
    return this.recentPresets
      .map(id => this.getPreset(id))
      .filter((preset): preset is ConfigurationPreset => preset !== undefined);
  }

  /**
   * Add preset to recent list
   */
  private addToRecent(presetId: string): void {
    // Remove if already exists
    this.recentPresets = this.recentPresets.filter(id => id !== presetId);
    
    // Add to beginning
    this.recentPresets.unshift(presetId);
    
    // Limit size
    if (this.recentPresets.length > this.maxRecentPresets) {
      this.recentPresets = this.recentPresets.slice(0, this.maxRecentPresets);
    }
  }

  /**
   * Generate unique preset ID
   */
  private generatePresetId(): string {
    return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Increment version string
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[parts.length - 1]++;
    return parts.join('.');
  }

  /**
   * Load favorites from storage
   */
  private loadFavorites(): void {
    try {
      const favorites = localStorage.getItem('blackmagic_preset_favorites');
      if (favorites) {
        this.favoritePresets = new Set(JSON.parse(favorites));
      }
    } catch (error) {
      console.warn('Failed to load favorites:', error);
    }
  }

  /**
   * Save favorites to storage
   */
  private saveFavorites(): void {
    try {
      localStorage.setItem(
        'blackmagic_preset_favorites',
        JSON.stringify(Array.from(this.favoritePresets))
      );
    } catch (error) {
      console.warn('Failed to save favorites:', error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.presets = [];
    this.templates = [];
    this.favoritePresets.clear();
    this.recentPresets = [];
    this.removeAllListeners();
    console.log('🧹 PresetManager destroyed');
  }
}

export default PresetManager;