import React, { useState, useCallback, useEffect } from 'react';
import { WebBluetoothAdapter } from '@/services/bluetooth';
import type { BluetoothDevice, DeviceConnectionState, ServiceDiscoveryResult, BluetoothOperationResult } from '@/types';
import './ConnectionManager.css';

interface ConnectionManagerProps {
  device: BluetoothDevice | null;
  onConnectionStateChange: (state: DeviceConnectionState) => void;
  onServicesDiscovered: (services: ServiceDiscoveryResult[]) => void;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  device,
  onConnectionStateChange,
  onServicesDiscovered
}) => {
  const [connectionState, setConnectionState] = useState<DeviceConnectionState>({
    connected: false,
    connecting: false,
    device: null,
    services: [],
    characteristics: new Map(),
    error: null
  });
  const [adapter] = useState(() => new WebBluetoothAdapter());
  const [discoveryProgress, setDiscoveryProgress] = useState<string | null>(null);

  useEffect(() => {
    if (device) {
      console.log('🞪 ConnectionManager: Device prop changed:', {
        id: device.id,
        name: device.name,
        gatt: device.gatt ? 'available' : 'not available'
      });
      
      // Set the device in the adapter
      adapter.setDevice(device);
      
      setConnectionState(prev => ({
        ...prev,
        device,
        error: null
      }));
    }
  }, [device, adapter]);

  useEffect(() => {
    onConnectionStateChange(connectionState);
  }, [connectionState, onConnectionStateChange]);

  const handleConnect = useCallback(async () => {
    if (!device) {
      console.log('🟠 ConnectionManager: No device available for connection');
      return;
    }

    console.log('🟠 ConnectionManager: Starting connection to device:', {
      id: device.id,
      name: device.name,
      gatt: device.gatt ? 'available' : 'not available'
    });

    setConnectionState(prev => ({
      ...prev,
      connecting: true,
      error: null
    }));

    try {
      // Pass the device to the connect method to ensure it's properly set
      const connectResult: BluetoothOperationResult<void> = await adapter.connect(device);
      
      console.log('🟠 ConnectionManager: Connection result:', {
        success: connectResult.success,
        error: connectResult.error
      });
      
      if (connectResult.success) {
        setConnectionState(prev => ({
          ...prev,
          connected: true,
          connecting: false
        }));

        console.log('🟠 ConnectionManager: Connected successfully, starting service discovery...');
        setDiscoveryProgress('Discovering services...');
        
        const servicesResult: BluetoothOperationResult<ServiceDiscoveryResult[]> = 
          await adapter.discoverServices();
        
        console.log('🟠 ConnectionManager: Service discovery result:', {
          success: servicesResult.success,
          serviceCount: servicesResult.data?.length || 0,
          error: servicesResult.error
        });
        
        if (servicesResult.success && servicesResult.data) {
          setConnectionState(prev => ({
            ...prev,
            services: servicesResult.data?.map(() => ({} as BluetoothRemoteGATTService)) || []
          }));
          
          onServicesDiscovered(servicesResult.data);
          setDiscoveryProgress(null);
          console.log('🟠 ConnectionManager: Services discovered and passed to parent');
        } else {
          setConnectionState(prev => ({
            ...prev,
            error: servicesResult.error || 'Service discovery failed'
          }));
          setDiscoveryProgress(null);
        }
      } else {
        setConnectionState(prev => ({
          ...prev,
          connecting: false,
          error: connectResult.error || 'Connection failed'
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection error';
      console.log('🔴 ConnectionManager: Connection exception:', errorMessage);
      setConnectionState(prev => ({
        ...prev,
        connecting: false,
        error: errorMessage
      }));
      setDiscoveryProgress(null);
    }
  }, [device, adapter, onServicesDiscovered]);

  const handleDisconnect = useCallback(async () => {
    try {
      await adapter.disconnect();
      setConnectionState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        services: [],
        characteristics: new Map(),
        error: null
      }));
      setDiscoveryProgress(null);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }, [adapter]);

  const clearError = useCallback(() => {
    setConnectionState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  if (!device) {
    return (
      <div className="connection-manager">
        <div className="no-device">
          <div className="no-device-icon">📱</div>
          <p>No device selected</p>
          <small>Please scan for and select a Blackmagic device first</small>
        </div>
      </div>
    );
  }

  return (
    <div className="connection-manager">
      <div className="connection-header">
        <h3>Device Connection</h3>
        <div className={`connection-status ${connectionState.connected ? 'connected' : connectionState.connecting ? 'connecting' : 'disconnected'}`}>
          {connectionState.connected ? '🟢 Connected' : 
           connectionState.connecting ? '🟡 Connecting...' : 
           '🔴 Disconnected'}
        </div>
      </div>

      <div className="device-details">
        <div className="device-info">
          <h4>{device.name || 'Unnamed Device'}</h4>
          <div className="device-meta">
            <span className="device-id">ID: {device.id}</span>
            {device.gatt && (
              <span className="gatt-status">
                GATT: {device.gatt.connected ? 'Connected' : 'Disconnected'}
              </span>
            )}
          </div>
        </div>

        <div className="connection-actions">
          {!connectionState.connected && !connectionState.connecting && (
            <button 
              className="connect-button primary"
              onClick={handleConnect}
            >
              Connect
            </button>
          )}
          
          {connectionState.connecting && (
            <button className="connect-button connecting" disabled>
              <span className="spinner"></span>
              Connecting...
            </button>
          )}
          
          {connectionState.connected && (
            <button 
              className="connect-button disconnect"
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {connectionState.error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{connectionState.error}</span>
          <button className="error-dismiss" onClick={clearError}>×</button>
        </div>
      )}

      {discoveryProgress && (
        <div className="discovery-progress">
          <div className="progress-info">
            <span className="progress-icon">🔍</span>
            <span>{discoveryProgress}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>
      )}

      {connectionState.connected && connectionState.services.length > 0 && (
        <div className="connection-summary">
          <div className="summary-item">
            <span className="summary-label">Services Discovered:</span>
            <span className="summary-value">{connectionState.services.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Characteristics:</span>
            <span className="summary-value">{connectionState.characteristics.size}</span>
          </div>
        </div>
      )}

      {connectionState.connected && (
        <div className="connection-tips">
          <h4>Connected Successfully!</h4>
          <ul>
            <li>✅ Device is now connected and ready</li>
            <li>🔍 Services have been discovered automatically</li>
            <li>📊 You can now view security analysis and firmware information</li>
            <li>⚙️ Advanced features are available in the device control panel</li>
          </ul>
        </div>
      )}
    </div>
  );
};