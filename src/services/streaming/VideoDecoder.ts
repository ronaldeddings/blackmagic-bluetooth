import { EventEmitter } from 'events';
import type { ViewfinderConfig, ViewfinderFrame } from './ViewfinderService';

export interface DecodingStats {
  framesDecoded: number;
  framesDropped: number;
  averageDecodeTime: number;
  currentDecodeTime: number;
  bufferHealth: number; // 0-100%
  errorRate: number;
}

export interface DecodingOptions {
  hardwareAcceleration: boolean;
  maxBufferSize: number;
  dropFrameThreshold: number;
  qualitySettings: {
    prioritizeLatency: boolean;
    adaptiveQuality: boolean;
    maxDecodeTime: number;
  };
}

export class VideoDecoder extends EventEmitter {
  private config: ViewfinderConfig;
  private options: DecodingOptions;
  private isActive = false;
  private frameBuffer: ArrayBuffer[] = [];
  private stats: DecodingStats;
  private decodeStartTime = 0;
  private frameNumber = 0;
  
  // Performance monitoring
  private recentDecodeTimes: number[] = [];
  private maxRecentSamples = 30;

  constructor(config: ViewfinderConfig, options?: Partial<DecodingOptions>) {
    super();
    
    this.config = config;
    this.options = {
      hardwareAcceleration: true,
      maxBufferSize: 10,
      dropFrameThreshold: 100, // ms
      qualitySettings: {
        prioritizeLatency: true,
        adaptiveQuality: true,
        maxDecodeTime: 50 // ms
      },
      ...options
    };

    this.stats = {
      framesDecoded: 0,
      framesDropped: 0,
      averageDecodeTime: 0,
      currentDecodeTime: 0,
      bufferHealth: 100,
      errorRate: 0
    };

    this.initialize();
    console.log(`🎬 VideoDecoder initialized for ${config.codec} ${config.resolution.width}x${config.resolution.height}`);
  }

  /**
   * Initialize decoder based on codec
   */
  private initialize(): void {
    this.isActive = true;
    
    // Initialize codec-specific decoder
    switch (this.config.codec) {
      case 'h264':
        this.initializeH264Decoder();
        break;
      case 'mjpeg':
        this.initializeMJPEGDecoder();
        break;
      default:
        throw new Error(`Unsupported codec: ${this.config.codec}`);
    }
  }

  /**
   * Initialize H.264 decoder
   */
  private initializeH264Decoder(): void {
    console.log('🔧 Initializing H.264 decoder');
    
    // In a real implementation, this would:
    // 1. Check for hardware H.264 decoder availability
    // 2. Initialize WebCodecs VideoDecoder or fallback
    // 3. Set up SPS/PPS parameter handling
    // 4. Configure decoder for low-latency streaming
    
    if (this.options.hardwareAcceleration && this.isHardwareDecodingAvailable()) {
      console.log('✅ Hardware H.264 decoding available');
    } else {
      console.log('📱 Using software H.264 decoding');
    }
  }

  /**
   * Initialize MJPEG decoder
   */
  private initializeMJPEGDecoder(): void {
    console.log('🔧 Initializing MJPEG decoder');
    
    // MJPEG is simpler - each frame is a complete JPEG image
    // Can use browser's native JPEG decoder via Canvas/ImageBitmap
  }

  /**
   * Decode incoming data
   */
  async decodeData(data: ArrayBuffer, timestamp: number = Date.now()): Promise<void> {
    if (!this.isActive) {
      console.warn('⚠️ Decoder not active, dropping frame');
      return;
    }

    // Check buffer health
    if (this.frameBuffer.length >= this.options.maxBufferSize) {
      this.stats.framesDropped++;
      this.frameBuffer.shift(); // Drop oldest frame
      console.warn('⚠️ Frame buffer full, dropping frame');
    }

    this.frameBuffer.push(data);
    this.processNextFrame(timestamp);
  }

  /**
   * Process next frame in buffer
   */
  private async processNextFrame(timestamp: number): Promise<void> {
    if (this.frameBuffer.length === 0) return;

    const frameData = this.frameBuffer.shift()!;
    this.decodeStartTime = performance.now();

    try {
      const decodedFrame = await this.decodeFrame(frameData, timestamp);
      
      if (decodedFrame) {
        this.updateDecodeStats();
        this.emit('frame', decodedFrame);
      }
    } catch (error) {
      this.handleDecodeError(error as Error);
    }
  }

  /**
   * Decode individual frame
   */
  private async decodeFrame(data: ArrayBuffer, timestamp: number): Promise<ViewfinderFrame | null> {
    switch (this.config.codec) {
      case 'h264':
        return this.decodeH264Frame(data, timestamp);
      case 'mjpeg':
        return this.decodeMJPEGFrame(data, timestamp);
      default:
        throw new Error(`Unsupported codec: ${this.config.codec}`);
    }
  }

  /**
   * Decode H.264 frame
   */
  private async decodeH264Frame(data: ArrayBuffer, timestamp: number): Promise<ViewfinderFrame | null> {
    // In a real implementation, this would:
    // 1. Parse NAL units
    // 2. Handle SPS/PPS updates
    // 3. Decode using WebCodecs VideoDecoder or WebAssembly decoder
    // 4. Convert to desired output format
    
    // Simulate decode time
    await this.simulateDecoding(20);

    return {
      deviceId: '', // Will be set by ViewfinderService
      streamId: '', // Will be set by ViewfinderService
      frameNumber: this.frameNumber++,
      timestamp,
      data: data, // In reality, this would be decoded pixel data
      width: this.config.resolution.width,
      height: this.config.resolution.height,
      format: 'yuv420p'
    };
  }

  /**
   * Decode MJPEG frame
   */
  private async decodeMJPEGFrame(data: ArrayBuffer, timestamp: number): Promise<ViewfinderFrame | null> {
    try {
      // Convert ArrayBuffer to Blob
      const blob = new Blob([data], { type: 'image/jpeg' });
      
      // Create ImageBitmap for efficient decoding
      const imageBitmap = await createImageBitmap(blob);
      
      // Convert to pixel data (in real implementation)
      // For now, we'll use the original data
      
      return {
        deviceId: '', // Will be set by ViewfinderService
        streamId: '', // Will be set by ViewfinderService
        frameNumber: this.frameNumber++,
        timestamp,
        data: data, // In reality, this would be decoded pixel data
        width: imageBitmap.width,
        height: imageBitmap.height,
        format: 'rgb24'
      };
    } catch (error) {
      console.error('❌ MJPEG decode error:', error);
      return null;
    }
  }

  /**
   * Update decoding statistics
   */
  private updateDecodeStats(): void {
    const decodeTime = performance.now() - this.decodeStartTime;
    
    this.stats.currentDecodeTime = decodeTime;
    this.stats.framesDecoded++;
    
    // Track recent decode times
    this.recentDecodeTimes.push(decodeTime);
    if (this.recentDecodeTimes.length > this.maxRecentSamples) {
      this.recentDecodeTimes.shift();
    }
    
    // Calculate average
    this.stats.averageDecodeTime = 
      this.recentDecodeTimes.reduce((a, b) => a + b, 0) / this.recentDecodeTimes.length;
    
    // Update buffer health
    this.stats.bufferHealth = Math.max(0, 100 - (this.frameBuffer.length / this.options.maxBufferSize * 100));
    
    // Calculate error rate
    const totalFrames = this.stats.framesDecoded + this.stats.framesDropped;
    this.stats.errorRate = totalFrames > 0 ? (this.stats.framesDropped / totalFrames) * 100 : 0;

    // Adaptive quality adjustment
    if (this.options.qualitySettings.adaptiveQuality) {
      this.adjustQualityBasedOnPerformance();
    }
  }

  /**
   * Adjust quality based on performance
   */
  private adjustQualityBasedOnPerformance(): void {
    const { maxDecodeTime, prioritizeLatency } = this.options.qualitySettings;
    
    if (prioritizeLatency && this.stats.averageDecodeTime > maxDecodeTime) {
      // In a real implementation, this might:
      // 1. Request lower resolution from source
      // 2. Skip B-frames in H.264
      // 3. Reduce decode quality
      console.log('📉 Adjusting quality for better latency');
    }
    
    if (this.stats.bufferHealth < 20) {
      // Buffer is getting full, might need to drop frames or reduce quality
      console.log('📊 Buffer health low, considering quality reduction');
    }
  }

  /**
   * Handle decode errors
   */
  private handleDecodeError(error: Error): void {
    console.error('❌ Decode error:', error);
    this.stats.framesDropped++;
    this.emit('error', error);
  }

  /**
   * Check hardware decoding availability
   */
  private isHardwareDecodingAvailable(): boolean {
    // In a real implementation, this would check:
    // 1. VideoDecoder API availability
    // 2. Hardware codec support
    // 3. Platform-specific acceleration
    return typeof VideoDecoder !== 'undefined';
  }

  /**
   * Simulate decoding delay for demo
   */
  private async simulateDecoding(maxMs: number): Promise<void> {
    const delay = Math.random() * maxMs;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Get current decoding statistics
   */
  getStats(): DecodingStats {
    return { ...this.stats };
  }

  /**
   * Update decoder configuration
   */
  updateConfig(config: Partial<ViewfinderConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    
    // Check if we need to reinitialize
    const needsReinit = (
      oldConfig.codec !== this.config.codec ||
      oldConfig.resolution.width !== this.config.resolution.width ||
      oldConfig.resolution.height !== this.config.resolution.height
    );
    
    if (needsReinit) {
      this.reinitialize();
    }
    
    console.log('⚙️ Decoder config updated:', this.config);
  }

  /**
   * Reinitialize decoder with new configuration
   */
  private reinitialize(): void {
    this.frameBuffer = [];
    this.frameNumber = 0;
    this.recentDecodeTimes = [];
    
    // Reset stats but keep cumulative counters
    this.stats.currentDecodeTime = 0;
    this.stats.averageDecodeTime = 0;
    this.stats.bufferHealth = 100;
    
    this.initialize();
    console.log('🔄 Decoder reinitialized');
  }

  /**
   * Pause decoding
   */
  pause(): void {
    this.isActive = false;
    console.log('⏸️ Decoder paused');
  }

  /**
   * Resume decoding
   */
  resume(): void {
    this.isActive = true;
    console.log('▶️ Decoder resumed');
  }

  /**
   * Destroy decoder and cleanup resources
   */
  destroy(): void {
    this.isActive = false;
    this.frameBuffer = [];
    this.recentDecodeTimes = [];
    this.removeAllListeners();
    
    console.log('🧹 VideoDecoder destroyed');
  }
}

export default VideoDecoder;