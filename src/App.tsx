import { useState, useCallback } from 'react';
import { DeviceScanner } from './components/DeviceScanner';
import { ConnectionManager } from './components/ConnectionManager';
import { ServiceExplorer } from './components/ServiceExplorer';
import type { 
  BluetoothDevice, 
  DeviceConnectionState, 
  ServiceDiscoveryResult,
  SecurityAssessment,
  FirmwareAnalysis,
  AppState 
} from './types';
import './App.css';

const initialAppState: AppState = {
  connectionState: {
    connected: false,
    connecting: false,
    device: null,
    services: [],
    characteristics: new Map(),
    error: null
  },
  discoveredServices: [],
  processedServices: [],
  securityAssessment: null,
  firmwareAnalysis: null,
  isScanning: false,
  availableDevices: []
};

function App() {
  const [appState, setAppState] = useState<AppState>(initialAppState);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [activeTab, setActiveTab] = useState<'scanner' | 'connection' | 'services'>('scanner');

  const handleDeviceSelected = useCallback((device: BluetoothDevice) => {
    console.log('🟣 App: Device selected by user:', {
      id: device.id,
      name: device.name,
      gatt: device.gatt ? 'available' : 'not available'
    });
    
    setSelectedDevice(device);
    setAppState(prev => ({
      ...prev,
      availableDevices: prev.availableDevices.includes(device) ? 
        prev.availableDevices : [...prev.availableDevices, device]
    }));
    setActiveTab('connection');
    
    console.log('🟣 App: Switched to connection tab and set selectedDevice');
  }, []);

  const handleScanStateChange = useCallback((scanning: boolean) => {
    setAppState(prev => ({
      ...prev,
      isScanning: scanning
    }));
  }, []);

  const handleConnectionStateChange = useCallback((connectionState: DeviceConnectionState) => {
    setAppState(prev => ({
      ...prev,
      connectionState
    }));
    
    if (connectionState.connected) {
      setActiveTab('services');
    }
  }, []);

  const handleServicesDiscovered = useCallback((services: ServiceDiscoveryResult[]) => {
    setAppState(prev => ({
      ...prev,
      discoveredServices: services
    }));
  }, []);

  const handleSecurityAssessment = useCallback((assessment: SecurityAssessment) => {
    setAppState(prev => ({
      ...prev,
      securityAssessment: assessment
    }));
  }, []);

  const handleFirmwareAnalysis = useCallback((analysis: FirmwareAnalysis) => {
    setAppState(prev => ({
      ...prev,
      firmwareAnalysis: analysis
    }));
  }, []);

  const handleTabChange = useCallback((tab: 'scanner' | 'connection' | 'services') => {
    setActiveTab(tab);
  }, []);

  const isTabEnabled = (tab: string) => {
    switch (tab) {
      case 'scanner':
        return true;
      case 'connection':
        return selectedDevice !== null;
      case 'services':
        return appState.connectionState.connected;
      default:
        return false;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>
            <span className="app-icon">📹</span>
            Blackmagic Bluetooth Interface
          </h1>
          <div className="header-status">
            {selectedDevice ? (
              <div className="device-status">
                <span className="device-name">{selectedDevice.name || 'Unknown Device'}</span>
                <span className={`connection-indicator ${appState.connectionState.connected ? 'connected' : 'disconnected'}`}>
                  {appState.connectionState.connected ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
              </div>
            ) : (
              <div className="device-status">
                <span className="device-name">No device selected</span>
                <span className="connection-indicator disconnected">🔴 Disconnected</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="app-nav">
        <button 
          className={`nav-tab ${activeTab === 'scanner' ? 'active' : ''}`}
          onClick={() => handleTabChange('scanner')}
          disabled={!isTabEnabled('scanner')}
        >
          <span className="tab-icon">🔍</span>
          Device Scanner
        </button>
        <button 
          className={`nav-tab ${activeTab === 'connection' ? 'active' : ''}`}
          onClick={() => handleTabChange('connection')}
          disabled={!isTabEnabled('connection')}
        >
          <span className="tab-icon">🔗</span>
          Connection
        </button>
        <button 
          className={`nav-tab ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => handleTabChange('services')}
          disabled={!isTabEnabled('services')}
        >
          <span className="tab-icon">⚙️</span>
          Services
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'scanner' && (
          <DeviceScanner
            onDeviceSelected={handleDeviceSelected}
            isScanning={appState.isScanning}
            onScanStateChange={handleScanStateChange}
          />
        )}

        {activeTab === 'connection' && (
          <ConnectionManager
            device={selectedDevice}
            onConnectionStateChange={handleConnectionStateChange}
            onServicesDiscovered={handleServicesDiscovered}
          />
        )}

        {activeTab === 'services' && (
          <ServiceExplorer
            services={appState.discoveredServices}
            onSecurityAssessment={handleSecurityAssessment}
            onFirmwareAnalysis={handleFirmwareAnalysis}
          />
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-info">
            <span>Blackmagic Bluetooth Interface v1.0.0</span>
            <span>•</span>
            <span>Built with React + TypeScript</span>
            <span>•</span>
            <span>Web Bluetooth API</span>
          </div>
          <div className="footer-stats">
            {appState.connectionState.connected && (
              <>
                <span>{appState.discoveredServices.length} Services</span>
                <span>•</span>
                <span>{appState.connectionState.characteristics.size} Characteristics</span>
                {appState.securityAssessment && (
                  <>
                    <span>•</span>
                    <span>Risk: {appState.securityAssessment.riskLevel}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;