import React, { useState, useEffect, useCallback } from 'react';
import type { CameraState, ControlResult } from '../services/control/CameraControlService';
import { CameraControlService } from '../services/control/CameraControlService';
import type { CameraCommand } from '../types';
import './CameraControlPanel.css';

export interface CameraControlPanelProps {
  deviceId: string;
  cameraState?: CameraState;
  controlService: CameraControlService;
  onControlResult?: (result: ControlResult) => void;
}

interface QuickControl {
  id: string;
  name: string;
  icon: string;
  command: Partial<CameraCommand>;
  description: string;
  category: 'recording' | 'exposure' | 'focus' | 'system';
  requiresConfirmation?: boolean;
}

const QUICK_CONTROLS: QuickControl[] = [
  {
    id: 'start_recording',
    name: 'Start Recording',
    icon: '⏺️',
    command: { commandId: 'RECORDING_START', priority: 'HIGH' },
    description: 'Begin recording video',
    category: 'recording'
  },
  {
    id: 'stop_recording',
    name: 'Stop Recording',
    icon: '⏹️',
    command: { commandId: 'RECORDING_STOP', priority: 'HIGH' },
    description: 'Stop recording video',
    category: 'recording'
  },
  {
    id: 'take_photo',
    name: 'Take Photo',
    icon: '📸',
    command: { commandId: 'TAKE_PHOTO', priority: 'NORMAL' },
    description: 'Capture a still photo',
    category: 'recording'
  },
  {
    id: 'auto_focus',
    name: 'Auto Focus',
    icon: '🎯',
    command: { commandId: 'AUTO_FOCUS', priority: 'NORMAL' },
    description: 'Trigger auto focus',
    category: 'focus'
  },
  {
    id: 'auto_expose',
    name: 'Auto Expose',
    icon: '✨',
    command: { commandId: 'AUTO_EXPOSE', priority: 'NORMAL' },
    description: 'Auto adjust exposure settings',
    category: 'exposure'
  },
  {
    id: 'white_balance',
    name: 'White Balance',
    icon: '🎨',
    command: { commandId: 'AUTO_WHITE_BALANCE', priority: 'LOW' },
    description: 'Auto white balance calibration',
    category: 'exposure'
  },
  {
    id: 'format_media',
    name: 'Format Media',
    icon: '💾',
    command: { commandId: 'FORMAT_MEDIA', priority: 'LOW' },
    description: 'Format storage media',
    category: 'system',
    requiresConfirmation: true
  },
  {
    id: 'reset_settings',
    name: 'Reset Settings',
    icon: '🔄',
    command: { commandId: 'FACTORY_RESET', priority: 'LOW' },
    description: 'Reset to factory defaults',
    category: 'system',
    requiresConfirmation: true
  }
];

export const CameraControlPanel: React.FC<CameraControlPanelProps> = ({
  deviceId,
  cameraState,
  controlService,
  onControlResult
}) => {
  const [activeTab, setActiveTab] = useState<'controls' | 'settings' | 'status'>('controls');
  const [isExecuting, setIsExecuting] = useState<Set<string>>(new Set());
  const [recentResults, setRecentResults] = useState<ControlResult[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connected');

  // Quick settings state
  const [quickSettings, setQuickSettings] = useState({
    iso: 800,
    aperture: 2.8,
    shutterAngle: 180,
    whiteBalance: 5600
  });

  // Monitor camera state changes
  useEffect(() => {
    const handleStateUpdate = () => {
      const currentState = controlService.getCameraState(deviceId);
      if (currentState) {
        setConnectionStatus(currentState.isResponding ? 'connected' : 'disconnected');
      }
    };

    // Set up event listeners
    controlService.on('command-success', handleCommandSuccess);
    controlService.on('command-error', handleCommandError);
    controlService.on('setting-updated', handleSettingUpdate);

    // Check initial state
    handleStateUpdate();

    return () => {
      controlService.off('command-success', handleCommandSuccess);
      controlService.off('command-error', handleCommandError);
      controlService.off('setting-updated', handleSettingUpdate);
    };
  }, [deviceId, controlService]);

  const handleCommandSuccess = useCallback((result: ControlResult) => {
    if (result.deviceId === deviceId) {
      setRecentResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
      setIsExecuting(prev => {
        const newSet = new Set(prev);
        newSet.delete(result.commandId);
        return newSet;
      });
      
      if (onControlResult) {
        onControlResult(result);
      }
    }
  }, [deviceId, onControlResult]);

  const handleCommandError = useCallback((result: ControlResult) => {
    if (result.deviceId === deviceId) {
      setRecentResults(prev => [result, ...prev.slice(0, 9)]);
      setIsExecuting(prev => {
        const newSet = new Set(prev);
        newSet.delete(result.commandId);
        return newSet;
      });
      
      if (onControlResult) {
        onControlResult(result);
      }
    }
  }, [deviceId, onControlResult]);

  const handleSettingUpdate = useCallback((update: any) => {
    if (update.deviceId === deviceId) {
      console.log(`Setting updated: ${update.setting} = ${update.value}`);
    }
  }, [deviceId]);

  /**
   * Execute quick control command
   */
  const executeQuickControl = useCallback(async (control: QuickControl) => {
    if (control.requiresConfirmation) {
      setShowConfirmDialog(control.id);
      return;
    }

    await executeCommand(control);
  }, []);

  /**
   * Execute command with loading state
   */
  const executeCommand = useCallback(async (control: QuickControl) => {
    if (isExecuting.has(control.id)) return;

    setIsExecuting(prev => new Set(prev).add(control.id));

    try {
      const command: CameraCommand = {
        ...control.command,
        commandId: control.command.commandId as any,
        priority: control.command.priority as any,
        parameters: control.command.parameters || {}
      };

      await controlService.sendCommand(deviceId, command);
      console.log(`✅ Executed ${control.name} on ${deviceId}`);
    } catch (error) {
      console.error(`❌ Failed to execute ${control.name}:`, error);
    }
  }, [deviceId, controlService, isExecuting]);

  /**
   * Update quick setting
   */
  const updateQuickSetting = useCallback(async (settingName: keyof typeof quickSettings, value: number) => {
    setQuickSettings(prev => ({ ...prev, [settingName]: value }));

    try {
      await controlService.updateCameraSetting(deviceId, settingName, value);
      console.log(`⚙️ Updated ${settingName} = ${value}`);
    } catch (error) {
      console.error(`❌ Failed to update ${settingName}:`, error);
    }
  }, [deviceId, controlService]);

  /**
   * Handle confirmation dialog
   */
  const handleConfirmAction = useCallback(async (confirmed: boolean) => {
    const controlId = showConfirmDialog;
    setShowConfirmDialog(null);

    if (confirmed && controlId) {
      const control = QUICK_CONTROLS.find(c => c.id === controlId);
      if (control) {
        await executeCommand(control);
      }
    }
  }, [showConfirmDialog, executeCommand]);

  /**
   * Get controls by category
   */
  const getControlsByCategory = (category: QuickControl['category']): QuickControl[] => {
    return QUICK_CONTROLS.filter(control => control.category === category);
  };

  /**
   * Format execution time
   */
  const formatExecutionTime = (time: number): string => {
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  return (
    <div className="camera-control-panel">
      <div className="panel-header">
        <h3>🎛️ Camera Control</h3>
        <div className="device-info">
          <span className="device-id">{deviceId.slice(-8)}</span>
          <span className={`connection-status ${connectionStatus}`}>
            {connectionStatus === 'connected' && '●'}
            {connectionStatus === 'connecting' && '○'}
            {connectionStatus === 'disconnected' && '×'}
          </span>
        </div>
      </div>

      <div className="panel-tabs">
        <button
          className={`tab-btn ${activeTab === 'controls' ? 'active' : ''}`}
          onClick={() => setActiveTab('controls')}
        >
          🎮 Controls
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
        <button
          className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          📊 Status
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'controls' && (
          <div className="controls-tab">
            <div className="control-category">
              <h4>📹 Recording</h4>
              <div className="control-grid">
                {getControlsByCategory('recording').map(control => (
                  <button
                    key={control.id}
                    className={`control-btn ${control.category} ${isExecuting.has(control.id) ? 'executing' : ''}`}
                    onClick={() => executeQuickControl(control)}
                    disabled={isExecuting.has(control.id) || connectionStatus !== 'connected'}
                    title={control.description}
                  >
                    {isExecuting.has(control.id) ? (
                      <span className="spinner"></span>
                    ) : (
                      <span className="control-icon">{control.icon}</span>
                    )}
                    <span className="control-name">{control.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="control-category">
              <h4>🎯 Focus & Exposure</h4>
              <div className="control-grid">
                {[...getControlsByCategory('focus'), ...getControlsByCategory('exposure')].map(control => (
                  <button
                    key={control.id}
                    className={`control-btn ${control.category} ${isExecuting.has(control.id) ? 'executing' : ''}`}
                    onClick={() => executeQuickControl(control)}
                    disabled={isExecuting.has(control.id) || connectionStatus !== 'connected'}
                    title={control.description}
                  >
                    {isExecuting.has(control.id) ? (
                      <span className="spinner"></span>
                    ) : (
                      <span className="control-icon">{control.icon}</span>
                    )}
                    <span className="control-name">{control.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="control-category">
              <h4>🛠️ System</h4>
              <div className="control-grid">
                {getControlsByCategory('system').map(control => (
                  <button
                    key={control.id}
                    className={`control-btn ${control.category} ${isExecuting.has(control.id) ? 'executing' : ''}`}
                    onClick={() => executeQuickControl(control)}
                    disabled={isExecuting.has(control.id) || connectionStatus !== 'connected'}
                    title={control.description}
                  >
                    {isExecuting.has(control.id) ? (
                      <span className="spinner"></span>
                    ) : (
                      <span className="control-icon">{control.icon}</span>
                    )}
                    <span className="control-name">{control.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <div className="quick-settings">
              <h4>⚡ Quick Settings</h4>
              
              <div className="setting-group">
                <label>ISO</label>
                <div className="setting-control">
                  <input
                    type="range"
                    min="100"
                    max="12800"
                    step="100"
                    value={quickSettings.iso}
                    onChange={(e) => updateQuickSetting('iso', parseInt(e.target.value))}
                    className="setting-slider"
                  />
                  <span className="setting-value">{quickSettings.iso}</span>
                </div>
              </div>

              <div className="setting-group">
                <label>Aperture</label>
                <div className="setting-control">
                  <input
                    type="range"
                    min="1.2"
                    max="22"
                    step="0.1"
                    value={quickSettings.aperture}
                    onChange={(e) => updateQuickSetting('aperture', parseFloat(e.target.value))}
                    className="setting-slider"
                  />
                  <span className="setting-value">f/{quickSettings.aperture}</span>
                </div>
              </div>

              <div className="setting-group">
                <label>Shutter Angle</label>
                <div className="setting-control">
                  <input
                    type="range"
                    min="45"
                    max="360"
                    step="5"
                    value={quickSettings.shutterAngle}
                    onChange={(e) => updateQuickSetting('shutterAngle', parseInt(e.target.value))}
                    className="setting-slider"
                  />
                  <span className="setting-value">{quickSettings.shutterAngle}°</span>
                </div>
              </div>

              <div className="setting-group">
                <label>White Balance</label>
                <div className="setting-control">
                  <input
                    type="range"
                    min="2500"
                    max="9500"
                    step="100"
                    value={quickSettings.whiteBalance}
                    onChange={(e) => updateQuickSetting('whiteBalance', parseInt(e.target.value))}
                    className="setting-slider"
                  />
                  <span className="setting-value">{quickSettings.whiteBalance}K</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <div className="status-tab">
            <div className="camera-status">
              <h4>📊 Camera Status</h4>
              
              {cameraState && (
                <div className="status-info">
                  <div className="status-item">
                    <span className="status-label">Recording:</span>
                    <span className={`status-value ${cameraState.isRecording ? 'recording' : ''}`}>
                      {cameraState.isRecording ? '● Recording' : '○ Standby'}
                    </span>
                  </div>
                  
                  {cameraState.batteryLevel !== undefined && (
                    <div className="status-item">
                      <span className="status-label">Battery:</span>
                      <span className="status-value">{cameraState.batteryLevel}%</span>
                    </div>
                  )}
                  
                  {cameraState.storageRemaining !== undefined && (
                    <div className="status-item">
                      <span className="status-label">Storage:</span>
                      <span className="status-value">{cameraState.storageRemaining}GB</span>
                    </div>
                  )}
                  
                  {cameraState.temperature !== undefined && (
                    <div className="status-item">
                      <span className="status-label">Temperature:</span>
                      <span className="status-value">{cameraState.temperature.toFixed(1)}°C</span>
                    </div>
                  )}
                  
                  <div className="status-item">
                    <span className="status-label">Last Command:</span>
                    <span className="status-value">
                      {cameraState.lastCommandTime.toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {cameraState.firmwareVersion && (
                    <div className="status-item">
                      <span className="status-label">Firmware:</span>
                      <span className="status-value">{cameraState.firmwareVersion}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="recent-results">
              <h4>📝 Recent Commands</h4>
              {recentResults.length === 0 ? (
                <div className="no-results">
                  <span className="no-results-icon">📭</span>
                  <span className="no-results-text">No recent commands</span>
                </div>
              ) : (
                <div className="results-list">
                  {recentResults.map((result, index) => (
                    <div
                      key={`${result.commandId}-${result.timestamp.getTime()}`}
                      className={`result-item ${result.success ? 'success' : 'error'}`}
                    >
                      <div className="result-header">
                        <span className="result-command">{result.commandId}</span>
                        <span className="result-time">
                          {formatExecutionTime(result.executionTime)}
                        </span>
                      </div>
                      {!result.success && result.error && (
                        <div className="result-error">{result.error}</div>
                      )}
                      <div className="result-timestamp">
                        {result.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog">
            <h4>⚠️ Confirm Action</h4>
            <p>
              Are you sure you want to execute "
              {QUICK_CONTROLS.find(c => c.id === showConfirmDialog)?.name}"?
            </p>
            <div className="dialog-actions">
              <button
                className="cancel-btn"
                onClick={() => handleConfirmAction(false)}
              >
                Cancel
              </button>
              <button
                className="confirm-btn"
                onClick={() => handleConfirmAction(true)}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraControlPanel;