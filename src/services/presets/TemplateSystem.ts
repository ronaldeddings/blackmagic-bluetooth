import { EventEmitter } from 'events';
import { PresetSettings } from './PresetManager';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'range';
  label: string;
  description?: string;
  required?: boolean;
  defaultValue?: any;
  options?: string[]; // for select type
  min?: number; // for number/range type
  max?: number; // for number/range type
  step?: number; // for range type
  validation?: TemplateValidation;
}

export interface TemplateValidation {
  pattern?: string; // regex pattern
  minLength?: number;
  maxLength?: number;
  customValidator?: (value: any) => boolean | string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  created: Date;
  updated: Date;
  tags: string[];
  variables: TemplateVariable[];
  settings: TemplateSettings;
  previewSettings?: Partial<PresetSettings>;
  compatibility: {
    cameraModels: string[];
    firmwareVersions: string[];
    features: string[];
  };
}

export interface TemplateSettings {
  video?: TemplateVideoSettings;
  audio?: TemplateAudioSettings;
  lens?: TemplateLensSettings;
  display?: TemplateDisplaySettings;
  recording?: TemplateRecordingSettings;
  network?: TemplateNetworkSettings;
  timecode?: TemplateTimecodeSettings;
  metadata?: TemplateMetadataSettings;
}

export interface TemplateVideoSettings {
  codec?: string | TemplateExpression;
  resolution?: string | TemplateExpression;
  framerate?: number | TemplateExpression;
  quality?: string | TemplateExpression;
  bitrate?: number | TemplateExpression;
  colorSpace?: string | TemplateExpression;
  gammaMode?: string | TemplateExpression;
  whiteBalance?: number | TemplateExpression;
  tint?: number | TemplateExpression;
  iso?: number | TemplateExpression;
  shutter?: number | TemplateExpression;
  aperture?: number | TemplateExpression;
}

export interface TemplateAudioSettings {
  enabled?: boolean | TemplateExpression;
  channels?: number | TemplateExpression;
  sampleRate?: number | TemplateExpression;
  bitrate?: number | TemplateExpression;
  inputLevel?: number | TemplateExpression;
  monitoring?: boolean | TemplateExpression;
}

export interface TemplateLensSettings {
  focus?: number | TemplateExpression;
  zoom?: number | TemplateExpression;
  iris?: number | TemplateExpression;
  stabilization?: boolean | TemplateExpression;
  autoFocus?: boolean | TemplateExpression;
}

export interface TemplateDisplaySettings {
  brightness?: number | TemplateExpression;
  contrast?: number | TemplateExpression;
  saturation?: number | TemplateExpression;
  overlay?: boolean | TemplateExpression;
  zebra?: boolean | TemplateExpression;
  histogram?: boolean | TemplateExpression;
}

export interface TemplateRecordingSettings {
  format?: string | TemplateExpression;
  compression?: string | TemplateExpression;
  duration?: number | TemplateExpression;
  autoStop?: boolean | TemplateExpression;
}

export interface TemplateNetworkSettings {
  streaming?: boolean | TemplateExpression;
  protocol?: string | TemplateExpression;
  quality?: string | TemplateExpression;
  latency?: string | TemplateExpression;
}

export interface TemplateTimecodeSettings {
  mode?: string | TemplateExpression;
  source?: string | TemplateExpression;
  dropFrame?: boolean | TemplateExpression;
}

export interface TemplateMetadataSettings {
  projectName?: string | TemplateExpression;
  scene?: string | TemplateExpression;
  take?: number | TemplateExpression;
  notes?: string | TemplateExpression;
}

export interface TemplateExpression {
  expression: string;
  dependencies?: string[]; // variable names this expression depends on
}

export interface TemplateInstance {
  templateId: string;
  variables: Map<string, any>;
  generatedSettings: PresetSettings;
  isValid: boolean;
  validationErrors: string[];
}

export class TemplateSystem extends EventEmitter {
  private templates: Map<string, TemplateDefinition> = new Map();
  private instances: Map<string, TemplateInstance> = new Map();

  constructor() {
    super();
    this.initializeBuiltInTemplates();
  }

  private initializeBuiltInTemplates(): void {
    // Professional Film Template
    const filmTemplate: TemplateDefinition = {
      id: 'professional-film',
      name: 'Professional Film Production',
      description: 'Configurable template for film production with variable quality and format options',
      category: 'production',
      version: '1.0.0',
      author: 'system',
      created: new Date(),
      updated: new Date(),
      tags: ['film', 'production', 'cinematic'],
      variables: [
        {
          name: 'resolution',
          type: 'select',
          label: 'Recording Resolution',
          description: 'Choose the recording resolution',
          required: true,
          defaultValue: '4K',
          options: ['HD', 'UHD', '4K', '6K']
        },
        {
          name: 'framerate',
          type: 'select',
          label: 'Frame Rate',
          description: 'Recording frame rate',
          required: true,
          defaultValue: '24',
          options: ['23.98', '24', '25', '29.97', '30', '50', '59.94', '60']
        },
        {
          name: 'codec',
          type: 'select',
          label: 'Recording Codec',
          description: 'Video codec for recording',
          required: true,
          defaultValue: 'Blackmagic RAW',
          options: ['H.264', 'H.265', 'ProRes', 'Blackmagic RAW']
        },
        {
          name: 'colorSpace',
          type: 'select',
          label: 'Color Space',
          description: 'Color space for recording',
          required: true,
          defaultValue: 'Rec. 2020',
          options: ['Rec. 709', 'Rec. 2020', 'P3']
        },
        {
          name: 'whiteBalance',
          type: 'range',
          label: 'White Balance (K)',
          description: 'Color temperature in Kelvin',
          required: true,
          defaultValue: 5600,
          min: 2500,
          max: 10000,
          step: 100
        },
        {
          name: 'iso',
          type: 'select',
          label: 'ISO',
          description: 'Camera ISO sensitivity',
          required: true,
          defaultValue: '800',
          options: ['100', '200', '400', '800', '1600', '3200', '6400', '12800']
        }
      ],
      settings: {
        video: {
          codec: { expression: '{{codec}}' },
          resolution: {
            expression: `{{resolution === 'HD' ? '1920x1080' : 
                         resolution === 'UHD' ? '3840x2160' : 
                         resolution === '4K' ? '4096x2160' : 
                         '6144x3240'}}`
          },
          framerate: { expression: 'parseFloat({{framerate}})' },
          quality: 'highest',
          colorSpace: { expression: '{{colorSpace}}' },
          gammaMode: 'Film',
          whiteBalance: { expression: '{{whiteBalance}}' },
          iso: { expression: 'parseInt({{iso}})' }
        },
        audio: {
          enabled: true,
          channels: 2,
          sampleRate: 48000,
          bitrate: 256
        },
        recording: {
          format: 'cinema',
          compression: 'lossless'
        },
        timecode: {
          mode: 'external',
          source: 'genlock',
          dropFrame: { expression: '{{framerate.includes("29.97") || framerate.includes("59.94")}}' }
        }
      },
      compatibility: {
        cameraModels: ['URSA Mini Pro', 'Pocket Cinema Camera', 'URSA Broadcast'],
        firmwareVersions: ['7.0+'],
        features: ['RAW recording', 'External timecode']
      }
    };

    // Streaming Template
    const streamTemplate: TemplateDefinition = {
      id: 'live-streaming',
      name: 'Live Streaming Setup',
      description: 'Optimized settings for live streaming with configurable quality',
      category: 'streaming',
      version: '1.0.0',
      author: 'system',
      created: new Date(),
      updated: new Date(),
      tags: ['streaming', 'live', 'broadcast'],
      variables: [
        {
          name: 'streamQuality',
          type: 'select',
          label: 'Stream Quality',
          description: 'Overall streaming quality preset',
          required: true,
          defaultValue: 'high',
          options: ['low', 'medium', 'high', 'ultra']
        },
        {
          name: 'latency',
          type: 'select',
          label: 'Latency Mode',
          description: 'Streaming latency preference',
          required: true,
          defaultValue: 'normal',
          options: ['ultra-low', 'low', 'normal', 'high']
        },
        {
          name: 'adaptiveBitrate',
          type: 'boolean',
          label: 'Adaptive Bitrate',
          description: 'Enable adaptive bitrate streaming',
          required: false,
          defaultValue: true
        },
        {
          name: 'maxBitrate',
          type: 'range',
          label: 'Maximum Bitrate (Mbps)',
          description: 'Maximum streaming bitrate',
          required: true,
          defaultValue: 8,
          min: 1,
          max: 50,
          step: 1
        }
      ],
      settings: {
        video: {
          codec: 'H.264',
          resolution: {
            expression: `{{streamQuality === 'low' ? '1280x720' : 
                         streamQuality === 'medium' ? '1920x1080' : 
                         streamQuality === 'high' ? '1920x1080' : 
                         '3840x2160'}}`
          },
          framerate: {
            expression: `{{streamQuality === 'low' ? 30 : 
                         streamQuality === 'medium' ? 30 : 
                         streamQuality === 'high' ? 60 : 60}}`
          },
          bitrate: { expression: '{{maxBitrate}} * 1000000' },
          quality: 'medium'
        },
        audio: {
          enabled: true,
          channels: 2,
          sampleRate: 48000,
          bitrate: 128
        },
        network: {
          streaming: true,
          protocol: 'RTMP',
          quality: { expression: '{{streamQuality}}' },
          latency: { expression: '{{latency}}' },
          adaptiveBitrate: { expression: '{{adaptiveBitrate}}' }
        }
      },
      compatibility: {
        cameraModels: ['All'],
        firmwareVersions: ['6.0+'],
        features: ['Streaming']
      }
    };

    // Event/Documentary Template
    const eventTemplate: TemplateDefinition = {
      id: 'event-documentary',
      name: 'Event & Documentary',
      description: 'Balanced settings for event and documentary shooting',
      category: 'documentary',
      version: '1.0.0',
      author: 'system',
      created: new Date(),
      updated: new Date(),
      tags: ['event', 'documentary', 'run-and-gun'],
      variables: [
        {
          name: 'shootingStyle',
          type: 'select',
          label: 'Shooting Style',
          description: 'Type of event or documentary style',
          required: true,
          defaultValue: 'handheld',
          options: ['handheld', 'tripod', 'gimbal', 'mixed']
        },
        {
          name: 'lightingConditions',
          type: 'select',
          label: 'Lighting Conditions',
          description: 'Expected lighting conditions',
          required: true,
          defaultValue: 'mixed',
          options: ['bright', 'normal', 'low', 'mixed']
        },
        {
          name: 'duration',
          type: 'select',
          label: 'Recording Duration',
          description: 'Expected recording length',
          required: true,
          defaultValue: 'long',
          options: ['short', 'medium', 'long', 'extended']
        }
      ],
      settings: {
        video: {
          codec: 'H.264',
          resolution: '1920x1080',
          framerate: 30,
          quality: 'high',
          iso: {
            expression: `{{lightingConditions === 'bright' ? 400 : 
                         lightingConditions === 'normal' ? 800 : 
                         lightingConditions === 'low' ? 1600 : 800}}`
          },
          shutter: {
            expression: `{{shootingStyle === 'handheld' ? 1/60 : 
                         shootingStyle === 'gimbal' ? 1/50 : 1/60}}`
          }
        },
        audio: {
          enabled: true,
          channels: 2,
          sampleRate: 48000,
          bitrate: 192,
          inputLevel: {
            expression: `{{shootingStyle === 'handheld' ? -12 : -18}}`
          }
        },
        lens: {
          stabilization: { expression: '{{shootingStyle === "handheld" || shootingStyle === "mixed"}}' },
          autoFocus: { expression: '{{shootingStyle !== "tripod"}}' }
        },
        recording: {
          autoStop: { expression: '{{duration === "extended"}}' },
          duration: {
            expression: `{{duration === 'short' ? 30 : 
                         duration === 'medium' ? 60 : 
                         duration === 'long' ? 120 : 0}}`
          }
        }
      },
      compatibility: {
        cameraModels: ['All'],
        firmwareVersions: ['5.0+'],
        features: ['Auto focus', 'Image stabilization']
      }
    };

    this.templates.set(filmTemplate.id, filmTemplate);
    this.templates.set(streamTemplate.id, streamTemplate);
    this.templates.set(eventTemplate.id, eventTemplate);
  }

  async getTemplates(category?: string): Promise<TemplateDefinition[]> {
    const templates = Array.from(this.templates.values());
    
    if (category) {
      return templates.filter(t => t.category === category);
    }
    
    return templates;
  }

  async getTemplate(id: string): Promise<TemplateDefinition | null> {
    return this.templates.get(id) || null;
  }

  async createTemplate(template: Omit<TemplateDefinition, 'id' | 'created' | 'updated'>): Promise<TemplateDefinition> {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const fullTemplate: TemplateDefinition = {
      ...template,
      id,
      created: now,
      updated: now
    };

    this.templates.set(id, fullTemplate);
    this.emit('template-created', fullTemplate);
    
    return fullTemplate;
  }

  async updateTemplate(id: string, updates: Partial<TemplateDefinition>): Promise<TemplateDefinition> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template ${id} not found`);
    }

    const updatedTemplate: TemplateDefinition = {
      ...template,
      ...updates,
      id: template.id, // Preserve ID
      created: template.created, // Preserve creation date
      updated: new Date()
    };

    this.templates.set(id, updatedTemplate);
    this.emit('template-updated', updatedTemplate);
    
    return updatedTemplate;
  }

  async deleteTemplate(id: string): Promise<void> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template ${id} not found`);
    }

    // Don't allow deletion of built-in templates
    if (template.author === 'system') {
      throw new Error('Cannot delete built-in template');
    }

    this.templates.delete(id);
    this.emit('template-deleted', { id, template });
  }

  createInstance(templateId: string, variables?: Map<string, any>): TemplateInstance {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const instanceId = `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const variableValues = variables || new Map();

    // Fill in default values for missing variables
    template.variables.forEach(variable => {
      if (!variableValues.has(variable.name) && variable.defaultValue !== undefined) {
        variableValues.set(variable.name, variable.defaultValue);
      }
    });

    const instance: TemplateInstance = {
      templateId,
      variables: variableValues,
      generatedSettings: {} as PresetSettings,
      isValid: false,
      validationErrors: []
    };

    this.instances.set(instanceId, instance);
    this.validateAndGenerate(instance);
    
    return instance;
  }

  updateInstanceVariables(instanceId: string, variables: Map<string, any>): TemplateInstance {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Template instance ${instanceId} not found`);
    }

    // Update variables
    variables.forEach((value, name) => {
      instance.variables.set(name, value);
    });

    this.validateAndGenerate(instance);
    this.emit('instance-updated', instance);
    
    return instance;
  }

  private validateAndGenerate(instance: TemplateInstance): void {
    const template = this.templates.get(instance.templateId);
    if (!template) {
      instance.isValid = false;
      instance.validationErrors = ['Template not found'];
      return;
    }

    // Validate variables
    const errors: string[] = [];
    
    template.variables.forEach(variable => {
      const value = instance.variables.get(variable.name);
      
      // Check required variables
      if (variable.required && (value === undefined || value === null || value === '')) {
        errors.push(`${variable.label} is required`);
        return;
      }

      // Skip validation if value is not provided and not required
      if (value === undefined || value === null) {
        return;
      }

      // Type validation
      switch (variable.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`${variable.label} must be a string`);
          }
          break;
        case 'number':
        case 'range':
          if (typeof value !== 'number') {
            errors.push(`${variable.label} must be a number`);
          } else {
            if (variable.min !== undefined && value < variable.min) {
              errors.push(`${variable.label} must be at least ${variable.min}`);
            }
            if (variable.max !== undefined && value > variable.max) {
              errors.push(`${variable.label} must be at most ${variable.max}`);
            }
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`${variable.label} must be true or false`);
          }
          break;
        case 'select':
          if (variable.options && !variable.options.includes(value)) {
            errors.push(`${variable.label} must be one of: ${variable.options.join(', ')}`);
          }
          break;
      }

      // Custom validation
      if (variable.validation) {
        if (typeof value === 'string') {
          if (variable.validation.pattern) {
            const regex = new RegExp(variable.validation.pattern);
            if (!regex.test(value)) {
              errors.push(`${variable.label} format is invalid`);
            }
          }
          if (variable.validation.minLength && value.length < variable.validation.minLength) {
            errors.push(`${variable.label} must be at least ${variable.validation.minLength} characters`);
          }
          if (variable.validation.maxLength && value.length > variable.validation.maxLength) {
            errors.push(`${variable.label} must be at most ${variable.validation.maxLength} characters`);
          }
        }

        if (variable.validation.customValidator) {
          const result = variable.validation.customValidator(value);
          if (result !== true) {
            errors.push(typeof result === 'string' ? result : `${variable.label} is invalid`);
          }
        }
      }
    });

    instance.validationErrors = errors;
    instance.isValid = errors.length === 0;

    if (instance.isValid) {
      // Generate settings
      try {
        instance.generatedSettings = this.generateSettings(template, instance.variables);
      } catch (error) {
        instance.isValid = false;
        instance.validationErrors.push(`Settings generation failed: ${error.message}`);
      }
    }
  }

  private generateSettings(template: TemplateDefinition, variables: Map<string, any>): PresetSettings {
    const settings: PresetSettings = {};

    // Process each section of template settings
    Object.keys(template.settings).forEach(section => {
      const sectionSettings = template.settings[section as keyof TemplateSettings];
      if (sectionSettings) {
        settings[section as keyof PresetSettings] = this.processTemplateSection(
          sectionSettings,
          variables
        );
      }
    });

    return settings;
  }

  private processTemplateSection(section: any, variables: Map<string, any>): any {
    const result: any = {};

    Object.keys(section).forEach(key => {
      const value = section[key];
      result[key] = this.processTemplateValue(value, variables);
    });

    return result;
  }

  private processTemplateValue(value: any, variables: Map<string, any>): any {
    if (typeof value === 'object' && value.expression) {
      // Process template expression
      return this.evaluateExpression(value.expression, variables);
    } else if (Array.isArray(value)) {
      // Process array values
      return value.map(item => this.processTemplateValue(item, variables));
    } else if (typeof value === 'object' && value !== null) {
      // Process nested objects
      return this.processTemplateSection(value, variables);
    } else {
      // Return primitive values as-is
      return value;
    }
  }

  private evaluateExpression(expression: string, variables: Map<string, any>): any {
    try {
      // Replace template variables with actual values
      let processedExpression = expression;

      // Handle variable substitution
      variables.forEach((value, name) => {
        const regex = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
        const stringValue = typeof value === 'string' ? `"${value}"` : String(value);
        processedExpression = processedExpression.replace(regex, stringValue);
      });

      // Handle conditional expressions
      // This is a simplified expression evaluator - in production, you might want to use a proper expression parser
      if (processedExpression.includes('===') || processedExpression.includes('?')) {
        // Use Function constructor for safe evaluation (be careful with user input)
        return Function(`"use strict"; return (${processedExpression})`)();
      } else {
        // Handle simple expressions
        if (processedExpression.startsWith('parseFloat(')) {
          const match = processedExpression.match(/parseFloat\((.+)\)/);
          if (match) {
            return parseFloat(match[1]);
          }
        } else if (processedExpression.startsWith('parseInt(')) {
          const match = processedExpression.match(/parseInt\((.+)\)/);
          if (match) {
            return parseInt(match[1]);
          }
        } else {
          // Try to evaluate as JavaScript
          return Function(`"use strict"; return (${processedExpression})`)();
        }
      }
    } catch (error) {
      console.warn('Expression evaluation failed:', expression, error);
      return undefined;
    }
  }

  getInstance(instanceId: string): TemplateInstance | null {
    return this.instances.get(instanceId) || null;
  }

  deleteInstance(instanceId: string): void {
    this.instances.delete(instanceId);
  }

  getTemplateCategories(): string[] {
    const categories = new Set<string>();
    this.templates.forEach(template => {
      categories.add(template.category);
    });
    return Array.from(categories).sort();
  }

  searchTemplates(query: string, category?: string): TemplateDefinition[] {
    const queryLower = query.toLowerCase();
    
    return Array.from(this.templates.values()).filter(template => {
      if (category && template.category !== category) {
        return false;
      }
      
      return (
        template.name.toLowerCase().includes(queryLower) ||
        template.description.toLowerCase().includes(queryLower) ||
        template.tags.some(tag => tag.toLowerCase().includes(queryLower))
      );
    });
  }
}