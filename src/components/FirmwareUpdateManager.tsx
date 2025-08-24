import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FirmwareUpdateService, 
  FirmwareInfo, 
  UpdateSession,
  FirmwareRepository 
} from '../services/firmware/FirmwareUpdateService';
import { 
  ValidationSystem, 
  ValidationContext, 
  ValidationReport,
  UserValidationPreferences 
} from '../services/firmware/ValidationSystem';
import { ProgressManager } from '../services/firmware/ProgressManager';
import './FirmwareUpdateManager.css';

interface FirmwareUpdateManagerProps {
  updateService: FirmwareUpdateService;
  validationSystem: ValidationSystem;
  progressManager: ProgressManager;
  selectedDevices: string[];
  onUpdateComplete?: (sessionId: string, success: boolean) => void;
}

interface DeviceUpdateState {
  deviceId: string;
  currentVersion: string;
  model: string;
  availableUpdates: FirmwareInfo[];
  selectedFirmware?: FirmwareInfo;
  validationReport?: ValidationReport;
  updateSession?: UpdateSession;
  lastChecked: Date;
}

export const FirmwareUpdateManager: React.FC<FirmwareUpdateManagerProps> = ({
  updateService,
  validationSystem,
  progressManager,
  selectedDevices,
  onUpdateComplete
}) => {
  const [deviceStates, setDeviceStates] = useState<Map<string, DeviceUpdateState>>(new Map());
  const [repositories, setRepositories] = useState<FirmwareRepository[]>([]);
  const [activeSessions, setActiveSessions] = useState<UpdateSession[]>([]);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'devices' | 'repositories' | 'history'>('devices');

  const [userPreferences, setUserPreferences] = useState<UserValidationPreferences>({
    skipNonCriticalWarnings: false,
    allowBetaFirmware: false,
    requirePowerConnection: true,
    minimumBatteryLevel: 50,
    backupRequired: true,
    testModeEnabled: false
  });

  const [updateOptions, setUpdateOptions] = useState({
    createBackup: true,
    skipValidation: false,
    forceUpdate: false,
    batchUpdate: false
  });

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const repos = updateService.getRepositories();
        setRepositories(repos);

        // Initialize device states for selected devices
        const states = new Map<string, DeviceUpdateState>();
        for (const deviceId of selectedDevices) {
          states.set(deviceId, {
            deviceId,
            currentVersion: '7.0.1', // Would be fetched from device
            model: 'URSA Mini Pro', // Would be detected from device
            availableUpdates: [],
            lastChecked: new Date(0)
          });
        }
        setDeviceStates(states);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      }
    };

    loadData();
  }, [updateService, selectedDevices]);

  // Set up event listeners
  useEffect(() => {
    const handleUpdateProgress = (session: UpdateSession) => {
      setActiveSessions(prev => prev.map(s => s.id === session.id ? session : s));
      
      // Update device state
      setDeviceStates(prev => {
        const newStates = new Map(prev);
        const deviceState = newStates.get(session.deviceId);
        if (deviceState) {
          newStates.set(session.deviceId, {
            ...deviceState,
            updateSession: session
          });
        }
        return newStates;
      });
    };

    const handleUpdateCompleted = (session: UpdateSession) => {
      handleUpdateProgress(session);
      onUpdateComplete?.(session.id, session.status === 'completed');
    };

    const handleUpdateFailed = (data: { session: UpdateSession; error: any }) => {
      handleUpdateProgress(data.session);
      setError(`Update failed for device ${data.session.deviceId}: ${data.error.message}`);
    };

    updateService.on('update-progress', handleUpdateProgress);
    updateService.on('update-completed', handleUpdateCompleted);
    updateService.on('update-failed', handleUpdateFailed);

    return () => {
      updateService.off('update-progress', handleUpdateProgress);
      updateService.off('update-completed', handleUpdateCompleted);
      updateService.off('update-failed', handleUpdateFailed);
    };
  }, [updateService, onUpdateComplete]);

  // Check for updates
  const checkForUpdates = useCallback(async (deviceIds?: string[]) => {
    const devicesToCheck = deviceIds || selectedDevices;
    if (devicesToCheck.length === 0) return;

    setIsCheckingUpdates(true);
    setError(null);

    try {
      const updatedStates = new Map(deviceStates);

      for (const deviceId of devicesToCheck) {
        const deviceState = deviceStates.get(deviceId);
        if (!deviceState) continue;

        try {
          const availableUpdates = await updateService.checkForUpdates(
            deviceId,
            deviceState.currentVersion,
            deviceState.model
          );

          updatedStates.set(deviceId, {
            ...deviceState,
            availableUpdates,
            lastChecked: new Date()
          });
        } catch (err) {
          console.error(`Failed to check updates for device ${deviceId}:`, err);
        }
      }

      setDeviceStates(updatedStates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check for updates');
    } finally {
      setIsCheckingUpdates(false);
    }
  }, [selectedDevices, deviceStates, updateService]);

  // Validate firmware update
  const validateUpdate = useCallback(async (deviceId: string, firmware: FirmwareInfo) => {
    const deviceState = deviceStates.get(deviceId);
    if (!deviceState) return;

    try {
      // Mock device info - in real implementation, this would be fetched from the device
      const validationContext: ValidationContext = {
        deviceId,
        deviceInfo: {
          model: deviceState.model,
          serialNumber: `SN${deviceId}`,
          hardwareRevision: '1.0',
          bootloaderVersion: '1.2.0',
          currentFirmwareVersion: deviceState.currentVersion,
          batteryLevel: 85,
          temperatureCelsius: 30,
          storageSpace: {
            total: 64 * 1024 * 1024 * 1024, // 64GB
            free: 32 * 1024 * 1024 * 1024   // 32GB free
          },
          connectedAccessories: [],
          lastUpdateDate: new Date('2024-01-01'),
          updateHistory: []
        },
        currentFirmware: {
          version: deviceState.currentVersion,
          buildNumber: '20240101.1',
          releaseDate: new Date('2024-01-01'),
          model: deviceState.model,
          size: 50 * 1024 * 1024,
          checksum: 'existing',
          changelog: [],
          isStable: true,
          compatibility: {
            minBootloaderVersion: '1.0.0',
            supportedModels: [deviceState.model],
            deprecatedFeatures: [],
            newFeatures: []
          }
        },
        targetFirmware: firmware,
        environment: {
          connectionType: 'bluetooth',
          signalStrength: 85,
          networkStability: 'good',
          powerSource: 'ac',
          interferenceLevel: 'low'
        },
        userPreferences
      };

      const validationReport = await validationSystem.validateUpdate(validationContext);

      setDeviceStates(prev => {
        const newStates = new Map(prev);
        const state = newStates.get(deviceId);
        if (state) {
          newStates.set(deviceId, {
            ...state,
            selectedFirmware: firmware,
            validationReport
          });
        }
        return newStates;
      });

    } catch (err) {
      setError(`Validation failed for device ${deviceId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [deviceStates, validationSystem, userPreferences]);

  // Start firmware update
  const startUpdate = useCallback(async (deviceId: string) => {
    const deviceState = deviceStates.get(deviceId);
    if (!deviceState?.selectedFirmware) {
      setError(`No firmware selected for device ${deviceId}`);
      return;
    }

    // Check if validation is required and passed
    if (!updateOptions.skipValidation && deviceState.validationReport) {
      if (!deviceState.validationReport.canProceed) {
        setError(`Validation failed for device ${deviceId}. Cannot proceed with update.`);
        return;
      }
    }

    try {
      const sessionId = await updateService.startUpdate(
        deviceId,
        deviceState.selectedFirmware,
        {
          createBackup: updateOptions.createBackup,
          skipValidation: updateOptions.skipValidation,
          forceUpdate: updateOptions.forceUpdate
        }
      );

      // Get the session and add to active sessions
      const session = updateService.getUpdateSession(sessionId);
      if (session) {
        setActiveSessions(prev => [...prev, session]);
      }

    } catch (err) {
      setError(`Failed to start update for device ${deviceId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [deviceStates, updateService, updateOptions]);

  // Batch update
  const startBatchUpdate = useCallback(async () => {
    const devicesWithFirmware = Array.from(deviceStates.entries())
      .filter(([_, state]) => state.selectedFirmware)
      .map(([deviceId, _]) => deviceId);

    if (devicesWithFirmware.length === 0) {
      setError('No devices selected for batch update');
      return;
    }

    try {
      for (const deviceId of devicesWithFirmware) {
        await startUpdate(deviceId);
        // Small delay between updates to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      setError(`Batch update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [deviceStates, startUpdate]);

  // Cancel update
  const cancelUpdate = useCallback(async (sessionId: string) => {
    try {
      await updateService.cancelUpdate(sessionId);
      setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      setError(`Failed to cancel update: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [updateService]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const devices = Array.from(deviceStates.values());
    const updatesAvailable = devices.filter(d => d.availableUpdates.length > 0).length;
    const readyToUpdate = devices.filter(d => d.selectedFirmware && (!d.validationReport || d.validationReport.canProceed)).length;
    const activeUpdates = activeSessions.filter(s => ['running', 'paused'].includes(s.status)).length;

    return {
      totalDevices: devices.length,
      updatesAvailable,
      readyToUpdate,
      activeUpdates
    };
  }, [deviceStates, activeSessions]);

  const renderDeviceTab = () => (
    <div className="devices-tab">
      <div className="tab-header">
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-value">{summaryStats.totalDevices}</span>
            <span className="stat-label">Devices</span>
          </div>
          <div className="stat">
            <span className="stat-value">{summaryStats.updatesAvailable}</span>
            <span className="stat-label">Updates Available</span>
          </div>
          <div className="stat">
            <span className="stat-value">{summaryStats.readyToUpdate}</span>
            <span className="stat-label">Ready to Update</span>
          </div>
          <div className="stat">
            <span className="stat-value">{summaryStats.activeUpdates}</span>
            <span className="stat-label">Active Updates</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="check-updates-btn"
            onClick={() => checkForUpdates()}
            disabled={isCheckingUpdates}
          >
            {isCheckingUpdates ? 'Checking...' : 'Check for Updates'}
          </button>

          {summaryStats.readyToUpdate > 1 && (
            <button
              className="batch-update-btn"
              onClick={startBatchUpdate}
              disabled={summaryStats.activeUpdates > 0}
            >
              Update All ({summaryStats.readyToUpdate})
            </button>
          )}
        </div>
      </div>

      <div className="update-options">
        <h4>Update Options</h4>
        <div className="options-grid">
          <label>
            <input
              type="checkbox"
              checked={updateOptions.createBackup}
              onChange={(e) => setUpdateOptions(prev => ({
                ...prev,
                createBackup: e.target.checked
              }))}
            />
            <span>Create backup before update</span>
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={updateOptions.skipValidation}
              onChange={(e) => setUpdateOptions(prev => ({
                ...prev,
                skipValidation: e.target.checked
              }))}
            />
            <span>Skip validation (not recommended)</span>
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={updateOptions.forceUpdate}
              onChange={(e) => setUpdateOptions(prev => ({
                ...prev,
                forceUpdate: e.target.checked
              }))}
            />
            <span>Force update (ignore warnings)</span>
          </label>
        </div>
      </div>

      <div className="devices-list">
        {Array.from(deviceStates.entries()).map(([deviceId, state]) => (
          <div key={deviceId} className="device-card">
            <div className="device-header">
              <div className="device-info">
                <h4>Device {deviceId}</h4>
                <div className="device-details">
                  <span className="model">{state.model}</span>
                  <span className="version">v{state.currentVersion}</span>
                  <span className="last-checked">
                    Checked: {state.lastChecked.toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="device-actions">
                {state.updateSession && ['running', 'paused'].includes(state.updateSession.status) ? (
                  <button
                    className="cancel-btn"
                    onClick={() => cancelUpdate(state.updateSession!.id)}
                  >
                    Cancel Update
                  </button>
                ) : (
                  <>
                    <button
                      className="check-btn"
                      onClick={() => checkForUpdates([deviceId])}
                      disabled={isCheckingUpdates}
                    >
                      Check Updates
                    </button>
                    
                    {state.selectedFirmware && (
                      <button
                        className="update-btn"
                        onClick={() => startUpdate(deviceId)}
                        disabled={
                          !state.validationReport?.canProceed && !updateOptions.forceUpdate ||
                          summaryStats.activeUpdates > 0
                        }
                      >
                        Start Update
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {state.availableUpdates.length > 0 && (
              <div className="available-updates">
                <h5>Available Updates</h5>
                <div className="updates-list">
                  {state.availableUpdates.map(firmware => (
                    <div
                      key={firmware.version}
                      className={`firmware-option ${
                        state.selectedFirmware?.version === firmware.version ? 'selected' : ''
                      }`}
                      onClick={() => validateUpdate(deviceId, firmware)}
                    >
                      <div className="firmware-header">
                        <span className="version">v{firmware.version}</span>
                        <div className="firmware-badges">
                          {!firmware.isStable && (
                            <span className="beta-badge">Beta</span>
                          )}
                          <span className="size-badge">
                            {Math.round(firmware.size / 1024 / 1024)}MB
                          </span>
                        </div>
                      </div>
                      
                      <div className="firmware-info">
                        <span className="release-date">
                          Released: {firmware.releaseDate.toLocaleDateString()}
                        </span>
                        <div className="changelog">
                          {firmware.changelog.slice(0, 2).map((change, idx) => (
                            <div key={idx} className="changelog-item">• {change}</div>
                          ))}
                          {firmware.changelog.length > 2 && (
                            <div className="changelog-more">
                              +{firmware.changelog.length - 2} more changes
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.validationReport && (
              <div className={`validation-report ${state.validationReport.overallResult}`}>
                <h5>Validation Results</h5>
                
                <div className="validation-summary">
                  <div className="summary-item">
                    <span className="label">Status:</span>
                    <span className={`status ${state.validationReport.overallResult}`}>
                      {state.validationReport.overallResult.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="validation-counts">
                    <span className="count passed">
                      ✓ {state.validationReport.summary.passed}
                    </span>
                    {state.validationReport.summary.warnings > 0 && (
                      <span className="count warnings">
                        ⚠ {state.validationReport.summary.warnings}
                      </span>
                    )}
                    {state.validationReport.summary.errors > 0 && (
                      <span className="count errors">
                        ✗ {state.validationReport.summary.errors}
                      </span>
                    )}
                  </div>
                </div>

                {state.validationReport.recommendations.length > 0 && (
                  <div className="recommendations">
                    <h6>Recommendations:</h6>
                    <ul>
                      {state.validationReport.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {state.updateSession && (
              <div className="update-progress">
                <h5>Update Progress</h5>
                
                <div className="progress-header">
                  <span className="status">{state.updateSession.status}</span>
                  <span className="progress-text">
                    {Math.round(state.updateSession.progress.progress)}%
                  </span>
                </div>
                
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${state.updateSession.progress.progress}%` }}
                  />
                </div>
                
                <div className="progress-details">
                  <div className="current-operation">
                    {state.updateSession.progress.currentStep}
                  </div>
                  
                  {state.updateSession.progress.eta && (
                    <div className="eta">
                      ETA: {Math.round(state.updateSession.progress.eta / 1000)}s
                    </div>
                  )}
                </div>

                {state.updateSession.progress.error && (
                  <div className="progress-error">
                    Error: {state.updateSession.progress.error}
                  </div>
                )}
              </div>
            )}

            {state.availableUpdates.length === 0 && state.lastChecked > new Date(0) && (
              <div className="no-updates">
                <span>No updates available</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderRepositoriesTab = () => (
    <div className="repositories-tab">
      <div className="tab-header">
        <h3>Firmware Repositories</h3>
        <button className="add-repo-btn">Add Repository</button>
      </div>

      <div className="repositories-list">
        {repositories.map(repo => (
          <div key={repo.id} className="repository-card">
            <div className="repo-header">
              <div className="repo-info">
                <h4>{repo.name}</h4>
                <div className="repo-details">
                  <span className={`type ${repo.type}`}>{repo.type}</span>
                  <span className="url">{repo.url}</span>
                </div>
              </div>
              
              <div className="repo-controls">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={repo.enabled}
                    onChange={() => {
                      // Toggle repository enabled state
                    }}
                  />
                  <span>Enabled</span>
                </label>
              </div>
            </div>
            
            <div className="repo-status">
              <span className="last-sync">
                Last sync: {repo.lastSync.toLocaleString()}
              </span>
              {repo.authRequired && (
                <span className="auth-required">Authentication Required</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="firmware-update-manager">
      <div className="manager-header">
        <h2>Firmware Update Manager</h2>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="manager-tabs">
        <button
          className={activeTab === 'devices' ? 'active' : ''}
          onClick={() => setActiveTab('devices')}
        >
          Devices ({selectedDevices.length})
        </button>
        <button
          className={activeTab === 'repositories' ? 'active' : ''}
          onClick={() => setActiveTab('repositories')}
        >
          Repositories ({repositories.length})
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          Update History
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'devices' && renderDeviceTab()}
        {activeTab === 'repositories' && renderRepositoriesTab()}
        {activeTab === 'history' && (
          <div className="history-tab">
            <div className="coming-soon">Update History - Coming Soon</div>
          </div>
        )}
      </div>
    </div>
  );
};