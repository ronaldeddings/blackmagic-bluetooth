import { EventEmitter } from 'events';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: 'connection' | 'protocol' | 'performance' | 'stress' | 'compatibility' | 'security';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  setup?: () => Promise<void>;
  execute: (context: TestContext) => Promise<TestResult>;
  cleanup?: () => Promise<void>;
  dependencies?: string[];
  tags: string[];
  retryCount: number;
  expectedDuration: number;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  testCases: string[];
  setup?: () => Promise<void>;
  cleanup?: () => Promise<void>;
  parallel: boolean;
  continueOnFailure: boolean;
}

export interface TestContext {
  testId: string;
  testName: string;
  startTime: Date;
  timeout: number;
  mockCamera?: any;
  connectionService?: any;
  metadata: Record<string, any>;
  logger: TestLogger;
}

export interface TestResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped' | 'timeout' | 'error';
  startTime: Date;
  endTime: Date;
  duration: number;
  message?: string;
  error?: Error;
  assertions: TestAssertion[];
  metrics: TestMetrics;
  artifacts: TestArtifact[];
}

export interface TestAssertion {
  description: string;
  passed: boolean;
  actual?: any;
  expected?: any;
  message?: string;
}

export interface TestMetrics {
  memoryUsage: {
    peak: number;
    average: number;
    final: number;
  };
  cpuUsage: {
    peak: number;
    average: number;
  };
  networkStats?: {
    bytesReceived: number;
    bytesSent: number;
    packetsLost: number;
    latency: number[];
  };
  customMetrics: Record<string, number>;
}

export interface TestArtifact {
  name: string;
  type: 'log' | 'screenshot' | 'packet_capture' | 'performance_profile' | 'memory_dump';
  path?: string;
  content?: string | Buffer;
  metadata: Record<string, any>;
}

export interface TestRunConfig {
  suites?: string[];
  tests?: string[];
  tags?: string[];
  categories?: string[];
  parallel?: boolean;
  maxParallel?: number;
  timeout?: number;
  retries?: number;
  continueOnFailure?: boolean;
  generateReport?: boolean;
  reportFormat?: 'json' | 'xml' | 'html';
  artifactsPath?: string;
  verbose?: boolean;
}

export interface TestRunResult {
  id: string;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  config: TestRunConfig;
  summary: TestSummary;
  results: TestResult[];
  artifacts: TestArtifact[];
  errors: string[];
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  timeout: number;
  error: number;
  successRate: number;
  categories: Record<string, TestSummary>;
}

export interface TestLogger {
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, data?: any): void;
  debug(message: string, data?: any): void;
}

export class ProtocolTestSuite extends EventEmitter {
  private testCases: Map<string, TestCase> = new Map();
  private testSuites: Map<string, TestSuite> = new Map();
  private isRunning = false;
  private currentRun: TestRunResult | null = null;

  constructor() {
    super();
    this.initializeBuiltInTests();
  }

  private initializeBuiltInTests(): void {
    this.addBluetoothConnectionTests();
    this.addProtocolTests();
    this.addPerformanceTests();
    this.addStressTests();
    this.addCompatibilityTests();
    this.addSecurityTests();
  }

  private addBluetoothConnectionTests(): void {
    // Basic connection test
    this.registerTest({
      id: 'bt_basic_connection',
      name: 'Basic Bluetooth Connection',
      description: 'Test basic Bluetooth connection to camera',
      category: 'connection',
      priority: 'critical',
      timeout: 30000,
      execute: async (context: TestContext) => {
        const assertions: TestAssertion[] = [];
        const startMemory = this.getMemoryUsage();
        
        context.logger.info('Starting basic connection test');
        
        try {
          // Test device discovery
          context.logger.debug('Testing device discovery');
          const devices = await context.connectionService.discoverDevices();
          assertions.push({
            description: 'Should discover at least one device',
            passed: devices.length > 0,
            actual: devices.length,
            expected: 'greater than 0'
          });

          if (devices.length === 0) {
            throw new Error('No devices discovered');
          }

          // Test connection
          context.logger.debug('Testing connection establishment');
          const device = devices[0];
          const connected = await context.connectionService.connect(device.id);
          assertions.push({
            description: 'Should successfully connect to device',
            passed: connected,
            actual: connected,
            expected: true
          });

          // Test connection status
          const isConnected = await context.connectionService.isConnected(device.id);
          assertions.push({
            description: 'Device should report as connected',
            passed: isConnected,
            actual: isConnected,
            expected: true
          });

          // Test disconnection
          context.logger.debug('Testing disconnection');
          const disconnected = await context.connectionService.disconnect(device.id);
          assertions.push({
            description: 'Should successfully disconnect from device',
            passed: disconnected,
            actual: disconnected,
            expected: true
          });

          const finalMemory = this.getMemoryUsage();
          
          return {
            testId: context.testId,
            testName: context.testName,
            status: 'passed',
            startTime: context.startTime,
            endTime: new Date(),
            duration: Date.now() - context.startTime.getTime(),
            assertions,
            metrics: {
              memoryUsage: {
                peak: Math.max(startMemory, finalMemory),
                average: (startMemory + finalMemory) / 2,
                final: finalMemory
              },
              cpuUsage: { peak: 0, average: 0 },
              customMetrics: {
                devicesDiscovered: devices.length,
                connectionTime: Date.now() - context.startTime.getTime()
              }
            },
            artifacts: []
          };

        } catch (error) {
          return this.createErrorResult(context, error, assertions);
        }
      },
      tags: ['bluetooth', 'connection', 'basic'],
      retryCount: 2,
      expectedDuration: 10000
    });

    // Connection pool test
    this.registerTest({
      id: 'bt_connection_pool',
      name: 'Connection Pool Test',
      description: 'Test connection pool functionality with multiple devices',
      category: 'connection',
      priority: 'high',
      timeout: 60000,
      execute: async (context: TestContext) => {
        const assertions: TestAssertion[] = [];
        context.logger.info('Starting connection pool test');

        try {
          const deviceCount = 3;
          const connectionPromises = [];

          // Simulate multiple connections
          for (let i = 0; i < deviceCount; i++) {
            const deviceId = `test_device_${i}`;
            connectionPromises.push(
              context.connectionService.connect(deviceId)
            );
          }

          const results = await Promise.allSettled(connectionPromises);
          const successCount = results.filter(r => r.status === 'fulfilled').length;

          assertions.push({
            description: 'Should handle multiple concurrent connections',
            passed: successCount >= deviceCount * 0.8, // Allow 20% failure
            actual: successCount,
            expected: `at least ${Math.ceil(deviceCount * 0.8)}`
          });

          // Test connection reuse
          const poolStats = await context.connectionService.getConnectionPoolStats();
          assertions.push({
            description: 'Should reuse connections from pool',
            passed: poolStats.reusedConnections > 0,
            actual: poolStats.reusedConnections,
            expected: 'greater than 0'
          });

          return this.createSuccessResult(context, assertions);

        } catch (error) {
          return this.createErrorResult(context, error, assertions);
        }
      },
      tags: ['bluetooth', 'connection', 'pool'],
      retryCount: 1,
      expectedDuration: 30000
    });
  }

  private addProtocolTests(): void {
    // Camera control protocol test
    this.registerTest({
      id: 'proto_camera_control',
      name: 'Camera Control Protocol Test',
      description: 'Test camera control protocol commands',
      category: 'protocol',
      priority: 'critical',
      timeout: 45000,
      execute: async (context: TestContext) => {
        const assertions: TestAssertion[] = [];
        context.logger.info('Starting camera control protocol test');

        try {
          // Test basic commands
          const commands = [
            { name: 'get_device_info', expected: 'object' },
            { name: 'set_recording_format', params: { format: 'ProRes' }, expected: 'boolean' },
            { name: 'start_recording', expected: 'boolean' },
            { name: 'get_recording_status', expected: 'object' },
            { name: 'stop_recording', expected: 'boolean' }
          ];

          for (const command of commands) {
            context.logger.debug(`Testing command: ${command.name}`);
            
            const startTime = Date.now();
            const result = await context.connectionService.sendCommand(
              command.name,
              command.params || {}
            );
            const duration = Date.now() - startTime;

            assertions.push({
              description: `Command ${command.name} should return ${command.expected}`,
              passed: typeof result === command.expected,
              actual: typeof result,
              expected: command.expected
            });

            assertions.push({
              description: `Command ${command.name} should respond within 5 seconds`,
              passed: duration < 5000,
              actual: duration,
              expected: 'less than 5000ms'
            });
          }

          return this.createSuccessResult(context, assertions);

        } catch (error) {
          return this.createErrorResult(context, error, assertions);
        }
      },
      tags: ['protocol', 'camera', 'control'],
      retryCount: 2,
      expectedDuration: 20000
    });

    // Protocol error handling test
    this.registerTest({
      id: 'proto_error_handling',
      name: 'Protocol Error Handling Test',
      description: 'Test protocol error handling and recovery',
      category: 'protocol',
      priority: 'high',
      timeout: 30000,
      execute: async (context: TestContext) => {
        const assertions: TestAssertion[] = [];
        context.logger.info('Starting protocol error handling test');

        try {
          // Test invalid commands
          const invalidCommands = [
            'invalid_command',
            'malformed_command_with_very_long_name',
            'command_with_invalid_params'
          ];

          for (const command of invalidCommands) {
            try {
              await context.connectionService.sendCommand(command, {});
              assertions.push({
                description: `Invalid command ${command} should throw error`,
                passed: false,
                actual: 'no error',
                expected: 'error thrown'
              });
            } catch (error) {
              assertions.push({
                description: `Invalid command ${command} should throw error`,
                passed: true,
                actual: 'error thrown',
                expected: 'error thrown'
              });
            }
          }

          // Test connection recovery after errors
          const connectionStatus = await context.connectionService.getConnectionStatus();
          assertions.push({
            description: 'Connection should remain stable after protocol errors',
            passed: connectionStatus.isConnected,
            actual: connectionStatus.isConnected,
            expected: true
          });

          return this.createSuccessResult(context, assertions);

        } catch (error) {
          return this.createErrorResult(context, error, assertions);
        }
      },
      tags: ['protocol', 'error', 'recovery'],
      retryCount: 1,
      expectedDuration: 15000
    });
  }

  private addPerformanceTests(): void {
    // Throughput test
    this.registerTest({
      id: 'perf_throughput',
      name: 'Data Throughput Test',
      description: 'Test data throughput under normal conditions',
      category: 'performance',
      priority: 'high',
      timeout: 120000,
      execute: async (context: TestContext) => {
        const assertions: TestAssertion[] = [];
        context.logger.info('Starting throughput test');

        try {
          const testDuration = 60000; // 1 minute
          const startTime = Date.now();
          let bytesTransferred = 0;

          // Start continuous data transfer
          const transferPromise = context.connectionService.startContinuousTransfer();
          
          // Monitor throughput
          while (Date.now() - startTime < testDuration) {
            await this.sleep(1000);
            const stats = await context.connectionService.getTransferStats();
            bytesTransferred = stats.totalBytes;
            
            context.logger.debug(`Throughput: ${(bytesTransferred / 1024).toFixed(2)} KB/s`);
          }

          await context.connectionService.stopContinuousTransfer();
          
          const throughputMBps = bytesTransferred / 1024 / 1024 / (testDuration / 1000);
          
          assertions.push({
            description: 'Throughput should be at least 1 MB/s',
            passed: throughputMBps >= 1.0,
            actual: `${throughputMBps.toFixed(2)} MB/s`,
            expected: 'at least 1.0 MB/s'
          });

          return this.createSuccessResult(context, assertions, {
            throughputMBps,
            totalBytesTransferred: bytesTransferred
          });

        } catch (error) {
          return this.createErrorResult(context, error, assertions);
        }
      },
      tags: ['performance', 'throughput'],
      retryCount: 1,
      expectedDuration: 90000
    });

    // Latency test
    this.registerTest({
      id: 'perf_latency',
      name: 'Command Latency Test',
      description: 'Test command response latency',
      category: 'performance',
      priority: 'medium',
      timeout: 60000,
      execute: async (context: TestContext) => {
        const assertions: TestAssertion[] = [];
        context.logger.info('Starting latency test');

        try {
          const testCount = 100;
          const latencies: number[] = [];

          for (let i = 0; i < testCount; i++) {
            const startTime = Date.now();
            await context.connectionService.sendCommand('ping', {});
            const latency = Date.now() - startTime;
            latencies.push(latency);
          }

          const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
          const maxLatency = Math.max(...latencies);
          const minLatency = Math.min(...latencies);

          assertions.push({
            description: 'Average latency should be under 100ms',
            passed: avgLatency < 100,
            actual: `${avgLatency.toFixed(2)}ms`,
            expected: 'under 100ms'
          });

          assertions.push({
            description: 'Maximum latency should be under 500ms',
            passed: maxLatency < 500,
            actual: `${maxLatency}ms`,
            expected: 'under 500ms'
          });

          return this.createSuccessResult(context, assertions, {
            avgLatency,
            maxLatency,
            minLatency,
            latencies
          });

        } catch (error) {
          return this.createErrorResult(context, error, assertions);
        }
      },
      tags: ['performance', 'latency'],
      retryCount: 1,
      expectedDuration: 30000
    });
  }

  private addStressTests(): void {
    // Connection stress test
    this.registerTest({
      id: 'stress_connections',
      name: 'Connection Stress Test',
      description: 'Test system under heavy connection load',
      category: 'stress',
      priority: 'medium',
      timeout: 300000, // 5 minutes
      execute: async (context: TestContext) => {
        const assertions: TestAssertion[] = [];
        context.logger.info('Starting connection stress test');

        try {
          const maxConnections = 10;
          const testDuration = 120000; // 2 minutes
          let activeConnections = 0;
          let totalConnectionAttempts = 0;
          let successfulConnections = 0;

          const startTime = Date.now();
          
          while (Date.now() - startTime < testDuration) {
            // Randomly connect/disconnect
            if (activeConnections < maxConnections && Math.random() > 0.5) {
              totalConnectionAttempts++;
              try {
                const deviceId = `stress_device_${totalConnectionAttempts}`;
                await context.connectionService.connect(deviceId);
                activeConnections++;
                successfulConnections++;
              } catch (error) {
                context.logger.debug(`Connection failed: ${error}`);
              }
            } else if (activeConnections > 0 && Math.random() > 0.7) {
              try {
                const deviceId = `stress_device_${Math.floor(Math.random() * totalConnectionAttempts) + 1}`;
                await context.connectionService.disconnect(deviceId);
                activeConnections--;
              } catch (error) {
                context.logger.debug(`Disconnection failed: ${error}`);
              }
            }

            await this.sleep(100);
          }

          const successRate = successfulConnections / totalConnectionAttempts;

          assertions.push({
            description: 'Success rate should be at least 80%',
            passed: successRate >= 0.8,
            actual: `${(successRate * 100).toFixed(1)}%`,
            expected: 'at least 80%'
          });

          return this.createSuccessResult(context, assertions, {
            totalConnectionAttempts,
            successfulConnections,
            successRate,
            maxActiveConnections: activeConnections
          });

        } catch (error) {
          return this.createErrorResult(context, error, assertions);
        }
      },
      tags: ['stress', 'connections'],
      retryCount: 0,
      expectedDuration: 180000
    });
  }

  private addCompatibilityTests(): void {
    // Camera model compatibility test
    this.registerTest({
      id: 'compat_camera_models',
      name: 'Camera Model Compatibility Test',
      description: 'Test compatibility with different camera models',
      category: 'compatibility',
      priority: 'high',
      timeout: 180000,
      execute: async (context: TestContext) => {
        const assertions: TestAssertion[] = [];
        context.logger.info('Starting camera model compatibility test');

        try {
          const cameraModels = [
            'BMPCC 4K',
            'BMPCC 6K',
            'BMPCC 6K Pro',
            'URSA Mini 4.6K',
            'URSA Mini Pro 12K'
          ];

          const compatibilityResults = new Map<string, boolean>();

          for (const model of cameraModels) {
            try {
              context.logger.debug(`Testing compatibility with ${model}`);
              
              // Simulate camera connection
              const deviceId = `${model.toLowerCase().replace(/\s+/g, '_')}_test`;
              const mockCamera = context.mockCamera.createMockCamera(model);
              
              // Test basic operations
              await mockCamera.connect();
              const deviceInfo = await mockCamera.getDeviceInfo();
              await mockCamera.disconnect();

              const isCompatible = deviceInfo && deviceInfo.model === model;
              compatibilityResults.set(model, isCompatible);

              assertions.push({
                description: `Should be compatible with ${model}`,
                passed: isCompatible,
                actual: isCompatible,
                expected: true
              });

            } catch (error) {
              compatibilityResults.set(model, false);
              assertions.push({
                description: `Should be compatible with ${model}`,
                passed: false,
                actual: false,
                expected: true,
                message: `Error: ${error}`
              });
            }
          }

          const compatibleCount = Array.from(compatibilityResults.values())
            .filter(Boolean).length;
          const totalCount = cameraModels.length;

          assertions.push({
            description: 'Should support at least 80% of camera models',
            passed: (compatibleCount / totalCount) >= 0.8,
            actual: `${compatibleCount}/${totalCount} (${((compatibleCount/totalCount)*100).toFixed(1)}%)`,
            expected: 'at least 80%'
          });

          return this.createSuccessResult(context, assertions, {
            totalModels: totalCount,
            compatibleModels: compatibleCount,
            compatibilityResults: Object.fromEntries(compatibilityResults)
          });

        } catch (error) {
          return this.createErrorResult(context, error, assertions);
        }
      },
      tags: ['compatibility', 'cameras'],
      retryCount: 1,
      expectedDuration: 120000
    });
  }

  private addSecurityTests(): void {
    // Authentication test
    this.registerTest({
      id: 'sec_authentication',
      name: 'Authentication Security Test',
      description: 'Test authentication and authorization mechanisms',
      category: 'security',
      priority: 'critical',
      timeout: 60000,
      execute: async (context: TestContext) => {
        const assertions: TestAssertion[] = [];
        context.logger.info('Starting authentication security test');

        try {
          // Test unauthorized access
          try {
            await context.connectionService.sendCommand('sensitive_command', {});
            assertions.push({
              description: 'Unauthorized access should be denied',
              passed: false,
              actual: 'access granted',
              expected: 'access denied'
            });
          } catch (error) {
            assertions.push({
              description: 'Unauthorized access should be denied',
              passed: error.message.includes('unauthorized'),
              actual: 'access denied',
              expected: 'access denied'
            });
          }

          // Test authentication
          const authResult = await context.connectionService.authenticate('test_user', 'test_password');
          assertions.push({
            description: 'Valid credentials should authenticate successfully',
            passed: authResult,
            actual: authResult,
            expected: true
          });

          // Test authorized access
          const commandResult = await context.connectionService.sendCommand('sensitive_command', {});
          assertions.push({
            description: 'Authenticated user should have access',
            passed: commandResult !== null,
            actual: 'access granted',
            expected: 'access granted'
          });

          return this.createSuccessResult(context, assertions);

        } catch (error) {
          return this.createErrorResult(context, error, assertions);
        }
      },
      tags: ['security', 'authentication'],
      retryCount: 1,
      expectedDuration: 30000
    });
  }

  private createSuccessResult(
    context: TestContext, 
    assertions: TestAssertion[], 
    customMetrics: Record<string, any> = {}
  ): TestResult {
    const allPassed = assertions.every(a => a.passed);
    
    return {
      testId: context.testId,
      testName: context.testName,
      status: allPassed ? 'passed' : 'failed',
      startTime: context.startTime,
      endTime: new Date(),
      duration: Date.now() - context.startTime.getTime(),
      assertions,
      metrics: {
        memoryUsage: {
          peak: this.getMemoryUsage(),
          average: this.getMemoryUsage(),
          final: this.getMemoryUsage()
        },
        cpuUsage: { peak: 0, average: 0 },
        customMetrics
      },
      artifacts: []
    };
  }

  private createErrorResult(
    context: TestContext, 
    error: any, 
    assertions: TestAssertion[]
  ): TestResult {
    return {
      testId: context.testId,
      testName: context.testName,
      status: 'error',
      startTime: context.startTime,
      endTime: new Date(),
      duration: Date.now() - context.startTime.getTime(),
      error: error instanceof Error ? error : new Error(String(error)),
      assertions,
      metrics: {
        memoryUsage: {
          peak: this.getMemoryUsage(),
          average: this.getMemoryUsage(),
          final: this.getMemoryUsage()
        },
        cpuUsage: { peak: 0, average: 0 },
        customMetrics: {}
      },
      artifacts: []
    };
  }

  registerTest(testCase: TestCase): void {
    this.testCases.set(testCase.id, testCase);
    this.emit('test_registered', testCase);
  }

  registerSuite(suite: TestSuite): void {
    this.testSuites.set(suite.id, suite);
    this.emit('suite_registered', suite);
  }

  async runTests(config: TestRunConfig = {}): Promise<TestRunResult> {
    if (this.isRunning) {
      throw new Error('Test run already in progress');
    }

    this.isRunning = true;
    const runId = this.generateRunId();
    
    this.currentRun = {
      id: runId,
      startTime: new Date(),
      endTime: new Date(),
      totalDuration: 0,
      config,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        timeout: 0,
        error: 0,
        successRate: 0,
        categories: {}
      },
      results: [],
      artifacts: [],
      errors: []
    };

    try {
      this.emit('test_run_started', { runId, config });

      // Select tests to run
      const testsToRun = this.selectTests(config);
      this.currentRun.summary.total = testsToRun.length;

      // Run tests
      if (config.parallel && config.maxParallel) {
        await this.runTestsInParallel(testsToRun, config);
      } else {
        await this.runTestsSequentially(testsToRun, config);
      }

      // Calculate final results
      this.calculateSummary();
      
      this.currentRun.endTime = new Date();
      this.currentRun.totalDuration = this.currentRun.endTime.getTime() - this.currentRun.startTime.getTime();

      this.emit('test_run_completed', this.currentRun);
      
      return { ...this.currentRun };

    } catch (error) {
      this.currentRun.errors.push(error instanceof Error ? error.message : String(error));
      this.currentRun.endTime = new Date();
      this.currentRun.totalDuration = this.currentRun.endTime.getTime() - this.currentRun.startTime.getTime();
      
      this.emit('test_run_failed', { runId, error });
      
      return { ...this.currentRun };
      
    } finally {
      this.isRunning = false;
      this.currentRun = null;
    }
  }

  private selectTests(config: TestRunConfig): TestCase[] {
    let tests = Array.from(this.testCases.values());

    // Filter by specific test IDs
    if (config.tests && config.tests.length > 0) {
      tests = tests.filter(t => config.tests!.includes(t.id));
    }

    // Filter by categories
    if (config.categories && config.categories.length > 0) {
      tests = tests.filter(t => config.categories!.includes(t.category));
    }

    // Filter by tags
    if (config.tags && config.tags.length > 0) {
      tests = tests.filter(t => 
        config.tags!.some(tag => t.tags.includes(tag))
      );
    }

    // Filter by suites
    if (config.suites && config.suites.length > 0) {
      const suiteTests = new Set<string>();
      for (const suiteId of config.suites) {
        const suite = this.testSuites.get(suiteId);
        if (suite) {
          suite.testCases.forEach(testId => suiteTests.add(testId));
        }
      }
      tests = tests.filter(t => suiteTests.has(t.id));
    }

    // Sort by priority
    tests.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return tests;
  }

  private async runTestsSequentially(tests: TestCase[], config: TestRunConfig): Promise<void> {
    for (const test of tests) {
      if (!this.isRunning) break;

      try {
        const result = await this.executeTest(test, config);
        this.currentRun!.results.push(result);
        this.updateSummaryForResult(result);

        if (!config.continueOnFailure && result.status === 'failed') {
          break;
        }
      } catch (error) {
        this.currentRun!.errors.push(`Error running test ${test.id}: ${error}`);
      }
    }
  }

  private async runTestsInParallel(tests: TestCase[], config: TestRunConfig): Promise<void> {
    const maxParallel = config.maxParallel || 3;
    const chunks = this.chunkArray(tests, maxParallel);

    for (const chunk of chunks) {
      if (!this.isRunning) break;

      const promises = chunk.map(test => this.executeTest(test, config));
      const results = await Promise.allSettled(promises);

      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled') {
          const result = (results[i] as PromiseFulfilledResult<TestResult>).value;
          this.currentRun!.results.push(result);
          this.updateSummaryForResult(result);
        } else {
          const error = (results[i] as PromiseRejectedResult).reason;
          this.currentRun!.errors.push(`Error running test ${chunk[i].id}: ${error}`);
        }
      }
    }
  }

  private async executeTest(testCase: TestCase, config: TestRunConfig): Promise<TestResult> {
    const context: TestContext = {
      testId: testCase.id,
      testName: testCase.name,
      startTime: new Date(),
      timeout: config.timeout || testCase.timeout,
      metadata: {},
      logger: this.createTestLogger(testCase.id, config.verbose || false)
    };

    this.emit('test_started', { testId: testCase.id, testName: testCase.name });

    try {
      // Setup
      if (testCase.setup) {
        await testCase.setup();
      }

      // Execute with timeout
      const result = await this.withTimeout(
        testCase.execute(context),
        context.timeout
      );

      // Cleanup
      if (testCase.cleanup) {
        await testCase.cleanup();
      }

      this.emit('test_completed', { testId: testCase.id, result });
      
      return result;

    } catch (error) {
      const result: TestResult = {
        testId: testCase.id,
        testName: testCase.name,
        status: error.message.includes('timeout') ? 'timeout' : 'error',
        startTime: context.startTime,
        endTime: new Date(),
        duration: Date.now() - context.startTime.getTime(),
        error: error instanceof Error ? error : new Error(String(error)),
        assertions: [],
        metrics: {
          memoryUsage: { peak: 0, average: 0, final: 0 },
          cpuUsage: { peak: 0, average: 0 },
          customMetrics: {}
        },
        artifacts: []
      };

      this.emit('test_failed', { testId: testCase.id, result });
      
      // Cleanup on error
      try {
        if (testCase.cleanup) {
          await testCase.cleanup();
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      return result;
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Test timed out after ${timeout}ms`));
      }, timeout);

      promise
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private updateSummaryForResult(result: TestResult): void {
    const summary = this.currentRun!.summary;
    
    switch (result.status) {
      case 'passed': summary.passed++; break;
      case 'failed': summary.failed++; break;
      case 'skipped': summary.skipped++; break;
      case 'timeout': summary.timeout++; break;
      case 'error': summary.error++; break;
    }
  }

  private calculateSummary(): void {
    const summary = this.currentRun!.summary;
    const total = summary.passed + summary.failed + summary.skipped + summary.timeout + summary.error;
    summary.total = total;
    summary.successRate = total > 0 ? summary.passed / total : 0;

    // Calculate category summaries
    const categorySummaries = new Map<string, TestSummary>();
    
    for (const result of this.currentRun!.results) {
      const testCase = this.testCases.get(result.testId);
      if (!testCase) continue;

      const category = testCase.category;
      if (!categorySummaries.has(category)) {
        categorySummaries.set(category, {
          total: 0, passed: 0, failed: 0, skipped: 0, 
          timeout: 0, error: 0, successRate: 0, categories: {}
        });
      }

      const catSummary = categorySummaries.get(category)!;
      catSummary.total++;
      
      switch (result.status) {
        case 'passed': catSummary.passed++; break;
        case 'failed': catSummary.failed++; break;
        case 'skipped': catSummary.skipped++; break;
        case 'timeout': catSummary.timeout++; break;
        case 'error': catSummary.error++; break;
      }
      
      catSummary.successRate = catSummary.passed / catSummary.total;
    }

    summary.categories = Object.fromEntries(categorySummaries);
  }

  private createTestLogger(testId: string, verbose: boolean): TestLogger {
    return {
      info: (message: string, data?: any) => {
        if (verbose) {
          console.log(`[${testId}] INFO: ${message}`, data || '');
        }
        this.emit('test_log', { testId, level: 'info', message, data });
      },
      warn: (message: string, data?: any) => {
        if (verbose) {
          console.warn(`[${testId}] WARN: ${message}`, data || '');
        }
        this.emit('test_log', { testId, level: 'warn', message, data });
      },
      error: (message: string, data?: any) => {
        console.error(`[${testId}] ERROR: ${message}`, data || '');
        this.emit('test_log', { testId, level: 'error', message, data });
      },
      debug: (message: string, data?: any) => {
        if (verbose) {
          console.debug(`[${testId}] DEBUG: ${message}`, data || '');
        }
        this.emit('test_log', { testId, level: 'debug', message, data });
      }
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private generateRunId(): string {
    return `test_run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  getRegisteredTests(): TestCase[] {
    return Array.from(this.testCases.values());
  }

  getRegisteredSuites(): TestSuite[] {
    return Array.from(this.testSuites.values());
  }

  getCurrentRun(): TestRunResult | null {
    return this.currentRun ? { ...this.currentRun } : null;
  }

  isTestRunning(): boolean {
    return this.isRunning;
  }

  async stopCurrentRun(): Promise<void> {
    if (this.isRunning) {
      this.isRunning = false;
      this.emit('test_run_stopped');
    }
  }
}