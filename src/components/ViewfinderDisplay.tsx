import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ViewfinderFrame, StreamInfo } from '../services/streaming/ViewfinderService';
import './ViewfinderDisplay.css';

export interface ViewfinderDisplayProps {
  deviceId: string;
  streamInfo?: StreamInfo;
  frame?: ViewfinderFrame;
  showControls?: boolean;
  showStats?: boolean;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const ViewfinderDisplay: React.FC<ViewfinderDisplayProps> = ({
  deviceId,
  streamInfo,
  frame,
  showControls = true,
  showStats = false,
  onDoubleClick,
  onContextMenu
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  
  // Performance monitoring
  const [renderStats, setRenderStats] = useState({
    fps: 0,
    frameCount: 0,
    lastFrameTime: 0,
    renderTime: 0
  });

  const frameCountRef = useRef(0);
  const lastStatsUpdate = useRef(Date.now());

  /**
   * Render frame to canvas
   */
  const renderFrame = useCallback(async (frameData: ViewfinderFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderStartTime = performance.now();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Update canvas size if needed
      if (canvas.width !== frameData.width || canvas.height !== frameData.height) {
        canvas.width = frameData.width;
        canvas.height = frameData.height;
        setAspectRatio(frameData.width / frameData.height);
      }

      // Render based on frame format
      switch (frameData.format) {
        case 'rgb24':
          await renderRGBFrame(ctx, frameData);
          break;
        case 'yuv420p':
          await renderYUVFrame(ctx, frameData);
          break;
        case 'nv12':
          await renderNV12Frame(ctx, frameData);
          break;
        default:
          console.warn(`Unsupported frame format: ${frameData.format}`);
      }

      // Update performance stats
      const renderTime = performance.now() - renderStartTime;
      updateRenderStats(renderTime);

    } catch (error) {
      console.error('Error rendering frame:', error);
      renderErrorMessage(ctx, 'Render Error');
    }
  }, []);

  /**
   * Render RGB24 frame
   */
  const renderRGBFrame = async (ctx: CanvasRenderingContext2D, frame: ViewfinderFrame): Promise<void> => {
    // For demo purposes, create a simulated image
    // In real implementation, this would decode the actual RGB data
    const imageData = ctx.createImageData(frame.width, frame.height);
    
    // Fill with a pattern or actual decoded data
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 100 + (Math.sin(i * 0.001) * 50);     // R
      imageData.data[i + 1] = 100 + (Math.cos(i * 0.001) * 50); // G
      imageData.data[i + 2] = 150;                               // B
      imageData.data[i + 3] = 255;                               // A
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

  /**
   * Render YUV420p frame
   */
  const renderYUVFrame = async (ctx: CanvasRenderingContext2D, frame: ViewfinderFrame): Promise<void> => {
    // YUV to RGB conversion would happen here
    // For demo, create a simulated YUV-like image
    const imageData = ctx.createImageData(frame.width, frame.height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 120 + (Math.sin(i * 0.002) * 30);     // R
      imageData.data[i + 1] = 120 + (Math.cos(i * 0.002) * 30); // G
      imageData.data[i + 2] = 120;                               // B
      imageData.data[i + 3] = 255;                               // A
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

  /**
   * Render NV12 frame
   */
  const renderNV12Frame = async (ctx: CanvasRenderingContext2D, frame: ViewfinderFrame): Promise<void> => {
    // NV12 format handling
    // For demo, similar to YUV
    await renderYUVFrame(ctx, frame);
  };

  /**
   * Render error message
   */
  const renderErrorMessage = (ctx: CanvasRenderingContext2D, message: string): void => {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(message, ctx.canvas.width / 2, ctx.canvas.height / 2);
  };

  /**
   * Update render performance statistics
   */
  const updateRenderStats = (renderTime: number): void => {
    frameCountRef.current++;
    const now = Date.now();
    
    // Update stats every second
    if (now - lastStatsUpdate.current >= 1000) {
      const elapsed = now - lastStatsUpdate.current;
      const fps = Math.round((frameCountRef.current * 1000) / elapsed);
      
      setRenderStats(prev => ({
        fps,
        frameCount: frameCountRef.current,
        lastFrameTime: now,
        renderTime
      }));
      
      frameCountRef.current = 0;
      lastStatsUpdate.current = now;
    }
  };

  /**
   * Toggle fullscreen
   */
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(error => {
        console.error('Error entering fullscreen:', error);
      });
    } else {
      document.exitFullscreen().catch(error => {
        console.error('Error exiting fullscreen:', error);
      });
    }
  }, []);

  /**
   * Handle fullscreen change
   */
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  /**
   * Render frame when received
   */
  useEffect(() => {
    if (frame) {
      renderFrame(frame);
    }
  }, [frame, renderFrame]);

  /**
   * Initialize canvas
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initial setup
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Show "No Signal" message
    ctx.fillStyle = '#666666';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No Signal', canvas.width / 2, canvas.height / 2);
    
    ctx.font = '14px Arial';
    ctx.fillText(`Device: ${deviceId.slice(-8)}`, canvas.width / 2, canvas.height / 2 + 30);
  }, [deviceId]);

  /**
   * Handle double click
   */
  const handleDoubleClick = useCallback(() => {
    if (onDoubleClick) {
      onDoubleClick();
    } else {
      toggleFullscreen();
    }
  }, [onDoubleClick, toggleFullscreen]);

  /**
   * Handle context menu
   */
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (onContextMenu) {
      onContextMenu(e);
    }
  }, [onContextMenu]);

  return (
    <div 
      ref={containerRef}
      className={`viewfinder-display ${isFullscreen ? 'fullscreen' : ''}`}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <canvas
        ref={canvasRef}
        className="viewfinder-canvas"
        style={{ aspectRatio: aspectRatio.toString() }}
        width={640}
        height={360}
      />
      
      {showControls && (
        <div className="viewfinder-controls">
          <div className="control-group">
            <button 
              className="control-btn"
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? '⛶' : '⛶'}
            </button>
          </div>
          
          <div className="stream-status">
            <span className={`status-indicator ${streamInfo?.isActive ? 'active' : 'inactive'}`}>
              {streamInfo?.isActive ? '●' : '○'}
            </span>
            <span className="status-text">
              {streamInfo?.isActive ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      )}
      
      {showStats && streamInfo && (
        <div className="viewfinder-stats">
          <div className="stats-group">
            <div className="stat-item">
              <span className="stat-label">FPS:</span>
              <span className="stat-value">{renderStats.fps}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Resolution:</span>
              <span className="stat-value">
                {streamInfo.config.resolution.width}×{streamInfo.config.resolution.height}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Codec:</span>
              <span className="stat-value">{streamInfo.config.codec.toUpperCase()}</span>
            </div>
          </div>
          
          <div className="stats-group">
            <div className="stat-item">
              <span className="stat-label">Latency:</span>
              <span className="stat-value">{streamInfo.latency}ms</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Bitrate:</span>
              <span className="stat-value">
                {streamInfo.currentBitrate > 1000 
                  ? `${(streamInfo.currentBitrate / 1000).toFixed(1)}M`
                  : `${streamInfo.currentBitrate}K`
                }
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Frames:</span>
              <span className="stat-value">
                {streamInfo.frameCount}
                {streamInfo.droppedFrames > 0 && (
                  <span className="dropped-frames"> (-{streamInfo.droppedFrames})</span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
      
      <div className="device-label">
        {deviceId.slice(-8)}
      </div>
    </div>
  );
};

export default ViewfinderDisplay;