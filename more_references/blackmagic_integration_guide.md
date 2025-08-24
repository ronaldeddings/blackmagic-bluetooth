# Blackmagic Camera Integration Guide - Practical Implementation

## Getting Started

### Installation and Setup

```bash
npm install @blackmagic/camera-protocol
# or
yarn add @blackmagic/camera-protocol
```

```typescript
import {
  BLEConnectionManager,
  CameraControlService,
  ViewfinderStreaming,
  FirmwareUpdateProtocol,
  BlackmagicProtocol
} from '@blackmagic/camera-protocol';
```

### Basic Project Setup

```typescript
// app.ts
import { BlackmagicProtocol } from '@blackmagic/camera-protocol';

class CameraApp {
  private protocol: BlackmagicProtocol;
  
  constructor() {
    // Initialize with recommended settings
    this.protocol = BlackmagicProtocol.createDefault();
  }
  
  async initialize() {
    try {
      await this.protocol.initialize();
      console.log('Blackmagic Protocol initialized');
    } catch (error) {
      console.error('Initialization failed:', error);
    }
  }
}

const app = new CameraApp();
app.initialize();
```

## Common Use Cases

### 1. Simple Camera Remote Control

```typescript
import { useState, useEffect } from 'react';
import { BLEConnectionManager, CameraControlService, ConnectionState } from '@blackmagic/camera-protocol';

export const SimpleCameraRemote: React.FC = () => {
  const [connectionManager] = useState(() => new BLEConnectionManager());
  const [cameraService, setCameraService] = useState<CameraControlService | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  
  useEffect(() => {
    // Monitor connection state
    connectionManager.onConnectionStateChange(setConnectionState);
    
    return () => {
      if (connectionState === ConnectionState.CONNECTED) {
        connectionManager.disconnect();
      }
    };
  }, []);
  
  const connectToCamera = async () => {
    try {
      const devices = await connectionManager.scanForDevices({
        timeout: 10000,
        serviceUUIDs: [ServiceUUID.BLACKMAGIC_CAMERA_CONTROL]
      });
      
      if (devices.length === 0) {
        alert('No Blackmagic cameras found nearby');
        return;
      }
      
      // Show device selector if multiple found
      const selectedDevice = devices.length > 1 
        ? await showDeviceSelector(devices)
        : devices[0];
      
      const connection = await connectionManager.connect(selectedDevice);
      const service = await connection.getCameraControlService();
      
      // Monitor recording state changes
      service.onRecordingStateChange((recording) => {
        setIsRecording(recording);
      });
      
      setCameraService(service);
      
    } catch (error) {
      console.error('Connection failed:', error);
      alert(`Failed to connect: ${error.message}`);
    }
  };
  
  const toggleRecording = async () => {
    if (!cameraService) return;
    
    try {
      if (isRecording) {
        await cameraService.stopRecording();
      } else {
        await cameraService.startRecording();
      }
    } catch (error) {
      console.error('Recording toggle failed:', error);
      alert(`Recording operation failed: ${error.message}`);
    }
  };
  
  return (
    <div className="camera-remote">
      <h2>Camera Remote Control</h2>
      
      <div className="connection-status">
        Status: {ConnectionState[connectionState]}
      </div>
      
      {connectionState === ConnectionState.DISCONNECTED && (
        <button onClick={connectToCamera} className="connect-btn">
          Connect to Camera
        </button>
      )}
      
      {connectionState === ConnectionState.READY && (
        <div className="controls">
          <button 
            onClick={toggleRecording}
            className={`record-btn ${isRecording ? 'recording' : ''}`}
          >
            {isRecording ? '⏹️ Stop Recording' : '🔴 Start Recording'}
          </button>
        </div>
      )}
    </div>
  );
};

// Utility function for device selection
async function showDeviceSelector(devices: BlackmagicDevice[]): Promise<BlackmagicDevice> {
  return new Promise((resolve) => {
    // Implementation would show a modal or dropdown
    // This is a simplified example
    const deviceNames = devices.map((d, i) => `${i}: ${d.name} (${d.model})`);
    const selection = prompt(`Select device:\n${deviceNames.join('\n')}`);
    const index = parseInt(selection || '0');
    resolve(devices[index] || devices[0]);
  });
}
```

### 2. Live Viewfinder with Controls

```typescript
interface ViewfinderControllerProps {
  connection: Connection;
}

export const ViewfinderController: React.FC<ViewfinderControllerProps> = ({ connection }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamingService, setStreamingService] = useState<ViewfinderStreaming | null>(null);
  const [streamStats, setStreamStats] = useState<StreamMetadata | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamConfig, setStreamConfig] = useState<StreamConfiguration>({
    resolution: { width: 1920, height: 1080 },
    frameRate: 30,
    quality: StreamQuality.HIGH,
    codec: VideoCodec.H264,
    latencyMode: LatencyMode.LOW_LATENCY
  });
  
  useEffect(() => {
    initializeStreaming();
    return () => {
      if (streamingService && isStreaming) {
        streamingService.stopStream();
      }
    };
  }, [connection]);
  
  const initializeStreaming = async () => {
    try {
      const service = await connection.getViewfinderService();
      
      // Set up frame handling
      service.onFrame((frame) => {
        renderFrame(frame);
      });
      
      // Set up metadata monitoring
      service.onMetadata((metadata) => {
        setStreamStats(metadata);
      });
      
      // Handle streaming errors
      service.onStreamError((error) => {
        console.error('Stream error:', error);
        setIsStreaming(false);
      });
      
      setStreamingService(service);
      
    } catch (error) {
      console.error('Failed to initialize streaming:', error);
    }
  };
  
  const startStream = async () => {
    if (!streamingService) return;
    
    try {
      const session = await streamingService.startStream(streamConfig);
      setIsStreaming(true);
      console.log('Stream started:', session);
    } catch (error) {
      console.error('Failed to start stream:', error);
    }
  };
  
  const stopStream = async () => {
    if (!streamingService) return;
    
    try {
      await streamingService.stopStream();
      setIsStreaming(false);
    } catch (error) {
      console.error('Failed to stop stream:', error);
    }
  };
  
  const renderFrame = (frame: VideoFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Update canvas size if needed
    if (canvas.width !== frame.width || canvas.height !== frame.height) {
      canvas.width = frame.width;
      canvas.height = frame.height;
    }
    
    // Convert frame data to ImageData and render
    try {
      const imageData = decodeFrameData(frame);
      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      console.error('Frame rendering failed:', error);
    }
  };
  
  const updateStreamQuality = async (quality: StreamQuality) => {
    if (!streamingService || !isStreaming) return;
    
    try {
      const newConfig = { ...streamConfig, quality };
      await streamingService.updateStreamConfig(newConfig);
      setStreamConfig(newConfig);
    } catch (error) {
      console.error('Failed to update stream quality:', error);
    }
  };
  
  return (
    <div className="viewfinder-controller">
      <div className="stream-canvas-container">
        <canvas 
          ref={canvasRef}
          className="viewfinder-canvas"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
        
        {!isStreaming && (
          <div className="stream-overlay">
            <button onClick={startStream} className="start-stream-btn">
              ▶️ Start Viewfinder
            </button>
          </div>
        )}
      </div>
      
      <div className="stream-controls">
        {isStreaming && (
          <>
            <button onClick={stopStream} className="stop-stream-btn">
              ⏹️ Stop Stream
            </button>
            
            <div className="quality-controls">
              <label>Quality:</label>
              <select 
                value={streamConfig.quality}
                onChange={(e) => updateStreamQuality(parseInt(e.target.value))}
              >
                <option value={StreamQuality.LOW}>Low (480p)</option>
                <option value={StreamQuality.MEDIUM}>Medium (720p)</option>
                <option value={StreamQuality.HIGH}>High (1080p)</option>
                <option value={StreamQuality.ULTRA}>Ultra (4K)</option>
              </select>
            </div>
          </>
        )}
        
        {streamStats && (
          <div className="stream-stats">
            <div>FPS: {streamStats.frameRate.toFixed(1)}</div>
            <div>Bitrate: {(streamStats.bitrate / 1000).toFixed(1)}Kbps</div>
            <div>Buffer: {streamStats.bufferHealth}%</div>
            <div>Dropped: {streamStats.droppedFrames}</div>
          </div>
        )}
      </div>
    </div>
  );
};

// Frame decoding utility (simplified example)
function decodeFrameData(frame: VideoFrame): ImageData {
  // In a real implementation, you would use WebCodecs API
  // or a video decoding library like FFmpeg.wasm
  
  if (frame.format === PixelFormat.RGB24) {
    const imageData = new ImageData(frame.width, frame.height);
    const pixels = imageData.data;
    
    // Convert RGB24 to RGBA
    for (let i = 0, j = 0; i < frame.data.length; i += 3, j += 4) {
      pixels[j] = frame.data[i];     // R
      pixels[j + 1] = frame.data[i + 1]; // G
      pixels[j + 2] = frame.data[i + 2]; // B
      pixels[j + 3] = 255;           // A
    }
    
    return imageData;
  }
  
  // For other formats, implement appropriate conversion
  throw new Error(`Unsupported pixel format: ${frame.format}`);
}
```

### 3. Firmware Update with Progress

```typescript
interface FirmwareUpdateProps {
  connection: Connection;
}

export const FirmwareUpdateComponent: React.FC<FirmwareUpdateProps> = ({ connection }) => {
  const [updateService, setUpdateService] = useState<FirmwareUpdateProtocol | null>(null);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  
  useEffect(() => {
    initializeUpdateService();
  }, [connection]);
  
  const initializeUpdateService = async () => {
    try {
      const service = await connection.getFirmwareUpdateService();
      
      // Set up progress monitoring
      service.onProgress((progress) => {
        setUpdateProgress(progress);
      });
      
      // Set up error handling
      service.onError((error) => {
        setUpdateError(error.message);
        setIsUpdating(false);
      });
      
      setUpdateService(service);
    } catch (error) {
      console.error('Failed to initialize update service:', error);
    }
  };
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !updateService) return;
    
    // Validate firmware file
    if (!file.name.endsWith('.bin')) {
      alert('Please select a valid firmware file (.bin)');
      return;
    }
    
    try {
      setIsUpdating(true);
      setUpdateError(null);
      setUpdateProgress(null);
      
      await performFirmwareUpdate(file);
      
    } catch (error) {
      console.error('Firmware update failed:', error);
      setUpdateError(error.message);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const performFirmwareUpdate = async (file: File) => {
    if (!updateService) throw new Error('Update service not initialized');
    
    // Calculate file checksum
    const checksum = await calculateFileChecksum(file);
    
    // Prepare metadata
    const metadata: FirmwareMetadata = {
      version: extractVersionFromFilename(file.name),
      size: file.size,
      checksum: checksum,
      buildDate: new Date(),
      requiredBootloaderVersion: '1.0.0',
      compatibleModels: ['Camera 6K Pro'] // Would be determined from file
    };
    
    // Initialize update session
    const session = await updateService.initializeUpdate(metadata);
    
    // Upload firmware in chunks
    await uploadFirmwareChunks(file, session);
    
    // Verify and finalize
    const verified = await updateService.verifyUpdate();
    if (!verified) {
      throw new Error('Firmware verification failed');
    }
    
    await updateService.finalizeUpdate();
  };
  
  const uploadFirmwareChunks = async (file: File, session: UpdateSession) => {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    
    for (let i = 0; i < session.totalChunks; i++) {
      const start = i * session.chunkSize;
      const end = Math.min(start + session.chunkSize, data.length);
      const chunkData = data.slice(start, end);
      
      const chunk: FirmwareChunk = {
        sessionId: session.sessionId,
        chunkNumber: i,
        data: chunkData,
        checksum: calculateChunkChecksum(chunkData),
        isLastChunk: i === session.totalChunks - 1
      };
      
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          const response = await updateService!.uploadChunk(chunk);
          
          if (response.success) {
            break; // Chunk uploaded successfully
          } else if (response.retryRequested && attempts < maxAttempts - 1) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
            continue;
          } else {
            throw new Error(`Chunk upload failed: ${response.errorCode}`);
          }
        } catch (error) {
          if (attempts < maxAttempts - 1) {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer on error
          } else {
            throw error;
          }
        }
      }
    }
  };
  
  return (
    <div className="firmware-update">
      <h3>Firmware Update</h3>
      
      {!isUpdating && (
        <div className="file-upload">
          <input
            type="file"
            accept=".bin"
            onChange={handleFileUpload}
            disabled={!updateService}
          />
          <p className="help-text">
            Select a Blackmagic firmware file (.bin) to update your camera
          </p>
        </div>
      )}
      
      {isUpdating && updateProgress && (
        <div className="update-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${updateProgress.percentage}%` }}
            />
          </div>
          
          <div className="progress-stats">
            <div>Progress: {updateProgress.percentage.toFixed(1)}%</div>
            <div>Speed: {formatBytes(updateProgress.currentSpeed)}/s</div>
            <div>ETA: {formatTime(updateProgress.estimatedTimeRemaining)}</div>
            <div>
              {formatBytes(updateProgress.bytesTransferred)} / {formatBytes(updateProgress.totalBytes)}
            </div>
          </div>
        </div>
      )}
      
      {updateError && (
        <div className="update-error">
          <p>Update failed: {updateError}</p>
          <button onClick={() => setUpdateError(null)}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

// Utility functions
async function calculateFileChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function extractVersionFromFilename(filename: string): string {
  const match = filename.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : '1.0.0';
}

function calculateChunkChecksum(data: Uint8Array): number {
  let checksum = 0;
  for (const byte of data) {
    checksum = ((checksum << 1) | (checksum >>> 31)) ^ byte;
  }
  return checksum;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
```

## Advanced Integration Patterns

### 4. Multi-Camera Management

```typescript
class CameraManager {
  private cameras: Map<string, CameraConnection> = new Map();
  private connectionManager: BLEConnectionManager;
  
  constructor() {
    this.connectionManager = new BLEConnectionManager();
  }
  
  async discoverCameras(): Promise<BlackmagicDevice[]> {
    return this.connectionManager.scanForDevices({
      timeout: 15000,
      serviceUUIDs: [ServiceUUID.BLACKMAGIC_CAMERA_CONTROL],
      allowDuplicates: false
    });
  }
  
  async connectCamera(device: BlackmagicDevice): Promise<string> {
    if (this.cameras.has(device.id)) {
      throw new Error(`Camera ${device.id} already connected`);
    }
    
    const connection = await this.connectionManager.connect(device);
    const cameraService = await connection.getCameraControlService();
    
    const cameraConnection: CameraConnection = {
      device,
      connection,
      service: cameraService,
      lastSeen: new Date()
    };
    
    // Monitor camera status
    cameraService.onStatusChange((status) => {
      this.handleCameraStatusChange(device.id, status);
    });
    
    this.cameras.set(device.id, cameraConnection);
    return device.id;
  }
  
  async disconnectCamera(cameraId: string): Promise<void> {
    const camera = this.cameras.get(cameraId);
    if (!camera) return;
    
    try {
      await camera.connection.disconnect();
    } finally {
      this.cameras.delete(cameraId);
    }
  }
  
  async startRecordingAll(): Promise<void> {
    const promises = Array.from(this.cameras.values()).map(camera =>
      camera.service.startRecording().catch(error => 
        console.error(`Failed to start recording on ${camera.device.name}:`, error)
      )
    );
    
    await Promise.allSettled(promises);
  }
  
  async stopRecordingAll(): Promise<void> {
    const promises = Array.from(this.cameras.values()).map(camera =>
      camera.service.stopRecording().catch(error => 
        console.error(`Failed to stop recording on ${camera.device.name}:`, error)
      )
    );
    
    await Promise.allSettled(promises);
  }
  
  getCameraStatus(cameraId: string): Promise<CameraStatus | null> {
    const camera = this.cameras.get(cameraId);
    return camera ? camera.service.getStatus() : Promise.resolve(null);
  }
  
  private handleCameraStatusChange(cameraId: string, status: CameraStatus) {
    // Update last seen timestamp
    const camera = this.cameras.get(cameraId);
    if (camera) {
      camera.lastSeen = new Date();
    }
    
    // Emit global camera status event
    this.onCameraStatusChange?.(cameraId, status);
  }
  
  // Event handlers
  onCameraStatusChange?: (cameraId: string, status: CameraStatus) => void;
}

interface CameraConnection {
  device: BlackmagicDevice;
  connection: Connection;
  service: CameraControlService;
  lastSeen: Date;
}
```

### 5. Automated Camera Configuration

```typescript
class CameraConfigurationManager {
  constructor(private cameraService: CameraControlService) {}
  
  async applyPreset(preset: CameraPreset): Promise<void> {
    try {
      // Apply settings in sequence to avoid conflicts
      await this.applyCoreSettings(preset.core);
      await this.applyImageSettings(preset.image);
      await this.applyRecordingSettings(preset.recording);
      
      console.log(`Applied preset: ${preset.name}`);
    } catch (error) {
      console.error(`Failed to apply preset ${preset.name}:`, error);
      throw error;
    }
  }
  
  private async applyCoreSettings(settings: CoreCameraSettings): Promise<void> {
    const commands: CameraCommand[] = [
      {
        commandId: CameraCommandId.SETTINGS_UPDATE,
        parameters: {
          category: 'core',
          fps: settings.frameRate,
          resolution: settings.resolution,
          codec: settings.codec
        }
      }
    ];
    
    for (const command of commands) {
      await this.cameraService.executeCommand(command);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between commands
    }
  }
  
  private async applyImageSettings(settings: ImageSettings): Promise<void> {
    const commands: CameraCommand[] = [
      {
        commandId: CameraCommandId.EXPOSURE_CONTROL,
        parameters: {
          shutterSpeed: settings.shutterSpeed,
          iso: settings.iso,
          aperture: settings.aperture
        }
      },
      {
        commandId: CameraCommandId.WHITE_BALANCE,
        parameters: {
          temperature: settings.whiteBalance.temperature,
          tint: settings.whiteBalance.tint
        }
      }
    ];
    
    for (const command of commands) {
      await this.cameraService.executeCommand(command);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  private async applyRecordingSettings(settings: RecordingSettings): Promise<void> {
    const command: CameraCommand = {
      commandId: CameraCommandId.SETTINGS_UPDATE,
      parameters: {
        category: 'recording',
        bitrate: settings.bitrate,
        quality: settings.quality,
        audioEnabled: settings.audioEnabled,
        audioChannels: settings.audioChannels
      }
    };
    
    await this.cameraService.executeCommand(command);
  }
  
  // Preset definitions
  static readonly PRESETS: CameraPreset[] = [
    {
      name: 'Cinema 4K',
      description: 'High-quality cinematic recording',
      core: {
        frameRate: 24,
        resolution: { width: 4096, height: 2160 },
        codec: VideoCodec.H265
      },
      image: {
        shutterSpeed: 1/48,
        iso: 400,
        aperture: 2.8,
        whiteBalance: { temperature: 5600, tint: 0 }
      },
      recording: {
        bitrate: 150000000, // 150 Mbps
        quality: 'high',
        audioEnabled: true,
        audioChannels: 2
      }
    },
    {
      name: 'Live Stream',
      description: 'Optimized for live streaming',
      core: {
        frameRate: 30,
        resolution: { width: 1920, height: 1080 },
        codec: VideoCodec.H264
      },
      image: {
        shutterSpeed: 1/60,
        iso: 800,
        aperture: 4.0,
        whiteBalance: { temperature: 5600, tint: 0 }
      },
      recording: {
        bitrate: 25000000, // 25 Mbps
        quality: 'medium',
        audioEnabled: true,
        audioChannels: 2
      }
    }
  ];
}

interface CameraPreset {
  name: string;
  description: string;
  core: CoreCameraSettings;
  image: ImageSettings;
  recording: RecordingSettings;
}

interface CoreCameraSettings {
  frameRate: number;
  resolution: Resolution;
  codec: VideoCodec;
}

interface ImageSettings {
  shutterSpeed: number; // fraction (e.g., 1/60)
  iso: number;
  aperture: number;
  whiteBalance: {
    temperature: number; // Kelvin
    tint: number; // -100 to +100
  };
}

interface RecordingSettings {
  bitrate: number; // bits per second
  quality: string;
  audioEnabled: boolean;
  audioChannels: number;
}
```

## Error Handling and Recovery

### 6. Robust Error Handling

```typescript
class ConnectionRecoveryManager {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // Start with 2 seconds
  private isRecovering = false;
  
  constructor(
    private connectionManager: BLEConnectionManager,
    private device: BlackmagicDevice
  ) {
    // Monitor connection health
    this.setupConnectionHealthMonitoring();
  }
  
  private setupConnectionHealthMonitoring() {
    // Monitor connection state changes
    this.connectionManager.onConnectionStateChange((state) => {
      if (state === ConnectionState.DISCONNECTED && !this.isRecovering) {
        this.initiateRecovery();
      }
    });
    
    // Periodic health checks
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
  }
  
  private async performHealthCheck() {
    try {
      const quality = this.connectionManager.getConnectionQuality();
      
      if (quality.signalStrength < -80 || quality.packetLoss > 10) {
        console.warn('Connection quality degraded:', quality);
        await this.optimizeConnection();
      }
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }
  
  private async optimizeConnection() {
    try {
      await this.connectionManager.optimizeConnection();
      console.log('Connection optimized');
    } catch (error) {
      console.error('Connection optimization failed:', error);
    }
  }
  
  private async initiateRecovery() {
    if (this.isRecovering) return;
    
    this.isRecovering = true;
    console.log('Initiating connection recovery...');
    
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      try {
        console.log(`Reconnection attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);
        
        // Wait before attempting reconnection
        await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
        
        // Try to reconnect
        const connection = await this.connectionManager.connect(this.device);
        
        // Test the connection
        await this.testConnection(connection);
        
        console.log('Connection recovered successfully');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 2000; // Reset delay
        this.isRecovering = false;
        
        // Notify recovery success
        this.onRecoverySuccess?.(connection);
        return;
        
      } catch (error) {
        console.error(`Reconnection attempt ${this.reconnectAttempts + 1} failed:`, error);
        this.reconnectAttempts++;
        
        // Exponential backoff with jitter
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2 + Math.random() * 1000,
          30000 // Max 30 seconds
        );
      }
    }
    
    console.error('Connection recovery failed after maximum attempts');
    this.isRecovering = false;
    this.onRecoveryFailed?.(new Error('Maximum reconnection attempts exceeded'));
  }
  
  private async testConnection(connection: Connection): Promise<void> {
    // Perform a simple test to verify connection works
    const cameraService = await connection.getCameraControlService();
    await cameraService.getStatus(); // This will throw if connection is broken
  }
  
  // Event handlers
  onRecoverySuccess?: (connection: Connection) => void;
  onRecoveryFailed?: (error: Error) => void;
  
  // Manual recovery trigger
  async forceReconnect(): Promise<void> {
    this.reconnectAttempts = 0;
    this.isRecovering = false;
    await this.initiateRecovery();
  }
}

// Global error handler for protocol errors
class ProtocolErrorHandler {
  static handleError(error: BlackmagicProtocolError): boolean {
    switch (error.errorCode) {
      case ErrorCode.CONNECTION_LOST:
        return this.handleConnectionError(error);
        
      case ErrorCode.CAMERA_BUSY:
        return this.handleCameraBusyError(error);
        
      case ErrorCode.COMMAND_TIMEOUT:
        return this.handleTimeoutError(error);
        
      case ErrorCode.FIRMWARE_INVALID:
        return this.handleFirmwareError(error);
        
      default:
        return this.handleGenericError(error);
    }
  }
  
  private static handleConnectionError(error: BlackmagicProtocolError): boolean {
    console.warn('Connection error detected:', error.message);
    
    if (error.details.recoverable) {
      // Attempt automatic recovery
      console.log('Attempting automatic recovery...');
      return true; // Indicate recovery should be attempted
    } else {
      // Show user notification
      this.showUserNotification('Connection lost', error.details.suggestedAction);
      return false;
    }
  }
  
  private static handleCameraBusyError(error: BlackmagicProtocolError): boolean {
    console.warn('Camera busy:', error.message);
    
    // Show temporary message to user
    this.showTemporaryMessage('Camera is busy, please try again in a moment');
    
    // Suggest retry after delay
    setTimeout(() => {
      console.log('Camera should be available now, you can retry the operation');
    }, 3000);
    
    return true; // Recoverable
  }
  
  private static handleTimeoutError(error: BlackmagicProtocolError): boolean {
    console.warn('Command timeout:', error.message);
    
    // Check if retrying makes sense
    if (error.details.context.retryCount < 3) {
      console.log('Retrying command...');
      return true;
    } else {
      this.showUserNotification('Operation timed out', 'Please check your connection and try again');
      return false;
    }
  }
  
  private static handleFirmwareError(error: BlackmagicProtocolError): boolean {
    console.error('Firmware error:', error.message);
    
    this.showUserNotification(
      'Firmware update failed',
      'Please ensure you have a valid firmware file and try again'
    );
    
    return false; // Not automatically recoverable
  }
  
  private static handleGenericError(error: BlackmagicProtocolError): boolean {
    console.error('Protocol error:', error);
    
    this.showUserNotification(
      'Operation failed',
      error.details.suggestedAction || 'Please try again'
    );
    
    return error.details.recoverable;
  }
  
  private static showUserNotification(title: string, message: string) {
    // Implementation would show toast notification or modal
    console.log(`Notification: ${title} - ${message}`);
  }
  
  private static showTemporaryMessage(message: string) {
    // Implementation would show temporary overlay message
    console.log(`Temporary message: ${message}`);
  }
}
```

## Performance Optimization

### 7. Connection and Data Optimization

```typescript
class PerformanceOptimizer {
  private metricsCollector: MetricsCollector;
  private adaptiveQuality: AdaptiveQualityController;
  private connectionOptimizer: ConnectionOptimizer;
  
  constructor(private connection: Connection) {
    this.metricsCollector = new MetricsCollector(connection);
    this.adaptiveQuality = new AdaptiveQualityController(connection);
    this.connectionOptimizer = new ConnectionOptimizer(connection);
    
    this.startPerformanceMonitoring();
  }
  
  private startPerformanceMonitoring() {
    // Collect performance metrics every 5 seconds
    setInterval(() => {
      this.collectAndAnalyzeMetrics();
    }, 5000);
    
    // Optimize connection parameters every minute
    setInterval(() => {
      this.optimizeConnectionParameters();
    }, 60000);
  }
  
  private async collectAndAnalyzeMetrics() {
    try {
      const metrics = await this.metricsCollector.collect();
      
      // Analyze metrics and make optimizations
      if (metrics.averageLatency > 200) {
        await this.optimizeForLowLatency();
      }
      
      if (metrics.throughput < 1000000) { // Less than 1MB/s
        await this.optimizeForThroughput();
      }
      
      if (metrics.packetLoss > 5) {
        await this.optimizeForReliability();
      }
      
    } catch (error) {
      console.error('Performance monitoring failed:', error);
    }
  }
  
  private async optimizeForLowLatency() {
    console.log('Optimizing for low latency...');
    
    // Reduce connection interval
    await this.connectionOptimizer.setConnectionInterval(15); // 15ms
    
    // Enable low latency mode for streaming
    await this.adaptiveQuality.enableLowLatencyMode();
    
    // Reduce buffer sizes
    await this.adaptiveQuality.setBufferSize(5); // 5 frames
  }
  
  private async optimizeForThroughput() {
    console.log('Optimizing for throughput...');
    
    // Increase MTU if possible
    await this.connectionOptimizer.negotiateMaxMTU();
    
    // Use larger connection interval for efficiency
    await this.connectionOptimizer.setConnectionInterval(50); // 50ms
    
    // Enable data compression
    await this.adaptiveQuality.enableDataCompression();
  }
  
  private async optimizeForReliability() {
    console.log('Optimizing for reliability...');
    
    // Reduce data rate to improve reliability
    await this.adaptiveQuality.reduceQuality();
    
    // Enable automatic retry
    await this.connectionOptimizer.enableAutoRetry(3);
    
    // Increase acknowledgment timeout
    await this.connectionOptimizer.setAckTimeout(1000); // 1 second
  }
  
  private async optimizeConnectionParameters() {
    try {
      const currentQuality = this.connection.getConnectionQuality();
      
      if (currentQuality.signalStrength < -70) {
        // Weak signal - optimize for reliability
        await this.optimizeForReliability();
      } else if (currentQuality.signalStrength > -40) {
        // Strong signal - optimize for performance
        await this.optimizeForThroughput();
      }
      
    } catch (error) {
      console.error('Connection optimization failed:', error);
    }
  }
  
  // Public API for manual optimization
  async enableHighPerformanceMode() {
    await Promise.all([
      this.optimizeForThroughput(),
      this.adaptiveQuality.setMaxQuality(),
      this.connectionOptimizer.negotiateMaxMTU()
    ]);
  }
  
  async enableBatteryOptimizedMode() {
    await Promise.all([
      this.connectionOptimizer.setConnectionInterval(100), // Slower updates
      this.adaptiveQuality.reduceQuality(),
      this.adaptiveQuality.enablePowerSaving()
    ]);
  }
  
  getPerformanceReport(): PerformanceReport {
    return this.metricsCollector.generateReport();
  }
}

class MetricsCollector {
  private metrics: PerformanceMetric[] = [];
  
  constructor(private connection: Connection) {}
  
  async collect(): Promise<CurrentMetrics> {
    const startTime = Date.now();
    
    try {
      // Measure connection quality
      const quality = this.connection.getConnectionQuality();
      
      // Measure round-trip time with ping
      const pingStartTime = Date.now();
      await this.pingCamera();
      const roundTripTime = Date.now() - pingStartTime;
      
      // Collect throughput data
      const throughput = await this.measureThroughput();
      
      const metric: PerformanceMetric = {
        timestamp: new Date(),
        latency: roundTripTime,
        throughput: throughput,
        packetLoss: quality.packetLoss,
        signalStrength: quality.signalStrength,
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCpuUsage()
      };
      
      this.metrics.push(metric);
      
      // Keep only last 100 measurements
      if (this.metrics.length > 100) {
        this.metrics = this.metrics.slice(-100);
      }
      
      return this.calculateCurrentMetrics();
      
    } catch (error) {
      console.error('Metrics collection failed:', error);
      throw error;
    }
  }
  
  private async pingCamera(): Promise<void> {
    // Send a small test command to measure response time
    const cameraService = await this.connection.getCameraControlService();
    await cameraService.getStatus();
  }
  
  private async measureThroughput(): Promise<number> {
    // This would measure actual data transfer rate
    // Implementation depends on available APIs
    return 1000000; // Placeholder: 1MB/s
  }
  
  private getMemoryUsage(): number {
    // Browser implementation would use performance.memory
    // Node.js would use process.memoryUsage()
    return typeof performance !== 'undefined' && 'memory' in performance
      ? (performance as any).memory.usedJSHeapSize
      : 0;
  }
  
  private getCpuUsage(): number {
    // This is a simplified estimation
    // Real implementation would need more sophisticated measurement
    return 0;
  }
  
  private calculateCurrentMetrics(): CurrentMetrics {
    if (this.metrics.length === 0) {
      throw new Error('No metrics available');
    }
    
    const recent = this.metrics.slice(-10); // Last 10 measurements
    
    return {
      averageLatency: recent.reduce((sum, m) => sum + m.latency, 0) / recent.length,
      throughput: recent[recent.length - 1].throughput,
      packetLoss: recent[recent.length - 1].packetLoss,
      signalStrength: recent[recent.length - 1].signalStrength
    };
  }
  
  generateReport(): PerformanceReport {
    return {
      metricsCount: this.metrics.length,
      timeRange: this.metrics.length > 0 
        ? { start: this.metrics[0].timestamp, end: this.metrics[this.metrics.length - 1].timestamp }
        : null,
      averageLatency: this.metrics.reduce((sum, m) => sum + m.latency, 0) / this.metrics.length,
      maxLatency: Math.max(...this.metrics.map(m => m.latency)),
      minLatency: Math.min(...this.metrics.map(m => m.latency)),
      averageThroughput: this.metrics.reduce((sum, m) => sum + m.throughput, 0) / this.metrics.length,
      averagePacketLoss: this.metrics.reduce((sum, m) => sum + m.packetLoss, 0) / this.metrics.length
    };
  }
}

interface PerformanceMetric {
  timestamp: Date;
  latency: number; // ms
  throughput: number; // bytes/second
  packetLoss: number; // percentage
  signalStrength: number; // dBm
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
}

interface CurrentMetrics {
  averageLatency: number;
  throughput: number;
  packetLoss: number;
  signalStrength: number;
}

interface PerformanceReport {
  metricsCount: number;
  timeRange: { start: Date; end: Date } | null;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  averageThroughput: number;
  averagePacketLoss: number;
}
```

## Testing and Development Tools

### 8. Testing Utilities and Mocks

```typescript
// Mock implementations for testing
export class MockCameraService implements CameraControlService {
  private status: CameraStatus;
  private settings: CameraSettings;
  private isRecording = false;
  private statusCallbacks: ((status: CameraStatus) => void)[] = [];
  private recordingCallbacks: ((recording: boolean) => void)[] = [];
  
  constructor() {
    this.status = this.createMockStatus();
    this.settings = this.createMockSettings();
  }
  
  async executeCommand(command: CameraCommand): Promise<CommandResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    
    switch (command.commandId) {
      case CameraCommandId.START_RECORDING:
        this.isRecording = true;
        this.notifyRecordingChange();
        return { success: true, commandId: command.commandId, responseCode: ResponseCode.SUCCESS };
        
      case CameraCommandId.STOP_RECORDING:
        this.isRecording = false;
        this.notifyRecordingChange();
        return { success: true, commandId: command.commandId, responseCode: ResponseCode.SUCCESS };
        
      default:
        return { 
          success: false, 
          commandId: command.commandId, 
          responseCode: ResponseCode.INVALID_COMMAND,
          errorMessage: 'Mock: Command not implemented'
        };
    }
  }
  
  async getStatus(): Promise<CameraStatus> {
    await new Promise(resolve => setTimeout(resolve, 20));
    
    this.status.recordingState.isRecording = this.isRecording;
    this.status.timestamp = Date.now();
    
    return { ...this.status }; // Return copy
  }
  
  async startRecording(): Promise<boolean> {
    const response = await this.executeCommand({
      commandId: CameraCommandId.START_RECORDING,
      parameters: {}
    });
    return response.success;
  }
  
  async stopRecording(): Promise<boolean> {
    const response = await this.executeCommand({
      commandId: CameraCommandId.STOP_RECORDING,
      parameters: {}
    });
    return response.success;
  }
  
  async updateSettings(settings: CameraSettings): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 100));
    this.settings = { ...this.settings, ...settings };
    return true;
  }
  
  async getSettings(): Promise<CameraSettings> {
    await new Promise(resolve => setTimeout(resolve, 30));
    return { ...this.settings };
  }
  
  onStatusChange(callback: (status: CameraStatus) => void): void {
    this.statusCallbacks.push(callback);
  }
  
  onRecordingStateChange(callback: (recording: boolean) => void): void {
    this.recordingCallbacks.push(callback);
  }
  
  // Mock-specific methods
  simulateStatusChange() {
    this.status.timestamp = Date.now();
    this.statusCallbacks.forEach(callback => callback(this.status));
  }
  
  simulateError(errorType: ResponseCode) {
    // Simulate various error conditions
    switch (errorType) {
      case ResponseCode.CAMERA_BUSY:
        console.log('Mock: Simulating camera busy error');
        break;
      case ResponseCode.HARDWARE_ERROR:
        console.log('Mock: Simulating hardware error');
        break;
    }
  }
  
  private notifyRecordingChange() {
    this.recordingCallbacks.forEach(callback => callback(this.isRecording));
  }
  
  private createMockStatus(): CameraStatus {
    return {
      deviceInfo: {
        model: 'Mock Camera 6K Pro',
        firmwareVersion: '2.5.0',
        serialNumber: 'MOCK123456',
        capabilities: {
          maxResolution: { width: 6144, height: 3456 },
          supportedFrameRates: [24, 25, 30, 60],
          hasOpticalZoom: true,
          hasImageStabilization: true,
          supportedCodecs: [VideoCodec.H264, VideoCodec.H265],
          maxRecordingDuration: 3600
        }
      },
      operationalState: OperationalState.IDLE,
      recordingState: {
        isRecording: false,
        recordingDuration: 0,
        remainingSpace: 64000, // 64GB
        currentCodec: VideoCodec.H264,
        currentResolution: { width: 1920, height: 1080 },
        frameRate: 30
      },
      batteryStatus: {
        level: 85,
        isCharging: false,
        estimatedTimeRemaining: 180,
        temperature: 35
      },
      storageStatus: {
        totalSpace: 128000, // 128GB
        availableSpace: 64000,
        mediaCount: 42,
        storageHealth: StorageHealth.GOOD
      },
      thermalStatus: {
        temperature: 45,
        warningLevel: 0
      },
      timestamp: Date.now()
    };
  }
  
  private createMockSettings(): CameraSettings {
    return {
      recording: {
        frameRate: 30,
        resolution: { width: 1920, height: 1080 },
        codec: VideoCodec.H264,
        bitrate: 50000000, // 50 Mbps
        quality: 'high'
      },
      image: {
        shutterSpeed: 1/60,
        iso: 800,
        aperture: 4.0,
        whiteBalance: { temperature: 5600, tint: 0 }
      },
      audio: {
        enabled: true,
        channels: 2,
        sampleRate: 48000,
        bitDepth: 24
      }
    };
  }
}

// Test scenario utilities
export class TestScenarios {
  static async simulateConnectionLoss(connectionManager: BLEConnectionManager) {
    console.log('Simulating connection loss...');
    
    // Simulate sudden disconnection
    setTimeout(() => {
      (connectionManager as any).simulateDisconnection();
    }, 2000);
  }
  
  static async simulateSlowNetwork(connection: Connection) {
    console.log('Simulating slow network conditions...');
    
    // Add artificial delay to all operations
    const originalSend = (connection as any).send;
    (connection as any).send = async function(data: any) {
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      return originalSend.call(this, data);
    };
  }
  
  static async simulateLowBattery(cameraService: MockCameraService) {
    console.log('Simulating low battery...');
    
    // Gradually reduce battery level
    const status = await cameraService.getStatus();
    status.batteryStatus.level = 15;
    status.batteryStatus.estimatedTimeRemaining = 30;
    
    cameraService.simulateStatusChange();
  }
  
  static async simulateStorageFull(cameraService: MockCameraService) {
    console.log('Simulating storage full...');
    
    const status = await cameraService.getStatus();
    status.storageStatus.availableSpace = 100; // 100MB remaining
    
    cameraService.simulateStatusChange();
  }
}

// Performance testing utilities
export class PerformanceTester {
  static async measureConnectionTime(connectionManager: BLEConnectionManager, device: BlackmagicDevice): Promise<number> {
    const startTime = Date.now();
    
    try {
      await connectionManager.connect(device);
      return Date.now() - startTime;
    } catch (error) {
      console.error('Connection test failed:', error);
      return -1;
    }
  }
  
  static async measureCommandResponseTime(cameraService: CameraControlService, command: CameraCommand): Promise<number> {
    const startTime = Date.now();
    
    try {
      await cameraService.executeCommand(command);
      return Date.now() - startTime;
    } catch (error) {
      console.error('Command test failed:', error);
      return -1;
    }
  }
  
  static async runPerformanceBenchmark(cameraService: CameraControlService): Promise<BenchmarkResults> {
    const results: BenchmarkResults = {
      commandResponseTimes: [],
      statusQueryTimes: [],
      settingsUpdateTimes: [],
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0
    };
    
    // Test command response times
    for (let i = 0; i < 10; i++) {
      const time = await this.measureCommandResponseTime(cameraService, {
        commandId: CameraCommandId.SETTINGS_UPDATE,
        parameters: { test: true }
      });
      
      if (time > 0) {
        results.commandResponseTimes.push(time);
      }
    }
    
    // Test status query times
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();
      await cameraService.getStatus();
      const time = Date.now() - startTime;
      results.statusQueryTimes.push(time);
    }
    
    // Calculate statistics
    const allTimes = [...results.commandResponseTimes, ...results.statusQueryTimes];
    results.averageResponseTime = allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;
    results.maxResponseTime = Math.max(...allTimes);
    results.minResponseTime = Math.min(...allTimes);
    
    return results;
  }
}

interface BenchmarkResults {
  commandResponseTimes: number[];
  statusQueryTimes: number[];
  settingsUpdateTimes: number[];
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
}
```

## Troubleshooting Guide

### Common Issues and Solutions

1. **Connection Failed**
   - Check if Bluetooth is enabled
   - Ensure camera is in pairing mode
   - Verify camera is within range (< 10 meters)
   - Clear Bluetooth cache if on mobile

2. **Commands Timeout**
   - Check signal strength
   - Reduce command frequency
   - Implement retry logic with exponential backoff

3. **Video Streaming Drops Frames**
   - Lower video quality/resolution
   - Check available bandwidth
   - Enable adaptive quality control
   - Optimize connection parameters

4. **Firmware Update Fails**
   - Ensure sufficient battery (>50%)
   - Verify firmware compatibility
   - Check available storage space
   - Use stable connection environment

5. **High Latency Issues**
   - Enable low latency mode
   - Optimize connection interval
   - Reduce data payload sizes
   - Use dedicated device/connection

## Best Practices Summary

1. **Always handle errors gracefully** with proper user feedback
2. **Implement connection recovery** mechanisms
3. **Use adaptive quality control** for streaming
4. **Monitor performance metrics** continuously  
5. **Test with mock services** during development
6. **Implement proper security** measures for production
7. **Optimize for battery life** when appropriate
8. **Provide clear user feedback** for all operations
9. **Use TypeScript** for type safety and better development experience
10. **Follow semantic versioning** for API compatibility

This integration guide provides practical, real-world examples for implementing Blackmagic camera control applications using TypeScript. The patterns and utilities shown here can be adapted for various use cases and deployment scenarios.

*Integration Guide Version: 1.0.0 | Last Updated: August 24, 2025*