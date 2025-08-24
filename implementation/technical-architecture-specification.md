# Blackmagic Bluetooth Accessibility - Technical Architecture Specification

## Overview

This document provides detailed technical specifications for implementing the critical accessibility features identified in the implementation checklist. It focuses on the technical architecture, data structures, and implementation patterns required for multi-camera management and remote camera control.

---

## Core Architecture Patterns

### 1. Multi-Device Connection Architecture

**Based on:** `blackmagic_performance_optimization_guide.md` - Advanced Connection Management

```typescript
// Core Multi-Device Manager Implementation
export class MultiDeviceConnectionManager {
  private connections: Map<string, CameraConnection> = new Map();
  private connectionPool: ConnectionPool;
  private deviceRegistry: DeviceRegistry;
  private eventEmitter: EventEmitter;

  constructor() {
    this.connectionPool = new ConnectionPool({
      maxConnections: 8,
      connectionTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000
    });
    
    this.deviceRegistry = new DeviceRegistry();
    this.eventEmitter = new EventEmitter();
  }

  async connectToMultipleDevices(devices: BluetoothDevice[]): Promise<ConnectionResult[]> {
    const connectionPromises = devices.map(device => 
      this.establishOptimalConnection(device)
    );
    
    const results = await Promise.allSettled(connectionPromises);
    
    return results.map((result, index) => ({
      device: devices[index],
      success: result.status === 'fulfilled',
      connection: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));
  }

  private async establishOptimalConnection(device: BluetoothDevice): Promise<CameraConnection> {
    // Implement advanced connection optimization from performance guide
    const connection = new CameraConnection(device);
    
    // Negotiate optimal connection parameters
    await connection.negotiateConnectionParams({
      minConnectionInterval: 15,    // 18.75ms (optimal for low latency)
      maxConnectionInterval: 30,    // 37.5ms
      slaveLatency: 0,             // No latency for real-time control
      supervisionTimeout: 300      // 3 seconds
    });
    
    // Optimize MTU size for better throughput
    await connection.negotiateOptimalMTU();
    
    // Initialize services
    await connection.discoverAndInitializeServices();
    
    this.connections.set(device.id, connection);
    this.eventEmitter.emit('device-connected', { device, connection });
    
    return connection;
  }

  async broadcastCommand(command: CameraCommand): Promise<BroadcastResult> {
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.isConnected());
    
    const commandPromises = activeConnections.map(conn => 
      conn.sendCommand(command).catch(error => ({ success: false, error }))
    );
    
    const results = await Promise.all(commandPromises);
    
    return {
      totalDevices: activeConnections.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
}
```

### 2. Advanced Camera Control Protocol

**Based on:** `blackmagic_advanced_protocol_specification.md` - Message Protocol Structures

```typescript
// Advanced Protocol Message Handling
export class AdvancedProtocolHandler {
  private messageCodec: MessageCodec;
  private sequenceManager: SequenceManager;
  private checksumValidator: ChecksumValidator;

  constructor() {
    this.messageCodec = new MessageCodec();
    this.sequenceManager = new SequenceManager();
    this.checksumValidator = new ChecksumValidator();
  }

  async sendCameraCommand(
    connection: CameraConnection, 
    command: CameraCommand
  ): Promise<CommandResponse> {
    
    // Encode command with advanced message structure
    const message = this.encodeAdvancedMessage(command);
    
    // Send with retry logic and sequence management
    const response = await this.sendWithRetry(connection, message);
    
    // Validate and decode response
    return this.validateAndDecodeResponse(response);
  }

  private encodeAdvancedMessage(command: CameraCommand): Uint8Array {
    const header: MessageHeader = {
      version: 1,
      messageType: this.getMessageType(command.commandId),
      sequenceNumber: this.sequenceManager.getNext(),
      payloadLength: 0, // Will be calculated
      flags: {
        requiresResponse: true,
        isFragmented: false,
        isLastFragment: true,
        priority: command.priority || Priority.NORMAL
      }
    };

    const payload = this.encodeCommandPayload(command);
    header.payloadLength = payload.length;

    return this.messageCodec.encode(header, payload);
  }

  private encodeCommandPayload(command: CameraCommand): Uint8Array {
    switch (command.commandId) {
      case CameraCommandId.CAMERA_SETTINGS_UPDATE:
        return this.encodeCameraSettings(command.parameters as CameraSettings);
      
      case CameraCommandId.RECORDING_START:
        return this.encodeRecordingParams(command.parameters);
      
      case CameraCommandId.STREAM_CONTROL:
        return this.encodeStreamConfig(command.parameters as StreamConfiguration);
      
      default:
        return new TextEncoder().encode(JSON.stringify(command.parameters));
    }
  }

  private encodeCameraSettings(settings: CameraSettings): Uint8Array {
    // Binary encoding for efficient transmission
    const buffer = new ArrayBuffer(256); // Adjust size as needed
    const view = new DataView(buffer);
    let offset = 0;

    // Resolution
    view.setUint16(offset, settings.resolution.width, true); offset += 2;
    view.setUint16(offset, settings.resolution.height, true); offset += 2;
    view.setFloat32(offset, settings.resolution.fps, true); offset += 4;

    // Image parameters
    view.setUint16(offset, settings.iso, true); offset += 2;
    view.setUint16(offset, settings.aperture, true); offset += 2;
    view.setUint32(offset, settings.shutter_speed, true); offset += 4;
    view.setUint16(offset, settings.white_balance, true); offset += 2;

    return new Uint8Array(buffer, 0, offset);
  }
}
```

### 3. Real-time Viewfinder Streaming

**Based on:** `blackmagic_advanced_protocol_specification.md` - Advanced Streaming Protocol

```typescript
// High-Performance Streaming Implementation
export class ViewfinderStreamingService {
  private streamSessions: Map<string, StreamSession> = new Map();
  private frameBuffer: CircularBuffer<StreamFrame>;
  private videoDecoder: VideoDecoder;
  private statsTracker: StreamStatsTracker;

  constructor() {
    this.frameBuffer = new CircularBuffer<StreamFrame>(60); // 2 second buffer at 30fps
    this.videoDecoder = new VideoDecoder();
    this.statsTracker = new StreamStatsTracker();
  }

  async startMultiCameraStreaming(
    cameras: CameraConnection[],
    config: StreamConfiguration
  ): Promise<MultiStreamSession> {
    
    const streamPromises = cameras.map(camera => 
      this.startSingleCameraStream(camera, config)
    );
    
    const sessions = await Promise.all(streamPromises);
    
    return new MultiStreamSession(sessions, {
      syncMode: 'frame-sync', // or 'timestamp-sync'
      bufferSize: config.bufferSize || 30,
      qualityAdaptation: true
    });
  }

  private async startSingleCameraStream(
    camera: CameraConnection,
    config: StreamConfiguration
  ): Promise<StreamSession> {
    
    // Configure camera streaming parameters
    const streamMessage = this.encodeStreamStartMessage(config);
    await camera.writeCharacteristic(
      CharacteristicUUIDs.BM_VIEWFINDER_STREAM,
      streamMessage
    );

    // Set up frame reception
    const session = new StreamSession(camera.deviceId, config);
    this.streamSessions.set(camera.deviceId, session);

    camera.onCharacteristicChanged(
      CharacteristicUUIDs.BM_VIEWFINDER_STREAM,
      (data: Uint8Array) => this.handleStreamFrame(camera.deviceId, data)
    );

    return session;
  }

  private handleStreamFrame(deviceId: string, data: Uint8Array): void {
    try {
      const frame = this.parseStreamFrame(data);
      
      // Add to buffer
      this.frameBuffer.push(frame);
      
      // Update statistics
      this.statsTracker.recordFrame(frame);
      
      // Decode and emit frame
      this.decodeAndEmitFrame(deviceId, frame);
      
    } catch (error) {
      console.error(`Frame processing error for device ${deviceId}:`, error);
      this.handleStreamError(deviceId, error);
    }
  }

  private parseStreamFrame(data: Uint8Array): StreamFrame {
    const view = new DataView(data.buffer);
    
    return {
      frameNumber: view.getUint32(0, true),
      timestamp: view.getBigUint64(4, true),
      frameType: String.fromCharCode(data[12]) as 'I' | 'P' | 'B',
      data: data.slice(13, data.length - 20),
      metadata: {
        exposure_time: view.getFloat32(data.length - 20, true),
        iso: view.getUint16(data.length - 16, true),
        white_balance: view.getUint16(data.length - 14, true),
        focus_distance: view.getFloat32(data.length - 12, true),
        lens_aperture: view.getFloat32(data.length - 8, true),
      }
    };
  }

  private async decodeAndEmitFrame(deviceId: string, frame: StreamFrame): Promise<void> {
    try {
      // Use WebCodecs for hardware acceleration when available
      if (this.videoDecoder.isHardwareAccelerated()) {
        const decodedFrame = await this.videoDecoder.decodeHardware(frame);
        this.emitFrame(deviceId, decodedFrame);
      } else {
        // Fallback to software decoding
        const decodedFrame = await this.videoDecoder.decodeSoftware(frame);
        this.emitFrame(deviceId, decodedFrame);
      }
    } catch (error) {
      console.error('Frame decode error:', error);
    }
  }
}
```

### 4. Configuration Preset System

**Based on:** `blackmagic_integration_guide.md` - Automated Configuration Presets

```typescript
// Intelligent Preset Management
export class PresetManagementSystem {
  private presetStorage: PresetStorage;
  private validator: SettingsValidator;
  private templateEngine: TemplateEngine;

  constructor() {
    this.presetStorage = new PresetStorage();
    this.validator = new SettingsValidator();
    this.templateEngine = new TemplateEngine();
  }

  async createSmartPreset(
    name: string, 
    sourceSettings: CameraSettings[],
    metadata: PresetMetadata
  ): Promise<ConfigurationPreset> {
    
    // Analyze common settings across cameras
    const commonSettings = this.analyzeCommonSettings(sourceSettings);
    
    // Create adaptive template
    const template = await this.templateEngine.createAdaptiveTemplate({
      baseSettings: commonSettings,
      variations: this.identifyVariations(sourceSettings),
      constraints: metadata.constraints
    });

    const preset: ConfigurationPreset = {
      id: this.generatePresetId(),
      name,
      description: metadata.description,
      template,
      compatibility: await this.analyzeCompatibility(template),
      createdAt: new Date(),
      version: '1.0.0',
      tags: metadata.tags || []
    };

    await this.presetStorage.save(preset);
    return preset;
  }

  async applyPresetIntelligently(
    presetId: string,
    targetCameras: CameraConnection[]
  ): Promise<PresetApplicationResult> {
    
    const preset = await this.presetStorage.load(presetId);
    if (!preset) {
      throw new Error(`Preset not found: ${presetId}`);
    }

    // Validate compatibility with each camera
    const compatibilityResults = await Promise.all(
      targetCameras.map(camera => 
        this.validateCameraCompatibility(camera, preset)
      )
    );

    // Apply settings with error handling and rollback
    const applicationResults: CameraApplicationResult[] = [];
    
    for (let i = 0; i < targetCameras.length; i++) {
      const camera = targetCameras[i];
      const compatibility = compatibilityResults[i];
      
      if (compatibility.compatible) {
        try {
          const adaptedSettings = this.adaptSettingsForCamera(preset.template, camera);
          await this.applySettingsWithValidation(camera, adaptedSettings);
          
          applicationResults.push({
            cameraId: camera.deviceId,
            success: true,
            appliedSettings: adaptedSettings
          });
          
        } catch (error) {
          applicationResults.push({
            cameraId: camera.deviceId,
            success: false,
            error: error.message,
            rollbackPerformed: await this.performRollback(camera)
          });
        }
      } else {
        applicationResults.push({
          cameraId: camera.deviceId,
          success: false,
          error: `Incompatible: ${compatibility.reason}`
        });
      }
    }

    return {
      presetId,
      totalCameras: targetCameras.length,
      successful: applicationResults.filter(r => r.success).length,
      failed: applicationResults.filter(r => !r.success).length,
      results: applicationResults
    };
  }

  private analyzeCommonSettings(settingsArray: CameraSettings[]): CameraSettings {
    // Find settings that are common across all cameras
    const commonSettings: Partial<CameraSettings> = {};
    
    const firstSettings = settingsArray[0];
    const settingsKeys = Object.keys(firstSettings) as (keyof CameraSettings)[];
    
    for (const key of settingsKeys) {
      const values = settingsArray.map(s => s[key]);
      const allSame = values.every(v => JSON.stringify(v) === JSON.stringify(values[0]));
      
      if (allSame) {
        (commonSettings as any)[key] = values[0];
      }
    }
    
    return commonSettings as CameraSettings;
  }

  private async adaptSettingsForCamera(
    template: SettingsTemplate,
    camera: CameraConnection
  ): Promise<CameraSettings> {
    
    const cameraCapabilities = await camera.getCapabilities();
    const adaptedSettings = { ...template.baseSettings };

    // Adapt resolution based on camera capabilities
    if (template.baseSettings.resolution) {
      const supportedResolutions = cameraCapabilities.supportedResolutions;
      const targetResolution = template.baseSettings.resolution;
      
      const bestMatch = this.findBestResolutionMatch(
        targetResolution,
        supportedResolutions
      );
      
      adaptedSettings.resolution = bestMatch;
    }

    // Adapt codec based on capabilities
    if (template.baseSettings.codec && cameraCapabilities.supportedCodecs) {
      const supportedCodecs = cameraCapabilities.supportedCodecs;
      
      if (!supportedCodecs.includes(template.baseSettings.codec)) {
        adaptedSettings.codec = this.findBestCodecFallback(
          template.baseSettings.codec,
          supportedCodecs
        );
      }
    }

    return adaptedSettings;
  }
}
```

### 5. Mock Camera Implementation for Development

**Based on:** `blackmagic_testing_debugging_utilities.md` - Mock Camera Simulator

```typescript
// Comprehensive Mock Camera for Development
export class MockCameraSimulator implements CameraConnection {
  private deviceId: string;
  private mockFirmware: MockFirmware;
  private streamSimulator: StreamSimulator;
  private settingsState: CameraSettings;
  private connectionState: ConnectionState;
  private eventEmitter: EventEmitter;

  constructor(deviceId: string, model: CameraModel) {
    this.deviceId = deviceId;
    this.mockFirmware = new MockFirmware(model);
    this.streamSimulator = new StreamSimulator(model.videoCapabilities);
    this.settingsState = this.getDefaultSettings(model);
    this.connectionState = ConnectionState.DISCONNECTED;
    this.eventEmitter = new EventEmitter();
  }

  async connect(): Promise<void> {
    // Simulate connection delay
    await this.delay(500 + Math.random() * 1000);
    
    // Simulate occasional connection failures
    if (Math.random() < 0.1) {
      throw new Error('Mock connection failure');
    }
    
    this.connectionState = ConnectionState.CONNECTED;
    this.eventEmitter.emit('connected');
  }

  async sendCommand(command: CameraCommand): Promise<CommandResponse> {
    if (this.connectionState !== ConnectionState.CONNECTED) {
      throw new Error('Camera not connected');
    }

    // Simulate network delay
    await this.delay(50 + Math.random() * 100);

    return this.mockFirmware.processCommand(command);
  }

  async updateSettings(settings: Partial<CameraSettings>): Promise<void> {
    // Validate settings just like real camera
    this.validateSettings(settings);
    
    // Apply settings with realistic delays
    await this.delay(200 + Math.random() * 300);
    
    Object.assign(this.settingsState, settings);
    this.eventEmitter.emit('settings-updated', this.settingsState);
  }

  async startViewfinderStream(config: StreamConfiguration): Promise<void> {
    await this.streamSimulator.startStream(config);
    
    // Emit mock frames at specified framerate
    this.streamSimulator.onFrame((frame) => {
      this.eventEmitter.emit('stream-frame', frame);
    });
  }

  // Simulate realistic camera behaviors
  private simulateRealisticBehaviors(): void {
    // Simulate battery drain
    setInterval(() => {
      if (this.connectionState === ConnectionState.CONNECTED) {
        // Simulate battery decreasing
        this.simulateBatteryDrain();
      }
    }, 30000); // Every 30 seconds

    // Simulate occasional disconnections
    setInterval(() => {
      if (Math.random() < 0.02) { // 2% chance every minute
        this.simulateUnexpectedDisconnection();
      }
    }, 60000);

    // Simulate temperature changes
    setInterval(() => {
      this.simulateTemperatureChanges();
    }, 10000);
  }

  private validateSettings(settings: Partial<CameraSettings>): void {
    // Implement same validation logic as real camera
    if (settings.resolution && settings.fps) {
      const { width, height } = settings.resolution;
      const fps = settings.fps;
      
      // 4K60 validation
      if (width === 3840 && height === 2160 && fps === 60) {
        if (settings.codec === 'Blackmagic RAW' && settings.quality === 'HQ') {
          throw new Error('Mock: 4K60 HQ BRAW exceeds data rate limits');
        }
      }
    }
  }
}

// Stream Simulation for Testing
class StreamSimulator {
  private isStreaming: boolean = false;
  private frameInterval: NodeJS.Timeout | null = null;
  private frameNumber: number = 0;
  private listeners: ((frame: StreamFrame) => void)[] = [];

  constructor(private videoCapabilities: VideoCapabilities) {}

  async startStream(config: StreamConfiguration): Promise<void> {
    if (this.isStreaming) {
      throw new Error('Stream already active');
    }

    this.isStreaming = true;
    this.frameNumber = 0;

    // Generate frames at specified framerate
    const frameIntervalMs = 1000 / config.frameRate;
    
    this.frameInterval = setInterval(() => {
      this.generateMockFrame(config);
    }, frameIntervalMs);
  }

  private generateMockFrame(config: StreamConfiguration): void {
    // Generate realistic mock frame data
    const frameSize = this.calculateFrameSize(config);
    const mockFrameData = new Uint8Array(frameSize);
    
    // Fill with pseudo-random data that looks like compressed video
    for (let i = 0; i < frameSize; i++) {
      mockFrameData[i] = Math.floor(Math.random() * 256);
    }

    const frame: StreamFrame = {
      frameNumber: this.frameNumber++,
      timestamp: BigInt(Date.now() * 1000), // Microseconds
      frameType: this.frameNumber % 30 === 0 ? 'I' : 'P', // I-frame every 30 frames
      data: mockFrameData,
      metadata: {
        exposure_time: 1/50, // 50th of a second
        iso: 800,
        white_balance: 5600,
        focus_distance: 2.5, // 2.5 meters
        lens_aperture: 2.8
      }
    };

    this.listeners.forEach(listener => listener(frame));
  }

  onFrame(callback: (frame: StreamFrame) => void): void {
    this.listeners.push(callback);
  }
}
```

---

## Data Structure Definitions

### Core Types and Interfaces

```typescript
// Extended Camera Settings Interface
export interface CameraSettings {
  // Recording Parameters
  resolution: {
    width: number;
    height: number;
    fps: number;
  };
  
  // Image Parameters  
  iso: number;                    // 100, 200, 400, 800, 1600, 3200, 6400
  aperture: number;               // f-stop * 100 (f/2.8 = 280)
  shutter_speed: number;          // 1/shutter_speed in seconds * 1000000
  white_balance: number;          // Kelvin temperature
  
  // Advanced Settings
  gamma: string;                  // "Blackmagic Design Video", "Rec. 709"
  color_space: string;            // "Rec. 2020", "Rec. 709", "DCI-P3"
  dynamic_range: string;          // "Video", "Extended Video", "Film"
  
  // Audio Settings
  audio_channels: number;         // 2, 4, 8
  audio_sample_rate: number;      // 48000, 96000
  audio_bit_depth: number;        // 16, 24
  
  // Storage Settings
  codec: string;                  // "Blackmagic RAW", "ProRes", "H.264"
  quality: string;                // "HQ", "12:1", "8:1", "5:1", "3:1"
  storage_location: string;       // "CFast", "SD", "USB-C"
}

// Multi-Camera Operation Results
export interface BroadcastResult {
  totalDevices: number;
  successful: number;
  failed: number;
  results: CommandResult[];
}

export interface PresetApplicationResult {
  presetId: string;
  totalCameras: number;
  successful: number;
  failed: number;
  results: CameraApplicationResult[];
}

// Stream Management Types
export interface MultiStreamSession {
  sessions: StreamSession[];
  syncMode: 'frame-sync' | 'timestamp-sync' | 'independent';
  bufferSize: number;
  qualityAdaptation: boolean;
}

export interface StreamFrame {
  frameNumber: number;
  timestamp: bigint;
  frameType: 'I' | 'P' | 'B';
  data: Uint8Array;
  metadata: FrameMetadata;
}

// Connection Management Types
export interface ConnectionResult {
  device: BluetoothDevice;
  success: boolean;
  connection: CameraConnection | null;
  error: string | null;
}
```

---

## Performance Optimizations

### 1. Connection Pool Management
- **Connection Reuse**: Maintain persistent connections to avoid reconnection overhead
- **Load Balancing**: Distribute operations across available connections
- **Health Monitoring**: Proactive connection health checks and replacement

### 2. Memory Management
- **Circular Buffers**: Efficient frame buffering for video streams
- **Zero-Copy Operations**: Minimize data copying where possible
- **Garbage Collection**: Proactive cleanup of large objects

### 3. Protocol Optimizations
- **Message Batching**: Combine multiple commands into single messages
- **Compression**: Use compression for large data transfers
- **Caching**: Cache device capabilities and frequently accessed data

---

## Error Recovery Strategies

### 1. Connection Recovery
```typescript
export class ConnectionRecoveryManager {
  async handleConnectionLoss(deviceId: string): Promise<void> {
    // Implement exponential backoff retry
    let retryDelay = 1000;
    const maxRetries = 5;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.reconnectDevice(deviceId);
        await this.restoreDeviceState(deviceId);
        return; // Success
      } catch (error) {
        if (attempt < maxRetries - 1) {
          await this.delay(retryDelay);
          retryDelay *= 2; // Exponential backoff
        }
      }
    }
    
    // Final failure - notify user
    this.notifyPermanentConnectionLoss(deviceId);
  }
}
```

### 2. State Preservation
- **Operation Queuing**: Queue operations during disconnections
- **State Synchronization**: Restore camera state after reconnection
- **Partial Failure Handling**: Continue operations on available cameras

---

This technical specification provides the detailed implementation guidance needed to build the accessibility features outlined in the main implementation checklist, with particular focus on multi-camera management, remote control capabilities, and robust error handling essential for accessibility use cases.