import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

interface DeviceInfo {
  id: string;
  name: string;
  model: string;
  rssi?: number;
  lastSeen: Date;
  paired: boolean;
  favorite: boolean;
}

interface ConnectionHistory {
  deviceId: string;
  deviceName: string;
  connectedAt: Date;
  disconnectedAt?: Date;
  duration?: number;
  success: boolean;
}

interface ConnectionPanelProps {
  onScan?: () => void;
  onConnect?: (deviceId: string) => Promise<void>;
  onDisconnect?: (deviceId: string) => Promise<void>;
  onBulkConnect?: (deviceIds: string[]) => Promise<void>;
  onBulkDisconnect?: (deviceIds: string[]) => Promise<void>;
  onToggleFavorite?: (deviceId: string) => void;
  scanning?: boolean;
  devices?: DeviceInfo[];
  history?: ConnectionHistory[];
}

const PanelContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: ${props => props.theme.spacing.lg};
  height: 100%;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
`;

const MainContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.lg};
`;

const Sidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};
`;

const Card = styled.div`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius};
  padding: ${props => props.theme.spacing.lg};
  box-shadow: 0 2px 4px ${props => props.theme.colors.shadow};
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${props => props.theme.spacing.md};
`;

const CardTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0;
`;

const ScanButton = styled(motion.button)<{ $scanning?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  background: ${props => props.$scanning ? props.theme.colors.warning : props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: ${props => props.theme.borderRadius};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .icon {
    font-size: 16px;
    animation: ${props => props.$scanning ? 'pulse 1.5s infinite' : 'none'};
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const BulkActions = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  margin-bottom: ${props => props.theme.spacing.md};
`;

const BulkButton = styled.button<{ $variant?: 'success' | 'danger' }>`
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  background: ${props => {
    switch (props.$variant) {
      case 'success': return props.theme.colors.success;
      case 'danger': return props.theme.colors.danger;
      default: return props.theme.colors.textSecondary;
    }
  }};
  color: white;
  border: none;
  border-radius: ${props => props.theme.borderRadius};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const DeviceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.sm};
  max-height: 600px;
  overflow-y: auto;
`;

const DeviceItem = styled(motion.div)<{ $selected?: boolean; $connected?: boolean }>`
  display: flex;
  align-items: center;
  padding: ${props => props.theme.spacing.md};
  background: ${props => {
    if (props.$selected) return props.theme.colors.primary + '10';
    if (props.$connected) return props.theme.colors.success + '10';
    return props.theme.colors.background;
  }};
  border: 1px solid ${props => {
    if (props.$selected) return props.theme.colors.primary;
    if (props.$connected) return props.theme.colors.success;
    return props.theme.colors.border;
  }};
  border-radius: ${props => props.theme.borderRadius};
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};

  &:hover {
    box-shadow: 0 2px 4px ${props => props.theme.colors.shadow};
    transform: translateY(-1px);
  }
`;

const DeviceCheckbox = styled.input`
  margin-right: ${props => props.theme.spacing.md};
`;

const DeviceInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.xs};
`;

const DeviceName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.theme.colors.text};
`;

const DeviceDetails = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  display: flex;
  gap: ${props => props.theme.spacing.sm};
`;

const DeviceActions = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.xs};
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'danger' | 'secondary' }>`
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.sm};
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};
  background: ${props => {
    switch (props.$variant) {
      case 'primary': return props.theme.colors.primary;
      case 'danger': return props.theme.colors.danger;
      default: return props.theme.colors.textSecondary;
    }
  }};
  color: white;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SignalStrength = styled.div<{ $strength?: number }>`
  display: flex;
  align-items: center;
  gap: 2px;
  
  .bar {
    width: 2px;
    height: 8px;
    background: ${props => props.theme.colors.textSecondary}40;
    border-radius: 1px;
    
    &.active {
      background: ${props => {
        const strength = props.$strength || 0;
        if (strength > -50) return props.theme.colors.success;
        if (strength > -70) return props.theme.colors.warning;
        return props.theme.colors.danger;
      }};
    }
  }
`;

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.xs};
  max-height: 300px;
  overflow-y: auto;
`;

const HistoryItem = styled.div<{ $success?: boolean }>`
  padding: ${props => props.theme.spacing.sm};
  border-left: 3px solid ${props => props.$success ? props.theme.colors.success : props.theme.colors.danger};
  background: ${props => props.theme.colors.background};
  border-radius: 0 ${props => props.theme.borderRadius} ${props => props.theme.borderRadius} 0;
  font-size: 12px;
`;

const HistoryDevice = styled.div`
  font-weight: 500;
  color: ${props => props.theme.colors.text};
  margin-bottom: ${props => props.theme.spacing.xs};
`;

const HistoryTime = styled.div`
  color: ${props => props.theme.colors.textSecondary};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${props => props.theme.spacing.xxl};
  color: ${props => props.theme.colors.textSecondary};
  
  .icon {
    font-size: 48px;
    margin-bottom: ${props => props.theme.spacing.md};
    opacity: 0.5;
  }
  
  .message {
    font-size: 16px;
    margin-bottom: ${props => props.theme.spacing.sm};
  }
  
  .submessage {
    font-size: 14px;
  }
`;

const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  onScan,
  onConnect,
  onDisconnect,
  onBulkConnect,
  onBulkDisconnect,
  onToggleFavorite,
  scanning = false,
  devices = [],
  history = []
}) => {
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [isConnecting, setIsConnecting] = useState<Set<string>>(new Set());

  const handleDeviceSelect = useCallback((deviceId: string, selected: boolean) => {
    setSelectedDevices(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(deviceId);
      } else {
        next.delete(deviceId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedDevices(new Set(devices.map(d => d.id)));
  }, [devices]);

  const handleDeselectAll = useCallback(() => {
    setSelectedDevices(new Set());
  }, []);

  const handleConnect = useCallback(async (deviceId: string) => {
    setIsConnecting(prev => new Set(prev).add(deviceId));
    try {
      await onConnect?.(deviceId);
    } finally {
      setIsConnecting(prev => {
        const next = new Set(prev);
        next.delete(deviceId);
        return next;
      });
    }
  }, [onConnect]);

  const handleBulkConnect = useCallback(async () => {
    const deviceIds = Array.from(selectedDevices);
    if (deviceIds.length === 0) return;
    
    await onBulkConnect?.(deviceIds);
    setSelectedDevices(new Set());
  }, [selectedDevices, onBulkConnect]);

  const handleBulkDisconnect = useCallback(async () => {
    const deviceIds = Array.from(selectedDevices);
    if (deviceIds.length === 0) return;
    
    await onBulkDisconnect?.(deviceIds);
    setSelectedDevices(new Set());
  }, [selectedDevices, onBulkDisconnect]);

  const renderSignalBars = (rssi?: number) => {
    if (!rssi) return null;
    
    return (
      <SignalStrength $strength={rssi}>
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={`bar ${rssi > (-90 + i * 10) ? 'active' : ''}`}
          />
        ))}
      </SignalStrength>
    );
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const connectedDevices = devices.filter(d => d.paired);
  const availableDevices = devices.filter(d => !d.paired);

  return (
    <PanelContainer>
      <MainContent>
        <Card>
          <CardHeader>
            <CardTitle>Device Discovery</CardTitle>
            <ScanButton
              $scanning={scanning}
              onClick={onScan}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="icon">{scanning ? '⏸️' : '🔍'}</span>
              {scanning ? 'Stop Scan' : 'Scan Devices'}
            </ScanButton>
          </CardHeader>

          {selectedDevices.size > 0 && (
            <BulkActions>
              <BulkButton onClick={handleSelectAll}>
                Select All ({devices.length})
              </BulkButton>
              <BulkButton onClick={handleDeselectAll}>
                Deselect All
              </BulkButton>
              <BulkButton $variant="success" onClick={handleBulkConnect}>
                Connect Selected ({selectedDevices.size})
              </BulkButton>
              <BulkButton $variant="danger" onClick={handleBulkDisconnect}>
                Disconnect Selected ({selectedDevices.size})
              </BulkButton>
            </BulkActions>
          )}

          {devices.length === 0 ? (
            <EmptyState>
              <div className="icon">📡</div>
              <div className="message">No devices found</div>
              <div className="submessage">
                {scanning ? 'Scanning for Blackmagic cameras...' : 'Click "Scan Devices" to search for cameras'}
              </div>
            </EmptyState>
          ) : (
            <DeviceList>
              <AnimatePresence>
                {devices.map(device => (
                  <DeviceItem
                    key={device.id}
                    $selected={selectedDevices.has(device.id)}
                    $connected={device.paired}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <DeviceCheckbox
                      type="checkbox"
                      checked={selectedDevices.has(device.id)}
                      onChange={(e) => handleDeviceSelect(device.id, e.target.checked)}
                    />
                    
                    <DeviceInfo>
                      <DeviceName>
                        {device.favorite && '⭐ '}
                        {device.name}
                      </DeviceName>
                      <DeviceDetails>
                        <span>{device.model}</span>
                        {device.rssi && (
                          <>
                            <span>•</span>
                            <span>{device.rssi} dBm</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{new Date(device.lastSeen).toLocaleTimeString()}</span>
                      </DeviceDetails>
                    </DeviceInfo>
                    
                    {device.rssi && renderSignalBars(device.rssi)}
                    
                    <DeviceActions>
                      <ActionButton
                        onClick={() => onToggleFavorite?.(device.id)}
                      >
                        {device.favorite ? '★' : '☆'}
                      </ActionButton>
                      
                      {device.paired ? (
                        <ActionButton
                          $variant="danger"
                          onClick={() => onDisconnect?.(device.id)}
                        >
                          Disconnect
                        </ActionButton>
                      ) : (
                        <ActionButton
                          $variant="primary"
                          onClick={() => handleConnect(device.id)}
                          disabled={isConnecting.has(device.id)}
                        >
                          {isConnecting.has(device.id) ? 'Connecting...' : 'Connect'}
                        </ActionButton>
                      )}
                    </DeviceActions>
                  </DeviceItem>
                ))}
              </AnimatePresence>
            </DeviceList>
          )}
        </Card>
      </MainContent>

      <Sidebar>
        <Card>
          <CardHeader>
            <CardTitle>Connection History</CardTitle>
          </CardHeader>
          
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
              <div style={{ fontSize: '24px', marginBottom: '1rem' }}>📝</div>
              <div>No connection history</div>
            </div>
          ) : (
            <HistoryList>
              {history.slice(-10).reverse().map((item, index) => (
                <HistoryItem key={index} $success={item.success}>
                  <HistoryDevice>{item.deviceName}</HistoryDevice>
                  <HistoryTime>
                    {item.success ? 'Connected' : 'Failed'} at{' '}
                    {new Date(item.connectedAt).toLocaleTimeString()}
                    {item.duration && (
                      <>
                        <br />
                        Duration: {formatDuration(item.duration)}
                      </>
                    )}
                  </HistoryTime>
                </HistoryItem>
              ))}
            </HistoryList>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                {connectedDevices.length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Connected</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                {availableDevices.length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Available</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffc107' }}>
                {devices.filter(d => d.favorite).length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Favorites</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6c757d' }}>
                {history.filter(h => h.success).length}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Connections</div>
            </div>
          </div>
        </Card>
      </Sidebar>
    </PanelContainer>
  );
};

export default ConnectionPanel;