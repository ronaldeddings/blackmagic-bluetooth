import React, { useState, useCallback } from 'react';
import type { CameraCommand } from '../types';
import './BulkOperationsPanel.css';

export interface BulkOperationsPanelProps {
  selectedCameras: string[];
  connectedCameras: string[];
  onBulkOperation: (command: CameraCommand) => Promise<void>;
  disabled?: boolean;
}

export interface QuickPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  settings: Record<string, any>;
}

const QUICK_PRESETS: QuickPreset[] = [
  {
    id: 'interview',
    name: 'Interview',
    description: '1080p24, Natural lighting',
    icon: '🎤',
    settings: {
      resolution: { width: 1920, height: 1080, fps: 24 },
      iso: 400,
      aperture: 280, // f/2.8
      white_balance: 5600,
      codec: 'H.264'
    }
  },
  {
    id: 'event',
    name: 'Event',
    description: '1080p30, Auto settings',
    icon: '🎉',
    settings: {
      resolution: { width: 1920, height: 1080, fps: 30 },
      iso: 800,
      aperture: 400, // f/4.0
      white_balance: 4000,
      codec: 'H.264'
    }
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: '4K24, RAW recording',
    icon: '🎬',
    settings: {
      resolution: { width: 3840, height: 2160, fps: 24 },
      iso: 200,
      aperture: 180, // f/1.8
      white_balance: 5600,
      codec: 'Blackmagic RAW',
      quality: '5:1'
    }
  },
  {
    id: 'livestream',
    name: 'Live Stream',
    description: '1080p60, Optimized for streaming',
    icon: '📺',
    settings: {
      resolution: { width: 1920, height: 1080, fps: 60 },
      iso: 400,
      aperture: 350, // f/3.5
      white_balance: 5000,
      codec: 'H.264'
    }
  }
];

export const BulkOperationsPanel: React.FC<BulkOperationsPanelProps> = ({
  selectedCameras,
  connectedCameras,
  onBulkOperation,
  disabled = false
}) => {
  const [activeTab, setActiveTab] = useState<'recording' | 'settings' | 'presets' | 'advanced'>('recording');
  const [isExecuting, setIsExecuting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null);

  // Recording controls
  const [recordingSettings, setRecordingSettings] = useState({
    clipName: '',
    duration: 0, // 0 = unlimited
    autoStop: false
  });

  // Settings controls
  const [bulkSettings, setBulkSettings] = useState({
    resolution: { width: 1920, height: 1080, fps: 30 },
    iso: 400,
    aperture: 280,
    white_balance: 5600,
    codec: 'H.264'
  });

  const handleBulkOperation = useCallback(async (command: CameraCommand) => {
    if (disabled || isExecuting || selectedCameras.length === 0) return;

    setIsExecuting(true);
    try {
      await onBulkOperation(command);
      console.log(`✅ Bulk operation ${command.commandId} completed`);
    } catch (error) {
      console.error(`❌ Bulk operation ${command.commandId} failed:`, error);
    } finally {
      setIsExecuting(false);
      setShowConfirmDialog(null);
    }
  }, [disabled, isExecuting, selectedCameras, onBulkOperation]);

  const handleStartRecording = useCallback(() => {
    const command: CameraCommand = {
      commandId: 'RECORDING_START' as any,
      parameters: {
        clipName: recordingSettings.clipName || `Recording_${Date.now()}`,
        duration: recordingSettings.duration,
        autoStop: recordingSettings.autoStop
      },
      priority: 'HIGH' as any
    };

    if (selectedCameras.length > 1) {
      setShowConfirmDialog('start-recording');
    } else {
      handleBulkOperation(command);
    }
  }, [recordingSettings, selectedCameras, handleBulkOperation]);

  const handleStopRecording = useCallback(() => {
    const command: CameraCommand = {
      commandId: 'RECORDING_STOP' as any,
      parameters: {},
      priority: 'HIGH' as any
    };

    handleBulkOperation(command);
  }, [handleBulkOperation]);

  const handleApplySettings = useCallback(() => {
    const command: CameraCommand = {
      commandId: 'CAMERA_SETTINGS_UPDATE' as any,
      parameters: bulkSettings,
      priority: 'NORMAL' as any
    };

    if (selectedCameras.length > 1) {
      setShowConfirmDialog('apply-settings');
    } else {
      handleBulkOperation(command);
    }
  }, [bulkSettings, selectedCameras, handleBulkOperation]);

  const handleApplyPreset = useCallback((preset: QuickPreset) => {
    const command: CameraCommand = {
      commandId: 'CAMERA_SETTINGS_UPDATE' as any,
      parameters: preset.settings,
      priority: 'NORMAL' as any
    };

    if (selectedCameras.length > 1) {
      setShowConfirmDialog(`preset-${preset.id}`);
    } else {
      handleBulkOperation(command);
    }
  }, [selectedCameras, handleBulkOperation]);

  const ConfirmationDialog: React.FC<{ operation: string }> = ({ operation }) => (
    <div className="confirmation-dialog-overlay">
      <div className="confirmation-dialog">
        <h3>⚠️ Confirm Bulk Operation</h3>
        <p>
          Apply "{operation}" to <strong>{selectedCameras.length}</strong> selected cameras?
        </p>
        <div className="dialog-actions">
          <button 
            className="cancel-btn"
            onClick={() => setShowConfirmDialog(null)}
          >
            Cancel
          </button>
          <button 
            className="confirm-btn"
            onClick={() => {
              if (operation === 'start-recording') {
                handleBulkOperation({
                  commandId: 'RECORDING_START' as any,
                  parameters: recordingSettings,
                  priority: 'HIGH' as any
                });
              } else if (operation === 'apply-settings') {
                handleBulkOperation({
                  commandId: 'CAMERA_SETTINGS_UPDATE' as any,
                  parameters: bulkSettings,
                  priority: 'NORMAL' as any
                });
              } else if (operation.startsWith('preset-')) {
                const presetId = operation.replace('preset-', '');
                const preset = QUICK_PRESETS.find(p => p.id === presetId);
                if (preset) {
                  handleBulkOperation({
                    commandId: 'CAMERA_SETTINGS_UPDATE' as any,
                    parameters: preset.settings,
                    priority: 'NORMAL' as any
                  });
                }
              }
            }}
          >
            Apply to {selectedCameras.length} Cameras
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bulk-operations-panel">
      <div className="panel-header">
        <h3>📡 Bulk Operations</h3>
        <div className="selection-info">
          <span className="selected-count">{selectedCameras.length}</span> 
          <span className="selection-text">of</span>
          <span className="connected-count">{connectedCameras.length}</span>
          <span className="selection-text">selected</span>
        </div>
      </div>

      <div className="panel-tabs">
        <button 
          className={`tab-btn ${activeTab === 'recording' ? 'active' : ''}`}
          onClick={() => setActiveTab('recording')}
        >
          ⏺ Recording
        </button>
        <button 
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
        <button 
          className={`tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveTab('presets')}
        >
          📋 Presets
        </button>
        <button 
          className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
          onClick={() => setActiveTab('advanced')}
        >
          🔧 Advanced
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'recording' && (
          <div className="recording-controls">
            <div className="control-group">
              <label htmlFor="clip-name">Clip Name (optional)</label>
              <input
                id="clip-name"
                type="text"
                value={recordingSettings.clipName}
                onChange={(e) => setRecordingSettings(prev => ({
                  ...prev,
                  clipName: e.target.value
                }))}
                placeholder="Auto-generated if empty"
              />
            </div>

            <div className="control-group">
              <label htmlFor="duration">Duration (minutes, 0 = unlimited)</label>
              <input
                id="duration"
                type="number"
                min="0"
                max="1440"
                value={recordingSettings.duration}
                onChange={(e) => setRecordingSettings(prev => ({
                  ...prev,
                  duration: parseInt(e.target.value) || 0
                }))}
              />
            </div>

            <div className="control-group">
              <label>
                <input
                  type="checkbox"
                  checked={recordingSettings.autoStop}
                  onChange={(e) => setRecordingSettings(prev => ({
                    ...prev,
                    autoStop: e.target.checked
                  }))}
                />
                Auto-stop when storage is low
              </label>
            </div>

            <div className="recording-actions">
              <button
                className="record-btn start"
                onClick={handleStartRecording}
                disabled={disabled || isExecuting || selectedCameras.length === 0}
              >
                {isExecuting ? (
                  <>
                    <span className="spinner"></span>
                    Starting...
                  </>
                ) : (
                  <>⏺ Start Recording</>
                )}
              </button>

              <button
                className="record-btn stop"
                onClick={handleStopRecording}
                disabled={disabled || isExecuting || selectedCameras.length === 0}
              >
                ⏹ Stop Recording
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-controls">
            <div className="settings-grid">
              <div className="setting-group">
                <label>Resolution</label>
                <select
                  value={`${bulkSettings.resolution.width}x${bulkSettings.resolution.height}`}
                  onChange={(e) => {
                    const [width, height] = e.target.value.split('x').map(Number);
                    setBulkSettings(prev => ({
                      ...prev,
                      resolution: { ...prev.resolution, width, height }
                    }));
                  }}
                >
                  <option value="1920x1080">1920×1080 (FHD)</option>
                  <option value="2560x1440">2560×1440 (QHD)</option>
                  <option value="3840x2160">3840×2160 (4K UHD)</option>
                  <option value="4096x2160">4096×2160 (4K DCI)</option>
                </select>
              </div>

              <div className="setting-group">
                <label>Frame Rate</label>
                <select
                  value={bulkSettings.resolution.fps}
                  onChange={(e) => setBulkSettings(prev => ({
                    ...prev,
                    resolution: { ...prev.resolution, fps: parseInt(e.target.value) }
                  }))}
                >
                  <option value={23.98}>23.98fps</option>
                  <option value={24}>24fps</option>
                  <option value={25}>25fps</option>
                  <option value={30}>30fps</option>
                  <option value={50}>50fps</option>
                  <option value={60}>60fps</option>
                </select>
              </div>

              <div className="setting-group">
                <label>ISO</label>
                <select
                  value={bulkSettings.iso}
                  onChange={(e) => setBulkSettings(prev => ({
                    ...prev,
                    iso: parseInt(e.target.value)
                  }))}
                >
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={400}>400</option>
                  <option value={800}>800</option>
                  <option value={1600}>1600</option>
                  <option value={3200}>3200</option>
                </select>
              </div>

              <div className="setting-group">
                <label>Aperture</label>
                <select
                  value={bulkSettings.aperture}
                  onChange={(e) => setBulkSettings(prev => ({
                    ...prev,
                    aperture: parseInt(e.target.value)
                  }))}
                >
                  <option value={140}>f/1.4</option>
                  <option value={180}>f/1.8</option>
                  <option value={280}>f/2.8</option>
                  <option value={400}>f/4.0</option>
                  <option value={560}>f/5.6</option>
                  <option value={800}>f/8.0</option>
                </select>
              </div>

              <div className="setting-group">
                <label>White Balance</label>
                <select
                  value={bulkSettings.white_balance}
                  onChange={(e) => setBulkSettings(prev => ({
                    ...prev,
                    white_balance: parseInt(e.target.value)
                  }))}
                >
                  <option value={3200}>3200K (Tungsten)</option>
                  <option value={4000}>4000K (Cool White)</option>
                  <option value={5600}>5600K (Daylight)</option>
                  <option value={6500}>6500K (Cloudy)</option>
                  <option value={7500}>7500K (Shade)</option>
                </select>
              </div>

              <div className="setting-group">
                <label>Codec</label>
                <select
                  value={bulkSettings.codec}
                  onChange={(e) => setBulkSettings(prev => ({
                    ...prev,
                    codec: e.target.value
                  }))}
                >
                  <option value="H.264">H.264</option>
                  <option value="H.265">H.265</option>
                  <option value="ProRes">ProRes</option>
                  <option value="Blackmagic RAW">Blackmagic RAW</option>
                </select>
              </div>
            </div>

            <button
              className="apply-settings-btn"
              onClick={handleApplySettings}
              disabled={disabled || isExecuting || selectedCameras.length === 0}
            >
              {isExecuting ? (
                <>
                  <span className="spinner"></span>
                  Applying...
                </>
              ) : (
                <>⚙️ Apply Settings</>
              )}
            </button>
          </div>
        )}

        {activeTab === 'presets' && (
          <div className="presets-controls">
            <div className="presets-grid">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="preset-card"
                  onClick={() => handleApplyPreset(preset)}
                  disabled={disabled || isExecuting || selectedCameras.length === 0}
                >
                  <div className="preset-icon">{preset.icon}</div>
                  <div className="preset-info">
                    <div className="preset-name">{preset.name}</div>
                    <div className="preset-description">{preset.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="advanced-controls">
            <div className="advanced-actions">
              <button
                className="advanced-btn"
                onClick={() => handleBulkOperation({
                  commandId: 'FACTORY_RESET' as any,
                  parameters: {},
                  priority: 'LOW' as any
                })}
                disabled={disabled || isExecuting || selectedCameras.length === 0}
              >
                🏭 Factory Reset
              </button>

              <button
                className="advanced-btn"
                onClick={() => handleBulkOperation({
                  commandId: 'CALIBRATE' as any,
                  parameters: {},
                  priority: 'LOW' as any
                })}
                disabled={disabled || isExecuting || selectedCameras.length === 0}
              >
                🎯 Calibrate
              </button>

              <button
                className="advanced-btn"
                onClick={() => handleBulkOperation({
                  commandId: 'SYNC_TIMECODE' as any,
                  parameters: { masterDevice: selectedCameras[0] },
                  priority: 'NORMAL' as any
                })}
                disabled={disabled || isExecuting || selectedCameras.length < 2}
              >
                🕐 Sync Timecode
              </button>

              <button
                className="advanced-btn"
                onClick={() => handleBulkOperation({
                  commandId: 'FIRMWARE_CHECK' as any,
                  parameters: {},
                  priority: 'LOW' as any
                })}
                disabled={disabled || isExecuting || selectedCameras.length === 0}
              >
                🔄 Check Firmware
              </button>
            </div>

            <div className="advanced-warning">
              <p>⚠️ Advanced operations may take longer to complete and could affect camera availability.</p>
            </div>
          </div>
        )}
      </div>

      {selectedCameras.length === 0 && (
        <div className="no-selection">
          <div className="no-selection-icon">📱</div>
          <p>Select cameras to perform bulk operations</p>
        </div>
      )}

      {showConfirmDialog && (
        <ConfirmationDialog operation={showConfirmDialog} />
      )}
    </div>
  );
};

export default BulkOperationsPanel;