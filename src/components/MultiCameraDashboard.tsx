import React, { useState, useCallback, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { CameraGrid } from './CameraGrid';
import { BulkOperationsPanel } from './BulkOperationsPanel';
import { MultiDeviceConnectionManager, CameraConnection } from '../services/bluetooth/MultiDeviceManager';
import { DeviceRegistry } from '../services/bluetooth/DeviceRegistry';
import type { 
  BluetoothDevice, 
  CameraCommand,
  BroadcastResult,
  ConnectionResult
} from '../types';
import './MultiCameraDashboard.css';

export interface MultiCameraDashboardProps {
  devices: BluetoothDevice[];
  onDeviceConnectionChange: (results: ConnectionResult[]) => void;
  onBulkOperationComplete: (result: BroadcastResult) => void;
}

export interface CameraGridItem {
  deviceId: string;
  device: BluetoothDevice;
  connection: CameraConnection;
  alias?: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastActivity?: Date;
  metrics?: {
    latency: number;
    dataTransferred: number;
    errorCount: number;
  };
}

export const MultiCameraDashboard: React.FC<MultiCameraDashboardProps> = ({
  devices,
  onDeviceConnectionChange,
  onBulkOperationComplete
}) => {
  const [connectionManager] = useState(() => new MultiDeviceConnectionManager());
  const [deviceRegistry] = useState(() => new DeviceRegistry());
  const [cameraConnections, setCameraConnections] = useState<Map<string, CameraConnection>>(new Map());
  const [selectedCameras, setSelectedCameras] = useState<Set<string>>(new Set());
  const [isConnecting, setIsConnecting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [gridSize, setGridSize] = useState<'2x2' | '3x3' | '4x4'>('2x2');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'activity'>('name');
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'disconnected'>('all');

  // Set up event listeners
  useEffect(() => {
    const handleDeviceConnected = ({ deviceId, connection }: { deviceId: string; connection: CameraConnection }) => {
      setCameraConnections(prev => new Map(prev).set(deviceId, connection));
      console.log(`🔗 Dashboard: Device connected - ${deviceId}`);
    };

    const handleDeviceDisconnected = ({ deviceId }: { deviceId: string }) => {
      setCameraConnections(prev => {
        const newMap = new Map(prev);
        newMap.delete(deviceId);
        return newMap;
      });
      setSelectedCameras(prev => {
        const newSet = new Set(prev);
        newSet.delete(deviceId);
        return newSet;
      });
      console.log(`🔌 Dashboard: Device disconnected - ${deviceId}`);
    };

    const handleMultiConnectionComplete = (result: any) => {
      console.log('🔗 Multi-connection complete:', result);
      onDeviceConnectionChange(result.results);
    };

    connectionManager.on('device-connected', handleDeviceConnected);
    connectionManager.on('device-disconnected', handleDeviceDisconnected);
    connectionManager.on('multi-connection-complete', handleMultiConnectionComplete);

    return () => {
      connectionManager.off('device-connected', handleDeviceConnected);
      connectionManager.off('device-disconnected', handleDeviceDisconnected);
      connectionManager.off('multi-connection-complete', handleMultiConnectionComplete);
    };
  }, [connectionManager, onDeviceConnectionChange]);

  const cameraGridItems = useMemo(() => {
    const items: CameraGridItem[] = [];

    for (const device of devices) {
      const connection = cameraConnections.get(device.id);
      const deviceInfo = deviceRegistry.getDevice(device.id);
      
      items.push({
        deviceId: device.id,
        device,
        connection: connection!,
        alias: deviceInfo?.alias,
        status: connection ? (connection.isConnected() ? 'connected' : 'disconnected') : 'disconnected',
        lastActivity: connection?.lastActivity,
        metrics: connectionManager.getConnection(device.id) 
          ? connectionManager['connectionPool']?.getConnectionMetrics(device.id)
          : undefined
      });
    }

    // Apply filtering
    const filtered = items.filter(item => {
      if (filterStatus === 'all') return true;
      return item.status === filterStatus;
    });

    // Apply sorting
    const sorted = filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.alias || a.device.name || '').localeCompare(b.alias || b.device.name || '');
        case 'status':
          return a.status.localeCompare(b.status);
        case 'activity':
          if (!a.lastActivity && !b.lastActivity) return 0;
          if (!a.lastActivity) return 1;
          if (!b.lastActivity) return -1;
          return b.lastActivity.getTime() - a.lastActivity.getTime();
        default:
          return 0;
      }
    });

    return sorted;
  }, [devices, cameraConnections, deviceRegistry, sortBy, filterStatus, connectionManager]);

  const handleConnectAll = useCallback(async () => {
    if (devices.length === 0) return;

    setIsConnecting(true);
    try {
      console.log(`🔗 Connecting to ${devices.length} devices...`);
      const results = await connectionManager.connectToMultipleDevices(devices);
      
      const successful = results.filter(r => r.success).length;
      console.log(`✅ Connected to ${successful}/${devices.length} devices`);
      
    } catch (error) {
      console.error('Failed to connect to devices:', error);
    } finally {
      setIsConnecting(false);
    }
  }, [devices, connectionManager]);

  const handleDisconnectAll = useCallback(async () => {
    try {
      await connectionManager.disconnectAll();
      setCameraConnections(new Map());
      setSelectedCameras(new Set());
      console.log('🔌 Disconnected all devices');
    } catch (error) {
      console.error('Failed to disconnect devices:', error);
    }
  }, [connectionManager]);

  const handleCameraSelection = useCallback((deviceId: string, selected: boolean) => {
    setSelectedCameras(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(deviceId);
      } else {
        newSet.delete(deviceId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const connectedDeviceIds = cameraGridItems
      .filter(item => item.status === 'connected')
      .map(item => item.deviceId);
    setSelectedCameras(new Set(connectedDeviceIds));
  }, [cameraGridItems]);

  const handleDeselectAll = useCallback(() => {
    setSelectedCameras(new Set());
  }, []);

  const handleBulkOperation = useCallback(async (command: CameraCommand) => {
    if (selectedCameras.size === 0) return;

    try {
      console.log(`📡 Executing bulk operation on ${selectedCameras.size} cameras`);
      const result = await connectionManager.broadcastCommand(command, Array.from(selectedCameras));
      
      onBulkOperationComplete(result);
      console.log(`📡 Bulk operation complete: ${result.successful}/${result.totalDevices} successful`);
      
    } catch (error) {
      console.error('Bulk operation failed:', error);
    }
  }, [selectedCameras, connectionManager, onBulkOperationComplete]);

  const connectedCount = cameraGridItems.filter(item => item.status === 'connected').length;
  const selectedCount = selectedCameras.size;

  return (
    <div className="multi-camera-dashboard">
      <div className="dashboard-header">
        <div className="header-title">
          <h2>📹 Multi-Camera Dashboard</h2>
          <div className="connection-stats">
            <span className="stat">
              <span className="stat-value">{connectedCount}</span>
              <span className="stat-label">Connected</span>
            </span>
            <span className="stat">
              <span className="stat-value">{devices.length}</span>
              <span className="stat-label">Total</span>
            </span>
            <span className="stat">
              <span className="stat-value">{selectedCount}</span>
              <span className="stat-label">Selected</span>
            </span>
          </div>
        </div>

        <div className="header-controls">
          <div className="connection-controls">
            <button 
              className="connect-all-btn"
              onClick={handleConnectAll}
              disabled={isConnecting || devices.length === 0}
            >
              {isConnecting ? (
                <>
                  <span className="spinner"></span>
                  Connecting...
                </>
              ) : (
                <>🔗 Connect All</>
              )}
            </button>
            
            <button 
              className="disconnect-all-btn"
              onClick={handleDisconnectAll}
              disabled={connectedCount === 0}
            >
              🔌 Disconnect All
            </button>
          </div>

          <div className="view-controls">
            <div className="view-mode-toggle">
              <button 
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => setViewMode('grid')}
              >
                ⊞ Grid
              </button>
              <button 
                className={viewMode === 'list' ? 'active' : ''}
                onClick={() => setViewMode('list')}
              >
                ☰ List
              </button>
            </div>

            {viewMode === 'grid' && (
              <select 
                value={gridSize} 
                onChange={(e) => setGridSize(e.target.value as any)}
                className="grid-size-select"
              >
                <option value="2x2">2×2</option>
                <option value="3x3">3×3</option>
                <option value="4x4">4×4</option>
              </select>
            )}
          </div>

          <div className="filter-controls">
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="sort-select"
            >
              <option value="name">Sort by Name</option>
              <option value="status">Sort by Status</option>
              <option value="activity">Sort by Activity</option>
            </select>

            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="filter-select"
            >
              <option value="all">All Devices</option>
              <option value="connected">Connected Only</option>
              <option value="disconnected">Disconnected Only</option>
            </select>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="camera-section">
          <div className="section-header">
            <h3>Camera Grid</h3>
            <div className="selection-controls">
              <button 
                onClick={handleSelectAll}
                disabled={connectedCount === 0}
                className="select-btn"
              >
                ☑ Select All Connected
              </button>
              <button 
                onClick={handleDeselectAll}
                disabled={selectedCount === 0}
                className="deselect-btn"
              >
                ☐ Deselect All
              </button>
            </div>
          </div>

          <CameraGrid
            cameras={cameraGridItems}
            selectedCameras={selectedCameras}
            onCameraSelection={handleCameraSelection}
            viewMode={viewMode}
            gridSize={gridSize}
          />
        </div>

        <div className="operations-section">
          <BulkOperationsPanel
            selectedCameras={Array.from(selectedCameras)}
            connectedCameras={Array.from(cameraConnections.keys())}
            onBulkOperation={handleBulkOperation}
            disabled={selectedCount === 0}
          />
        </div>
      </div>

      {devices.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📱</div>
          <h3>No Cameras Available</h3>
          <p>Please scan for and select Blackmagic cameras first</p>
        </div>
      )}
    </div>
  );
};

export default MultiCameraDashboard;