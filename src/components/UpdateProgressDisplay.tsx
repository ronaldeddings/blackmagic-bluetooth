import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UpdateSession, UpdateProgress } from '../services/firmware/FirmwareUpdateService';
import { ProgressManager, ProgressSession } from '../services/firmware/ProgressManager';
import './UpdateProgressDisplay.css';

interface UpdateProgressDisplayProps {
  updateSession: UpdateSession;
  progressManager?: ProgressManager;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  compact?: boolean;
  showDetails?: boolean;
}

export const UpdateProgressDisplay: React.FC<UpdateProgressDisplayProps> = ({
  updateSession,
  progressManager,
  onCancel,
  onPause,
  onResume,
  compact = false,
  showDetails = true
}) => {
  const [progressSession, setProgressSession] = useState<ProgressSession | null>(null);
  const [showFullLog, setShowFullLog] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Get progress session if available
  useEffect(() => {
    if (!progressManager) return;

    const sessions = progressManager.getAllSessions();
    const session = sessions.find(s => s.name.includes(updateSession.deviceId));
    setProgressSession(session || null);
  }, [progressManager, updateSession.deviceId]);

  // Update elapsed time
  useEffect(() => {
    if (updateSession.status !== 'running') return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - updateSession.startTime.getTime();
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [updateSession.status, updateSession.startTime]);

  // Format time duration
  const formatDuration = useCallback((milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      return `0:${seconds.toString().padStart(2, '0')}`;
    }
  }, []);

  // Format speed
  const formatSpeed = useCallback((speed?: UpdateProgress['speed']): string => {
    if (!speed) return 'N/A';

    const { value, unit } = speed;
    
    if (unit === 'bytes/s') {
      if (value >= 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)} MB/s`;
      } else if (value >= 1024) {
        return `${(value / 1024).toFixed(1)} KB/s`;
      } else {
        return `${value.toFixed(0)} B/s`;
      }
    }
    
    return `${value.toFixed(1)} ${unit}`;
  }, []);

  // Get stage info
  const stageInfo = useMemo(() => {
    const progress = updateSession.progress;
    const stage = progress.stage;
    
    const stageNames = {
      preparing: 'Preparation',
      downloading: 'Downloading',
      validating: 'Validation',
      flashing: 'Installing',
      verifying: 'Verification',
      completing: 'Finalizing'
    };

    const stageIcons = {
      preparing: '⚙️',
      downloading: '⬇️',
      validating: '✅',
      flashing: '⚡',
      verifying: '🔍',
      completing: '🏁'
    };

    return {
      name: stageNames[stage] || stage,
      icon: stageIcons[stage] || '●',
      isActive: updateSession.status === 'running'
    };
  }, [updateSession.progress, updateSession.status]);

  // Status color
  const statusColor = useMemo(() => {
    switch (updateSession.status) {
      case 'running': return 'var(--primary-color)';
      case 'completed': return 'var(--success-color)';
      case 'failed': return 'var(--error-color)';
      case 'cancelled': return 'var(--warning-color)';
      case 'paused': return 'var(--warning-color)';
      default: return 'var(--text-muted)';
    }
  }, [updateSession.status]);

  // Compact view
  if (compact) {
    return (
      <div className="update-progress-display compact">
        <div className="compact-header">
          <div className="device-info">
            <span className="device-id">Device {updateSession.deviceId}</span>
            <span className="firmware-version">→ v{updateSession.targetFirmware}</span>
          </div>
          
          <div className="progress-info">
            <div className="progress-percentage">
              {Math.round(updateSession.progress.progress)}%
            </div>
            <div
              className="status-indicator"
              style={{ backgroundColor: statusColor }}
            />
          </div>
        </div>

        <div className="compact-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${updateSession.progress.progress}%`,
                backgroundColor: statusColor
              }}
            />
          </div>
          
          <div className="stage-info">
            <span className="stage-icon">{stageInfo.icon}</span>
            <span className="stage-name">{stageInfo.name}</span>
          </div>
        </div>

        {updateSession.progress.error && (
          <div className="compact-error">
            {updateSession.progress.error}
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="update-progress-display">
      <div className="progress-header">
        <div className="device-header">
          <div className="device-info">
            <h3>Device {updateSession.deviceId}</h3>
            <div className="update-info">
              <span className="current-version">v{updateSession.currentFirmware}</span>
              <span className="arrow">→</span>
              <span className="target-version">v{updateSession.targetFirmware}</span>
            </div>
          </div>

          <div className="status-section">
            <div className={`status-badge ${updateSession.status}`}>
              {updateSession.status.toUpperCase()}
            </div>
            <div className="progress-percentage">
              {Math.round(updateSession.progress.progress)}%
            </div>
          </div>
        </div>

        <div className="progress-controls">
          {updateSession.status === 'running' && onPause && (
            <button className="control-btn pause-btn" onClick={onPause}>
              ⏸️ Pause
            </button>
          )}
          
          {updateSession.status === 'paused' && onResume && (
            <button className="control-btn resume-btn" onClick={onResume}>
              ▶️ Resume
            </button>
          )}
          
          {['running', 'paused'].includes(updateSession.status) && onCancel && (
            <button className="control-btn cancel-btn" onClick={onCancel}>
              ❌ Cancel
            </button>
          )}
        </div>
      </div>

      <div className="progress-body">
        <div className="main-progress">
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${updateSession.progress.progress}%`,
                  backgroundColor: statusColor
                }}
              />
            </div>
            
            <div className="progress-text">
              {Math.round(updateSession.progress.progress)}% Complete
            </div>
          </div>

          <div className="current-stage">
            <div className="stage-header">
              <div className="stage-info">
                <span className={`stage-icon ${stageInfo.isActive ? 'active' : ''}`}>
                  {stageInfo.icon}
                </span>
                <span className="stage-name">{stageInfo.name}</span>
              </div>
              
              <div className="stage-progress">
                {updateSession.progress.completedSteps}/{updateSession.progress.totalSteps} steps
              </div>
            </div>
            
            <div className="current-operation">
              {updateSession.progress.currentStep}
            </div>
          </div>
        </div>

        {showDetails && (
          <div className="progress-details">
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Elapsed Time:</span>
                <span className="detail-value">{formatDuration(elapsedTime)}</span>
              </div>

              {updateSession.progress.eta && (
                <div className="detail-item">
                  <span className="detail-label">Time Remaining:</span>
                  <span className="detail-value">{formatDuration(updateSession.progress.eta)}</span>
                </div>
              )}

              {updateSession.progress.speed && (
                <div className="detail-item">
                  <span className="detail-label">Speed:</span>
                  <span className="detail-value">{formatSpeed(updateSession.progress.speed)}</span>
                </div>
              )}

              {updateSession.startTime && (
                <div className="detail-item">
                  <span className="detail-label">Started:</span>
                  <span className="detail-value">{updateSession.startTime.toLocaleTimeString()}</span>
                </div>
              )}

              {updateSession.endTime && (
                <div className="detail-item">
                  <span className="detail-label">Finished:</span>
                  <span className="detail-value">{updateSession.endTime.toLocaleTimeString()}</span>
                </div>
              )}

              {updateSession.backupPath && (
                <div className="detail-item">
                  <span className="detail-label">Backup:</span>
                  <span className="detail-value">Available</span>
                </div>
              )}
            </div>
          </div>
        )}

        {updateSession.progress.throughput && (
          <div className="throughput-info">
            <div className="throughput-label">Data Transfer:</div>
            <div className="throughput-bar">
              <div
                className="throughput-fill"
                style={{
                  width: `${(updateSession.progress.throughput.processed / updateSession.progress.throughput.total) * 100}%`
                }}
              />
            </div>
            <div className="throughput-text">
              {Math.round(updateSession.progress.throughput.processed / 1024 / 1024)}MB / 
              {Math.round(updateSession.progress.throughput.total / 1024 / 1024)}MB
            </div>
          </div>
        )}

        {updateSession.progress.warnings.length > 0 && (
          <div className="warnings-section">
            <h4>Warnings</h4>
            <ul className="warnings-list">
              {updateSession.progress.warnings.map((warning, index) => (
                <li key={index} className="warning-item">
                  ⚠️ {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {updateSession.progress.error && (
          <div className="error-section">
            <h4>Error</h4>
            <div className="error-message">
              ❌ {updateSession.progress.error}
            </div>
            
            {updateSession.rollbackAvailable && (
              <div className="rollback-info">
                <span>A backup is available for rollback if needed.</span>
              </div>
            )}
          </div>
        )}

        {progressSession && (
          <div className="detailed-progress">
            <div className="section-header">
              <h4>Detailed Progress</h4>
              <button
                className="toggle-log-btn"
                onClick={() => setShowFullLog(!showFullLog)}
              >
                {showFullLog ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {showFullLog && (
              <div className="progress-log">
                <div className="log-entry">
                  <span className="timestamp">{progressSession.startTime.toLocaleTimeString()}</span>
                  <span className="log-message">Update started</span>
                </div>
                
                {progressSession.warnings.map((warning, index) => (
                  <div key={`warning-${index}`} className="log-entry warning">
                    <span className="timestamp">--:--:--</span>
                    <span className="log-message">⚠️ {warning}</span>
                  </div>
                ))}
                
                {progressSession.errors.map((error, index) => (
                  <div key={`error-${index}`} className="log-entry error">
                    <span className="timestamp">--:--:--</span>
                    <span className="log-message">❌ {error}</span>
                  </div>
                ))}
                
                <div className="log-entry current">
                  <span className="timestamp">{new Date().toLocaleTimeString()}</span>
                  <span className="log-message">{updateSession.progress.currentStep}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="progress-footer">
        {updateSession.status === 'completed' && (
          <div className="completion-message">
            ✅ Firmware update completed successfully! Device is now running v{updateSession.targetFirmware}.
          </div>
        )}
        
        {updateSession.status === 'failed' && (
          <div className="failure-message">
            ❌ Firmware update failed. 
            {updateSession.rollbackAvailable && (
              <span> The device has been restored to v{updateSession.currentFirmware}.</span>
            )}
          </div>
        )}
        
        {updateSession.status === 'cancelled' && (
          <div className="cancellation-message">
            ⚠️ Firmware update was cancelled. The device remains on v{updateSession.currentFirmware}.
          </div>
        )}
      </div>
    </div>
  );
};