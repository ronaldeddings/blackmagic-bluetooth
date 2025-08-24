import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BluetoothConnectionService } from '../services/bluetooth/BluetoothConnection';
import { MultiDeviceConnectionManager } from '../services/bluetooth/MultiDeviceManager';
import { MemoryManager } from '../services/performance/MemoryManager';
import { HardwareAccelerator } from '../services/performance/HardwareAccel';
import { ConnectionRecoveryService } from '../services/performance/ConnectionRecovery';
import { RetryManager } from '../services/performance/RetryManager';
import './DiagnosticsPanel.css';

interface DiagnosticsPanelProps {
  connectionService?: BluetoothConnectionService;
  multiDeviceManager?: MultiDeviceConnectionManager;
  memoryManager?: MemoryManager;
  hardwareAccel?: HardwareAccelerator;
  recoveryService?: ConnectionRecoveryService;
  retryManager?: RetryManager;
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  bluetooth: HealthStatus;
  memory: HealthStatus;
  performance: HealthStatus;
  connections: HealthStatus;
}

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  metrics?: Record<string, any>;
}

interface PerformanceMetrics {
  memory: {
    used: number;
    total: number;
    allocations: number;
    pools: number;
  };
  connections: {
    active: number;
    pooled: number;
    failed: number;
    recovery: number;
  };
  hardware: {
    acceleration: boolean;
    profile: string;
    usage: number;
  };
  retry: {
    totalOperations: number;
    successRate: number;
    averageAttempts: number;
    circuitBreakers: number;
  };
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  connectionService,
  multiDeviceManager,
  memoryManager,
  hardwareAccel,
  recoveryService,
  retryManager
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'memory' | 'connections' | 'performance' | 'logs'>('overview');
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [isCollectingMetrics, setIsCollectingMetrics] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // Collect system health data
  const collectSystemHealth = useCallback(async (): Promise<SystemHealth> => {
    const health: SystemHealth = {
      overall: 'healthy',
      bluetooth: { status: 'healthy', message: 'Bluetooth system operational' },
      memory: { status: 'healthy', message: 'Memory usage normal' },
      performance: { status: 'healthy', message: 'Performance optimal' },
      connections: { status: 'healthy', message: 'All connections stable' }
    };

    try {
      // Check Bluetooth health
      if (connectionService) {
        const bluetoothStatus = await connectionService.getSystemStatus();
        if (!bluetoothStatus.available) {
          health.bluetooth = { status: 'critical', message: 'Bluetooth not available' };
        } else if (bluetoothStatus.errors && bluetoothStatus.errors.length > 0) {
          health.bluetooth = { status: 'warning', message: `${bluetoothStatus.errors.length} recent errors` };
        }
      }

      // Check memory health
      if (memoryManager) {
        const memoryStats = memoryManager.getMemoryStats();
        const usagePercent = memoryStats.totalAllocated / memoryStats.totalCapacity;
        
        if (usagePercent > 0.9) {
          health.memory = { status: 'critical', message: 'Memory usage critical (>90%)' };
        } else if (usagePercent > 0.7) {
          health.memory = { status: 'warning', message: 'Memory usage high (>70%)' };
        }
        
        health.memory.metrics = memoryStats;
      }

      // Check performance health
      if (hardwareAccel) {
        const accelStats = hardwareAccel.getAccelerationStats();
        const profiles = hardwareAccel.getAvailableProfiles();
        
        if (profiles.length === 0) {
          health.performance = { status: 'warning', message: 'No hardware acceleration available' };
        }
        
        health.performance.metrics = accelStats;
      }

      // Check connection health
      if (multiDeviceManager) {
        const connectionStats = multiDeviceManager.getConnectionStats();
        const errorRate = connectionStats.totalConnections > 0 
          ? connectionStats.failedConnections / connectionStats.totalConnections 
          : 0;
          
        if (errorRate > 0.2) {
          health.connections = { status: 'warning', message: 'High connection failure rate' };
        } else if (connectionStats.activeConnections === 0 && connectionStats.totalConnections > 0) {
          health.connections = { status: 'critical', message: 'No active connections' };
        }
        
        health.connections.metrics = connectionStats;
      }

      // Determine overall health
      const statuses = [health.bluetooth, health.memory, health.performance, health.connections];
      const hasCritical = statuses.some(s => s.status === 'critical');
      const hasWarning = statuses.some(s => s.status === 'warning');
      
      if (hasCritical) {
        health.overall = 'critical';
      } else if (hasWarning) {
        health.overall = 'warning';
      }

    } catch (error) {
      console.error('Error collecting system health:', error);
      health.overall = 'critical';
    }

    return health;
  }, [connectionService, multiDeviceManager, memoryManager, hardwareAccel]);

  // Collect performance metrics
  const collectPerformanceMetrics = useCallback(async (): Promise<PerformanceMetrics> => {
    const metrics: PerformanceMetrics = {
      memory: { used: 0, total: 0, allocations: 0, pools: 0 },
      connections: { active: 0, pooled: 0, failed: 0, recovery: 0 },
      hardware: { acceleration: false, profile: 'none', usage: 0 },
      retry: { totalOperations: 0, successRate: 0, averageAttempts: 0, circuitBreakers: 0 }
    };

    try {
      // Memory metrics
      if (memoryManager) {
        const memStats = memoryManager.getMemoryStats();
        const poolStats = memoryManager.getPoolStats();
        
        metrics.memory = {
          used: memStats.totalAllocated,
          total: memStats.totalCapacity,
          allocations: memStats.activeAllocations,
          pools: poolStats.length
        };
      }

      // Connection metrics
      if (multiDeviceManager) {
        const connStats = multiDeviceManager.getConnectionStats();
        metrics.connections = {
          active: connStats.activeConnections,
          pooled: connStats.pooledConnections,
          failed: connStats.failedConnections,
          recovery: 0
        };
      }

      if (recoveryService) {
        const recoveryStats = recoveryService.getActiveRecoverySessions();
        metrics.connections.recovery = recoveryStats.length;
      }

      // Hardware acceleration metrics
      if (hardwareAccel) {
        const accelStats = hardwareAccel.getAccelerationStats();
        const activeProfile = hardwareAccel.getActiveProfile();
        
        metrics.hardware = {
          acceleration: accelStats.accelerationEnabled,
          profile: activeProfile?.name || 'none',
          usage: accelStats.resourceUsage.gpu || 0
        };
      }

      // Retry manager metrics
      if (retryManager) {
        const retryStats = retryManager.getStatistics();
        
        metrics.retry = {
          totalOperations: retryStats.totalOperations,
          successRate: retryStats.totalOperations > 0 
            ? retryStats.successfulOperations / retryStats.totalOperations 
            : 0,
          averageAttempts: retryStats.averageAttempts,
          circuitBreakers: retryStats.circuitBreakerActivations
        };
      }

    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    }

    return metrics;
  }, [memoryManager, multiDeviceManager, hardwareAccel, recoveryService, retryManager]);

  // Auto-refresh data
  useEffect(() => {
    if (!autoRefresh) return;

    const updateData = async () => {
      setIsCollectingMetrics(true);
      try {
        const [health, metrics] = await Promise.all([
          collectSystemHealth(),
          collectPerformanceMetrics()
        ]);
        
        setSystemHealth(health);
        setPerformanceMetrics(metrics);
      } catch (error) {
        console.error('Error updating diagnostics data:', error);
        addLog(`Error updating diagnostics: ${error}`);
      } finally {
        setIsCollectingMetrics(false);
      }
    };

    updateData(); // Initial load
    const interval = setInterval(updateData, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, collectSystemHealth, collectPerformanceMetrics]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setDiagnosticLogs(prev => [logEntry, ...prev].slice(0, 100)); // Keep last 100 logs
  }, []);

  const handleRunDiagnostic = async (type: string) => {
    addLog(`Running ${type} diagnostic...`);
    
    try {
      switch (type) {
        case 'memory_cleanup':
          if (memoryManager) {
            await memoryManager.forceGarbageCollection();
            addLog('Memory cleanup completed');
          }
          break;
          
        case 'connection_test':
          if (connectionService) {
            const devices = await connectionService.discoverDevices();
            addLog(`Connection test completed - found ${devices.length} devices`);
          }
          break;
          
        case 'performance_test':
          if (hardwareAccel) {
            const profiles = hardwareAccel.getAvailableProfiles();
            addLog(`Performance test completed - ${profiles.length} acceleration profiles available`);
          }
          break;
          
        case 'reset_stats':
          if (retryManager) {
            retryManager.resetStatistics();
            addLog('Statistics reset completed');
          }
          break;
          
        default:
          addLog(`Unknown diagnostic type: ${type}`);
      }
    } catch (error) {
      addLog(`Diagnostic failed: ${error}`);
    }
  };

  const handleExportDiagnostics = () => {
    const diagnosticData = {
      timestamp: new Date().toISOString(),
      systemHealth,
      performanceMetrics,
      logs: diagnosticLogs
    };

    const blob = new Blob([JSON.stringify(diagnosticData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const healthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#4ade80';
      case 'warning': return '#fbbf24';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="diagnostics-panel">
      <div className="diagnostics-header">
        <h2>System Diagnostics</h2>
        <div className="diagnostics-controls">
          <label className="auto-refresh-control">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto Refresh
          </label>
          
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            disabled={!autoRefresh}
          >
            <option value={1000}>1s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
          </select>

          <button
            onClick={handleExportDiagnostics}
            className="export-btn"
          >
            Export Diagnostics
          </button>

          {isCollectingMetrics && (
            <div className="collecting-indicator">
              Collecting...
            </div>
          )}
        </div>
      </div>

      <div className="tab-navigation">
        {['overview', 'memory', 'connections', 'performance', 'logs'].map(tab => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && systemHealth && (
        <div className="overview-tab">
          <div className="system-health-overview">
            <div className="overall-health">
              <div
                className="health-indicator"
                style={{ backgroundColor: healthStatusColor(systemHealth.overall) }}
              />
              <h3>System Health: {systemHealth.overall.toUpperCase()}</h3>
            </div>

            <div className="health-components">
              {Object.entries(systemHealth).filter(([key]) => key !== 'overall').map(([component, health]) => (
                <div key={component} className="health-component">
                  <div className="component-header">
                    <div
                      className="health-indicator"
                      style={{ backgroundColor: healthStatusColor(health.status) }}
                    />
                    <h4>{component.charAt(0).toUpperCase() + component.slice(1)}</h4>
                  </div>
                  <p className="health-message">{health.message}</p>
                  
                  {health.metrics && (
                    <div className="component-metrics">
                      {Object.entries(health.metrics).map(([key, value]) => (
                        <div key={key} className="metric-item">
                          <span className="metric-label">{key}:</span>
                          <span className="metric-value">
                            {typeof value === 'number' ? value.toLocaleString() : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="quick-actions">
            <h3>Quick Actions</h3>
            <div className="action-buttons">
              <button onClick={() => handleRunDiagnostic('memory_cleanup')}>
                Clean Memory
              </button>
              <button onClick={() => handleRunDiagnostic('connection_test')}>
                Test Connections
              </button>
              <button onClick={() => handleRunDiagnostic('performance_test')}>
                Check Performance
              </button>
              <button onClick={() => handleRunDiagnostic('reset_stats')}>
                Reset Statistics
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'memory' && performanceMetrics && (
        <div className="memory-tab">
          <div className="memory-overview">
            <h3>Memory Usage</h3>
            <div className="memory-stats">
              <div className="memory-stat">
                <span className="stat-label">Used Memory:</span>
                <span className="stat-value">
                  {(performanceMetrics.memory.used / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
              <div className="memory-stat">
                <span className="stat-label">Total Memory:</span>
                <span className="stat-value">
                  {(performanceMetrics.memory.total / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
              <div className="memory-stat">
                <span className="stat-label">Usage:</span>
                <span className="stat-value">
                  {((performanceMetrics.memory.used / performanceMetrics.memory.total) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="memory-stat">
                <span className="stat-label">Active Allocations:</span>
                <span className="stat-value">{performanceMetrics.memory.allocations}</span>
              </div>
              <div className="memory-stat">
                <span className="stat-label">Memory Pools:</span>
                <span className="stat-value">{performanceMetrics.memory.pools}</span>
              </div>
            </div>

            <div className="memory-usage-bar">
              <div
                className="usage-fill"
                style={{
                  width: `${(performanceMetrics.memory.used / performanceMetrics.memory.total) * 100}%`,
                  backgroundColor: (performanceMetrics.memory.used / performanceMetrics.memory.total) > 0.8 
                    ? '#ef4444' : '#4ade80'
                }}
              />
            </div>
          </div>

          {memoryManager && (
            <div className="memory-pools">
              <h3>Memory Pools</h3>
              {/* Memory pool details would be rendered here */}
            </div>
          )}
        </div>
      )}

      {activeTab === 'connections' && performanceMetrics && (
        <div className="connections-tab">
          <div className="connection-overview">
            <h3>Connection Statistics</h3>
            <div className="connection-stats">
              <div className="connection-stat">
                <span className="stat-label">Active Connections:</span>
                <span className="stat-value">{performanceMetrics.connections.active}</span>
              </div>
              <div className="connection-stat">
                <span className="stat-label">Pooled Connections:</span>
                <span className="stat-value">{performanceMetrics.connections.pooled}</span>
              </div>
              <div className="connection-stat">
                <span className="stat-label">Failed Connections:</span>
                <span className="stat-value">{performanceMetrics.connections.failed}</span>
              </div>
              <div className="connection-stat">
                <span className="stat-label">Recovery Sessions:</span>
                <span className="stat-value">{performanceMetrics.connections.recovery}</span>
              </div>
            </div>
          </div>

          <div className="retry-statistics">
            <h3>Retry Manager Statistics</h3>
            <div className="retry-stats">
              <div className="retry-stat">
                <span className="stat-label">Total Operations:</span>
                <span className="stat-value">{performanceMetrics.retry.totalOperations}</span>
              </div>
              <div className="retry-stat">
                <span className="stat-label">Success Rate:</span>
                <span className="stat-value">
                  {(performanceMetrics.retry.successRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="retry-stat">
                <span className="stat-label">Average Attempts:</span>
                <span className="stat-value">{performanceMetrics.retry.averageAttempts.toFixed(1)}</span>
              </div>
              <div className="retry-stat">
                <span className="stat-label">Circuit Breakers:</span>
                <span className="stat-value">{performanceMetrics.retry.circuitBreakers}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'performance' && performanceMetrics && (
        <div className="performance-tab">
          <div className="hardware-acceleration">
            <h3>Hardware Acceleration</h3>
            <div className="hardware-stats">
              <div className="hardware-stat">
                <span className="stat-label">Acceleration Enabled:</span>
                <span className="stat-value">
                  {performanceMetrics.hardware.acceleration ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="hardware-stat">
                <span className="stat-label">Active Profile:</span>
                <span className="stat-value">{performanceMetrics.hardware.profile}</span>
              </div>
              <div className="hardware-stat">
                <span className="stat-label">GPU Usage:</span>
                <span className="stat-value">
                  {(performanceMetrics.hardware.usage * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="performance-charts">
            <h3>Performance Metrics</h3>
            {/* Performance charts would be rendered here */}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="logs-tab">
          <div className="logs-header">
            <h3>Diagnostic Logs</h3>
            <div className="logs-controls">
              <button onClick={() => setDiagnosticLogs([])}>
                Clear Logs
              </button>
              <span className="logs-count">
                {diagnosticLogs.length} entries
              </span>
            </div>
          </div>

          <div className="logs-content">
            {diagnosticLogs.map((log, index) => (
              <div key={index} className="log-entry">
                {log}
              </div>
            ))}

            {diagnosticLogs.length === 0 && (
              <div className="no-logs">
                No diagnostic logs available.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};