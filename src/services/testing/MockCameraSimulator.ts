import { EventEmitter } from 'events';

export interface MockCameraConfig {
  model: string;
  firmwareVersion: string;
  serialNumber: string;
  capabilities: CameraCapabilities;
  simulationMode: 'realistic' | 'perfect' | 'error_prone' | 'custom';
  networkLatency: [number, number]; // min, max in ms
  errorRate: number; // 0.0 to 1.0
  batteryLevel: number; // 0 to 100
  storageCapacity: number; // in GB
  customBehaviors?: CustomBehavior[];
}

export interface CameraCapabilities {
  recordingFormats: string[];
  resolutions: string[];
  frameRates: number[];
  isoRange: [number, number];
  shutterSpeedRange: [string, string];
  hasAutofocus: boolean;
  hasImageStabilization: boolean;
  hasBuiltInMicrophone: boolean;
  supportedLenses: string[];
  maxRecordingDuration: number; // in minutes
}

export interface CustomBehavior {
  id: string;
  trigger: 'command' | 'time' | 'state' | 'random';
  condition: any;
  action: 'delay' | 'error' | 'modify_response' | 'state_change' | 'disconnect';
  parameters: Record<string, any>;
  probability?: number;
}

export interface CameraState {
  isRecording: boolean;
  recordingFormat: string;
  resolution: string;
  frameRate: number;
  iso: number;
  shutterSpeed: string;
  batteryLevel: number;
  storageUsed: number;
  temperature: number;
  isOverheating: boolean;
  lensAttached: boolean;
  autofocusEnabled: boolean;
  imageStabilizationEnabled: boolean;
  exposureMode: 'manual' | 'auto' | 'aperture_priority' | 'shutter_priority';
  whiteBalance: string;
  lastRecordingDuration: number;
  totalRecordingTime: number;
  mediaFiles: MediaFile[];
}

export interface MediaFile {
  id: string;
  name: string;
  format: string;
  resolution: string;
  duration: number; // seconds
  sizeBytes: number;
  timestamp: Date;
  thumbnailData?: string; // base64 encoded
}

export interface SimulationStats {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  averageLatency: number;
  uptime: number;
  dataTransferred: number;
  simulationErrors: number;
  customBehaviorTriggers: number;
}

export class MockCameraSimulator extends EventEmitter {
  private config: MockCameraConfig;
  private state: CameraState;
  private stats: SimulationStats;
  private isConnected = false;
  private startTime: Date;
  private recordingStartTime?: Date;
  private simulationInterval?: NodeJS.Timeout;
  private behaviorsEnabled = true;

  constructor(config: Partial<MockCameraConfig> = {}) {
    super();
    
    this.config = this.mergeWithDefaults(config);
    this.state = this.createInitialState();
    this.stats = this.createInitialStats();
    this.startTime = new Date();
    
    this.setupSimulation();
  }

  private mergeWithDefaults(config: Partial<MockCameraConfig>): MockCameraConfig {
    const defaultCapabilities: CameraCapabilities = {
      recordingFormats: ['ProRes', 'H.264', 'H.265', 'RAW'],
      resolutions: ['1920x1080', '3840x2160', '4096x2160', '6144x3456'],
      frameRates: [24, 25, 30, 50, 60, 120],
      isoRange: [100, 25600],
      shutterSpeedRange: ['1/8000', '1/30'],
      hasAutofocus: true,
      hasImageStabilization: true,
      hasBuiltInMicrophone: true,
      supportedLenses: ['EF Mount', 'PL Mount', 'MFT'],
      maxRecordingDuration: 120
    };

    return {
      model: config.model || 'BMPCC 6K Pro',
      firmwareVersion: config.firmwareVersion || '8.5.2',
      serialNumber: config.serialNumber || `BMD${Math.random().toString(36).substr(2, 12).toUpperCase()}`,
      capabilities: { ...defaultCapabilities, ...config.capabilities },
      simulationMode: config.simulationMode || 'realistic',
      networkLatency: config.networkLatency || [50, 200],
      errorRate: config.errorRate || 0.05,
      batteryLevel: config.batteryLevel || 85,
      storageCapacity: config.storageCapacity || 500,
      customBehaviors: config.customBehaviors || []
    };
  }

  private createInitialState(): CameraState {
    return {
      isRecording: false,
      recordingFormat: this.config.capabilities.recordingFormats[0],
      resolution: this.config.capabilities.resolutions[1],
      frameRate: this.config.capabilities.frameRates[2],
      iso: 800,
      shutterSpeed: '1/50',
      batteryLevel: this.config.batteryLevel,
      storageUsed: Math.random() * 50, // Random initial storage usage
      temperature: 35 + Math.random() * 10,
      isOverheating: false,
      lensAttached: true,
      autofocusEnabled: this.config.capabilities.hasAutofocus,
      imageStabilizationEnabled: this.config.capabilities.hasImageStabilization,
      exposureMode: 'manual',
      whiteBalance: 'daylight',
      lastRecordingDuration: 0,
      totalRecordingTime: 0,
      mediaFiles: this.generateInitialMediaFiles()
    };
  }

  private generateInitialMediaFiles(): MediaFile[] {
    const files: MediaFile[] = [];
    const count = Math.floor(Math.random() * 10) + 1;
    
    for (let i = 0; i < count; i++) {
      const duration = Math.random() * 300 + 30; // 30s to 5min
      files.push({
        id: `file_${i}_${Date.now()}`,
        name: `A001_C00${i + 1}_${Date.now().toString(36)}.mov`,
        format: this.config.capabilities.recordingFormats[
          Math.floor(Math.random() * this.config.capabilities.recordingFormats.length)
        ],
        resolution: this.config.capabilities.resolutions[
          Math.floor(Math.random() * this.config.capabilities.resolutions.length)
        ],
        duration,
        sizeBytes: duration * 100 * 1024 * 1024, // ~100MB per second
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 30), // Within last 30 days
        thumbnailData: this.generateThumbnailData()
      });
    }
    
    return files.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private generateThumbnailData(): string {
    // Generate a simple base64 encoded placeholder image
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d')!;
    
    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, `hsl(${Math.random() * 360}, 50%, 50%)`);
    gradient.addColorStop(1, `hsl(${Math.random() * 360}, 50%, 30%)`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw some random shapes
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = `hsla(${Math.random() * 360}, 60%, 70%, 0.3)`;
      ctx.fillRect(
        Math.random() * canvas.width * 0.8,
        Math.random() * canvas.height * 0.8,
        Math.random() * 40 + 20,
        Math.random() * 40 + 20
      );
    }
    
    return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
  }

  private createInitialStats(): SimulationStats {
    return {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      averageLatency: 0,
      uptime: 0,
      dataTransferred: 0,
      simulationErrors: 0,
      customBehaviorTriggers: 0
    };
  }

  private setupSimulation(): void {
    // Update simulation state every second
    this.simulationInterval = setInterval(() => {
      this.updateSimulation();
    }, 1000);
  }

  private updateSimulation(): void {
    // Update uptime
    this.stats.uptime = Date.now() - this.startTime.getTime();

    // Update battery level (discharge over time)
    if (this.state.isRecording) {
      this.state.batteryLevel = Math.max(0, this.state.batteryLevel - 0.02); // 2% per 100 seconds when recording
    } else if (this.isConnected) {
      this.state.batteryLevel = Math.max(0, this.state.batteryLevel - 0.005); // 0.5% per 100 seconds when connected
    }

    // Update temperature
    if (this.state.isRecording) {
      this.state.temperature = Math.min(85, this.state.temperature + 0.1);
    } else {
      this.state.temperature = Math.max(25, this.state.temperature - 0.05);
    }

    // Check for overheating
    this.state.isOverheating = this.state.temperature > 75;
    if (this.state.isOverheating && this.state.isRecording) {
      this.stopRecording();
      this.emit('overheating_protection_triggered');
    }

    // Update recording if active
    if (this.state.isRecording && this.recordingStartTime) {
      const recordingDuration = (Date.now() - this.recordingStartTime.getTime()) / 1000;
      
      // Check storage space
      const estimatedFileSize = recordingDuration * 100 * 1024 * 1024; // ~100MB per second
      const totalStorageUsed = this.state.storageUsed + (estimatedFileSize / (1024 * 1024 * 1024));
      
      if (totalStorageUsed > this.config.storageCapacity * 0.95) {
        this.stopRecording();
        this.emit('storage_full');
      }
      
      // Check max recording duration
      if (recordingDuration > this.config.capabilities.maxRecordingDuration * 60) {
        this.stopRecording();
        this.emit('max_recording_duration_reached');
      }
    }

    // Random behaviors based on simulation mode
    if (this.config.simulationMode === 'error_prone') {
      if (Math.random() < 0.01) { // 1% chance per second
        this.triggerRandomError();
      }
    }

    // Emit state update
    this.emit('state_updated', this.getState());
  }

  async connect(): Promise<boolean> {
    if (this.isConnected) return true;

    // Simulate connection delay
    await this.simulateDelay();

    // Check for connection errors
    if (this.shouldSimulateError('connection')) {
      throw new Error('Failed to establish Bluetooth connection');
    }

    this.isConnected = true;
    this.emit('connected');
    
    return true;
  }

  async disconnect(): Promise<boolean> {
    if (!this.isConnected) return true;

    // Stop recording if active
    if (this.state.isRecording) {
      await this.stopRecording();
    }

    await this.simulateDelay();
    
    this.isConnected = false;
    this.emit('disconnected');
    
    return true;
  }

  async sendCommand(command: string, parameters: Record<string, any> = {}): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Camera not connected');
    }

    this.stats.totalCommands++;
    const startTime = Date.now();

    try {
      // Simulate network latency
      await this.simulateDelay();

      // Check for custom behaviors
      const behavior = this.findMatchingBehavior('command', { command, parameters });
      if (behavior) {
        return await this.executeBehavior(behavior, { command, parameters });
      }

      // Check for command errors
      if (this.shouldSimulateError('command')) {
        throw new Error(`Command failed: ${command}`);
      }

      // Process the command
      const result = await this.processCommand(command, parameters);
      
      this.stats.successfulCommands++;
      this.updateLatencyStats(Date.now() - startTime);
      
      return result;

    } catch (error) {
      this.stats.failedCommands++;
      throw error;
    }
  }

  private async processCommand(command: string, parameters: Record<string, any>): Promise<any> {
    switch (command) {
      case 'get_device_info':
        return this.getDeviceInfo();
        
      case 'get_status':
      case 'get_state':
        return this.getState();
        
      case 'start_recording':
        return await this.startRecording();
        
      case 'stop_recording':
        return await this.stopRecording();
        
      case 'set_recording_format':
        return this.setRecordingFormat(parameters.format);
        
      case 'set_resolution':
        return this.setResolution(parameters.resolution);
        
      case 'set_frame_rate':
        return this.setFrameRate(parameters.frameRate);
        
      case 'set_iso':
        return this.setISO(parameters.iso);
        
      case 'set_shutter_speed':
        return this.setShutterSpeed(parameters.shutterSpeed);
        
      case 'set_white_balance':
        return this.setWhiteBalance(parameters.whiteBalance);
        
      case 'set_autofocus':
        return this.setAutofocus(parameters.enabled);
        
      case 'trigger_autofocus':
        return await this.triggerAutofocus();
        
      case 'get_media_files':
        return this.getMediaFiles();
        
      case 'delete_media_file':
        return this.deleteMediaFile(parameters.fileId);
        
      case 'download_thumbnail':
        return this.downloadThumbnail(parameters.fileId);
        
      case 'format_storage':
        return await this.formatStorage();
        
      case 'ping':
        return { timestamp: Date.now(), message: 'pong' };
        
      case 'get_firmware_version':
        return { version: this.config.firmwareVersion };
        
      case 'reset_settings':
        return await this.resetSettings();
        
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  private getDeviceInfo(): any {
    return {
      model: this.config.model,
      firmwareVersion: this.config.firmwareVersion,
      serialNumber: this.config.serialNumber,
      capabilities: this.config.capabilities,
      batteryLevel: this.state.batteryLevel,
      storageCapacity: this.config.storageCapacity,
      storageUsed: this.state.storageUsed,
      temperature: this.state.temperature,
      isOverheating: this.state.isOverheating
    };
  }

  private getState(): CameraState {
    return { ...this.state };
  }

  private async startRecording(): Promise<boolean> {
    if (this.state.isRecording) {
      throw new Error('Already recording');
    }

    if (this.state.batteryLevel < 10) {
      throw new Error('Battery level too low to start recording');
    }

    if (this.state.storageUsed > this.config.storageCapacity * 0.95) {
      throw new Error('Storage full');
    }

    if (this.state.isOverheating) {
      throw new Error('Camera overheating, cannot start recording');
    }

    this.state.isRecording = true;
    this.recordingStartTime = new Date();
    
    this.emit('recording_started');
    
    return true;
  }

  private async stopRecording(): Promise<boolean> {
    if (!this.state.isRecording) {
      return false;
    }

    this.state.isRecording = false;
    
    if (this.recordingStartTime) {
      const duration = (Date.now() - this.recordingStartTime.getTime()) / 1000;
      this.state.lastRecordingDuration = duration;
      this.state.totalRecordingTime += duration;
      
      // Create new media file
      const fileSize = duration * 100 * 1024 * 1024; // ~100MB per second
      const mediaFile: MediaFile = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `A001_C${String(this.state.mediaFiles.length + 1).padStart(3, '0')}_${Date.now().toString(36)}.mov`,
        format: this.state.recordingFormat,
        resolution: this.state.resolution,
        duration,
        sizeBytes: fileSize,
        timestamp: new Date(),
        thumbnailData: this.generateThumbnailData()
      };
      
      this.state.mediaFiles.unshift(mediaFile);
      this.state.storageUsed += fileSize / (1024 * 1024 * 1024); // Convert to GB
      
      this.recordingStartTime = undefined;
    }
    
    this.emit('recording_stopped', {
      duration: this.state.lastRecordingDuration,
      fileName: this.state.mediaFiles[0]?.name
    });
    
    return true;
  }

  private setRecordingFormat(format: string): boolean {
    if (!this.config.capabilities.recordingFormats.includes(format)) {
      throw new Error(`Unsupported recording format: ${format}`);
    }
    
    this.state.recordingFormat = format;
    this.emit('setting_changed', { setting: 'recordingFormat', value: format });
    
    return true;
  }

  private setResolution(resolution: string): boolean {
    if (!this.config.capabilities.resolutions.includes(resolution)) {
      throw new Error(`Unsupported resolution: ${resolution}`);
    }
    
    this.state.resolution = resolution;
    this.emit('setting_changed', { setting: 'resolution', value: resolution });
    
    return true;
  }

  private setFrameRate(frameRate: number): boolean {
    if (!this.config.capabilities.frameRates.includes(frameRate)) {
      throw new Error(`Unsupported frame rate: ${frameRate}`);
    }
    
    this.state.frameRate = frameRate;
    this.emit('setting_changed', { setting: 'frameRate', value: frameRate });
    
    return true;
  }

  private setISO(iso: number): boolean {
    const [minISO, maxISO] = this.config.capabilities.isoRange;
    if (iso < minISO || iso > maxISO) {
      throw new Error(`ISO out of range: ${minISO}-${maxISO}`);
    }
    
    this.state.iso = iso;
    this.emit('setting_changed', { setting: 'iso', value: iso });
    
    return true;
  }

  private setShutterSpeed(shutterSpeed: string): boolean {
    this.state.shutterSpeed = shutterSpeed;
    this.emit('setting_changed', { setting: 'shutterSpeed', value: shutterSpeed });
    
    return true;
  }

  private setWhiteBalance(whiteBalance: string): boolean {
    this.state.whiteBalance = whiteBalance;
    this.emit('setting_changed', { setting: 'whiteBalance', value: whiteBalance });
    
    return true;
  }

  private setAutofocus(enabled: boolean): boolean {
    if (!this.config.capabilities.hasAutofocus && enabled) {
      throw new Error('Camera does not support autofocus');
    }
    
    this.state.autofocusEnabled = enabled;
    this.emit('setting_changed', { setting: 'autofocus', value: enabled });
    
    return true;
  }

  private async triggerAutofocus(): Promise<boolean> {
    if (!this.config.capabilities.hasAutofocus) {
      throw new Error('Camera does not support autofocus');
    }
    
    if (!this.state.autofocusEnabled) {
      throw new Error('Autofocus is disabled');
    }
    
    await this.simulateDelay([500, 1500]); // Autofocus takes time
    
    const success = Math.random() > 0.1; // 90% success rate
    
    this.emit('autofocus_result', { success, timestamp: new Date() });
    
    return success;
  }

  private getMediaFiles(): MediaFile[] {
    return this.state.mediaFiles.map(file => ({
      ...file,
      thumbnailData: undefined // Don't include thumbnail data in list
    }));
  }

  private deleteMediaFile(fileId: string): boolean {
    const index = this.state.mediaFiles.findIndex(f => f.id === fileId);
    if (index === -1) {
      throw new Error(`Media file not found: ${fileId}`);
    }
    
    const file = this.state.mediaFiles[index];
    this.state.storageUsed -= file.sizeBytes / (1024 * 1024 * 1024);
    this.state.mediaFiles.splice(index, 1);
    
    this.emit('media_file_deleted', { fileId, fileName: file.name });
    
    return true;
  }

  private downloadThumbnail(fileId: string): string {
    const file = this.state.mediaFiles.find(f => f.id === fileId);
    if (!file) {
      throw new Error(`Media file not found: ${fileId}`);
    }
    
    this.stats.dataTransferred += file.thumbnailData?.length || 0;
    
    return file.thumbnailData || '';
  }

  private async formatStorage(): Promise<boolean> {
    if (this.state.isRecording) {
      throw new Error('Cannot format storage while recording');
    }
    
    // Simulate formatting delay
    await this.simulateDelay([2000, 5000]);
    
    this.state.mediaFiles = [];
    this.state.storageUsed = 0;
    
    this.emit('storage_formatted');
    
    return true;
  }

  private async resetSettings(): Promise<boolean> {
    if (this.state.isRecording) {
      throw new Error('Cannot reset settings while recording');
    }
    
    // Reset to defaults
    this.state.recordingFormat = this.config.capabilities.recordingFormats[0];
    this.state.resolution = this.config.capabilities.resolutions[1];
    this.state.frameRate = this.config.capabilities.frameRates[2];
    this.state.iso = 800;
    this.state.shutterSpeed = '1/50';
    this.state.exposureMode = 'manual';
    this.state.whiteBalance = 'daylight';
    this.state.autofocusEnabled = this.config.capabilities.hasAutofocus;
    this.state.imageStabilizationEnabled = this.config.capabilities.hasImageStabilization;
    
    this.emit('settings_reset');
    
    return true;
  }

  private shouldSimulateError(context: string): boolean {
    if (this.config.simulationMode === 'perfect') return false;
    if (this.config.simulationMode === 'error_prone') return Math.random() < this.config.errorRate * 2;
    
    return Math.random() < this.config.errorRate;
  }

  private async simulateDelay(customRange?: [number, number]): Promise<void> {
    const [min, max] = customRange || this.config.networkLatency;
    const delay = Math.random() * (max - min) + min;
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  private updateLatencyStats(latency: number): void {
    const total = this.stats.successfulCommands + this.stats.failedCommands;
    this.stats.averageLatency = (this.stats.averageLatency * (total - 1) + latency) / total;
  }

  private findMatchingBehavior(trigger: string, context: any): CustomBehavior | undefined {
    if (!this.behaviorsEnabled) return undefined;
    
    return this.config.customBehaviors?.find(behavior => {
      if (behavior.trigger !== trigger) return false;
      
      // Check probability
      if (behavior.probability && Math.random() > behavior.probability) {
        return false;
      }
      
      // Check condition based on trigger type
      switch (trigger) {
        case 'command':
          return !behavior.condition || 
                 behavior.condition.command === context.command ||
                 (Array.isArray(behavior.condition.commands) && 
                  behavior.condition.commands.includes(context.command));
        
        case 'state':
          return this.evaluateStateCondition(behavior.condition);
        
        case 'time':
          return this.evaluateTimeCondition(behavior.condition);
        
        default:
          return true;
      }
    });
  }

  private evaluateStateCondition(condition: any): boolean {
    // Simple state condition evaluation
    for (const [key, value] of Object.entries(condition)) {
      if ((this.state as any)[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private evaluateTimeCondition(condition: any): boolean {
    const now = Date.now();
    const uptime = now - this.startTime.getTime();
    
    if (condition.uptime && uptime < condition.uptime) return false;
    if (condition.interval && (uptime % condition.interval) > 1000) return false;
    
    return true;
  }

  private async executeBehavior(behavior: CustomBehavior, context: any): Promise<any> {
    this.stats.customBehaviorTriggers++;
    
    switch (behavior.action) {
      case 'delay':
        const delay = behavior.parameters.delay || 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return await this.processCommand(context.command, context.parameters);
      
      case 'error':
        const errorMessage = behavior.parameters.message || 'Simulated error';
        throw new Error(errorMessage);
      
      case 'modify_response':
        const result = await this.processCommand(context.command, context.parameters);
        return { ...result, ...behavior.parameters.modifications };
      
      case 'state_change':
        Object.assign(this.state, behavior.parameters.stateChanges);
        this.emit('behavior_triggered', { behavior: behavior.id, action: 'state_change' });
        return await this.processCommand(context.command, context.parameters);
      
      case 'disconnect':
        this.disconnect();
        throw new Error('Connection lost due to simulated behavior');
      
      default:
        return await this.processCommand(context.command, context.parameters);
    }
  }

  private triggerRandomError(): void {
    const errors = [
      'Temporary connection instability',
      'Camera overheating protection triggered',
      'Memory buffer overflow',
      'Lens communication error',
      'Storage device error'
    ];
    
    const error = errors[Math.floor(Math.random() * errors.length)];
    this.stats.simulationErrors++;
    this.emit('random_error', { error, timestamp: new Date() });
  }

  // Public utility methods
  createMockCamera(model?: string): MockCameraSimulator {
    const config = model ? { ...this.config, model } : this.config;
    return new MockCameraSimulator(config);
  }

  getSimulationStats(): SimulationStats {
    return { ...this.stats };
  }

  addCustomBehavior(behavior: CustomBehavior): void {
    if (!this.config.customBehaviors) {
      this.config.customBehaviors = [];
    }
    this.config.customBehaviors.push(behavior);
    this.emit('behavior_added', behavior);
  }

  removeCustomBehavior(behaviorId: string): boolean {
    if (!this.config.customBehaviors) return false;
    
    const index = this.config.customBehaviors.findIndex(b => b.id === behaviorId);
    if (index === -1) return false;
    
    this.config.customBehaviors.splice(index, 1);
    this.emit('behavior_removed', behaviorId);
    return true;
  }

  enableBehaviors(enabled: boolean): void {
    this.behaviorsEnabled = enabled;
    this.emit('behaviors_toggled', enabled);
  }

  updateConfig(updates: Partial<MockCameraConfig>): void {
    Object.assign(this.config, updates);
    this.emit('config_updated', updates);
  }

  resetStats(): void {
    this.stats = this.createInitialStats();
    this.emit('stats_reset');
  }

  isConnected(): boolean {
    return this.isConnected;
  }

  destroy(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = undefined;
    }
    
    this.disconnect();
    this.removeAllListeners();
  }
}