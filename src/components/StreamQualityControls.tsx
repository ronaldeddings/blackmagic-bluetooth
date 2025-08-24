import React, { useState, useEffect, useCallback } from 'react';
import type { ViewfinderConfig, StreamInfo } from '../services/streaming/ViewfinderService';
import type { OptimizationProfile } from '../services/streaming/StreamConfigManager';
import { StreamConfigManager } from '../services/streaming/StreamConfigManager';
import './StreamQualityControls.css';

export interface StreamQualityControlsProps {
  deviceIds: string[];
  streamInfos: Map<string, StreamInfo>;
  configManager: StreamConfigManager;
  onConfigUpdate: (deviceId: string, config: Partial<ViewfinderConfig>) => void;
  onGlobalConfigUpdate: (config: Partial<ViewfinderConfig>) => void;
  onOptimizationProfileChange: (profileName: string) => void;
}

export const StreamQualityControls: React.FC<StreamQualityControlsProps> = ({
  deviceIds,
  streamInfos,
  configManager,
  onConfigUpdate,
  onGlobalConfigUpdate,
  onOptimizationProfileChange
}) => {
  const [selectedDevice, setSelectedDevice] = useState<string>('global');
  const [activeTab, setActiveTab] = useState<'quality' | 'advanced' | 'network'>('quality');
  const [optimizationProfiles, setOptimizationProfiles] = useState<OptimizationProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<OptimizationProfile | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Current configuration state
  const [currentConfig, setCurrentConfig] = useState<ViewfinderConfig>({
    resolution: { width: 1280, height: 720 },
    quality: 'medium',
    framerate: 30,
    codec: 'h264'
  });

  // Network information
  const [networkInfo, setNetworkInfo] = useState<any>(null);

  // Load profiles and network info on mount
  useEffect(() => {
    const profiles = configManager.getOptimizationProfiles();
    setOptimizationProfiles(profiles);
    
    const profile = configManager.getCurrentProfile();
    setCurrentProfile(profile);

    // Load network conditions
    configManager.getCurrentNetworkConditions().then(network => {
      setNetworkInfo(network);
    });
  }, [configManager]);

  // Update current config when device selection changes
  useEffect(() => {
    if (selectedDevice === 'global') {
      // Use default/common config for global
      setCurrentConfig({
        resolution: { width: 1280, height: 720 },
        quality: 'medium',
        framerate: 30,
        codec: 'h264'
      });
    } else {
      const streamInfo = streamInfos.get(selectedDevice);
      if (streamInfo) {
        setCurrentConfig(streamInfo.config);
      }
    }
  }, [selectedDevice, streamInfos]);

  /**
   * Handle resolution change
   */
  const handleResolutionChange = useCallback((resolution: string) => {
    const [width, height] = resolution.split('x').map(Number);
    const newConfig = {
      ...currentConfig,
      resolution: { ...currentConfig.resolution, width, height }
    };
    setCurrentConfig(newConfig);
    
    if (selectedDevice === 'global') {
      onGlobalConfigUpdate({ resolution: { width, height } });
    } else {
      onConfigUpdate(selectedDevice, { resolution: { width, height } });
    }
  }, [currentConfig, selectedDevice, onConfigUpdate, onGlobalConfigUpdate]);

  /**
   * Handle quality change
   */
  const handleQualityChange = useCallback((quality: ViewfinderConfig['quality']) => {
    const newConfig = { ...currentConfig, quality };
    setCurrentConfig(newConfig);
    
    if (selectedDevice === 'global') {
      onGlobalConfigUpdate({ quality });
    } else {
      onConfigUpdate(selectedDevice, { quality });
    }
  }, [currentConfig, selectedDevice, onConfigUpdate, onGlobalConfigUpdate]);

  /**
   * Handle framerate change
   */
  const handleFramerateChange = useCallback((framerate: number) => {
    const newConfig = { ...currentConfig, framerate };
    setCurrentConfig(newConfig);
    
    if (selectedDevice === 'global') {
      onGlobalConfigUpdate({ framerate });
    } else {
      onConfigUpdate(selectedDevice, { framerate });
    }
  }, [currentConfig, selectedDevice, onConfigUpdate, onGlobalConfigUpdate]);

  /**
   * Handle codec change
   */
  const handleCodecChange = useCallback((codec: ViewfinderConfig['codec']) => {
    const newConfig = { ...currentConfig, codec };
    setCurrentConfig(newConfig);
    
    if (selectedDevice === 'global') {
      onGlobalConfigUpdate({ codec });
    } else {
      onConfigUpdate(selectedDevice, { codec });
    }
  }, [currentConfig, selectedDevice, onConfigUpdate, onGlobalConfigUpdate]);

  /**
   * Handle optimization profile change
   */
  const handleProfileChange = useCallback(async (profileName: string) => {
    setIsApplying(true);
    try {
      await onOptimizationProfileChange(profileName);
      const newProfile = optimizationProfiles.find(p => p.name === profileName);
      setCurrentProfile(newProfile || null);
    } catch (error) {
      console.error('Failed to apply optimization profile:', error);
    } finally {
      setIsApplying(false);
    }
  }, [optimizationProfiles, onOptimizationProfileChange]);

  /**
   * Apply optimal settings based on network conditions
   */
  const handleOptimizeForNetwork = useCallback(async () => {
    if (!networkInfo) return;

    setIsApplying(true);
    try {
      // Get optimized configuration
      const deviceId = selectedDevice === 'global' ? deviceIds[0] : selectedDevice;
      const optimizedConfig = await configManager.optimizeConfigForDevice(deviceId, currentConfig);
      
      setCurrentConfig(optimizedConfig);
      
      if (selectedDevice === 'global') {
        onGlobalConfigUpdate(optimizedConfig);
      } else {
        onConfigUpdate(selectedDevice, optimizedConfig);
      }
    } catch (error) {
      console.error('Failed to optimize for network:', error);
    } finally {
      setIsApplying(false);
    }
  }, [networkInfo, selectedDevice, deviceIds, currentConfig, configManager, onConfigUpdate, onGlobalConfigUpdate]);

  /**
   * Get stream statistics for selected device
   */
  const getStreamStats = useCallback(() => {
    if (selectedDevice === 'global') {
      // Return aggregated stats
      const activeStreams = Array.from(streamInfos.values()).filter(s => s.isActive);
      if (activeStreams.length === 0) return null;

      const avgLatency = activeStreams.reduce((sum, s) => sum + s.latency, 0) / activeStreams.length;
      const totalFrames = activeStreams.reduce((sum, s) => sum + s.frameCount, 0);
      const totalDropped = activeStreams.reduce((sum, s) => sum + s.droppedFrames, 0);
      const avgBitrate = activeStreams.reduce((sum, s) => sum + s.currentBitrate, 0) / activeStreams.length;

      return {
        latency: Math.round(avgLatency),
        frameCount: totalFrames,
        droppedFrames: totalDropped,
        currentBitrate: Math.round(avgBitrate),
        activeCount: activeStreams.length
      };
    } else {
      const streamInfo = streamInfos.get(selectedDevice);
      return streamInfo ? {
        latency: streamInfo.latency,
        frameCount: streamInfo.frameCount,
        droppedFrames: streamInfo.droppedFrames,
        currentBitrate: streamInfo.currentBitrate,
        isActive: streamInfo.isActive
      } : null;
    }
  }, [selectedDevice, streamInfos]);

  const streamStats = getStreamStats();

  return (
    <div className="stream-quality-controls">
      <div className="controls-header">
        <h3>📊 Stream Quality Controls</h3>
        
        <div className="device-selector">
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="device-select"
          >
            <option value="global">All Devices (Global)</option>
            {deviceIds.map(deviceId => (
              <option key={deviceId} value={deviceId}>
                {deviceId.slice(-8)} {streamInfos.get(deviceId)?.isActive ? '●' : '○'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="controls-tabs">
        <button
          className={`tab-btn ${activeTab === 'quality' ? 'active' : ''}`}
          onClick={() => setActiveTab('quality')}
        >
          🎛️ Quality
        </button>
        <button
          className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
          onClick={() => setActiveTab('advanced')}
        >
          ⚙️ Advanced
        </button>
        <button
          className={`tab-btn ${activeTab === 'network' ? 'active' : ''}`}
          onClick={() => setActiveTab('network')}
        >
          🌐 Network
        </button>
      </div>

      <div className="controls-content">
        {activeTab === 'quality' && (
          <div className="quality-controls">
            <div className="control-group">
              <label>Resolution</label>
              <select
                value={`${currentConfig.resolution.width}x${currentConfig.resolution.height}`}
                onChange={(e) => handleResolutionChange(e.target.value)}
                className="control-select"
              >
                <option value="640x360">640×360 (360p)</option>
                <option value="854x480">854×480 (480p)</option>
                <option value="1280x720">1280×720 (720p)</option>
                <option value="1920x1080">1920×1080 (1080p)</option>
                <option value="2560x1440">2560×1440 (1440p)</option>
                <option value="3840x2160">3840×2160 (4K)</option>
              </select>
            </div>

            <div className="control-group">
              <label>Quality</label>
              <div className="quality-buttons">
                {(['low', 'medium', 'high', 'ultra'] as const).map(quality => (
                  <button
                    key={quality}
                    className={`quality-btn ${currentConfig.quality === quality ? 'active' : ''}`}
                    onClick={() => handleQualityChange(quality)}
                  >
                    {quality.charAt(0).toUpperCase() + quality.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <label>Frame Rate</label>
              <div className="framerate-slider">
                <input
                  type="range"
                  min="15"
                  max="60"
                  step="5"
                  value={currentConfig.framerate}
                  onChange={(e) => handleFramerateChange(parseInt(e.target.value))}
                  className="slider"
                />
                <div className="slider-value">{currentConfig.framerate} fps</div>
              </div>
            </div>

            <div className="control-group">
              <label>Codec</label>
              <div className="codec-buttons">
                <button
                  className={`codec-btn ${currentConfig.codec === 'h264' ? 'active' : ''}`}
                  onClick={() => handleCodecChange('h264')}
                >
                  H.264
                </button>
                <button
                  className={`codec-btn ${currentConfig.codec === 'mjpeg' ? 'active' : ''}`}
                  onClick={() => handleCodecChange('mjpeg')}
                >
                  MJPEG
                </button>
              </div>
            </div>

            {currentConfig.bitrate && (
              <div className="control-group">
                <label>Bitrate</label>
                <div className="bitrate-info">
                  <span className="bitrate-value">
                    {currentConfig.bitrate > 1000 
                      ? `${(currentConfig.bitrate / 1000).toFixed(1)} Mbps`
                      : `${currentConfig.bitrate} Kbps`
                    }
                  </span>
                  <span className="bitrate-note">Auto-calculated</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="advanced-controls">
            <div className="control-group">
              <label>Optimization Profile</label>
              <select
                value={currentProfile?.name || ''}
                onChange={(e) => handleProfileChange(e.target.value)}
                className="control-select"
                disabled={isApplying}
              >
                {optimizationProfiles.map(profile => (
                  <option key={profile.name} value={profile.name}>
                    {profile.name}
                  </option>
                ))}
              </select>
              {currentProfile && (
                <div className="profile-description">
                  {currentProfile.description}
                </div>
              )}
            </div>

            <div className="control-group">
              <label>Auto-Optimization</label>
              <button
                className="optimize-btn"
                onClick={handleOptimizeForNetwork}
                disabled={isApplying || !networkInfo}
              >
                {isApplying ? (
                  <>
                    <span className="spinner"></span>
                    Optimizing...
                  </>
                ) : (
                  <>🚀 Optimize for Current Network</>
                )}
              </button>
            </div>

            {streamStats && (
              <div className="control-group">
                <label>Performance Metrics</label>
                <div className="performance-metrics">
                  <div className="metric">
                    <span className="metric-label">Latency:</span>
                    <span className={`metric-value ${streamStats.latency > 100 ? 'high' : streamStats.latency > 50 ? 'medium' : 'low'}`}>
                      {streamStats.latency}ms
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Frames:</span>
                    <span className="metric-value">
                      {streamStats.frameCount}
                      {streamStats.droppedFrames > 0 && (
                        <span className="dropped"> (-{streamStats.droppedFrames})</span>
                      )}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Bitrate:</span>
                    <span className="metric-value">
                      {streamStats.currentBitrate > 1000 
                        ? `${(streamStats.currentBitrate / 1000).toFixed(1)}M`
                        : `${streamStats.currentBitrate}K`
                      }
                    </span>
                  </div>
                  {'activeCount' in streamStats && (
                    <div className="metric">
                      <span className="metric-label">Active:</span>
                      <span className="metric-value">{streamStats.activeCount}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'network' && (
          <div className="network-controls">
            {networkInfo && (
              <div className="network-info">
                <div className="info-group">
                  <label>Network Status</label>
                  <div className="network-metrics">
                    <div className="metric">
                      <span className="metric-label">Bandwidth:</span>
                      <span className="metric-value">
                        {networkInfo.bandwidth > 1000 
                          ? `${(networkInfo.bandwidth / 1000).toFixed(1)} Mbps`
                          : `${networkInfo.bandwidth} Kbps`
                        }
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Latency:</span>
                      <span className="metric-value">{networkInfo.latency}ms</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Stability:</span>
                      <span className={`metric-value status-${networkInfo.stability}`}>
                        {networkInfo.stability}
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Packet Loss:</span>
                      <span className="metric-value">{networkInfo.packetLoss.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="info-group">
                  <label>Recommendations</label>
                  <div className="network-recommendations">
                    {networkInfo.bandwidth < 2000 && (
                      <div className="recommendation warning">
                        ⚠️ Low bandwidth detected. Consider reducing resolution or quality.
                      </div>
                    )}
                    {networkInfo.latency > 100 && (
                      <div className="recommendation warning">
                        ⚠️ High latency detected. MJPEG codec might provide better responsiveness.
                      </div>
                    )}
                    {networkInfo.stability === 'poor' && (
                      <div className="recommendation error">
                        ❌ Poor network stability. Consider lowering frame rate and quality.
                      </div>
                    )}
                    {networkInfo.bandwidth > 10000 && networkInfo.latency < 50 && (
                      <div className="recommendation success">
                        ✅ Excellent network conditions. High quality streaming recommended.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="control-group">
              <label>Adaptive Quality</label>
              <div className="adaptive-controls">
                <label className="checkbox-label">
                  <input type="checkbox" defaultChecked />
                  Enable adaptive quality based on network conditions
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" defaultChecked />
                  Automatically adjust bitrate for optimal performance
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" />
                  Prioritize low latency over quality
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamQualityControls;