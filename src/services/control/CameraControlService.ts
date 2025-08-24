import { EventEmitter } from 'events';
import type { BluetoothDevice, CameraCommand } from '../../types';
import { SettingsManager } from './SettingsManager';
import { MessageHandler } from './MessageHandler';

export interface CameraControlConfig {
  enableAutoRecovery: boolean;
  commandTimeout: number;
  maxRetries: number;
  batchOperations: boolean;
  priorityQueue: boolean;
}

export interface CameraState {
  deviceId: string;
  isRecording: boolean;
  batteryLevel?: number;
  storageRemaining?: number;
  temperature?: number;
  currentSettings: Map<string, any>;
  lastCommandTime: Date;
  isResponding: boolean;
  firmwareVersion?: string;
  capabilities: string[];
}

export interface ControlResult {
  deviceId: string;
  commandId: string;
  success: boolean;
  response?: any;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

export interface BatchOperation {
  id: string;
  commands: CameraCommand[];
  targetDevices: string[];
  progress: number;
  results: ControlResult[];
  startTime: Date;
  estimatedCompletion?: Date;
}

const DEFAULT_CONFIG: CameraControlConfig = {
  enableAutoRecovery: true,
  commandTimeout: 5000, // 5 seconds
  maxRetries: 3,
  batchOperations: true,
  priorityQueue: true
};

export class CameraControlService extends EventEmitter {
  private config: CameraControlConfig;
  private settingsManager: SettingsManager;
  private messageHandler: MessageHandler;
  private cameraStates: Map<string, CameraState> = new Map();
  private pendingCommands: Map<string, { command: CameraCommand; resolve: Function; reject: Function; timeout: NodeJS.Timeout; retries: number }> = new Map();
  private commandQueue: Array<{ command: CameraCommand; deviceId: string; priority: number }> = [];
  private batchOperations: Map<string, BatchOperation> = new Map();
  private isProcessingQueue = false;

  constructor(config?: Partial<CameraControlConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.settingsManager = new SettingsManager();
    this.messageHandler = new MessageHandler();
    
    this.setupEventHandlers();
    this.startQueueProcessor();
    
    console.log('🎛️ CameraControlService initialized');
  }

  /**
   * Register a camera device for control
   */
  async registerCamera(deviceId: string, device: BluetoothDevice): Promise<void> {
    if (this.cameraStates.has(deviceId)) {
      console.warn(`Camera ${deviceId} already registered`);
      return;
    }

    const cameraState: CameraState = {
      deviceId,
      isRecording: false,
      currentSettings: new Map(),
      lastCommandTime: new Date(),
      isResponding: true,
      capabilities: []
    };

    this.cameraStates.set(deviceId, cameraState);

    try {
      // Initialize camera state by querying current settings
      await this.initializeCameraState(deviceId);
      
      this.emit('camera-registered', { deviceId, state: cameraState });
      console.log(`✅ Registered camera ${deviceId}`);
    } catch (error) {
      console.error(`❌ Failed to register camera ${deviceId}:`, error);
      this.cameraStates.delete(deviceId);
      throw error;
    }
  }

  /**
   * Unregister a camera device
   */
  async unregisterCamera(deviceId: string): Promise<void> {
    const cameraState = this.cameraStates.get(deviceId);
    if (!cameraState) {
      console.warn(`Camera ${deviceId} not registered`);
      return;
    }

    // Cancel any pending commands for this device
    for (const [commandId, pendingCommand] of this.pendingCommands.entries()) {
      if (commandId.startsWith(deviceId)) {
        clearTimeout(pendingCommand.timeout);
        pendingCommand.reject(new Error('Device unregistered'));
        this.pendingCommands.delete(commandId);
      }
    }

    // Remove from queue
    this.commandQueue = this.commandQueue.filter(item => item.deviceId !== deviceId);

    this.cameraStates.delete(deviceId);
    this.emit('camera-unregistered', { deviceId });
    console.log(`🔌 Unregistered camera ${deviceId}`);
  }

  /**
   * Send command to a specific camera
   */
  async sendCommand(deviceId: string, command: CameraCommand): Promise<ControlResult> {
    const cameraState = this.cameraStates.get(deviceId);
    if (!cameraState) {
      throw new Error(`Camera ${deviceId} not registered`);
    }

    if (!cameraState.isResponding && !command.forceExecution) {
      throw new Error(`Camera ${deviceId} is not responding`);
    }

    const commandId = this.generateCommandId(deviceId, command.commandId);
    const startTime = Date.now();

    try {
      // Add to priority queue if enabled
      if (this.config.priorityQueue) {
        return await this.queueCommand(deviceId, command);
      }

      // Execute immediately
      const response = await this.executeCommand(deviceId, command);
      
      const result: ControlResult = {
        deviceId,
        commandId: command.commandId,
        success: true,
        response,
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      };

      this.emit('command-success', result);
      return result;

    } catch (error) {
      const result: ControlResult = {
        deviceId,
        commandId: command.commandId,
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      };

      this.emit('command-error', result);
      throw error;
    }
  }

  /**
   * Send command to multiple cameras (batch operation)
   */
  async sendBatchCommand(deviceIds: string[], command: CameraCommand): Promise<BatchOperation> {
    if (!this.config.batchOperations) {
      throw new Error('Batch operations not enabled');
    }

    const batchId = this.generateBatchId();
    const commands = deviceIds.map(() => ({ ...command }));
    
    const batchOperation: BatchOperation = {
      id: batchId,
      commands,
      targetDevices: deviceIds,
      progress: 0,
      results: [],
      startTime: new Date(),
      estimatedCompletion: new Date(Date.now() + (deviceIds.length * this.config.commandTimeout))
    };

    this.batchOperations.set(batchId, batchOperation);
    this.emit('batch-started', batchOperation);

    try {
      const promises = deviceIds.map(async (deviceId, index) => {
        try {
          const result = await this.sendCommand(deviceId, commands[index]);
          
          batchOperation.results.push(result);
          batchOperation.progress = (batchOperation.results.length / deviceIds.length) * 100;
          
          this.emit('batch-progress', batchOperation);
          return result;
        } catch (error) {
          const failedResult: ControlResult = {
            deviceId,
            commandId: command.commandId,
            success: false,
            error: (error as Error).message,
            executionTime: 0,
            timestamp: new Date()
          };
          
          batchOperation.results.push(failedResult);
          batchOperation.progress = (batchOperation.results.length / deviceIds.length) * 100;
          
          this.emit('batch-progress', batchOperation);
          return failedResult;
        }
      });

      await Promise.allSettled(promises);
      
      batchOperation.progress = 100;
      this.emit('batch-complete', batchOperation);
      
      return batchOperation;

    } catch (error) {
      this.emit('batch-error', { batchOperation, error });
      throw error;
    }
  }

  /**
   * Get current state of a camera
   */
  getCameraState(deviceId: string): CameraState | undefined {
    return this.cameraStates.get(deviceId);
  }

  /**
   * Get all camera states
   */
  getAllCameraStates(): Map<string, CameraState> {
    return new Map(this.cameraStates);
  }

  /**
   * Update camera setting
   */
  async updateCameraSetting(deviceId: string, settingName: string, value: any): Promise<void> {
    const command: CameraCommand = {
      commandId: 'SET_CAMERA_SETTING' as any,
      parameters: {
        setting: settingName,
        value: value
      },
      priority: 'NORMAL' as any
    };

    await this.sendCommand(deviceId, command);
    
    // Update local state
    const cameraState = this.cameraStates.get(deviceId);
    if (cameraState) {
      cameraState.currentSettings.set(settingName, value);
      this.emit('setting-updated', { deviceId, setting: settingName, value });
    }
  }

  /**
   * Get camera setting
   */
  async getCameraSetting(deviceId: string, settingName: string): Promise<any> {
    const cameraState = this.cameraStates.get(deviceId);
    if (!cameraState) {
      throw new Error(`Camera ${deviceId} not registered`);
    }

    // Try to get from cache first
    if (cameraState.currentSettings.has(settingName)) {
      return cameraState.currentSettings.get(settingName);
    }

    // Query from camera
    const command: CameraCommand = {
      commandId: 'GET_CAMERA_SETTING' as any,
      parameters: {
        setting: settingName
      },
      priority: 'NORMAL' as any
    };

    const result = await this.sendCommand(deviceId, command);
    if (result.success && result.response) {
      cameraState.currentSettings.set(settingName, result.response.value);
      return result.response.value;
    }

    throw new Error(`Failed to get setting ${settingName}`);
  }

  /**
   * Start recording on camera
   */
  async startRecording(deviceId: string, options?: { filename?: string; duration?: number }): Promise<void> {
    const command: CameraCommand = {
      commandId: 'RECORDING_START' as any,
      parameters: options || {},
      priority: 'HIGH' as any
    };

    await this.sendCommand(deviceId, command);
    
    const cameraState = this.cameraStates.get(deviceId);
    if (cameraState) {
      cameraState.isRecording = true;
      this.emit('recording-started', { deviceId });
    }
  }

  /**
   * Stop recording on camera
   */
  async stopRecording(deviceId: string): Promise<void> {
    const command: CameraCommand = {
      commandId: 'RECORDING_STOP' as any,
      parameters: {},
      priority: 'HIGH' as any
    };

    await this.sendCommand(deviceId, command);
    
    const cameraState = this.cameraStates.get(deviceId);
    if (cameraState) {
      cameraState.isRecording = false;
      this.emit('recording-stopped', { deviceId });
    }
  }

  /**
   * Get batch operation status
   */
  getBatchOperation(batchId: string): BatchOperation | undefined {
    return this.batchOperations.get(batchId);
  }

  /**
   * Cancel batch operation
   */
  async cancelBatchOperation(batchId: string): Promise<void> {
    const batchOperation = this.batchOperations.get(batchId);
    if (!batchOperation) {
      throw new Error(`Batch operation ${batchId} not found`);
    }

    // Mark as cancelled and emit event
    this.emit('batch-cancelled', batchOperation);
    this.batchOperations.delete(batchId);
  }

  /**
   * Initialize camera state by querying current settings
   */
  private async initializeCameraState(deviceId: string): Promise<void> {
    try {
      // Query basic camera information
      const queries = [
        'BATTERY_LEVEL',
        'STORAGE_REMAINING', 
        'TEMPERATURE',
        'FIRMWARE_VERSION',
        'CAPABILITIES'
      ];

      for (const query of queries) {
        try {
          const command: CameraCommand = {
            commandId: 'QUERY' as any,
            parameters: { query },
            priority: 'LOW' as any
          };
          
          const result = await this.executeCommand(deviceId, command);
          this.updateCameraStateFromQuery(deviceId, query, result);
        } catch (error) {
          console.warn(`Failed to query ${query} for ${deviceId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to initialize camera state for ${deviceId}:`, error);
    }
  }

  /**
   * Update camera state from query result
   */
  private updateCameraStateFromQuery(deviceId: string, query: string, result: any): void {
    const cameraState = this.cameraStates.get(deviceId);
    if (!cameraState) return;

    switch (query) {
      case 'BATTERY_LEVEL':
        cameraState.batteryLevel = result.level;
        break;
      case 'STORAGE_REMAINING':
        cameraState.storageRemaining = result.remaining;
        break;
      case 'TEMPERATURE':
        cameraState.temperature = result.temperature;
        break;
      case 'FIRMWARE_VERSION':
        cameraState.firmwareVersion = result.version;
        break;
      case 'CAPABILITIES':
        cameraState.capabilities = result.capabilities || [];
        break;
    }
  }

  /**
   * Queue command for prioritized execution
   */
  private async queueCommand(deviceId: string, command: CameraCommand): Promise<ControlResult> {
    return new Promise((resolve, reject) => {
      const priority = this.getCommandPriority(command);
      
      this.commandQueue.push({ command, deviceId, priority });
      this.commandQueue.sort((a, b) => b.priority - a.priority); // Higher priority first
      
      // Store promise resolvers for when command is executed
      const commandId = this.generateCommandId(deviceId, command.commandId);
      this.pendingCommands.set(commandId, {
        command,
        resolve,
        reject,
        timeout: setTimeout(() => {
          reject(new Error(`Command timeout: ${command.commandId}`));
          this.pendingCommands.delete(commandId);
        }, this.config.commandTimeout),
        retries: 0
      });
    });
  }

  /**
   * Process command queue
   */
  private async startQueueProcessor(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (this.isProcessingQueue) {
      if (this.commandQueue.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      const queueItem = this.commandQueue.shift()!;
      const commandId = this.generateCommandId(queueItem.deviceId, queueItem.command.commandId);
      const pendingCommand = this.pendingCommands.get(commandId);
      
      if (!pendingCommand) {
        continue; // Command may have been cancelled/timed out
      }

      try {
        const startTime = Date.now();
        const response = await this.executeCommand(queueItem.deviceId, queueItem.command);
        
        const result: ControlResult = {
          deviceId: queueItem.deviceId,
          commandId: queueItem.command.commandId,
          success: true,
          response,
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        };

        clearTimeout(pendingCommand.timeout);
        pendingCommand.resolve(result);
        this.pendingCommands.delete(commandId);
        this.emit('command-success', result);

      } catch (error) {
        if (pendingCommand.retries < this.config.maxRetries && this.config.enableAutoRecovery) {
          // Retry command
          pendingCommand.retries++;
          this.commandQueue.unshift(queueItem);
          console.warn(`Retrying command ${commandId} (${pendingCommand.retries}/${this.config.maxRetries})`);
        } else {
          // Max retries reached, fail command
          const result: ControlResult = {
            deviceId: queueItem.deviceId,
            commandId: queueItem.command.commandId,
            success: false,
            error: (error as Error).message,
            executionTime: Date.now() - Date.now(),
            timestamp: new Date()
          };

          clearTimeout(pendingCommand.timeout);
          pendingCommand.reject(error);
          this.pendingCommands.delete(commandId);
          this.emit('command-error', result);
        }
      }
    }
  }

  /**
   * Execute command (actual communication with camera)
   */
  private async executeCommand(deviceId: string, command: CameraCommand): Promise<any> {
    // This would contain the actual Bluetooth communication logic
    // For now, simulate command execution
    
    const cameraState = this.cameraStates.get(deviceId);
    if (!cameraState) {
      throw new Error(`Camera ${deviceId} not registered`);
    }

    // Update last command time
    cameraState.lastCommandTime = new Date();

    // Simulate network delay
    await this.simulateDelay(50, 200);

    // Simulate success/failure based on command and camera state
    const success = this.shouldCommandSucceed(command, cameraState);
    
    if (!success) {
      cameraState.isResponding = false;
      throw new Error(`Command ${command.commandId} failed on device ${deviceId}`);
    }

    cameraState.isResponding = true;

    // Return simulated response based on command
    return this.generateCommandResponse(command);
  }

  /**
   * Setup event handlers for settings manager and message handler
   */
  private setupEventHandlers(): void {
    this.settingsManager.on('setting-changed', ({ deviceId, setting, value }) => {
      const cameraState = this.cameraStates.get(deviceId);
      if (cameraState) {
        cameraState.currentSettings.set(setting, value);
        this.emit('setting-updated', { deviceId, setting, value });
      }
    });

    this.messageHandler.on('camera-response', ({ deviceId, commandId, response }) => {
      // Handle responses from cameras
      this.emit('camera-response', { deviceId, commandId, response });
    });
  }

  /**
   * Get command priority based on type
   */
  private getCommandPriority(command: CameraCommand): number {
    const priorityMap = {
      'HIGH': 100,
      'NORMAL': 50,
      'LOW': 10
    };
    return priorityMap[command.priority as keyof typeof priorityMap] || 50;
  }

  /**
   * Generate unique command ID
   */
  private generateCommandId(deviceId: string, commandId: string): string {
    return `${deviceId}_${commandId}_${Date.now()}`;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Simulate command execution delay
   */
  private async simulateDelay(min: number, max: number): Promise<void> {
    const delay = min + Math.random() * (max - min);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Simulate command success/failure
   */
  private shouldCommandSucceed(command: CameraCommand, cameraState: CameraState): boolean {
    // Simulate various failure conditions
    if (!cameraState.isResponding) return false;
    if (Math.random() < 0.05) return false; // 5% random failure rate
    return true;
  }

  /**
   * Generate simulated command response
   */
  private generateCommandResponse(command: CameraCommand): any {
    switch (command.commandId) {
      case 'QUERY':
        return this.generateQueryResponse(command.parameters.query);
      case 'SET_CAMERA_SETTING':
        return { success: true };
      case 'GET_CAMERA_SETTING':
        return { value: this.generateSettingValue(command.parameters.setting) };
      default:
        return { success: true };
    }
  }

  /**
   * Generate simulated query response
   */
  private generateQueryResponse(query: string): any {
    switch (query) {
      case 'BATTERY_LEVEL':
        return { level: Math.floor(Math.random() * 100) };
      case 'STORAGE_REMAINING':
        return { remaining: Math.floor(Math.random() * 1000) }; // GB
      case 'TEMPERATURE':
        return { temperature: 35 + Math.random() * 20 }; // Celsius
      case 'FIRMWARE_VERSION':
        return { version: '1.2.3' };
      case 'CAPABILITIES':
        return { capabilities: ['recording', 'streaming', 'remote_control'] };
      default:
        return {};
    }
  }

  /**
   * Generate simulated setting value
   */
  private generateSettingValue(setting: string): any {
    const settingValues = {
      'iso': [100, 200, 400, 800, 1600, 3200],
      'aperture': [1.4, 1.8, 2.8, 4.0, 5.6, 8.0],
      'shutter_speed': [24, 25, 30, 48, 50, 60],
      'white_balance': [3200, 4000, 5600, 6500],
      'resolution': ['1080p', '4K', '6K']
    };

    if (settingValues[setting as keyof typeof settingValues]) {
      const values = settingValues[setting as keyof typeof settingValues];
      return values[Math.floor(Math.random() * values.length)];
    }

    return null;
  }

  /**
   * Stop queue processor and cleanup
   */
  destroy(): void {
    this.isProcessingQueue = false;
    
    // Cancel all pending commands
    for (const [commandId, pendingCommand] of this.pendingCommands.entries()) {
      clearTimeout(pendingCommand.timeout);
      pendingCommand.reject(new Error('Service destroyed'));
    }
    this.pendingCommands.clear();
    
    // Clear queues and states
    this.commandQueue = [];
    this.cameraStates.clear();
    this.batchOperations.clear();
    
    this.removeAllListeners();
    console.log('🧹 CameraControlService destroyed');
  }
}

export default CameraControlService;