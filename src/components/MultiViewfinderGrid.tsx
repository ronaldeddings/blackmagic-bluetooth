import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ViewfinderDisplay } from './ViewfinderDisplay';
import { ViewfinderService } from '../services/streaming/ViewfinderService';
import type { ViewfinderFrame, StreamInfo, ViewfinderConfig } from '../services/streaming/ViewfinderService';
import type { BluetoothDevice } from '../types';
import './MultiViewfinderGrid.css';

export interface MultiViewfinderGridProps {
  devices: BluetoothDevice[];
  viewfinderService: ViewfinderService;
  gridLayout: '1x1' | '2x2' | '3x3' | '4x4' | '2x3' | '3x2';
  showControls?: boolean;
  showStats?: boolean;
  autoStart?: boolean;
  onStreamError?: (deviceId: string, error: Error) => void;
  onFullscreenDevice?: (deviceId: string) => void;
}

export interface GridStreamState {
  deviceId: string;
  device: BluetoothDevice;
  streamInfo?: StreamInfo;
  lastFrame?: ViewfinderFrame;
  isLoading: boolean;
  error?: string;
}

const GRID_LAYOUTS = {
  '1x1': { rows: 1, cols: 1, maxDevices: 1 },
  '2x2': { rows: 2, cols: 2, maxDevices: 4 },
  '3x3': { rows: 3, cols: 3, maxDevices: 9 },
  '4x4': { rows: 4, cols: 4, maxDevices: 16 },
  '2x3': { rows: 2, cols: 3, maxDevices: 6 },
  '3x2': { rows: 3, cols: 2, maxDevices: 6 }
};

export const MultiViewfinderGrid: React.FC<MultiViewfinderGridProps> = ({
  devices,
  viewfinderService,
  gridLayout = '2x2',
  showControls = true,
  showStats = false,
  autoStart = false,
  onStreamError,
  onFullscreenDevice
}) => {
  const [streamStates, setStreamStates] = useState<Map<string, GridStreamState>>(new Map());
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const layoutConfig = GRID_LAYOUTS[gridLayout];
  const maxDevices = layoutConfig.maxDevices;
  const displayDevices = devices.slice(0, maxDevices);

  // Initialize stream states
  useEffect(() => {
    const newStates = new Map<string, GridStreamState>();
    
    displayDevices.forEach(device => {
      const existingState = streamStates.get(device.id);
      newStates.set(device.id, {
        deviceId: device.id,
        device,
        streamInfo: existingState?.streamInfo,
        lastFrame: existingState?.lastFrame,
        isLoading: existingState?.isLoading || false,
        error: existingState?.error
      });
    });
    
    setStreamStates(newStates);
  }, [devices, displayDevices]); // Remove streamStates from dependencies to prevent infinite loop

  // Set up viewfinder service event listeners
  useEffect(() => {
    const handleStreamStarted = ({ deviceId, streamInfo }: { deviceId: string; streamInfo: StreamInfo }) => {
      setStreamStates(prev => {
        const newStates = new Map(prev);
        const state = newStates.get(deviceId);
        if (state) {
          state.streamInfo = streamInfo;
          state.isLoading = false;
          state.error = undefined;
        }
        return newStates;
      });
    };

    const handleStreamStopped = ({ deviceId }: { deviceId: string }) => {
      setStreamStates(prev => {
        const newStates = new Map(prev);
        const state = newStates.get(deviceId);
        if (state) {
          state.streamInfo = undefined;
          state.lastFrame = undefined;
          state.isLoading = false;
        }
        return newStates;
      });
    };

    const handleFrame = ({ deviceId, frame }: { deviceId: string; frame: ViewfinderFrame }) => {
      setStreamStates(prev => {
        const newStates = new Map(prev);
        const state = newStates.get(deviceId);
        if (state) {
          state.lastFrame = frame;
        }
        return newStates;
      });
    };

    const handleStreamError = ({ deviceId, error }: { deviceId: string; error: Error }) => {
      setStreamStates(prev => {
        const newStates = new Map(prev);
        const state = newStates.get(deviceId);
        if (state) {
          state.error = error.message;
          state.isLoading = false;
        }
        return newStates;
      });

      if (onStreamError) {
        onStreamError(deviceId, error);
      }
    };

    viewfinderService.on('stream-started', handleStreamStarted);
    viewfinderService.on('stream-stopped', handleStreamStopped);
    viewfinderService.on('frame', handleFrame);
    viewfinderService.on('decoder-error', handleStreamError);

    return () => {
      viewfinderService.off('stream-started', handleStreamStarted);
      viewfinderService.off('stream-stopped', handleStreamStopped);
      viewfinderService.off('frame', handleFrame);
      viewfinderService.off('decoder-error', handleStreamError);
    };
  }, [viewfinderService, onStreamError]);

  // Auto-start streams if requested
  useEffect(() => {
    if (autoStart && displayDevices.length > 0) {
      startAllStreams();
    }
  }, [autoStart, displayDevices]); // Remove startAllStreams from dependencies

  /**
   * Start streams for all devices
   */
  const startAllStreams = useCallback(async () => {
    if (isStarting) return;

    setIsStarting(true);
    setGlobalError(null);

    try {
      // Get optimized configurations for all devices
      const configs = await viewfinderService.configManager.getMultiStreamConfig(
        displayDevices.map(d => d.id)
      );

      // Start streams with staggered timing
      const startPromises = displayDevices.map(async (device, index) => {
        try {
          // Mark device as loading
          setStreamStates(prev => {
            const newStates = new Map(prev);
            const state = newStates.get(device.id);
            if (state) {
              state.isLoading = true;
              state.error = undefined;
            }
            return newStates;
          });

          // Stagger start times to prevent resource contention
          await new Promise(resolve => setTimeout(resolve, index * 200));
          
          const config = configs.get(device.id);
          await viewfinderService.startStream(device.id, device, config);
          
          console.log(`✅ Started stream for ${device.id}`);
        } catch (error) {
          console.error(`❌ Failed to start stream for ${device.id}:`, error);
          
          setStreamStates(prev => {
            const newStates = new Map(prev);
            const state = newStates.get(device.id);
            if (state) {
              state.isLoading = false;
              state.error = (error as Error).message;
            }
            return newStates;
          });
        }
      });

      await Promise.allSettled(startPromises);
      console.log(`🎥 Started ${displayDevices.length} viewfinder streams`);

    } catch (error) {
      console.error('❌ Failed to start streams:', error);
      setGlobalError((error as Error).message);
    } finally {
      setIsStarting(false);
    }
  }, [displayDevices, isStarting, viewfinderService]);

  /**
   * Stop all streams
   */
  const stopAllStreams = useCallback(async () => {
    try {
      await viewfinderService.stopAllStreams();
      console.log('🛑 Stopped all viewfinder streams');
    } catch (error) {
      console.error('❌ Failed to stop streams:', error);
      setGlobalError((error as Error).message);
    }
  }, [viewfinderService]);

  /**
   * Start individual stream
   */
  const startStream = useCallback(async (deviceId: string) => {
    const device = displayDevices.find(d => d.id === deviceId);
    if (!device) return;

    try {
      setStreamStates(prev => {
        const newStates = new Map(prev);
        const state = newStates.get(deviceId);
        if (state) {
          state.isLoading = true;
          state.error = undefined;
        }
        return newStates;
      });

      await viewfinderService.startStream(deviceId, device);
      console.log(`✅ Started stream for ${deviceId}`);
    } catch (error) {
      console.error(`❌ Failed to start stream for ${deviceId}:`, error);
    }
  }, [displayDevices, viewfinderService]);

  /**
   * Stop individual stream
   */
  const stopStream = useCallback(async (deviceId: string) => {
    try {
      await viewfinderService.stopStream(deviceId);
      console.log(`🛑 Stopped stream for ${deviceId}`);
    } catch (error) {
      console.error(`❌ Failed to stop stream for ${deviceId}:`, error);
    }
  }, [viewfinderService]);

  /**
   * Handle device selection
   */
  const handleDeviceClick = useCallback((deviceId: string) => {
    setSelectedDevice(prev => prev === deviceId ? null : deviceId);
  }, []);

  /**
   * Handle device double-click (fullscreen)
   */
  const handleDeviceDoubleClick = useCallback((deviceId: string) => {
    if (onFullscreenDevice) {
      onFullscreenDevice(deviceId);
    }
  }, [onFullscreenDevice]);

  /**
   * Handle device context menu
   */
  const handleDeviceContextMenu = useCallback((deviceId: string, e: React.MouseEvent) => {
    e.preventDefault();
    
    const streamState = streamStates.get(deviceId);
    if (!streamState) return;

    // Simple context menu actions (in a real app, this would show a proper context menu)
    const action = window.confirm(
      streamState.streamInfo 
        ? `Stop stream for ${deviceId.slice(-8)}?`
        : `Start stream for ${deviceId.slice(-8)}?`
    );

    if (action) {
      if (streamState.streamInfo) {
        stopStream(deviceId);
      } else {
        startStream(deviceId);
      }
    }
  }, [streamStates, startStream, stopStream]);

  /**
   * Get grid styles based on layout
   */
  const gridStyles = useMemo(() => {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${layoutConfig.cols}, 1fr)`,
      gridTemplateRows: `repeat(${layoutConfig.rows}, 1fr)`,
      gap: '0.5rem',
      height: '100%'
    };
  }, [layoutConfig]);

  /**
   * Get active streams count
   */
  const activeStreamsCount = useMemo(() => {
    return Array.from(streamStates.values()).filter(state => state.streamInfo?.isActive).length;
  }, [streamStates]);

  return (
    <div className="multi-viewfinder-grid">
      {showControls && (
        <div className="grid-controls">
          <div className="control-group">
            <button
              className="control-btn start-all"
              onClick={startAllStreams}
              disabled={isStarting || activeStreamsCount === displayDevices.length}
            >
              {isStarting ? (
                <>
                  <span className="spinner"></span>
                  Starting...
                </>
              ) : (
                <>▶️ Start All</>
              )}
            </button>
            
            <button
              className="control-btn stop-all"
              onClick={stopAllStreams}
              disabled={activeStreamsCount === 0}
            >
              ⏹️ Stop All
            </button>
          </div>
          
          <div className="status-info">
            <span className="streams-count">
              {activeStreamsCount} / {displayDevices.length} streams active
            </span>
            <span className="layout-info">
              {gridLayout.toUpperCase()} layout
            </span>
          </div>
        </div>
      )}

      {globalError && (
        <div className="global-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{globalError}</span>
          <button 
            className="dismiss-error"
            onClick={() => setGlobalError(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="viewfinder-grid" style={gridStyles}>
        {displayDevices.map(device => {
          const streamState = streamStates.get(device.id);
          if (!streamState) return null;

          return (
            <div
              key={device.id}
              className={`grid-cell ${selectedDevice === device.id ? 'selected' : ''} ${streamState.isLoading ? 'loading' : ''} ${streamState.error ? 'error' : ''}`}
              onClick={() => handleDeviceClick(device.id)}
            >
              <ViewfinderDisplay
                deviceId={device.id}
                streamInfo={streamState.streamInfo}
                frame={streamState.lastFrame}
                showControls={false} // Grid controls are handled at grid level
                showStats={showStats}
                onDoubleClick={() => handleDeviceDoubleClick(device.id)}
                onContextMenu={(e) => handleDeviceContextMenu(device.id, e)}
              />
              
              {streamState.isLoading && (
                <div className="loading-overlay">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">Starting stream...</div>
                </div>
              )}
              
              {streamState.error && (
                <div className="error-overlay">
                  <div className="error-icon">⚠️</div>
                  <div className="error-text">{streamState.error}</div>
                  <button
                    className="retry-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      startStream(device.id);
                    }}
                  >
                    🔄 Retry
                  </button>
                </div>
              )}
              
              <div className="cell-controls">
                <button
                  className={`stream-toggle ${streamState.streamInfo?.isActive ? 'stop' : 'start'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (streamState.streamInfo?.isActive) {
                      stopStream(device.id);
                    } else {
                      startStream(device.id);
                    }
                  }}
                  disabled={streamState.isLoading}
                >
                  {streamState.streamInfo?.isActive ? '⏹' : '▶️'}
                </button>
              </div>
            </div>
          );
        })}
        
        {/* Fill empty grid cells */}
        {Array.from({ length: maxDevices - displayDevices.length }).map((_, index) => (
          <div key={`empty-${index}`} className="grid-cell empty">
            <div className="empty-placeholder">
              <div className="empty-icon">📹</div>
              <div className="empty-text">No Device</div>
            </div>
          </div>
        ))}
      </div>
      
      {displayDevices.length === 0 && (
        <div className="no-devices">
          <div className="no-devices-icon">📱</div>
          <h3>No Cameras Available</h3>
          <p>Connect cameras to start viewing live streams</p>
        </div>
      )}
    </div>
  );
};

export default MultiViewfinderGrid;