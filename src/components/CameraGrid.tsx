import React, { useState, useCallback } from 'react';
import { CameraGridItem } from './MultiCameraDashboard';
import './CameraGrid.css';

export interface CameraGridProps {
  cameras: CameraGridItem[];
  selectedCameras: Set<string>;
  onCameraSelection: (deviceId: string, selected: boolean) => void;
  viewMode: 'grid' | 'list';
  gridSize: '2x2' | '3x3' | '4x4';
}

export const CameraGrid: React.FC<CameraGridProps> = ({
  cameras,
  selectedCameras,
  onCameraSelection,
  viewMode,
  gridSize
}) => {
  const [draggedCamera, setDraggedCamera] = useState<string | null>(null);
  const [dragOverCamera, setDragOverCamera] = useState<string | null>(null);

  const handleCameraClick = useCallback((deviceId: string) => {
    const isSelected = selectedCameras.has(deviceId);
    onCameraSelection(deviceId, !isSelected);
  }, [selectedCameras, onCameraSelection]);

  const handleDragStart = useCallback((e: React.DragEvent, deviceId: string) => {
    setDraggedCamera(deviceId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, deviceId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCamera(deviceId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCamera(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetDeviceId: string) => {
    e.preventDefault();
    
    if (draggedCamera && draggedCamera !== targetDeviceId) {
      // In a real implementation, this would reorganize the camera order
      console.log(`Moving camera ${draggedCamera} to position of ${targetDeviceId}`);
    }
    
    setDraggedCamera(null);
    setDragOverCamera(null);
  }, [draggedCamera]);

  const getStatusIcon = (status: CameraGridItem['status']) => {
    switch (status) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'disconnected': return '🔴';
      case 'error': return '🟠';
      default: return '⚪';
    }
  };

  const getStatusText = (status: CameraGridItem['status']) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  const formatDataSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const CameraCard: React.FC<{ camera: CameraGridItem }> = ({ camera }) => {
    const isSelected = selectedCameras.has(camera.deviceId);
    const isDragOver = dragOverCamera === camera.deviceId;
    
    return (
      <div
        className={`camera-card ${camera.status} ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
        onClick={() => handleCameraClick(camera.deviceId)}
        draggable={camera.status === 'connected'}
        onDragStart={(e) => handleDragStart(e, camera.deviceId)}
        onDragOver={(e) => handleDragOver(e, camera.deviceId)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, camera.deviceId)}
      >
        <div className="camera-header">
          <div className="camera-info">
            <div className="camera-name">
              {camera.alias || camera.device.name || 'Unknown Camera'}
            </div>
            <div className="camera-id">
              {camera.deviceId.slice(-8)}
            </div>
          </div>
          
          <div className="camera-status">
            <span className="status-icon">{getStatusIcon(camera.status)}</span>
            <span className="status-text">{getStatusText(camera.status)}</span>
          </div>
        </div>

        <div className="camera-preview">
          {camera.status === 'connected' ? (
            <div className="preview-placeholder">
              <span className="preview-icon">📹</span>
              <span className="preview-text">Viewfinder</span>
            </div>
          ) : (
            <div className="preview-placeholder offline">
              <span className="preview-icon">📷</span>
              <span className="preview-text">Offline</span>
            </div>
          )}
          
          {isSelected && (
            <div className="selection-indicator">
              <span className="selection-check">✓</span>
            </div>
          )}
        </div>

        {camera.status === 'connected' && (
          <div className="camera-metrics">
            {camera.metrics && (
              <>
                <div className="metric">
                  <span className="metric-label">Latency:</span>
                  <span className="metric-value">{camera.metrics.latency}ms</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Data:</span>
                  <span className="metric-value">{formatDataSize(camera.metrics.dataTransferred)}</span>
                </div>
                {camera.metrics.errorCount > 0 && (
                  <div className="metric error">
                    <span className="metric-label">Errors:</span>
                    <span className="metric-value">{camera.metrics.errorCount}</span>
                  </div>
                )}
              </>
            )}
            
            {camera.lastActivity && (
              <div className="last-activity">
                Last: {formatTimeAgo(camera.lastActivity)}
              </div>
            )}
          </div>
        )}

        <div className="camera-actions">
          <button 
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              // Handle quick action (e.g., start recording)
              console.log(`Quick action for camera ${camera.deviceId}`);
            }}
            disabled={camera.status !== 'connected'}
          >
            ⏺ Record
          </button>
          
          <button 
            className="action-btn"
            onClick={(e) => {
              e.stopPropagation();
              // Handle settings action
              console.log(`Settings for camera ${camera.deviceId}`);
            }}
            disabled={camera.status !== 'connected'}
          >
            ⚙️ Settings
          </button>
        </div>
      </div>
    );
  };

  const CameraListItem: React.FC<{ camera: CameraGridItem }> = ({ camera }) => {
    const isSelected = selectedCameras.has(camera.deviceId);
    
    return (
      <div
        className={`camera-list-item ${camera.status} ${isSelected ? 'selected' : ''}`}
        onClick={() => handleCameraClick(camera.deviceId)}
      >
        <div className="list-item-checkbox">
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={() => {}} // Handled by parent click
          />
        </div>
        
        <div className="list-item-info">
          <div className="camera-name">
            {camera.alias || camera.device.name || 'Unknown Camera'}
          </div>
          <div className="camera-id">{camera.deviceId}</div>
        </div>
        
        <div className="list-item-status">
          <span className="status-icon">{getStatusIcon(camera.status)}</span>
          <span className="status-text">{getStatusText(camera.status)}</span>
        </div>
        
        {camera.metrics && (
          <div className="list-item-metrics">
            <span className="metric">
              {camera.metrics.latency}ms
            </span>
            <span className="metric">
              {formatDataSize(camera.metrics.dataTransferred)}
            </span>
            {camera.metrics.errorCount > 0 && (
              <span className="metric error">
                {camera.metrics.errorCount} errors
              </span>
            )}
          </div>
        )}
        
        {camera.lastActivity && (
          <div className="list-item-activity">
            {formatTimeAgo(camera.lastActivity)}
          </div>
        )}
        
        <div className="list-item-actions">
          <button 
            className="action-btn small"
            onClick={(e) => {
              e.stopPropagation();
              console.log(`Quick action for camera ${camera.deviceId}`);
            }}
            disabled={camera.status !== 'connected'}
          >
            ⏺
          </button>
          <button 
            className="action-btn small"
            onClick={(e) => {
              e.stopPropagation();
              console.log(`Settings for camera ${camera.deviceId}`);
            }}
            disabled={camera.status !== 'connected'}
          >
            ⚙️
          </button>
        </div>
      </div>
    );
  };

  if (cameras.length === 0) {
    return (
      <div className="camera-grid empty">
        <div className="empty-state">
          <div className="empty-icon">📹</div>
          <h3>No Cameras Found</h3>
          <p>Connect to cameras to see them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`camera-grid ${viewMode} ${gridSize}`}>
      {viewMode === 'grid' ? (
        <div className={`grid-container ${gridSize}`}>
          {cameras.map((camera) => (
            <CameraCard key={camera.deviceId} camera={camera} />
          ))}
        </div>
      ) : (
        <div className="list-container">
          <div className="list-header">
            <div className="header-checkbox">
              <input 
                type="checkbox" 
                checked={selectedCameras.size > 0 && selectedCameras.size === cameras.filter(c => c.status === 'connected').length}
                onChange={() => {
                  // This would be handled by parent select all/none
                }}
              />
            </div>
            <div className="header-info">Camera</div>
            <div className="header-status">Status</div>
            <div className="header-metrics">Metrics</div>
            <div className="header-activity">Activity</div>
            <div className="header-actions">Actions</div>
          </div>
          
          {cameras.map((camera) => (
            <CameraListItem key={camera.deviceId} camera={camera} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CameraGrid;