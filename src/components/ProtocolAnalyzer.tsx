import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ProtocolTestSuite, TestRunResult, TestCase, TestSuite } from '../services/testing/ProtocolTestSuite';
import { ProtocolDebugger, DebugSession, DebugEvent } from '../services/testing/ProtocolDebugger';
import { MockCameraSimulator } from '../services/testing/MockCameraSimulator';
import './ProtocolAnalyzer.css';

interface ProtocolAnalyzerProps {
  testSuite: ProtocolTestSuite;
  debugger: ProtocolDebugger;
  mockCamera: MockCameraSimulator;
}

interface TestRunStatus {
  isRunning: boolean;
  currentTest?: string;
  progress: number;
  results?: TestRunResult;
}

export const ProtocolAnalyzer: React.FC<ProtocolAnalyzerProps> = ({
  testSuite,
  debugger: protocolDebugger,
  mockCamera
}) => {
  const [activeTab, setActiveTab] = useState<'tests' | 'debugger' | 'simulator'>('tests');
  const [testRunStatus, setTestRunStatus] = useState<TestRunStatus>({
    isRunning: false,
    progress: 0
  });
  const [availableTests, setAvailableTests] = useState<TestCase[]>([]);
  const [availableSuites, setAvailableSuites] = useState<TestSuite[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<TestRunResult | null>(null);
  const [debugSessions, setDebugSessions] = useState<DebugSession[]>([]);
  const [activeDebugSession, setActiveDebugSession] = useState<DebugSession | null>(null);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const [simulatorStats, setSimulatorStats] = useState<any>(null);

  // Initialize available tests and suites
  useEffect(() => {
    setAvailableTests(testSuite.getRegisteredTests());
    setAvailableSuites(testSuite.getRegisteredSuites());
  }, [testSuite]);

  // Set up test suite event listeners
  useEffect(() => {
    const handleTestRunStarted = (data: any) => {
      setTestRunStatus({
        isRunning: true,
        progress: 0
      });
    };

    const handleTestStarted = (data: any) => {
      setTestRunStatus(prev => ({
        ...prev,
        currentTest: data.testName
      }));
    };

    const handleTestCompleted = (data: any) => {
      setTestRunStatus(prev => ({
        ...prev,
        progress: prev.progress + (100 / availableTests.length)
      }));
    };

    const handleTestRunCompleted = (result: TestRunResult) => {
      setTestRunStatus({
        isRunning: false,
        progress: 100,
        results: result
      });
      setTestResults(result);
    };

    testSuite.on('test_run_started', handleTestRunStarted);
    testSuite.on('test_started', handleTestStarted);
    testSuite.on('test_completed', handleTestCompleted);
    testSuite.on('test_run_completed', handleTestRunCompleted);

    return () => {
      testSuite.off('test_run_started', handleTestRunStarted);
      testSuite.off('test_started', handleTestStarted);
      testSuite.off('test_completed', handleTestCompleted);
      testSuite.off('test_run_completed', handleTestRunCompleted);
    };
  }, [testSuite, availableTests.length]);

  // Set up debugger event listeners
  useEffect(() => {
    const updateSessions = () => {
      setDebugSessions(protocolDebugger.getSessions());
      setActiveDebugSession(protocolDebugger.getActiveSession());
    };

    const handleEventCaptured = (data: any) => {
      if (data.sessionId === activeDebugSession?.id) {
        setDebugEvents(prev => [...prev, data.event].slice(-1000)); // Keep last 1000 events
      }
    };

    protocolDebugger.on('session_created', updateSessions);
    protocolDebugger.on('session_started', updateSessions);
    protocolDebugger.on('session_stopped', updateSessions);
    protocolDebugger.on('event_captured', handleEventCaptured);

    return () => {
      protocolDebugger.off('session_created', updateSessions);
      protocolDebugger.off('session_started', updateSessions);
      protocolDebugger.off('session_stopped', updateSessions);
      protocolDebugger.off('event_captured', handleEventCaptured);
    };
  }, [protocolDebugger, activeDebugSession]);

  // Set up mock camera event listeners
  useEffect(() => {
    const handleStatsUpdate = () => {
      setSimulatorStats(mockCamera.getSimulationStats());
    };

    mockCamera.on('connected', handleStatsUpdate);
    mockCamera.on('disconnected', handleStatsUpdate);
    mockCamera.on('state_updated', handleStatsUpdate);

    // Initial stats
    handleStatsUpdate();

    const interval = setInterval(handleStatsUpdate, 1000);

    return () => {
      mockCamera.off('connected', handleStatsUpdate);
      mockCamera.off('disconnected', handleStatsUpdate);
      mockCamera.off('state_updated', handleStatsUpdate);
      clearInterval(interval);
    };
  }, [mockCamera]);

  const handleRunTests = async () => {
    try {
      const config = {
        tests: selectedTests.length > 0 ? selectedTests : undefined,
        parallel: true,
        maxParallel: 3,
        continueOnFailure: true,
        generateReport: true,
        verbose: true
      };

      await testSuite.runTests(config);
    } catch (error) {
      console.error('Failed to run tests:', error);
    }
  };

  const handleStopTests = async () => {
    await testSuite.stopCurrentRun();
  };

  const handleSelectAllTests = () => {
    setSelectedTests(availableTests.map(t => t.id));
  };

  const handleDeselectAllTests = () => {
    setSelectedTests([]);
  };

  const handleTestSelection = (testId: string, selected: boolean) => {
    if (selected) {
      setSelectedTests(prev => [...prev, testId]);
    } else {
      setSelectedTests(prev => prev.filter(id => id !== testId));
    }
  };

  const handleCreateDebugSession = () => {
    const sessionName = `Debug Session ${new Date().toLocaleTimeString()}`;
    const sessionId = protocolDebugger.createSession(sessionName);
    protocolDebugger.startSession(sessionId);
  };

  const handleStopDebugSession = () => {
    if (activeDebugSession) {
      protocolDebugger.stopSession(activeDebugSession.id);
    }
  };

  const handleExportDebugSession = () => {
    if (activeDebugSession) {
      const exportData = protocolDebugger.exportSession(activeDebugSession.id, {
        format: 'json',
        includeMetadata: true
      });
      
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug_session_${activeDebugSession.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const testSummary = useMemo(() => {
    if (!testResults) return null;

    return {
      total: testResults.summary.total,
      passed: testResults.summary.passed,
      failed: testResults.summary.failed,
      skipped: testResults.summary.skipped,
      successRate: Math.round(testResults.summary.successRate * 100),
      duration: Math.round(testResults.totalDuration / 1000)
    };
  }, [testResults]);

  const debugEventsByType = useMemo(() => {
    const counts = new Map<string, number>();
    debugEvents.forEach(event => {
      counts.set(event.type, (counts.get(event.type) || 0) + 1);
    });
    return Object.fromEntries(counts);
  }, [debugEvents]);

  return (
    <div className="protocol-analyzer">
      <div className="analyzer-header">
        <h2>Protocol Analyzer</h2>
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'tests' ? 'active' : ''}`}
            onClick={() => setActiveTab('tests')}
          >
            Test Suite
          </button>
          <button
            className={`tab-button ${activeTab === 'debugger' ? 'active' : ''}`}
            onClick={() => setActiveTab('debugger')}
          >
            Protocol Debugger
          </button>
          <button
            className={`tab-button ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
          >
            Mock Simulator
          </button>
        </div>
      </div>

      {activeTab === 'tests' && (
        <div className="test-suite-panel">
          <div className="test-controls">
            <div className="control-group">
              <button
                className="run-tests-btn"
                onClick={handleRunTests}
                disabled={testRunStatus.isRunning}
              >
                {testRunStatus.isRunning ? 'Running Tests...' : 'Run Tests'}
              </button>
              
              {testRunStatus.isRunning && (
                <button className="stop-tests-btn" onClick={handleStopTests}>
                  Stop Tests
                </button>
              )}

              <div className="test-selection-controls">
                <button onClick={handleSelectAllTests}>Select All</button>
                <button onClick={handleDeselectAllTests}>Deselect All</button>
                <span className="selection-count">
                  {selectedTests.length} of {availableTests.length} selected
                </span>
              </div>
            </div>

            {testRunStatus.isRunning && (
              <div className="test-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${testRunStatus.progress}%` }}
                  />
                </div>
                <div className="progress-info">
                  <span className="current-test">{testRunStatus.currentTest}</span>
                  <span className="progress-percentage">
                    {Math.round(testRunStatus.progress)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="test-content">
            <div className="test-list">
              <h3>Available Tests</h3>
              <div className="test-categories">
                {['connection', 'protocol', 'performance', 'stress', 'compatibility', 'security'].map(category => (
                  <div key={category} className="test-category">
                    <h4>{category.charAt(0).toUpperCase() + category.slice(1)} Tests</h4>
                    <div className="test-items">
                      {availableTests
                        .filter(test => test.category === category)
                        .map(test => (
                          <div key={test.id} className="test-item">
                            <label className="test-checkbox">
                              <input
                                type="checkbox"
                                checked={selectedTests.includes(test.id)}
                                onChange={(e) => handleTestSelection(test.id, e.target.checked)}
                              />
                              <span className="test-info">
                                <span className="test-name">{test.name}</span>
                                <span className="test-description">{test.description}</span>
                                <div className="test-meta">
                                  <span className={`priority priority-${test.priority}`}>
                                    {test.priority}
                                  </span>
                                  <span className="expected-duration">
                                    ~{Math.round(test.expectedDuration / 1000)}s
                                  </span>
                                </div>
                              </span>
                            </label>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {testSummary && (
              <div className="test-results">
                <h3>Test Results</h3>
                <div className="results-summary">
                  <div className="summary-stats">
                    <div className="stat">
                      <span className="stat-value">{testSummary.total}</span>
                      <span className="stat-label">Total Tests</span>
                    </div>
                    <div className="stat success">
                      <span className="stat-value">{testSummary.passed}</span>
                      <span className="stat-label">Passed</span>
                    </div>
                    <div className="stat failure">
                      <span className="stat-value">{testSummary.failed}</span>
                      <span className="stat-label">Failed</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{testSummary.successRate}%</span>
                      <span className="stat-label">Success Rate</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{testSummary.duration}s</span>
                      <span className="stat-label">Duration</span>
                    </div>
                  </div>
                </div>

                <div className="detailed-results">
                  {testResults?.results.map(result => (
                    <div key={result.testId} className={`test-result ${result.status}`}>
                      <div className="result-header">
                        <span className="test-name">{result.testName}</span>
                        <span className={`status ${result.status}`}>{result.status}</span>
                        <span className="duration">{Math.round(result.duration)}ms</span>
                      </div>

                      {result.error && (
                        <div className="error-message">
                          {result.error.message}
                        </div>
                      )}

                      {result.assertions.length > 0 && (
                        <div className="assertions">
                          {result.assertions.map((assertion, index) => (
                            <div
                              key={index}
                              className={`assertion ${assertion.passed ? 'passed' : 'failed'}`}
                            >
                              <span className="assertion-description">
                                {assertion.description}
                              </span>
                              {!assertion.passed && (
                                <div className="assertion-details">
                                  Expected: {String(assertion.expected)}<br/>
                                  Actual: {String(assertion.actual)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'debugger' && (
        <div className="debugger-panel">
          <div className="debugger-controls">
            <div className="session-controls">
              <button onClick={handleCreateDebugSession}>
                New Debug Session
              </button>
              
              {activeDebugSession && (
                <>
                  <button onClick={handleStopDebugSession}>
                    Stop Session
                  </button>
                  <button onClick={handleExportDebugSession}>
                    Export Session
                  </button>
                </>
              )}

              <div className="session-info">
                {activeDebugSession ? (
                  <span>
                    Active: {activeDebugSession.name} 
                    ({debugEvents.length} events)
                  </span>
                ) : (
                  <span>No active session</span>
                )}
              </div>
            </div>

            {activeDebugSession && (
              <div className="event-summary">
                <h4>Event Types</h4>
                <div className="event-type-stats">
                  {Object.entries(debugEventsByType).map(([type, count]) => (
                    <div key={type} className="event-stat">
                      <span className="event-type">{type}</span>
                      <span className="event-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="debug-events">
            <h3>Debug Events</h3>
            <div className="events-list">
              {debugEvents.slice(-50).reverse().map(event => (
                <div
                  key={event.id}
                  className={`debug-event ${event.type} ${event.highlighted ? 'highlighted' : ''}`}
                >
                  <div className="event-header">
                    <span className="event-timestamp">
                      {event.timestamp.toLocaleTimeString()}
                    </span>
                    <span className="event-type">{event.type}</span>
                    <span className="event-direction">{event.direction}</span>
                    {event.command && (
                      <span className="event-command">{event.command}</span>
                    )}
                  </div>

                  <div className="event-metadata">
                    <span className="data-size">{event.metadata.size} bytes</span>
                    {event.metadata.duration && (
                      <span className="duration">{event.metadata.duration}ms</span>
                    )}
                    {event.metadata.sequenceNumber && (
                      <span className="sequence">#{event.metadata.sequenceNumber}</span>
                    )}
                  </div>

                  {event.data && Object.keys(event.data).length > 0 && (
                    <details className="event-data">
                      <summary>Event Data</summary>
                      <pre>{JSON.stringify(event.data, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))}

              {debugEvents.length === 0 && (
                <div className="no-events">
                  No debug events captured yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'simulator' && (
        <div className="simulator-panel">
          <div className="simulator-controls">
            <button
              onClick={() => mockCamera.connect()}
              disabled={mockCamera.isConnected()}
            >
              Connect Simulator
            </button>
            
            <button
              onClick={() => mockCamera.disconnect()}
              disabled={!mockCamera.isConnected()}
            >
              Disconnect Simulator
            </button>

            <button onClick={() => mockCamera.resetStats()}>
              Reset Statistics
            </button>
          </div>

          {simulatorStats && (
            <div className="simulator-stats">
              <h3>Simulation Statistics</h3>
              <div className="stats-grid">
                <div className="stat-group">
                  <h4>Commands</h4>
                  <div className="stat-item">
                    <span className="stat-label">Total Commands:</span>
                    <span className="stat-value">{simulatorStats.totalCommands}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Successful:</span>
                    <span className="stat-value">{simulatorStats.successfulCommands}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Failed:</span>
                    <span className="stat-value">{simulatorStats.failedCommands}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Success Rate:</span>
                    <span className="stat-value">
                      {simulatorStats.totalCommands > 0 
                        ? Math.round((simulatorStats.successfulCommands / simulatorStats.totalCommands) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>

                <div className="stat-group">
                  <h4>Performance</h4>
                  <div className="stat-item">
                    <span className="stat-label">Average Latency:</span>
                    <span className="stat-value">{Math.round(simulatorStats.averageLatency)}ms</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Uptime:</span>
                    <span className="stat-value">
                      {Math.round(simulatorStats.uptime / 1000)}s
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Data Transferred:</span>
                    <span className="stat-value">
                      {Math.round(simulatorStats.dataTransferred / 1024)}KB
                    </span>
                  </div>
                </div>

                <div className="stat-group">
                  <h4>Errors</h4>
                  <div className="stat-item">
                    <span className="stat-label">Simulation Errors:</span>
                    <span className="stat-value">{simulatorStats.simulationErrors}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Behavior Triggers:</span>
                    <span className="stat-value">{simulatorStats.customBehaviorTriggers}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="simulator-config">
            <h3>Simulator Configuration</h3>
            <div className="config-options">
              <div className="config-group">
                <label>
                  Simulation Mode:
                  <select
                    onChange={(e) => mockCamera.updateConfig({ 
                      simulationMode: e.target.value as any 
                    })}
                  >
                    <option value="realistic">Realistic</option>
                    <option value="perfect">Perfect</option>
                    <option value="error_prone">Error Prone</option>
                  </select>
                </label>
              </div>

              <div className="config-group">
                <label>
                  Error Rate:
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.01"
                    onChange={(e) => mockCamera.updateConfig({ 
                      errorRate: parseFloat(e.target.value) 
                    })}
                  />
                </label>
              </div>

              <div className="config-group">
                <label>
                  <input
                    type="checkbox"
                    onChange={(e) => mockCamera.enableBehaviors(e.target.checked)}
                    defaultChecked
                  />
                  Enable Custom Behaviors
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};