import React, { useState, useCallback } from 'react';
import { WebBluetoothAdapter } from '@/services/bluetooth';
import type { BluetoothDevice, BluetoothOperationResult } from '@/types';
import './DeviceScanner.css';

interface DeviceScannerProps {
  onDeviceSelected: (device: BluetoothDevice) => void;
  isScanning: boolean;
  onScanStateChange: (scanning: boolean) => void;
}

export const DeviceScanner: React.FC<DeviceScannerProps> = ({
  onDeviceSelected,
  isScanning,
  onScanStateChange
}) => {
  const [availableDevices, setAvailableDevices] = useState<BluetoothDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adapter] = useState(() => new WebBluetoothAdapter());

  const handleScan = useCallback(async () => {
    console.log('🟡 DeviceScanner: Starting scan...');
    setError(null);
    onScanStateChange(true);

    try {
      console.log('🟡 DeviceScanner: Calling adapter.requestDevice()...');
      const result: BluetoothOperationResult<BluetoothDevice> = await adapter.requestDevice();
      
      console.log('🟡 DeviceScanner: Request result:', {
        success: result.success,
        hasData: !!result.data,
        error: result.error,
        deviceId: result.data?.id,
        deviceName: result.data?.name
      });
      
      if (result.success && result.data) {
        const device = result.data;
        console.log('🟡 DeviceScanner: Device selected, updating state...', {
          deviceId: device.id,
          deviceName: device.name,
          gatt: device.gatt ? 'available' : 'not available'
        });
        
        setAvailableDevices(prev => {
          const exists = prev.find(d => d.id === device.id);
          const newDevices = exists ? prev : [...prev, device];
          console.log('🟡 DeviceScanner: Available devices updated:', newDevices.map(d => ({
            id: d.id,
            name: d.name
          })));
          return newDevices;
        });
        
        console.log('🟡 DeviceScanner: Calling onDeviceSelected...');
        onDeviceSelected(device);
      } else {
        console.log('🔴 DeviceScanner: Request failed:', result.error);
        setError(result.error || 'Device scan failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown scanning error';
      console.log('🔴 DeviceScanner: Exception during scan:', errorMessage);
      setError(errorMessage);
    } finally {
      console.log('🟡 DeviceScanner: Scan completed, setting scanning to false');
      onScanStateChange(false);
    }
  }, [adapter, onDeviceSelected, onScanStateChange]);

  const handleDeviceSelect = useCallback((device: BluetoothDevice) => {
    console.log('🟡 DeviceScanner: Device manually selected:', {
      deviceId: device.id,
      deviceName: device.name,
      gatt: device.gatt ? 'available' : 'not available'
    });
    onDeviceSelected(device);
  }, [onDeviceSelected]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className="device-scanner">
      <div className="scanner-header">
        <h2>Blackmagic Device Scanner</h2>
        <button 
          className={`scan-button ${isScanning ? 'scanning' : ''}`}
          onClick={handleScan}
          disabled={isScanning}
        >
          {isScanning ? (
            <>
              <span className="spinner"></span>
              Scanning...
            </>
          ) : (
            <>
              <span className="scan-icon">📡</span>
              Scan for Devices
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button className="error-dismiss" onClick={clearError}>×</button>
        </div>
      )}

      {availableDevices.length > 0 && (
        <div className="device-list">
          <h3>Available Devices</h3>
          {availableDevices.map(device => (
            <div 
              key={device.id}
              className="device-item"
              onClick={() => handleDeviceSelect(device)}
            >
              <div className="device-info">
                <div className="device-name">
                  {device.name || 'Unnamed Device'}
                </div>
                <div className="device-id">
                  ID: {device.id}
                </div>
                {device.gatt?.connected && (
                  <div className="device-status connected">
                    Connected
                  </div>
                )}
              </div>
              <div className="device-actions">
                <button className="select-button">
                  Select
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isScanning && availableDevices.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <p>No devices found. Click "Scan for Devices" to search for Bluetooth devices.</p>
          <div className="tips">
            <h4>Tips:</h4>
            <ul>
              <li>Make sure your Bluetooth device is powered on and discoverable</li>
              <li>Enable Bluetooth pairing mode on your device</li>
              <li>Ensure you're using a supported browser (Chrome/Edge with HTTPS)</li>
              <li>Check that Web Bluetooth is enabled in your browser settings</li>
              <li>For Blackmagic cameras, enable Bluetooth in camera settings</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};