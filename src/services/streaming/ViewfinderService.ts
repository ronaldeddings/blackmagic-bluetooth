import { EventEmitter } from 'events';
import type { BluetoothDevice } from '../../types';
import { VideoDecoder } from './VideoDecoder';
import { StreamConfigManager } from './StreamConfigManager';

export interface ViewfinderConfig {
  resolution: {
    width: number;
    height: number;
  };
  quality: 'low' | 'medium' | 'high' | 'ultra';
  framerate: number;
  bitrate?: number;
  codec: 'h264' | 'mjpeg';
}

export interface StreamInfo {
  deviceId: string;
  config: ViewfinderConfig;
  isActive: boolean;
  streamId: string;
  startTime: Date;
  lastFrameTime?: Date;
  frameCount: number;
  droppedFrames: number;
  averageBitrate: number;
  currentBitrate: number;
  latency: number;
}

export interface ViewfinderFrame {
  deviceId: string;
  streamId: string;
  frameNumber: number;
  timestamp: number;
  data: ArrayBuffer;
  width: number;
  height: number;
  format: 'yuv420p' | 'nv12' | 'rgb24';
}

export class ViewfinderService extends EventEmitter {
  private streams: Map<string, StreamInfo> = new Map();
  private decoders: Map<string, VideoDecoder> = new Map();
  private configManager: StreamConfigManager;
  private activeStreamCount = 0;
  private maxConcurrentStreams = 8;
  private streamStartDelay = 100; // ms between stream starts

  constructor() {
    super();
    this.configManager = new StreamConfigManager();
    console.log('🎥 ViewfinderService initialized');
  }

  /**
   * Start viewfinder stream for a device
   */
  async startStream(deviceId: string, device: BluetoothDevice, config?: Partial<ViewfinderConfig>): Promise<StreamInfo> {
    if (this.streams.has(deviceId)) {
      throw new Error(`Stream already active for device ${deviceId}`);
    }

    if (this.activeStreamCount >= this.maxConcurrentStreams) {
      throw new Error(`Maximum concurrent streams (${this.maxConcurrentStreams}) reached`);
    }

    try {
      // Apply staggered start to prevent resource contention
      if (this.activeStreamCount > 0) {
        await this.delay(this.streamStartDelay);
      }

      const optimizedConfig = await this.configManager.optimizeConfigForDevice(deviceId, config);
      const streamId = this.generateStreamId(deviceId);

      const streamInfo: StreamInfo = {
        deviceId,
        config: optimizedConfig,
        isActive: false,
        streamId,
        startTime: new Date(),
        frameCount: 0,
        droppedFrames: 0,
        averageBitrate: 0,
        currentBitrate: 0,
        latency: 0
      };

      // Initialize video decoder
      const decoder = new VideoDecoder(optimizedConfig);
      decoder.on('frame', (frame: ViewfinderFrame) => {
        this.handleDecodedFrame(deviceId, frame);
      });
      decoder.on('error', (error: Error) => {
        this.handleDecoderError(deviceId, error);
      });

      this.decoders.set(deviceId, decoder);
      this.streams.set(deviceId, streamInfo);

      // Start the actual stream
      await this.initializeStream(deviceId, device, optimizedConfig);
      
      streamInfo.isActive = true;
      this.activeStreamCount++;

      this.emit('stream-started', { deviceId, streamInfo });
      console.log(`🎥 Started viewfinder stream for ${deviceId}:`, optimizedConfig);

      return streamInfo;

    } catch (error) {
      // Cleanup on failure
      this.decoders.delete(deviceId);
      this.streams.delete(deviceId);
      console.error(`❌ Failed to start stream for ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Stop viewfinder stream for a device
   */
  async stopStream(deviceId: string): Promise<void> {
    const streamInfo = this.streams.get(deviceId);
    if (!streamInfo) {
      console.warn(`⚠️ No stream found for device ${deviceId}`);
      return;
    }

    try {
      // Stop the stream
      await this.terminateStream(deviceId);
      
      // Cleanup decoder
      const decoder = this.decoders.get(deviceId);
      if (decoder) {
        decoder.destroy();
        this.decoders.delete(deviceId);
      }

      // Update state
      streamInfo.isActive = false;
      this.streams.delete(deviceId);
      this.activeStreamCount = Math.max(0, this.activeStreamCount - 1);

      this.emit('stream-stopped', { deviceId, streamInfo });
      console.log(`🛑 Stopped viewfinder stream for ${deviceId}`);

    } catch (error) {
      console.error(`❌ Error stopping stream for ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Stop all active streams
   */
  async stopAllStreams(): Promise<void> {
    const activeDeviceIds = Array.from(this.streams.keys());
    
    await Promise.all(
      activeDeviceIds.map(deviceId => 
        this.stopStream(deviceId).catch(error => {
          console.error(`Error stopping stream ${deviceId}:`, error);
        })
      )
    );

    console.log('🛑 All viewfinder streams stopped');
  }

  /**
   * Update stream configuration
   */
  async updateStreamConfig(deviceId: string, config: Partial<ViewfinderConfig>): Promise<void> {
    const streamInfo = this.streams.get(deviceId);
    if (!streamInfo) {
      throw new Error(`No active stream for device ${deviceId}`);
    }

    const newConfig = { ...streamInfo.config, ...config };
    const optimizedConfig = await this.configManager.optimizeConfigForDevice(deviceId, newConfig);

    // Update decoder if codec or resolution changed
    const decoder = this.decoders.get(deviceId);
    if (decoder && this.needsDecoderRecreation(streamInfo.config, optimizedConfig)) {
      decoder.destroy();
      
      const newDecoder = new VideoDecoder(optimizedConfig);
      newDecoder.on('frame', (frame: ViewfinderFrame) => {
        this.handleDecodedFrame(deviceId, frame);
      });
      newDecoder.on('error', (error: Error) => {
        this.handleDecoderError(deviceId, error);
      });

      this.decoders.set(deviceId, newDecoder);
    }

    // Apply configuration to device
    await this.applyConfigToDevice(deviceId, optimizedConfig);
    
    streamInfo.config = optimizedConfig;
    this.emit('stream-config-updated', { deviceId, config: optimizedConfig });
    
    console.log(`⚙️ Updated stream config for ${deviceId}:`, optimizedConfig);
  }

  /**
   * Get stream information
   */
  getStreamInfo(deviceId: string): StreamInfo | undefined {
    return this.streams.get(deviceId);
  }

  /**
   * Get all active streams
   */
  getActiveStreams(): StreamInfo[] {
    return Array.from(this.streams.values()).filter(stream => stream.isActive);
  }

  /**
   * Get stream statistics
   */
  getStreamStats(deviceId: string): Partial<StreamInfo> | undefined {
    const stream = this.streams.get(deviceId);
    if (!stream) return undefined;

    return {
      frameCount: stream.frameCount,
      droppedFrames: stream.droppedFrames,
      averageBitrate: stream.averageBitrate,
      currentBitrate: stream.currentBitrate,
      latency: stream.latency,
      lastFrameTime: stream.lastFrameTime
    };
  }

  /**
   * Set maximum concurrent streams
   */
  setMaxConcurrentStreams(max: number): void {
    this.maxConcurrentStreams = Math.max(1, Math.min(max, 16));
    console.log(`📊 Max concurrent streams set to ${this.maxConcurrentStreams}`);
  }

  /**
   * Initialize stream with device
   */
  private async initializeStream(deviceId: string, device: BluetoothDevice, config: ViewfinderConfig): Promise<void> {
    // This would typically involve:
    // 1. Sending stream configuration to camera
    // 2. Setting up data reception pipeline
    // 3. Starting data flow
    
    console.log(`🔧 Initializing stream for ${deviceId} with config:`, config);
    
    // Simulate stream initialization
    await this.delay(100);
  }

  /**
   * Terminate stream
   */
  private async terminateStream(deviceId: string): Promise<void> {
    console.log(`🔧 Terminating stream for ${deviceId}`);
    // This would send stop command to camera
    await this.delay(50);
  }

  /**
   * Apply configuration to device
   */
  private async applyConfigToDevice(deviceId: string, config: ViewfinderConfig): Promise<void> {
    console.log(`🔧 Applying config to ${deviceId}:`, config);
    // This would send configuration commands to camera
    await this.delay(50);
  }

  /**
   * Handle decoded frame from video decoder
   */
  private handleDecodedFrame(deviceId: string, frame: ViewfinderFrame): void {
    const streamInfo = this.streams.get(deviceId);
    if (!streamInfo) return;

    // Update statistics
    streamInfo.frameCount++;
    streamInfo.lastFrameTime = new Date();
    
    // Calculate latency (simplified)
    streamInfo.latency = Date.now() - frame.timestamp;

    // Emit frame event
    this.emit('frame', {
      deviceId,
      frame,
      streamInfo
    });
  }

  /**
   * Handle decoder errors
   */
  private handleDecoderError(deviceId: string, error: Error): void {
    console.error(`❌ Decoder error for ${deviceId}:`, error);
    
    const streamInfo = this.streams.get(deviceId);
    if (streamInfo) {
      streamInfo.droppedFrames++;
    }

    this.emit('decoder-error', { deviceId, error });
  }

  /**
   * Check if decoder needs recreation for config change
   */
  private needsDecoderRecreation(oldConfig: ViewfinderConfig, newConfig: ViewfinderConfig): boolean {
    return (
      oldConfig.codec !== newConfig.codec ||
      oldConfig.resolution.width !== newConfig.resolution.width ||
      oldConfig.resolution.height !== newConfig.resolution.height
    );
  }

  /**
   * Generate unique stream ID
   */
  private generateStreamId(deviceId: string): string {
    return `stream_${deviceId.slice(-8)}_${Date.now()}`;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.stopAllStreams().catch(error => {
      console.error('Error during ViewfinderService destruction:', error);
    });

    this.decoders.forEach(decoder => decoder.destroy());
    this.decoders.clear();
    this.streams.clear();
    
    this.removeAllListeners();
    console.log('🧹 ViewfinderService destroyed');
  }
}

export default ViewfinderService;