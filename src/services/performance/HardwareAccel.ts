import { EventEmitter } from 'events';

export interface HardwareCapabilities {
  gpu: {
    vendor: string;
    model: string;
    memoryMB: number;
    supportsWebGL: boolean;
    supportsWebGL2: boolean;
    supportsWebGPU: boolean;
    maxTextureSize: number;
    extensions: string[];
  };
  cpu: {
    cores: number;
    threads: number;
    architecture: string;
    features: string[]; // SIMD, AVX, etc.
  };
  memory: {
    totalMB: number;
    availableMB: number;
    type: string;
  };
  display: {
    supportsHDR: boolean;
    maxRefreshRate: number;
    colorSpaces: string[];
  };
}

export interface AccelerationContext {
  id: string;
  type: 'webgl' | 'webgl2' | 'webgpu' | 'canvas2d' | 'offscreen';
  canvas: HTMLCanvasElement | OffscreenCanvas;
  context: WebGLRenderingContext | WebGL2RenderingContext | GPUDevice | CanvasRenderingContext2D | null;
  isActive: boolean;
  performance: {
    framesProcessed: number;
    averageFrameTime: number;
    lastFrameTime: number;
    errorCount: number;
  };
  capabilities: Partial<HardwareCapabilities>;
}

export interface VideoProcessingPipeline {
  id: string;
  name: string;
  stages: ProcessingStage[];
  inputFormat: VideoFormat;
  outputFormat: VideoFormat;
  context: AccelerationContext;
  isActive: boolean;
  performance: {
    throughputMBps: number;
    latencyMs: number;
    frameDrops: number;
    qualityScore: number; // 0-100
  };
}

export interface ProcessingStage {
  id: string;
  name: string;
  type: 'decode' | 'colorspace' | 'scale' | 'filter' | 'encode' | 'composite';
  shader?: WebGLShader | string;
  uniforms?: Record<string, any>;
  enabled: boolean;
  performance: {
    processingTimeMs: number;
    memoryUsageMB: number;
  };
}

export interface VideoFormat {
  width: number;
  height: number;
  pixelFormat: 'RGBA' | 'YUV420' | 'YUV422' | 'RGB24' | 'NV12';
  colorSpace: 'sRGB' | 'Rec709' | 'Rec2020' | 'P3';
  framerate: number;
  bitDepth: 8 | 10 | 12 | 16;
}

export interface AccelerationProfile {
  id: string;
  name: string;
  description: string;
  targetUseCase: 'streaming' | 'recording' | 'preview' | 'analysis';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  gpuUtilization: number; // 0-100
  cpuUtilization: number; // 0-100
  memoryUsageMB: number;
  powerConsumption: 'low' | 'medium' | 'high';
  settings: {
    enableGPU: boolean;
    preferWebGL2: boolean;
    useOffscreenCanvas: boolean;
    parallelProcessing: boolean;
    cacheTextures: boolean;
    adaptiveQuality: boolean;
  };
}

export class HardwareAccelerator extends EventEmitter {
  private capabilities: HardwareCapabilities | null = null;
  private contexts: Map<string, AccelerationContext> = new Map();
  private pipelines: Map<string, VideoProcessingPipeline> = new Map();
  private profiles: Map<string, AccelerationProfile> = new Map();
  private activeProfile: AccelerationProfile | null = null;
  private isInitialized = false;
  private performanceMonitor: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeProfiles();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.detectHardwareCapabilities();
      await this.createDefaultContexts();
      await this.selectOptimalProfile();
      
      this.startPerformanceMonitoring();
      this.isInitialized = true;
      
      this.emit('initialized', { capabilities: this.capabilities });
    } catch (error) {
      this.emit('initialization-failed', error);
      throw error;
    }
  }

  private async detectHardwareCapabilities(): Promise<void> {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    // Detect GPU capabilities
    const gpu = {
      vendor: 'unknown',
      model: 'unknown',
      memoryMB: 0,
      supportsWebGL: !!canvas.getContext('webgl'),
      supportsWebGL2: !!canvas.getContext('webgl2'),
      supportsWebGPU: 'gpu' in navigator,
      maxTextureSize: 0,
      extensions: [] as string[]
    };

    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpu.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown';
        gpu.model = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
      }
      
      gpu.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      
      const supportedExtensions = gl.getSupportedExtensions() || [];
      gpu.extensions = supportedExtensions;
      
      // Try to estimate GPU memory (this is approximate)
      const memoryInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (memoryInfo) {
        // This is a rough estimation - actual GPU memory detection requires more complex techniques
        gpu.memoryMB = gpu.maxTextureSize > 8192 ? 4096 : 2048;
      }
    }

    // Detect CPU capabilities
    const cpu = {
      cores: navigator.hardwareConcurrency || 4,
      threads: navigator.hardwareConcurrency || 4,
      architecture: this.detectCPUArchitecture(),
      features: this.detectCPUFeatures()
    };

    // Detect memory (rough estimation)
    const memory = {
      totalMB: this.estimateSystemMemory(),
      availableMB: this.estimateSystemMemory() * 0.7, // Assume 70% available
      type: 'DDR4' // Default assumption
    };

    // Detect display capabilities
    const display = {
      supportsHDR: this.detectHDRSupport(),
      maxRefreshRate: this.detectMaxRefreshRate(),
      colorSpaces: this.detectColorSpaceSupport()
    };

    this.capabilities = { gpu, cpu, memory, display };
  }

  private detectCPUArchitecture(): string {
    // This is a simplified detection - actual CPU architecture detection is more complex
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('arm') || userAgent.includes('aarch64')) {
      return 'ARM';
    } else if (userAgent.includes('x86_64') || userAgent.includes('amd64')) {
      return 'x86_64';
    } else if (userAgent.includes('x86')) {
      return 'x86';
    }
    return 'unknown';
  }

  private detectCPUFeatures(): string[] {
    // Simplified feature detection - real implementation would use more sophisticated methods
    const features: string[] = [];
    
    // Check for SIMD support (very basic check)
    if (typeof SharedArrayBuffer !== 'undefined') {
      features.push('SharedArrayBuffer');
    }
    
    if (typeof WebAssembly !== 'undefined') {
      features.push('WebAssembly');
    }
    
    return features;
  }

  private estimateSystemMemory(): number {
    // Rough estimation based on device characteristics
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory) {
      return deviceMemory * 1024; // deviceMemory is in GB
    }
    
    // Fallback estimation based on other factors
    const cores = navigator.hardwareConcurrency || 4;
    if (cores >= 8) return 16 * 1024; // 16GB for high-end devices
    if (cores >= 4) return 8 * 1024;  // 8GB for mid-range
    return 4 * 1024; // 4GB for low-end
  }

  private detectHDRSupport(): boolean {
    // Check for HDR support
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (ctx && 'colorSpace' in ctx.getContextAttributes()) {
      return true;
    }
    
    return 'screen' in window && 'colorDepth' in screen && screen.colorDepth > 24;
  }

  private detectMaxRefreshRate(): number {
    if ('screen' in window && 'refreshRate' in screen) {
      return (screen as any).refreshRate || 60;
    }
    return 60; // Default assumption
  }

  private detectColorSpaceSupport(): string[] {
    const colorSpaces = ['srgb']; // Default
    
    // Check for P3 support
    const canvas = document.createElement('canvas');
    try {
      const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
      if (ctx) colorSpaces.push('display-p3');
    } catch (e) {
      // P3 not supported
    }
    
    // Check for Rec2020 support
    try {
      const ctx = canvas.getContext('2d', { colorSpace: 'rec2020' });
      if (ctx) colorSpaces.push('rec2020');
    } catch (e) {
      // Rec2020 not supported
    }
    
    return colorSpaces;
  }

  private async createDefaultContexts(): Promise<void> {
    if (!this.capabilities) return;

    // Create WebGL2 context if supported
    if (this.capabilities.gpu.supportsWebGL2) {
      await this.createContext('webgl2', 'default-webgl2');
    }
    
    // Create WebGL context as fallback
    if (this.capabilities.gpu.supportsWebGL) {
      await this.createContext('webgl', 'default-webgl');
    }
    
    // Create offscreen context for background processing
    if ('OffscreenCanvas' in window) {
      await this.createContext('offscreen', 'background-processing');
    }
    
    // Always create 2D context for fallback
    await this.createContext('canvas2d', 'fallback-2d');
  }

  private async createContext(type: AccelerationContext['type'], id: string): Promise<string> {
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let context: any = null;

    if (type === 'offscreen' && 'OffscreenCanvas' in window) {
      canvas = new OffscreenCanvas(1920, 1080);
    } else {
      canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
    }

    try {
      switch (type) {
        case 'webgl2':
          context = canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
          });
          break;
        case 'webgl':
          context = canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
          });
          break;
        case 'webgpu':
          if ('gpu' in navigator) {
            const adapter = await (navigator as any).gpu.requestAdapter();
            context = await adapter?.requestDevice();
          }
          break;
        case 'canvas2d':
        case 'offscreen':
          context = canvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
            colorSpace: 'srgb'
          });
          break;
      }

      if (!context) {
        throw new Error(`Failed to create ${type} context`);
      }

      const accelContext: AccelerationContext = {
        id,
        type,
        canvas,
        context,
        isActive: false,
        performance: {
          framesProcessed: 0,
          averageFrameTime: 0,
          lastFrameTime: 0,
          errorCount: 0
        },
        capabilities: this.capabilities || {}
      };

      this.contexts.set(id, accelContext);
      this.emit('context-created', { id, type });
      
      return id;
    } catch (error) {
      this.emit('context-creation-failed', { id, type, error });
      throw error;
    }
  }

  private initializeProfiles(): void {
    const profiles: AccelerationProfile[] = [
      {
        id: 'low-power',
        name: 'Low Power',
        description: 'Minimal GPU usage, optimized for battery life',
        targetUseCase: 'preview',
        quality: 'low',
        gpuUtilization: 20,
        cpuUtilization: 40,
        memoryUsageMB: 128,
        powerConsumption: 'low',
        settings: {
          enableGPU: true,
          preferWebGL2: false,
          useOffscreenCanvas: false,
          parallelProcessing: false,
          cacheTextures: true,
          adaptiveQuality: true
        }
      },
      {
        id: 'balanced',
        name: 'Balanced',
        description: 'Good balance of performance and power consumption',
        targetUseCase: 'streaming',
        quality: 'medium',
        gpuUtilization: 60,
        cpuUtilization: 50,
        memoryUsageMB: 256,
        powerConsumption: 'medium',
        settings: {
          enableGPU: true,
          preferWebGL2: true,
          useOffscreenCanvas: true,
          parallelProcessing: true,
          cacheTextures: true,
          adaptiveQuality: true
        }
      },
      {
        id: 'high-performance',
        name: 'High Performance',
        description: 'Maximum performance for professional use',
        targetUseCase: 'recording',
        quality: 'high',
        gpuUtilization: 90,
        cpuUtilization: 70,
        memoryUsageMB: 512,
        powerConsumption: 'high',
        settings: {
          enableGPU: true,
          preferWebGL2: true,
          useOffscreenCanvas: true,
          parallelProcessing: true,
          cacheTextures: true,
          adaptiveQuality: false
        }
      },
      {
        id: 'ultra-quality',
        name: 'Ultra Quality',
        description: 'Highest quality settings for content creation',
        targetUseCase: 'analysis',
        quality: 'ultra',
        gpuUtilization: 95,
        cpuUtilization: 80,
        memoryUsageMB: 1024,
        powerConsumption: 'high',
        settings: {
          enableGPU: true,
          preferWebGL2: true,
          useOffscreenCanvas: true,
          parallelProcessing: true,
          cacheTextures: false, // Always fresh data for analysis
          adaptiveQuality: false
        }
      }
    ];

    profiles.forEach(profile => {
      this.profiles.set(profile.id, profile);
    });
  }

  private async selectOptimalProfile(): Promise<void> {
    if (!this.capabilities) return;

    const { gpu, cpu, memory } = this.capabilities;
    let selectedProfileId = 'balanced'; // default

    // Select profile based on hardware capabilities
    if (gpu.memoryMB >= 4096 && cpu.cores >= 8 && memory.totalMB >= 16384) {
      selectedProfileId = 'ultra-quality';
    } else if (gpu.memoryMB >= 2048 && cpu.cores >= 6 && memory.totalMB >= 8192) {
      selectedProfileId = 'high-performance';
    } else if (gpu.memoryMB >= 1024 && cpu.cores >= 4 && memory.totalMB >= 4096) {
      selectedProfileId = 'balanced';
    } else {
      selectedProfileId = 'low-power';
    }

    await this.setProfile(selectedProfileId);
  }

  async setProfile(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    this.activeProfile = profile;
    
    // Configure contexts based on profile
    await this.applyProfileSettings(profile);
    
    this.emit('profile-changed', { profile });
  }

  private async applyProfileSettings(profile: AccelerationProfile): Promise<void> {
    // Enable/disable GPU acceleration
    for (const context of this.contexts.values()) {
      if (context.type.includes('webgl') || context.type === 'webgpu') {
        context.isActive = profile.settings.enableGPU;
      }
    }

    // Prefer WebGL2 if specified
    if (profile.settings.preferWebGL2) {
      const webgl2Context = Array.from(this.contexts.values())
        .find(ctx => ctx.type === 'webgl2');
      if (webgl2Context) {
        webgl2Context.isActive = true;
      }
    }

    // Configure parallel processing
    if (profile.settings.parallelProcessing && 'OffscreenCanvas' in window) {
      const offscreenContext = Array.from(this.contexts.values())
        .find(ctx => ctx.type === 'offscreen');
      if (offscreenContext) {
        offscreenContext.isActive = true;
      }
    }
  }

  async createVideoProcessingPipeline(
    name: string,
    inputFormat: VideoFormat,
    outputFormat: VideoFormat,
    stages: Omit<ProcessingStage, 'id' | 'performance'>[]
  ): Promise<string> {
    const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Select best context for this pipeline
    const context = this.selectBestContext(inputFormat, outputFormat);
    if (!context) {
      throw new Error('No suitable acceleration context available');
    }

    // Create processing stages
    const processedStages: ProcessingStage[] = stages.map((stage, index) => ({
      ...stage,
      id: `${pipelineId}-stage-${index}`,
      performance: {
        processingTimeMs: 0,
        memoryUsageMB: 0
      }
    }));

    const pipeline: VideoProcessingPipeline = {
      id: pipelineId,
      name,
      stages: processedStages,
      inputFormat,
      outputFormat,
      context,
      isActive: false,
      performance: {
        throughputMBps: 0,
        latencyMs: 0,
        frameDrops: 0,
        qualityScore: 0
      }
    };

    this.pipelines.set(pipelineId, pipeline);
    this.emit('pipeline-created', { pipelineId, pipeline });
    
    return pipelineId;
  }

  private selectBestContext(inputFormat: VideoFormat, outputFormat: VideoFormat): AccelerationContext | null {
    if (!this.activeProfile?.settings.enableGPU) {
      return Array.from(this.contexts.values()).find(ctx => ctx.type === 'canvas2d') || null;
    }

    // Prefer WebGL2 for complex processing
    if (this.activeProfile.settings.preferWebGL2) {
      const webgl2 = Array.from(this.contexts.values()).find(ctx => ctx.type === 'webgl2' && ctx.isActive);
      if (webgl2) return webgl2;
    }

    // Fallback to WebGL
    const webgl = Array.from(this.contexts.values()).find(ctx => ctx.type === 'webgl' && ctx.isActive);
    if (webgl) return webgl;

    // Final fallback to Canvas2D
    return Array.from(this.contexts.values()).find(ctx => ctx.type === 'canvas2d') || null;
  }

  async processFrame(pipelineId: string, frameData: ImageData | ArrayBuffer): Promise<ImageData | ArrayBuffer> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline || !pipeline.isActive) {
      throw new Error(`Pipeline ${pipelineId} not found or not active`);
    }

    const startTime = performance.now();
    let processedData = frameData;

    try {
      // Process through each stage
      for (const stage of pipeline.stages) {
        if (stage.enabled) {
          const stageStartTime = performance.now();
          processedData = await this.processStage(stage, processedData, pipeline.context);
          const stageTime = performance.now() - stageStartTime;
          
          // Update stage performance
          stage.performance.processingTimeMs = stageTime;
        }
      }

      // Update pipeline performance
      const totalTime = performance.now() - startTime;
      pipeline.performance.latencyMs = totalTime;
      pipeline.performance.throughputMBps = this.calculateThroughput(frameData, totalTime);
      
      // Update context performance
      pipeline.context.performance.framesProcessed++;
      pipeline.context.performance.lastFrameTime = totalTime;
      pipeline.context.performance.averageFrameTime = 
        (pipeline.context.performance.averageFrameTime * (pipeline.context.performance.framesProcessed - 1) + totalTime) /
        pipeline.context.performance.framesProcessed;

      return processedData;
    } catch (error) {
      pipeline.context.performance.errorCount++;
      pipeline.performance.frameDrops++;
      this.emit('processing-error', { pipelineId, error });
      throw error;
    }
  }

  private async processStage(
    stage: ProcessingStage,
    data: ImageData | ArrayBuffer,
    context: AccelerationContext
  ): Promise<ImageData | ArrayBuffer> {
    // This is a simplified implementation - real processing would depend on the stage type and context
    switch (stage.type) {
      case 'decode':
        return this.processDecodeStage(stage, data, context);
      case 'colorspace':
        return this.processColorspaceStage(stage, data, context);
      case 'scale':
        return this.processScaleStage(stage, data, context);
      case 'filter':
        return this.processFilterStage(stage, data, context);
      case 'encode':
        return this.processEncodeStage(stage, data, context);
      case 'composite':
        return this.processCompositeStage(stage, data, context);
      default:
        return data;
    }
  }

  private async processDecodeStage(stage: ProcessingStage, data: ImageData | ArrayBuffer, context: AccelerationContext): Promise<ImageData | ArrayBuffer> {
    // Simplified decode implementation
    if (data instanceof ArrayBuffer) {
      // Convert ArrayBuffer to ImageData (this would typically involve actual decoding)
      const canvas = context.canvas;
      const ctx = context.context as CanvasRenderingContext2D;
      if (ctx && canvas instanceof HTMLCanvasElement) {
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    }
    return data;
  }

  private async processColorspaceStage(stage: ProcessingStage, data: ImageData | ArrayBuffer, context: AccelerationContext): Promise<ImageData | ArrayBuffer> {
    // Simplified colorspace conversion
    return data;
  }

  private async processScaleStage(stage: ProcessingStage, data: ImageData | ArrayBuffer, context: AccelerationContext): Promise<ImageData | ArrayBuffer> {
    // Simplified scaling
    return data;
  }

  private async processFilterStage(stage: ProcessingStage, data: ImageData | ArrayBuffer, context: AccelerationContext): Promise<ImageData | ArrayBuffer> {
    // Simplified filtering
    return data;
  }

  private async processEncodeStage(stage: ProcessingStage, data: ImageData | ArrayBuffer, context: AccelerationContext): Promise<ImageData | ArrayBuffer> {
    // Simplified encoding
    return data;
  }

  private async processCompositeStage(stage: ProcessingStage, data: ImageData | ArrayBuffer, context: AccelerationContext): Promise<ImageData | ArrayBuffer> {
    // Simplified compositing
    return data;
  }

  private calculateThroughput(data: ImageData | ArrayBuffer, processingTimeMs: number): number {
    const dataSize = data instanceof ImageData ? 
      data.data.length : data.byteLength;
    const sizeInMB = dataSize / (1024 * 1024);
    const timeInSeconds = processingTimeMs / 1000;
    return timeInSeconds > 0 ? sizeInMB / timeInSeconds : 0;
  }

  private startPerformanceMonitoring(): void {
    this.performanceMonitor = setInterval(() => {
      const stats = this.getPerformanceStats();
      this.emit('performance-update', stats);
      
      // Auto-adjust profile if needed
      if (this.activeProfile && this.shouldAdjustProfile(stats)) {
        this.autoAdjustProfile(stats);
      }
    }, 5000);
  }

  private shouldAdjustProfile(stats: any): boolean {
    // Implement logic to determine if profile adjustment is needed
    // For example, if performance is consistently poor, downgrade profile
    return false; // Simplified
  }

  private autoAdjustProfile(stats: any): void {
    // Implement automatic profile adjustment logic
    // This could downgrade to a lower performance profile if resources are constrained
  }

  getPerformanceStats() {
    const contextStats = Array.from(this.contexts.entries()).map(([id, context]) => ({
      id,
      type: context.type,
      isActive: context.isActive,
      performance: context.performance
    }));

    const pipelineStats = Array.from(this.pipelines.entries()).map(([id, pipeline]) => ({
      id,
      name: pipeline.name,
      isActive: pipeline.isActive,
      performance: pipeline.performance,
      stageCount: pipeline.stages.length
    }));

    return {
      capabilities: this.capabilities,
      activeProfile: this.activeProfile,
      contexts: contextStats,
      pipelines: pipelineStats,
      isInitialized: this.isInitialized
    };
  }

  getCapabilities(): HardwareCapabilities | null {
    return this.capabilities;
  }

  getProfiles(): AccelerationProfile[] {
    return Array.from(this.profiles.values());
  }

  getActiveProfile(): AccelerationProfile | null {
    return this.activeProfile;
  }

  getContexts(): AccelerationContext[] {
    return Array.from(this.contexts.values());
  }

  getPipelines(): VideoProcessingPipeline[] {
    return Array.from(this.pipelines.values());
  }

  async activatePipeline(pipelineId: string): Promise<void> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    pipeline.isActive = true;
    this.emit('pipeline-activated', { pipelineId });
  }

  async deactivatePipeline(pipelineId: string): Promise<void> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    pipeline.isActive = false;
    this.emit('pipeline-deactivated', { pipelineId });
  }

  async destroyPipeline(pipelineId: string): Promise<void> {
    const pipeline = this.pipelines.get(pipelineId);
    if (pipeline) {
      pipeline.isActive = false;
      this.pipelines.delete(pipelineId);
      this.emit('pipeline-destroyed', { pipelineId });
    }
  }

  destroy(): void {
    if (this.performanceMonitor) {
      clearInterval(this.performanceMonitor);
      this.performanceMonitor = null;
    }

    // Clean up contexts
    for (const context of this.contexts.values()) {
      context.isActive = false;
      // Additional cleanup would go here
    }

    this.contexts.clear();
    this.pipelines.clear();
    this.isInitialized = false;
    
    this.removeAllListeners();
  }
}