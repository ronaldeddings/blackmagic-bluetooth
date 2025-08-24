import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

interface ViewfinderControlsProps {
  isPlaying?: boolean;
  isRecording?: boolean;
  isFullscreen?: boolean;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  volume?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onRecord?: () => void;
  onSnapshot?: () => void;
  onFullscreen?: () => void;
  onQualityChange?: (quality: 'low' | 'medium' | 'high' | 'ultra') => void;
  onVolumeChange?: (volume: number) => void;
  onSettings?: () => void;
}

const ControlsOverlay = styled(motion.div)<{ $visible: boolean }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  padding: ${props => props.theme.spacing.lg} ${props => props.theme.spacing.md} ${props => props.theme.spacing.md};
  opacity: ${props => props.$visible ? 1 : 0};
  pointer-events: ${props => props.$visible ? 'auto' : 'none'};
  transition: opacity ${props => props.theme.transitions.default};
  z-index: 10;
`;

const ControlsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
  color: white;

  @media (max-width: 768px) {
    flex-wrap: wrap;
    gap: ${props => props.theme.spacing.sm};
  }
`;

const ControlButton = styled(motion.button)<{ $active?: boolean; $variant?: 'danger' | 'primary' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: ${props => {
    if (props.$active) return 'rgba(255, 255, 255, 0.3)';
    if (props.$variant === 'danger') return 'rgba(220, 53, 69, 0.8)';
    if (props.$variant === 'primary') return 'rgba(0, 123, 255, 0.8)';
    return 'rgba(255, 255, 255, 0.2)';
  }};
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};
  backdrop-filter: blur(4px);

  &:hover {
    background: rgba(255, 255, 255, 0.4);
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }

  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }
`;

const PlayPauseButton = styled(ControlButton)`
  width: 48px;
  height: 48px;
  font-size: 20px;
  margin-right: ${props => props.theme.spacing.sm};

  @media (max-width: 768px) {
    width: 42px;
    height: 42px;
    font-size: 18px;
  }
`;

const RecordButton = styled(ControlButton)<{ $recording?: boolean }>`
  animation: ${props => props.$recording ? 'pulse 1.5s infinite' : 'none'};

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
`;

const QualitySelector = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
`;

const QualityButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  color: white;
  font-size: 12px;
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.sm};
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};
  backdrop-filter: blur(4px);

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const QualityDropdown = styled(motion.div)`
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: ${props => props.theme.spacing.sm};
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${props => props.theme.borderRadius};
  padding: ${props => props.theme.spacing.sm};
  backdrop-filter: blur(8px);
  min-width: 120px;
`;

const QualityOption = styled.button<{ $active?: boolean }>`
  display: block;
  width: 100%;
  text-align: left;
  background: ${props => props.$active ? 'rgba(255, 255, 255, 0.2)' : 'transparent'};
  border: none;
  color: white;
  font-size: 12px;
  padding: ${props => props.theme.spacing.sm};
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};
  border-radius: 4px;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const VolumeControl = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const VolumeSlider = styled.input`
  -webkit-appearance: none;
  width: 80px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.3);
  outline: none;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
  
  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
`;

const Spacer = styled.div`
  flex: 1;
`;

const InfoDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);

  @media (max-width: 768px) {
    font-size: 10px;
    gap: ${props => props.theme.spacing.sm};
  }
`;

const StatusIndicator = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.xs};

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.$color};
  }
`;

const ViewfinderControls: React.FC<ViewfinderControlsProps> = ({
  isPlaying = false,
  isRecording = false,
  isFullscreen = false,
  quality = 'medium',
  volume = 0.8,
  onPlay,
  onPause,
  onStop,
  onRecord,
  onSnapshot,
  onFullscreen,
  onQualityChange,
  onVolumeChange,
  onSettings
}) => {
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      onPause?.();
    } else {
      onPlay?.();
    }
  }, [isPlaying, onPlay, onPause]);

  const handleQualitySelect = useCallback((newQuality: 'low' | 'medium' | 'high' | 'ultra') => {
    onQualityChange?.(newQuality);
    setShowQualityDropdown(false);
  }, [onQualityChange]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    onVolumeChange?.(newVolume);
  }, [onVolumeChange]);

  const getQualityLabel = (q: string): string => {
    switch (q) {
      case 'low': return '480p';
      case 'medium': return '720p';
      case 'high': return '1080p';
      case 'ultra': return '4K';
      default: return '720p';
    }
  };

  const getVolumeIcon = (vol: number): string => {
    if (vol === 0) return '🔇';
    if (vol < 0.3) return '🔈';
    if (vol < 0.7) return '🔉';
    return '🔊';
  };

  return (
    <ControlsOverlay
      $visible={controlsVisible}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: controlsVisible ? 1 : 0, y: controlsVisible ? 0 : 20 }}
      onMouseEnter={() => setControlsVisible(true)}
      onMouseLeave={() => setControlsVisible(false)}
    >
      <ControlsContainer>
        <PlayPauseButton
          onClick={handlePlayPause}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </PlayPauseButton>

        <ControlButton
          onClick={onStop}
          title="Stop"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          ⏹️
        </ControlButton>

        <RecordButton
          $variant="danger"
          $recording={isRecording}
          onClick={onRecord}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          🔴
        </RecordButton>

        <ControlButton
          onClick={onSnapshot}
          title="Take Snapshot"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          📷
        </ControlButton>

        <QualitySelector>
          <QualityButton
            onClick={() => setShowQualityDropdown(!showQualityDropdown)}
            title="Change Quality"
          >
            {getQualityLabel(quality)}
          </QualityButton>
          
          {showQualityDropdown && (
            <QualityDropdown
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              {(['low', 'medium', 'high', 'ultra'] as const).map(q => (
                <QualityOption
                  key={q}
                  $active={quality === q}
                  onClick={() => handleQualitySelect(q)}
                >
                  {getQualityLabel(q)} - {q.charAt(0).toUpperCase() + q.slice(1)}
                </QualityOption>
              ))}
            </QualityDropdown>
          )}
        </QualitySelector>

        <VolumeControl>
          <span style={{ fontSize: '14px' }}>{getVolumeIcon(volume)}</span>
          <VolumeSlider
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        </VolumeControl>

        <Spacer />

        <InfoDisplay>
          <StatusIndicator $color={isPlaying ? '#28a745' : '#6c757d'}>
            {isPlaying ? 'LIVE' : 'STOPPED'}
          </StatusIndicator>
          
          {isRecording && (
            <StatusIndicator $color="#dc3545">
              REC
            </StatusIndicator>
          )}
          
          <span>{getQualityLabel(quality)}</span>
          <span>•</span>
          <span>30 FPS</span>
        </InfoDisplay>

        <ControlButton
          onClick={onSettings}
          title="Stream Settings"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          ⚙️
        </ControlButton>

        <ControlButton
          $active={isFullscreen}
          onClick={onFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {isFullscreen ? '⤶' : '⤢'}
        </ControlButton>
      </ControlsContainer>
    </ControlsOverlay>
  );
};

export default ViewfinderControls;