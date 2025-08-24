import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

interface CameraCardProps {
  id: string;
  name: string;
  model: string;
  connected: boolean;
  battery: number;
  recording: boolean;
  streaming: boolean;
  signalStrength: number;
  lastSeen: Date;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onStartStreaming?: () => void;
  onStopStreaming?: () => void;
  onSettings?: () => void;
}

const Card = styled(motion.div)<{ $connected: boolean }>`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius};
  padding: ${props => props.theme.spacing.lg};
  box-shadow: 0 2px 4px ${props => props.theme.colors.shadow};
  position: relative;
  opacity: ${props => props.$connected ? 1 : 0.7};
  transition: all ${props => props.theme.transitions.default};

  &:hover {
    box-shadow: 0 4px 8px ${props => props.theme.colors.shadow};
    transform: translateY(-2px);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${props => props.$connected ? props.theme.colors.success : props.theme.colors.textSecondary};
    border-radius: ${props => props.theme.borderRadius} ${props => props.theme.borderRadius} 0 0;
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${props => props.theme.spacing.md};
`;

const CameraInfo = styled.div`
  flex: 1;
`;

const CameraName = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0 0 ${props => props.theme.spacing.xs} 0;
`;

const CameraModel = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatusBadge = styled.div<{ $variant: 'online' | 'offline' | 'recording' | 'streaming' }>`
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.sm};
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: ${props => {
    switch (props.$variant) {
      case 'online': return props.theme.colors.success + '20';
      case 'recording': return props.theme.colors.danger + '20';
      case 'streaming': return props.theme.colors.info + '20';
      default: return props.theme.colors.textSecondary + '20';
    }
  }};
  color: ${props => {
    switch (props.$variant) {
      case 'online': return props.theme.colors.success;
      case 'recording': return props.theme.colors.danger;
      case 'streaming': return props.theme.colors.info;
      default: return props.theme.colors.textSecondary;
    }
  }};
`;

const Metrics = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${props => props.theme.spacing.md};
  margin-bottom: ${props => props.theme.spacing.lg};
`;

const MetricItem = styled.div`
  text-align: center;
`;

const MetricValue = styled.div<{ $status?: 'good' | 'warning' | 'critical' }>`
  font-size: 16px;
  font-weight: 600;
  color: ${props => {
    switch (props.$status) {
      case 'good': return props.theme.colors.success;
      case 'warning': return props.theme.colors.warning;
      case 'critical': return props.theme.colors.danger;
      default: return props.theme.colors.text;
    }
  }};
  margin-bottom: ${props => props.theme.spacing.xs};
`;

const MetricLabel = styled.div`
  font-size: 10px;
  color: ${props => props.theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  flex-wrap: wrap;
`;

const ActionButton = styled(motion.button)<{ $variant?: 'primary' | 'danger' | 'success' | 'secondary' }>`
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  border: none;
  border-radius: ${props => props.theme.borderRadius};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};
  background: ${props => {
    switch (props.$variant) {
      case 'primary': return props.theme.colors.primary;
      case 'danger': return props.theme.colors.danger;
      case 'success': return props.theme.colors.success;
      default: return props.theme.colors.textSecondary;
    }
  }};
  color: white;
  flex: 1;
  min-width: 80px;

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .icon {
    margin-right: ${props => props.theme.spacing.xs};
  }
`;

const SignalStrengthIndicator = styled.div<{ $strength: number }>`
  display: flex;
  align-items: center;
  gap: 2px;
  
  .bar {
    width: 3px;
    height: 12px;
    background: ${props => props.theme.colors.textSecondary}30;
    border-radius: 1px;
    
    &.active {
      background: ${props => {
        if (props.$strength > 75) return props.theme.colors.success;
        if (props.$strength > 50) return props.theme.colors.warning;
        return props.theme.colors.danger;
      }};
    }
  }
`;

const BatteryIndicator = styled.div<{ $level: number }>`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.xs};
  
  .battery-icon {
    width: 20px;
    height: 12px;
    border: 1px solid ${props => props.theme.colors.textSecondary};
    border-radius: 2px;
    position: relative;
    
    &::after {
      content: '';
      position: absolute;
      right: -3px;
      top: 3px;
      width: 2px;
      height: 6px;
      background: ${props => props.theme.colors.textSecondary};
      border-radius: 0 1px 1px 0;
    }
    
    .battery-fill {
      position: absolute;
      top: 1px;
      left: 1px;
      bottom: 1px;
      width: ${props => Math.max(0, props.$level - 2)}%;
      background: ${props => {
        if (props.$level > 50) return props.theme.colors.success;
        if (props.$level > 20) return props.theme.colors.warning;
        return props.theme.colors.danger;
      }};
      border-radius: 1px;
      transition: all ${props => props.theme.transitions.default};
    }
  }
  
  .battery-text {
    font-size: 11px;
    color: ${props => props.theme.colors.textSecondary};
  }
`;

const LastSeenText = styled.div`
  font-size: 10px;
  color: ${props => props.theme.colors.textSecondary};
  text-align: center;
  margin-top: ${props => props.theme.spacing.sm};
`;

const CameraCard: React.FC<CameraCardProps> = ({
  id,
  name,
  model,
  connected,
  battery,
  recording,
  streaming,
  signalStrength,
  lastSeen,
  onConnect,
  onDisconnect,
  onStartRecording,
  onStopRecording,
  onStartStreaming,
  onStopStreaming,
  onSettings
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = useCallback(async (action: () => void | Promise<void>) => {
    setIsLoading(true);
    try {
      await action();
    } catch (error) {
      console.error('Camera action failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getStatus = (): 'online' | 'offline' | 'recording' | 'streaming' => {
    if (!connected) return 'offline';
    if (recording) return 'recording';
    if (streaming) return 'streaming';
    return 'online';
  };

  const getBatteryStatus = (level: number): 'good' | 'warning' | 'critical' => {
    if (level > 50) return 'good';
    if (level > 20) return 'warning';
    return 'critical';
  };

  const getSignalStatus = (strength: number): 'good' | 'warning' | 'critical' => {
    if (strength > 75) return 'good';
    if (strength > 50) return 'warning';
    return 'critical';
  };

  const formatLastSeen = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const renderSignalBars = () => {
    return Array.from({ length: 4 }, (_, i) => (
      <div
        key={i}
        className={`bar ${signalStrength > (i + 1) * 25 ? 'active' : ''}`}
        style={{ height: `${6 + i * 2}px` }}
      />
    ));
  };

  return (
    <Card
      $connected={connected}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <CardHeader>
        <CameraInfo>
          <CameraName>{name}</CameraName>
          <CameraModel>{model}</CameraModel>
        </CameraInfo>
        <StatusBadge $variant={getStatus()}>
          {getStatus()}
        </StatusBadge>
      </CardHeader>

      <Metrics>
        <MetricItem>
          <MetricValue $status={getBatteryStatus(battery)}>
            <BatteryIndicator $level={battery}>
              <div className="battery-icon">
                <div className="battery-fill" />
              </div>
              <span className="battery-text">{battery}%</span>
            </BatteryIndicator>
          </MetricValue>
          <MetricLabel>Battery</MetricLabel>
        </MetricItem>

        <MetricItem>
          <MetricValue $status={getSignalStatus(signalStrength)}>
            <SignalStrengthIndicator $strength={signalStrength}>
              {renderSignalBars()}
              <span style={{ fontSize: '11px', marginLeft: '4px' }}>
                {signalStrength}%
              </span>
            </SignalStrengthIndicator>
          </MetricValue>
          <MetricLabel>Signal</MetricLabel>
        </MetricItem>

        <MetricItem>
          <MetricValue>
            {connected ? '🟢' : '🔴'}
          </MetricValue>
          <MetricLabel>Status</MetricLabel>
        </MetricItem>
      </Metrics>

      <ActionButtons>
        {connected ? (
          <>
            <ActionButton
              $variant="danger"
              onClick={() => handleAction(onDisconnect!)}
              disabled={isLoading}
            >
              <span className="icon">🔌</span>
              Disconnect
            </ActionButton>
            
            {recording ? (
              <ActionButton
                $variant="secondary"
                onClick={() => handleAction(onStopRecording!)}
                disabled={isLoading}
              >
                <span className="icon">⏹️</span>
                Stop Rec
              </ActionButton>
            ) : (
              <ActionButton
                $variant="danger"
                onClick={() => handleAction(onStartRecording!)}
                disabled={isLoading}
              >
                <span className="icon">🔴</span>
                Record
              </ActionButton>
            )}
            
            {streaming ? (
              <ActionButton
                $variant="secondary"
                onClick={() => handleAction(onStopStreaming!)}
                disabled={isLoading}
              >
                <span className="icon">⏹️</span>
                Stop Stream
              </ActionButton>
            ) : (
              <ActionButton
                $variant="success"
                onClick={() => handleAction(onStartStreaming!)}
                disabled={isLoading}
              >
                <span className="icon">📺</span>
                Stream
              </ActionButton>
            )}
            
            <ActionButton
              $variant="secondary"
              onClick={() => handleAction(onSettings!)}
              disabled={isLoading}
            >
              <span className="icon">⚙️</span>
              Settings
            </ActionButton>
          </>
        ) : (
          <ActionButton
            $variant="primary"
            onClick={() => handleAction(onConnect!)}
            disabled={isLoading}
            style={{ flex: 'none', width: '100%' }}
          >
            <span className="icon">🔗</span>
            {isLoading ? 'Connecting...' : 'Connect'}
          </ActionButton>
        )}
      </ActionButtons>

      {connected && (
        <LastSeenText>
          Last activity: {formatLastSeen(lastSeen)}
        </LastSeenText>
      )}
    </Card>
  );
};

export default CameraCard;