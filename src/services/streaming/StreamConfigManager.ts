import type { ViewfinderConfig } from './ViewfinderService';

export interface DeviceCapabilities {
  supportedResolutions: Array<{
    width: number;
    height: number;
    maxFramerate: number;
  }>;
  supportedCodecs: Array<'h264' | 'mjpeg'>;
  maxBitrate: number;
  minBitrate: number;
  hardwareAcceleration: boolean;
  lowLatencyMode: boolean;
}

export interface NetworkConditions {
  bandwidth: number; // Kbps
  latency: number; // ms
  packetLoss: number; // percentage
  jitter: number; // ms
  stability: 'excellent' | 'good' | 'poor' | 'unstable';
}

export interface OptimizationProfile {
  name: string;
  description: string;
  priority: 'quality' | 'latency' | 'bandwidth' | 'balanced';
  settings: {
    preferredCodec: 'h264' | 'mjpeg';
    qualityBias: number; // -1 to 1 (low to high quality)
    latencyBias: number; // -1 to 1 (low to high latency tolerance)
    bandwidthEfficiency: number; // 0 to 1
  };
}

const DEFAULT_CAPABILITIES: DeviceCapabilities = {
  supportedResolutions: [
    { width: 640, height: 360, maxFramerate: 60 },
    { width: 854, height: 480, maxFramerate: 60 },
    { width: 1280, height: 720, maxFramerate: 60 },
    { width: 1920, height: 1080, maxFramerate: 30 },
    { width: 2560, height: 1440, maxFramerate: 30 },
    { width: 3840, height: 2160, maxFramerate: 25 }
  ],
  supportedCodecs: ['h264', 'mjpeg'],
  maxBitrate: 50000, // 50 Mbps
  minBitrate: 500,   // 500 Kbps
  hardwareAcceleration: true,
  lowLatencyMode: true
};

const OPTIMIZATION_PROFILES: OptimizationProfile[] = [
  {
    name: 'Ultra Low Latency',
    description: 'Minimize latency for real-time monitoring',
    priority: 'latency',
    settings: {
      preferredCodec: 'mjpeg',
      qualityBias: -0.5,
      latencyBias: -1,
      bandwidthEfficiency: 0.3
    }
  },
  {
    name: 'High Quality',
    description: 'Maximum quality for detailed monitoring',
    priority: 'quality',
    settings: {
      preferredCodec: 'h264',
      qualityBias: 1,
      latencyBias: 0.5,
      bandwidthEfficiency: 0.7
    }
  },
  {
    name: 'Bandwidth Efficient',
    description: 'Minimize bandwidth usage',
    priority: 'bandwidth',
    settings: {
      preferredCodec: 'h264',
      qualityBias: -0.3,
      latencyBias: 0.2,
      bandwidthEfficiency: 1
    }
  },
  {
    name: 'Balanced',
    description: 'Balance quality, latency, and bandwidth',
    priority: 'balanced',
    settings: {
      preferredCodec: 'h264',
      qualityBias: 0,
      latencyBias: 0,
      bandwidthEfficiency: 0.6
    }
  }
];

export class StreamConfigManager {
  private deviceCapabilities: Map<string, DeviceCapabilities> = new Map();
  private networkConditions: NetworkConditions | null = null;
  private currentProfile: OptimizationProfile = OPTIMIZATION_PROFILES[3]; // Balanced
  private adaptiveSettings = {
    enabled: true,
    monitoringInterval: 5000, // ms
    adjustmentThreshold: 0.2 // 20% change threshold
  };

  constructor() {
    this.initializeNetworkMonitoring();
    console.log('📊 StreamConfigManager initialized');
  }

  /**
   * Get device capabilities (with fallback to defaults)
   */
  getDeviceCapabilities(deviceId: string): DeviceCapabilities {
    return this.deviceCapabilities.get(deviceId) || DEFAULT_CAPABILITIES;
  }

  /**
   * Set device capabilities
   */
  setDeviceCapabilities(deviceId: string, capabilities: DeviceCapabilities): void {
    this.deviceCapabilities.set(deviceId, capabilities);
    console.log(`📋 Updated capabilities for ${deviceId}:`, capabilities);
  }

  /**
   * Optimize configuration for device and current conditions
   */
  async optimizeConfigForDevice(deviceId: string, requestedConfig?: Partial<ViewfinderConfig>): Promise<ViewfinderConfig> {
    const capabilities = this.getDeviceCapabilities(deviceId);
    const networkConditions = await this.getCurrentNetworkConditions();
    
    // Start with default config
    const baseConfig: ViewfinderConfig = {
      resolution: { width: 1280, height: 720 },
      quality: 'medium',
      framerate: 30,
      codec: 'h264'
    };

    // Apply requested overrides
    const targetConfig: ViewfinderConfig = { ...baseConfig, ...requestedConfig };

    // Optimize based on device capabilities
    const capabilityOptimized = this.optimizeForCapabilities(targetConfig, capabilities);
    
    // Optimize based on network conditions
    const networkOptimized = this.optimizeForNetwork(capabilityOptimized, networkConditions);
    
    // Apply profile-based optimizations
    const profileOptimized = this.applyOptimizationProfile(networkOptimized);
    
    // Calculate optimal bitrate
    const finalConfig = this.calculateOptimalBitrate(profileOptimized, capabilities, networkConditions);

    console.log(`⚙️ Optimized config for ${deviceId}:`, finalConfig);
    return finalConfig;
  }

  /**
   * Optimize configuration based on device capabilities
   */
  private optimizeForCapabilities(config: ViewfinderConfig, capabilities: DeviceCapabilities): ViewfinderConfig {
    const optimized = { ...config };

    // Find best supported resolution
    const supportedRes = capabilities.supportedResolutions.find(res => 
      res.width >= optimized.resolution.width && 
      res.height >= optimized.resolution.height
    );

    if (supportedRes) {
      optimized.resolution = {
        width: supportedRes.width,
        height: supportedRes.height
      };
      
      // Adjust framerate based on resolution capabilities
      optimized.framerate = Math.min(optimized.framerate, supportedRes.maxFramerate);
    } else {
      // Use highest supported resolution if requested is too high
      const highestRes = capabilities.supportedResolutions[capabilities.supportedResolutions.length - 1];
      optimized.resolution = {
        width: highestRes.width,
        height: highestRes.height
      };
      optimized.framerate = Math.min(optimized.framerate, highestRes.maxFramerate);
    }

    // Ensure codec is supported
    if (!capabilities.supportedCodecs.includes(optimized.codec)) {
      optimized.codec = capabilities.supportedCodecs[0]; // Use first supported codec
    }

    return optimized;
  }

  /**
   * Optimize configuration based on network conditions
   */
  private optimizeForNetwork(config: ViewfinderConfig, network: NetworkConditions): ViewfinderConfig {
    const optimized = { ...config };

    // Adjust based on bandwidth
    if (network.bandwidth < 2000) { // Less than 2 Mbps
      optimized.resolution = { width: 640, height: 360 };
      optimized.framerate = Math.min(optimized.framerate, 15);
      optimized.quality = 'low';
    } else if (network.bandwidth < 5000) { // Less than 5 Mbps
      optimized.resolution = { width: 1280, height: 720 };
      optimized.framerate = Math.min(optimized.framerate, 30);
      optimized.quality = 'medium';
    }

    // Adjust for high latency networks
    if (network.latency > 100) {
      optimized.codec = 'mjpeg'; // Lower latency but higher bandwidth
      optimized.framerate = Math.min(optimized.framerate, 25);
    }

    // Adjust for poor network stability
    if (network.stability === 'poor' || network.stability === 'unstable') {
      optimized.quality = optimized.quality === 'high' ? 'medium' : 'low';
      optimized.framerate = Math.min(optimized.framerate, 20);
    }

    return optimized;
  }

  /**
   * Apply optimization profile settings
   */
  private applyOptimizationProfile(config: ViewfinderConfig): ViewfinderConfig {
    const optimized = { ...config };
    const profile = this.currentProfile;

    // Apply codec preference
    if (profile.settings.preferredCodec !== config.codec) {
      optimized.codec = profile.settings.preferredCodec;
    }

    // Apply quality bias
    const qualityLevels: ViewfinderConfig['quality'][] = ['low', 'medium', 'high', 'ultra'];
    const currentQualityIndex = qualityLevels.indexOf(optimized.quality);
    const biasAdjustment = Math.round(profile.settings.qualityBias * 2);
    const newQualityIndex = Math.max(0, Math.min(qualityLevels.length - 1, currentQualityIndex + biasAdjustment));
    optimized.quality = qualityLevels[newQualityIndex];

    // Apply latency bias (affects framerate for latency-sensitive profiles)
    if (profile.settings.latencyBias < -0.5) {
      optimized.framerate = Math.min(optimized.framerate, 15); // Reduce for ultra-low latency
    }

    return optimized;
  }

  /**
   * Calculate optimal bitrate based on configuration and conditions
   */
  private calculateOptimalBitrate(config: ViewfinderConfig, capabilities: DeviceCapabilities, network: NetworkConditions): ViewfinderConfig {
    const optimized = { ...config };
    
    // Base bitrate calculation (simplified)
    const pixelCount = config.resolution.width * config.resolution.height;
    const baseRate = pixelCount * config.framerate;
    
    let bitrate: number;

    if (config.codec === 'h264') {
      // H.264 is more efficient
      switch (config.quality) {
        case 'low': bitrate = baseRate * 0.1; break;
        case 'medium': bitrate = baseRate * 0.2; break;
        case 'high': bitrate = baseRate * 0.4; break;
        case 'ultra': bitrate = baseRate * 0.8; break;
      }
    } else {
      // MJPEG requires higher bitrates
      switch (config.quality) {
        case 'low': bitrate = baseRate * 0.3; break;
        case 'medium': bitrate = baseRate * 0.6; break;
        case 'high': bitrate = baseRate * 1.2; break;
        case 'ultra': bitrate = baseRate * 2.0; break;
      }
    }

    // Apply capability constraints
    bitrate = Math.max(capabilities.minBitrate, Math.min(capabilities.maxBitrate, bitrate));
    
    // Apply network bandwidth constraints (use 80% of available bandwidth)
    const maxNetworkBitrate = network.bandwidth * 0.8;
    bitrate = Math.min(bitrate, maxNetworkBitrate);

    // Apply profile bandwidth efficiency
    bitrate *= this.currentProfile.settings.bandwidthEfficiency;

    optimized.bitrate = Math.round(bitrate);
    
    return optimized;
  }

  /**
   * Set optimization profile
   */
  setOptimizationProfile(profileName: string): void {
    const profile = OPTIMIZATION_PROFILES.find(p => p.name === profileName);
    if (profile) {
      this.currentProfile = profile;
      console.log(`📊 Optimization profile set to: ${profileName}`);
    } else {
      console.warn(`⚠️ Unknown profile: ${profileName}`);
    }
  }

  /**
   * Get available optimization profiles
   */
  getOptimizationProfiles(): OptimizationProfile[] {
    return [...OPTIMIZATION_PROFILES];
  }

  /**
   * Get current optimization profile
   */
  getCurrentProfile(): OptimizationProfile {
    return this.currentProfile;
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring(): void {
    // Start with default network conditions
    this.networkConditions = {
      bandwidth: 10000, // 10 Mbps default
      latency: 50,      // 50ms default
      packetLoss: 0,
      jitter: 5,
      stability: 'good'
    };

    if (this.adaptiveSettings.enabled) {
      setInterval(() => {
        this.updateNetworkConditions();
      }, this.adaptiveSettings.monitoringInterval);
    }
  }

  /**
   * Update network conditions (simplified monitoring)
   */
  private async updateNetworkConditions(): Promise<void> {
    // In a real implementation, this would:
    // 1. Measure actual bandwidth using test requests
    // 2. Monitor RTT to determine latency
    // 3. Track packet loss and jitter
    // 4. Analyze connection stability over time
    
    // For now, simulate some variation
    if (this.networkConditions) {
      const variation = 0.1; // 10% variation
      const currentBandwidth = this.networkConditions.bandwidth;
      
      this.networkConditions.bandwidth = currentBandwidth * (1 + (Math.random() - 0.5) * variation);
      this.networkConditions.latency = 50 + Math.random() * 20;
      this.networkConditions.jitter = Math.random() * 10;
    }
  }

  /**
   * Get current network conditions
   */
  async getCurrentNetworkConditions(): Promise<NetworkConditions> {
    if (!this.networkConditions) {
      await this.initializeNetworkMonitoring();
    }
    return { ...this.networkConditions! };
  }

  /**
   * Manually set network conditions (for testing)
   */
  setNetworkConditions(conditions: Partial<NetworkConditions>): void {
    this.networkConditions = {
      ...this.networkConditions!,
      ...conditions
    };
    console.log('📡 Network conditions updated:', this.networkConditions);
  }

  /**
   * Enable or disable adaptive settings
   */
  setAdaptiveSettings(enabled: boolean, options?: { monitoringInterval?: number; adjustmentThreshold?: number }): void {
    this.adaptiveSettings.enabled = enabled;
    
    if (options) {
      if (options.monitoringInterval) {
        this.adaptiveSettings.monitoringInterval = options.monitoringInterval;
      }
      if (options.adjustmentThreshold) {
        this.adaptiveSettings.adjustmentThreshold = options.adjustmentThreshold;
      }
    }

    console.log(`⚙️ Adaptive settings: ${enabled ? 'enabled' : 'disabled'}`, this.adaptiveSettings);
  }

  /**
   * Get recommended configuration for multiple streams
   */
  async getMultiStreamConfig(deviceIds: string[], baseConfig?: Partial<ViewfinderConfig>): Promise<Map<string, ViewfinderConfig>> {
    const configs = new Map<string, ViewfinderConfig>();
    const networkConditions = await this.getCurrentNetworkConditions();
    
    // Calculate available bandwidth per stream
    const availableBandwidth = networkConditions.bandwidth * 0.8; // Use 80% of available
    const bandwidthPerStream = availableBandwidth / deviceIds.length;
    
    for (const deviceId of deviceIds) {
      // Adjust base config for reduced bandwidth
      const adjustedConfig = {
        ...baseConfig,
        // Automatically reduce quality for multiple streams
        quality: deviceIds.length > 4 ? 'low' : deviceIds.length > 2 ? 'medium' : 'high'
      } as Partial<ViewfinderConfig>;
      
      // Simulate reduced bandwidth for this stream
      const adjustedNetwork = {
        ...networkConditions,
        bandwidth: bandwidthPerStream
      };
      
      const capabilities = this.getDeviceCapabilities(deviceId);
      
      // Apply optimizations with reduced bandwidth
      let optimized = this.optimizeForCapabilities(adjustedConfig as ViewfinderConfig, capabilities);
      optimized = this.optimizeForNetwork(optimized, adjustedNetwork);
      optimized = this.applyOptimizationProfile(optimized);
      optimized = this.calculateOptimalBitrate(optimized, capabilities, adjustedNetwork);
      
      configs.set(deviceId, optimized);
    }
    
    console.log(`📊 Multi-stream config for ${deviceIds.length} devices:`, Array.from(configs.values()));
    return configs;
  }
}

export default StreamConfigManager;