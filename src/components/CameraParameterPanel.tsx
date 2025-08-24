import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

interface CameraParameter {
  id: string;
  label: string;
  value: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string | number }[];
  unit?: string;
  locked?: boolean;
  category: 'exposure' | 'color' | 'focus' | 'audio';
}

interface CameraParameterPanelProps {
  deviceId: string;
  parameters: CameraParameter[];
  presets?: { id: string; name: string; parameters: Record<string, any> }[];
  onParameterChange?: (parameterId: string, value: number | string) => void;
  onParameterLock?: (parameterId: string, locked: boolean) => void;
  onApplyPreset?: (presetId: string) => void;
  onResetToDefaults?: () => void;
  onSaveAsPreset?: () => void;
}

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${props => props.theme.colors.surface};
  border-radius: ${props => props.theme.borderRadius};
  overflow: hidden;
`;

const TabBar = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.background};
`;

const Tab = styled(motion.button)<{ $active: boolean }>`
  flex: 1;
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  background: ${props => props.$active ? props.theme.colors.surface : 'transparent'};
  border: none;
  border-bottom: 2px solid ${props => props.$active ? props.theme.colors.primary : 'transparent'};
  color: ${props => props.$active ? props.theme.colors.text : props.theme.colors.textSecondary};
  font-size: 14px;
  font-weight: ${props => props.$active ? '600' : '400'};
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};

  &:hover {
    background: ${props => props.theme.colors.surface};
    color: ${props => props.theme.colors.text};
  }

  .icon {
    margin-right: ${props => props.theme.spacing.xs};
    font-size: 16px;
  }
`;

const TabContent = styled(motion.div)`
  flex: 1;
  padding: ${props => props.theme.spacing.lg};
  overflow-y: auto;
`;

const ParameterSection = styled.div`
  margin-bottom: ${props => props.theme.spacing.xl};
`;

const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0 0 ${props => props.theme.spacing.md} 0;
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};

  .icon {
    font-size: 18px;
    opacity: 0.7;
  }
`;

const ParameterGrid = styled.div`
  display: grid;
  gap: ${props => props.theme.spacing.lg};
`;

const ParameterItem = styled(motion.div)<{ $locked?: boolean }>`
  background: ${props => props.$locked ? props.theme.colors.warning + '10' : props.theme.colors.background};
  border: 1px solid ${props => props.$locked ? props.theme.colors.warning : props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius};
  padding: ${props => props.theme.spacing.md};
  transition: all ${props => props.theme.transitions.fast};

  &:hover {
    box-shadow: 0 2px 4px ${props => props.theme.colors.shadow};
  }
`;

const ParameterHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${props => props.theme.spacing.md};
`;

const ParameterLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.theme.colors.text};
`;

const ParameterControls = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
`;

const LockButton = styled.button<{ $locked?: boolean }>`
  background: none;
  border: none;
  color: ${props => props.$locked ? props.theme.colors.warning : props.theme.colors.textSecondary};
  font-size: 14px;
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};
  padding: ${props => props.theme.spacing.xs};
  border-radius: 4px;

  &:hover {
    background: ${props => props.theme.colors.surface};
    color: ${props => props.$locked ? props.theme.colors.warning : props.theme.colors.text};
  }
`;

const ParameterValue = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
  margin-bottom: ${props => props.theme.spacing.md};
`;

const ValueSlider = styled.input<{ $locked?: boolean }>`
  flex: 1;
  -webkit-appearance: none;
  height: 6px;
  border-radius: 3px;
  background: ${props => props.theme.colors.border};
  outline: none;
  opacity: ${props => props.$locked ? 0.5 : 1};
  pointer-events: ${props => props.$locked ? 'none' : 'auto'};

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${props => props.theme.colors.primary};
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all ${props => props.theme.transitions.fast};

    &:hover {
      transform: scale(1.1);
    }
  }

  &::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${props => props.theme.colors.primary};
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
`;

const ValueInput = styled.input<{ $locked?: boolean }>`
  width: 80px;
  padding: ${props => props.theme.spacing.sm};
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  color: ${props => props.theme.colors.text};
  font-size: 12px;
  text-align: center;
  opacity: ${props => props.$locked ? 0.5 : 1};
  pointer-events: ${props => props.$locked ? 'none' : 'auto'};

  &:focus {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }
`;

const ValueSelect = styled.select<{ $locked?: boolean }>`
  flex: 1;
  padding: ${props => props.theme.spacing.sm};
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  opacity: ${props => props.$locked ? 0.5 : 1};
  pointer-events: ${props => props.$locked ? 'none' : 'auto'};

  &:focus {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 1px;
  }
`;

const ValueUnit = styled.span`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  min-width: 30px;
`;

const PresetBar = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  margin-bottom: ${props => props.theme.spacing.lg};
  padding: ${props => props.theme.spacing.md};
  background: ${props => props.theme.colors.background};
  border-radius: ${props => props.theme.borderRadius};
  flex-wrap: wrap;
`;

const PresetButton = styled(motion.button)`
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.md};
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all ${props => props.theme.transitions.fast};
  white-space: nowrap;

  &:hover {
    background: ${props => props.theme.colors.primary}dd;
    transform: translateY(-1px);
  }
`;

const ActionButton = styled(motion.button)<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  background: ${props => {
    switch (props.$variant) {
      case 'primary': return props.theme.colors.primary;
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
    transform: translateY(-1px);
  }
`;

const tabs = [
  { id: 'exposure', label: 'Exposure', icon: '📸' },
  { id: 'color', label: 'Color', icon: '🎨' },
  { id: 'focus', label: 'Focus', icon: '🎯' },
  { id: 'audio', label: 'Audio', icon: '🎵' }
] as const;

type TabId = typeof tabs[number]['id'];

const CameraParameterPanel: React.FC<CameraParameterPanelProps> = ({
  deviceId,
  parameters = [],
  presets = [],
  onParameterChange,
  onParameterLock,
  onApplyPreset,
  onResetToDefaults,
  onSaveAsPreset
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('exposure');

  const handleParameterChange = useCallback((parameterId: string, value: number | string) => {
    onParameterChange?.(parameterId, value);
  }, [onParameterChange]);

  const handleLockToggle = useCallback((parameterId: string, locked: boolean) => {
    onParameterLock?.(parameterId, !locked);
  }, [onParameterLock]);

  const renderParameterControl = (parameter: CameraParameter) => {
    if (parameter.options) {
      // Dropdown for options
      return (
        <ValueSelect
          $locked={parameter.locked}
          value={parameter.value}
          onChange={(e) => handleParameterChange(parameter.id, e.target.value)}
        >
          {parameter.options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ValueSelect>
      );
    } else if (typeof parameter.value === 'number' && parameter.min !== undefined && parameter.max !== undefined) {
      // Slider for numeric ranges
      return (
        <ParameterValue>
          <ValueSlider
            type="range"
            $locked={parameter.locked}
            min={parameter.min}
            max={parameter.max}
            step={parameter.step || 1}
            value={parameter.value}
            onChange={(e) => handleParameterChange(parameter.id, parseFloat(e.target.value))}
          />
          <ValueInput
            type="number"
            $locked={parameter.locked}
            min={parameter.min}
            max={parameter.max}
            step={parameter.step || 1}
            value={parameter.value}
            onChange={(e) => handleParameterChange(parameter.id, parseFloat(e.target.value))}
          />
          {parameter.unit && <ValueUnit>{parameter.unit}</ValueUnit>}
        </ParameterValue>
      );
    } else {
      // Text input for other types
      return (
        <ValueInput
          type="text"
          $locked={parameter.locked}
          value={parameter.value}
          onChange={(e) => handleParameterChange(parameter.id, e.target.value)}
        />
      );
    }
  };

  const filteredParameters = parameters.filter(p => p.category === activeTab);

  return (
    <PanelContainer>
      <TabBar>
        {tabs.map(tab => (
          <Tab
            key={tab.id}
            $active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="icon">{tab.icon}</span>
            {tab.label}
          </Tab>
        ))}
      </TabBar>

      <TabContent
        key={activeTab}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
      >
        {presets.length > 0 && (
          <PresetBar>
            {presets.map(preset => (
              <PresetButton
                key={preset.id}
                onClick={() => onApplyPreset?.(preset.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {preset.name}
              </PresetButton>
            ))}
            <ActionButton $variant="secondary" onClick={onSaveAsPreset}>
              💾 Save Preset
            </ActionButton>
            <ActionButton $variant="danger" onClick={onResetToDefaults}>
              🔄 Reset
            </ActionButton>
          </PresetBar>
        )}

        <ParameterSection>
          <SectionTitle>
            <span className="icon">{tabs.find(t => t.id === activeTab)?.icon}</span>
            {tabs.find(t => t.id === activeTab)?.label} Controls
          </SectionTitle>
          
          <ParameterGrid>
            <AnimatePresence>
              {filteredParameters.map(parameter => (
                <ParameterItem
                  key={parameter.id}
                  $locked={parameter.locked}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  layout
                >
                  <ParameterHeader>
                    <ParameterLabel>{parameter.label}</ParameterLabel>
                    <ParameterControls>
                      <LockButton
                        $locked={parameter.locked}
                        onClick={() => handleLockToggle(parameter.id, parameter.locked || false)}
                        title={parameter.locked ? 'Unlock parameter' : 'Lock parameter'}
                      >
                        {parameter.locked ? '🔒' : '🔓'}
                      </LockButton>
                    </ParameterControls>
                  </ParameterHeader>
                  
                  {renderParameterControl(parameter)}
                </ParameterItem>
              ))}
            </AnimatePresence>
          </ParameterGrid>

          {filteredParameters.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem', 
              color: '#666',
              background: '#f8f9fa',
              borderRadius: '8px' 
            }}>
              <div style={{ fontSize: '24px', marginBottom: '1rem' }}>⚙️</div>
              <div>No {activeTab} parameters available</div>
              <div style={{ fontSize: '12px', marginTop: '0.5rem', opacity: 0.7 }}>
                Parameters will appear here when a camera is connected
              </div>
            </div>
          )}
        </ParameterSection>
      </TabContent>
    </PanelContainer>
  );
};

export default CameraParameterPanel;