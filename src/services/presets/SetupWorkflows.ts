import { EventEmitter } from 'events';
import { CameraControlService } from '../control/CameraControlService';
import { PresetManager, ConfigurationPreset, PresetSettings } from './PresetManager';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  type: 'configure' | 'validate' | 'prompt' | 'delay';
  settings?: Partial<PresetSettings>;
  validation?: WorkflowValidation;
  prompt?: WorkflowPrompt;
  delay?: number; // milliseconds
  optional?: boolean;
  dependencies?: string[];
}

export interface WorkflowValidation {
  type: 'setting_check' | 'device_response' | 'user_confirm';
  expected?: any;
  timeout?: number;
  retries?: number;
}

export interface WorkflowPrompt {
  message: string;
  type: 'confirm' | 'select' | 'input';
  options?: string[];
  defaultValue?: any;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedDuration: number; // minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  steps: WorkflowStep[];
  metadata: {
    author: string;
    version: string;
    created: Date;
    tags: string[];
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  deviceIds: string[];
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  startTime?: Date;
  endTime?: Date;
  progress: number; // 0-100
  results: Map<string, any>;
  errors: WorkflowError[];
}

export interface WorkflowError {
  stepId: string;
  deviceId?: string;
  message: string;
  code?: string;
  timestamp: Date;
  recoverable: boolean;
}

export class SetupWorkflows extends EventEmitter {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private presetManager: PresetManager;
  private controlService: CameraControlService;

  constructor(presetManager: PresetManager, controlService: CameraControlService) {
    super();
    this.presetManager = presetManager;
    this.controlService = controlService;
    this.initializeBuiltInWorkflows();
  }

  private initializeBuiltInWorkflows(): void {
    // Basic Camera Setup Workflow
    const basicSetup: WorkflowDefinition = {
      id: 'basic-camera-setup',
      name: 'Basic Camera Setup',
      description: 'Essential camera configuration for first-time setup',
      category: 'setup',
      estimatedDuration: 5,
      difficulty: 'beginner',
      prerequisites: [],
      steps: [
        {
          id: 'connect-device',
          name: 'Connect Device',
          description: 'Establish Bluetooth connection to camera',
          type: 'configure',
          validation: {
            type: 'device_response',
            timeout: 10000,
            retries: 3
          }
        },
        {
          id: 'set-basic-recording',
          name: 'Configure Recording Format',
          description: 'Set basic recording parameters',
          type: 'configure',
          settings: {
            video: {
              codec: 'H.264',
              resolution: '1920x1080',
              framerate: 30,
              quality: 'medium'
            }
          }
        },
        {
          id: 'configure-audio',
          name: 'Audio Settings',
          description: 'Set up audio recording parameters',
          type: 'configure',
          settings: {
            audio: {
              enabled: true,
              channels: 2,
              sampleRate: 48000,
              bitrate: 192
            }
          }
        },
        {
          id: 'test-recording',
          name: 'Test Recording',
          description: 'Perform a brief test recording',
          type: 'prompt',
          prompt: {
            message: 'Ready to start a 5-second test recording?',
            type: 'confirm'
          }
        }
      ],
      metadata: {
        author: 'system',
        version: '1.0.0',
        created: new Date(),
        tags: ['setup', 'beginner', 'essential']
      }
    };

    // Professional Film Setup
    const filmSetup: WorkflowDefinition = {
      id: 'professional-film-setup',
      name: 'Professional Film Setup',
      description: 'Comprehensive setup for film production',
      category: 'production',
      estimatedDuration: 15,
      difficulty: 'advanced',
      prerequisites: ['basic-camera-setup'],
      steps: [
        {
          id: 'set-film-format',
          name: 'Film Format Configuration',
          description: 'Configure for cinematic recording',
          type: 'configure',
          settings: {
            video: {
              codec: 'Blackmagic RAW',
              resolution: '4096x2160',
              framerate: 24,
              quality: 'constant_quality',
              bitrate: 'max'
            }
          }
        },
        {
          id: 'color-correction-setup',
          name: 'Color Correction Setup',
          description: 'Configure color grading settings',
          type: 'configure',
          settings: {
            video: {
              colorSpace: 'Rec. 2020',
              gammaMode: 'Film',
              whiteBalance: 5600,
              tint: 0
            }
          }
        },
        {
          id: 'timecode-sync',
          name: 'Timecode Synchronization',
          description: 'Set up timecode for multi-camera sync',
          type: 'configure',
          settings: {
            timecode: {
              mode: 'external',
              source: 'genlock',
              dropFrame: false
            }
          }
        },
        {
          id: 'validate-storage',
          name: 'Storage Validation',
          description: 'Check storage capacity and speed',
          type: 'validate',
          validation: {
            type: 'setting_check',
            timeout: 5000
          }
        }
      ],
      metadata: {
        author: 'system',
        version: '1.0.0',
        created: new Date(),
        tags: ['film', 'professional', 'advanced', 'production']
      }
    };

    // Live Streaming Setup
    const streamSetup: WorkflowDefinition = {
      id: 'live-streaming-setup',
      name: 'Live Streaming Setup',
      description: 'Configure camera for live streaming',
      category: 'streaming',
      estimatedDuration: 10,
      difficulty: 'intermediate',
      prerequisites: ['basic-camera-setup'],
      steps: [
        {
          id: 'streaming-format',
          name: 'Streaming Format',
          description: 'Optimize settings for live streaming',
          type: 'configure',
          settings: {
            video: {
              codec: 'H.264',
              resolution: '1920x1080',
              framerate: 30,
              quality: 'medium',
              keyframeInterval: 2
            }
          }
        },
        {
          id: 'network-optimization',
          name: 'Network Optimization',
          description: 'Configure for stable streaming',
          type: 'configure',
          settings: {
            network: {
              adaptiveBitrate: true,
              bufferSize: 'medium',
              lowLatencyMode: true
            }
          }
        },
        {
          id: 'streaming-test',
          name: 'Streaming Test',
          description: 'Test streaming output',
          type: 'validate',
          validation: {
            type: 'device_response',
            timeout: 15000,
            retries: 2
          }
        }
      ],
      metadata: {
        author: 'system',
        version: '1.0.0',
        created: new Date(),
        tags: ['streaming', 'live', 'intermediate']
      }
    };

    this.workflows.set(basicSetup.id, basicSetup);
    this.workflows.set(filmSetup.id, filmSetup);
    this.workflows.set(streamSetup.id, streamSetup);
  }

  async getWorkflows(category?: string): Promise<WorkflowDefinition[]> {
    const workflows = Array.from(this.workflows.values());
    
    if (category) {
      return workflows.filter(w => w.category === category);
    }
    
    return workflows;
  }

  async getWorkflow(id: string): Promise<WorkflowDefinition | null> {
    return this.workflows.get(id) || null;
  }

  async createWorkflow(workflow: Omit<WorkflowDefinition, 'id'>): Promise<WorkflowDefinition> {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullWorkflow: WorkflowDefinition = {
      ...workflow,
      id,
      metadata: {
        ...workflow.metadata,
        created: new Date()
      }
    };

    this.workflows.set(id, fullWorkflow);
    this.emit('workflow-created', fullWorkflow);
    
    return fullWorkflow;
  }

  async executeWorkflow(
    workflowId: string,
    deviceIds: string[],
    options: { pauseOnError?: boolean; userPrompts?: boolean } = {}
  ): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      deviceIds,
      status: 'pending',
      currentStep: 0,
      progress: 0,
      results: new Map(),
      errors: []
    };

    this.executions.set(executionId, execution);
    this.emit('workflow-started', execution);

    // Start execution asynchronously
    this.runWorkflowExecution(execution, workflow, options).catch(error => {
      execution.status = 'failed';
      execution.errors.push({
        stepId: 'system',
        message: error.message,
        timestamp: new Date(),
        recoverable: false
      });
      this.emit('workflow-failed', execution);
    });

    return executionId;
  }

  private async runWorkflowExecution(
    execution: WorkflowExecution,
    workflow: WorkflowDefinition,
    options: { pauseOnError?: boolean; userPrompts?: boolean }
  ): Promise<void> {
    execution.status = 'running';
    execution.startTime = new Date();
    this.emit('workflow-progress', execution);

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        execution.currentStep = i;
        execution.progress = Math.round(((i + 1) / workflow.steps.length) * 100);

        this.emit('workflow-step-started', { execution, step });

        try {
          await this.executeStep(step, execution, options);
          this.emit('workflow-step-completed', { execution, step });
        } catch (error) {
          const workflowError: WorkflowError = {
            stepId: step.id,
            message: error.message,
            timestamp: new Date(),
            recoverable: !step.optional
          };

          execution.errors.push(workflowError);
          this.emit('workflow-step-failed', { execution, step, error: workflowError });

          if (!step.optional && options.pauseOnError) {
            execution.status = 'paused';
            this.emit('workflow-paused', execution);
            return;
          }

          if (!step.optional) {
            throw error;
          }
        }

        this.emit('workflow-progress', execution);
      }

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.progress = 100;
      this.emit('workflow-completed', execution);

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      this.emit('workflow-failed', execution);
      throw error;
    }
  }

  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    options: { userPrompts?: boolean }
  ): Promise<void> {
    switch (step.type) {
      case 'configure':
        await this.executeConfigureStep(step, execution);
        break;
      case 'validate':
        await this.executeValidateStep(step, execution);
        break;
      case 'prompt':
        if (options.userPrompts) {
          await this.executePromptStep(step, execution);
        }
        break;
      case 'delay':
        await this.executeDelayStep(step);
        break;
    }
  }

  private async executeConfigureStep(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    if (!step.settings) return;

    const results = await Promise.allSettled(
      execution.deviceIds.map(async deviceId => {
        // Apply settings through control service
        const commands = this.settingsToCommands(step.settings!);
        const results = [];

        for (const command of commands) {
          const result = await this.controlService.sendCommand(deviceId, command);
          results.push(result);
        }

        return { deviceId, results };
      })
    );

    // Store results
    results.forEach((result, index) => {
      const deviceId = execution.deviceIds[index];
      if (result.status === 'fulfilled') {
        execution.results.set(`${step.id}-${deviceId}`, result.value);
      } else {
        throw new Error(`Configuration failed for device ${deviceId}: ${result.reason.message}`);
      }
    });
  }

  private async executeValidateStep(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    if (!step.validation) return;

    const validation = step.validation;
    const timeout = validation.timeout || 5000;
    const retries = validation.retries || 1;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        switch (validation.type) {
          case 'device_response':
            await this.validateDeviceResponse(execution.deviceIds, timeout);
            break;
          case 'setting_check':
            await this.validateSettings(execution.deviceIds, validation.expected);
            break;
          case 'user_confirm':
            // Emit event for UI to handle
            this.emit('workflow-user-confirmation', { execution, step });
            break;
        }
        return; // Success
      } catch (error) {
        if (attempt === retries - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  private async executePromptStep(step: WorkflowStep, execution: WorkflowExecution): Promise<void> {
    if (!step.prompt) return;

    // Emit event for UI to handle user prompt
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('User prompt timeout'));
      }, 60000); // 1 minute timeout

      const handleResponse = (response: any) => {
        clearTimeout(timeout);
        execution.results.set(step.id, response);
        this.removeListener('workflow-prompt-response', handleResponse);
        resolve();
      };

      this.on('workflow-prompt-response', handleResponse);
      this.emit('workflow-user-prompt', { execution, step });
    });
  }

  private async executeDelayStep(step: WorkflowStep): Promise<void> {
    if (step.delay) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
    }
  }

  private settingsToCommands(settings: Partial<PresetSettings>): any[] {
    const commands = [];

    if (settings.video) {
      if (settings.video.codec) {
        commands.push({
          type: 'set-codec',
          value: settings.video.codec
        });
      }
      if (settings.video.resolution) {
        commands.push({
          type: 'set-resolution',
          value: settings.video.resolution
        });
      }
      if (settings.video.framerate) {
        commands.push({
          type: 'set-framerate',
          value: settings.video.framerate
        });
      }
    }

    if (settings.audio) {
      commands.push({
        type: 'set-audio-config',
        value: settings.audio
      });
    }

    if (settings.lens) {
      commands.push({
        type: 'set-lens-config',
        value: settings.lens
      });
    }

    return commands;
  }

  private async validateDeviceResponse(deviceIds: string[], timeout: number): Promise<void> {
    const promises = deviceIds.map(async deviceId => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Device ${deviceId} response timeout`));
        }, timeout);

        // Send ping command and wait for response
        this.controlService.sendCommand(deviceId, { type: 'ping' })
          .then(result => {
            clearTimeout(timer);
            if (result.success) {
              resolve(result);
            } else {
              reject(new Error(`Device ${deviceId} ping failed`));
            }
          })
          .catch(error => {
            clearTimeout(timer);
            reject(error);
          });
      });
    });

    await Promise.all(promises);
  }

  private async validateSettings(deviceIds: string[], expected: any): Promise<void> {
    // Implementation would check current device settings against expected values
    // This is a simplified version
    return Promise.resolve();
  }

  async pauseWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'paused';
      this.emit('workflow-paused', execution);
    }
  }

  async resumeWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'paused') {
      execution.status = 'running';
      this.emit('workflow-resumed', execution);
      
      const workflow = this.workflows.get(execution.workflowId);
      if (workflow) {
        this.runWorkflowExecution(execution, workflow, {}).catch(error => {
          execution.status = 'failed';
          this.emit('workflow-failed', execution);
        });
      }
    }
  }

  async cancelWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (execution && ['running', 'paused'].includes(execution.status)) {
      execution.status = 'cancelled';
      execution.endTime = new Date();
      this.emit('workflow-cancelled', execution);
    }
  }

  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    return this.executions.get(executionId) || null;
  }

  async getActiveExecutions(): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values())
      .filter(e => ['running', 'paused'].includes(e.status));
  }

  respondToPrompt(executionId: string, response: any): void {
    this.emit('workflow-prompt-response', { executionId, response });
  }
}