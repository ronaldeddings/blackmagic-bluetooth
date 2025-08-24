import { EventEmitter } from 'events';
import { BluetoothConnectionService } from '../bluetooth/BluetoothConnection';

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  maxAttempts: number;
  baseDelay: number;
  backoffMultiplier: number;
  successRate: number;
  avgRecoveryTime: number;
  conditions: RecoveryCondition[];
  actions: RecoveryAction[];
  fallbackStrategies: string[];
}

export interface RecoveryCondition {
  type: 'signal_strength' | 'error_type' | 'connection_state' | 'device_type' | 'retry_count' | 'time_since_failure';
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: any;
  weight: number;
}

export interface RecoveryAction {
  type: 'reconnect' | 'reset_connection' | 'clear_cache' | 'restart_service' | 'switch_adapter' | 'reduce_quality' | 'wait';
  parameters: Record<string, any>;
  timeout: number;
  retryable: boolean;
}

export interface ConnectionFailure {
  deviceId: string;
  timestamp: Date;
  errorType: string;
  errorMessage: string;
  signalStrength?: number;
  connectionState: string;
  previousFailures: number;
  context: Record<string, any>;
}

export interface RecoverySession {
  id: string;
  deviceId: string;
  startTime: Date;
  endTime?: Date;
  strategy: RecoveryStrategy;
  attemptCount: number;
  currentAction?: RecoveryAction;
  success: boolean;
  totalRecoveryTime?: number;
  errors: string[];
  metrics: RecoveryMetrics;
}

export interface RecoveryMetrics {
  attemptDuration: number[];
  signalStrengthHistory: number[];
  errorHistory: string[];
  actionEffectiveness: Map<string, number>;
  resourceUsage: {
    cpu: number[];
    memory: number[];
    battery: number[];
  };
}

export interface RecoveryConfig {
  enabled: boolean;
  maxConcurrentSessions: number;
  defaultStrategy: string;
  strategyTimeout: number;
  learningEnabled: boolean;
  adaptiveStrategies: boolean;
  fallbackBehavior: 'fail' | 'retry_all' | 'manual';
  monitoringEnabled: boolean;
  metricsRetention: number;
}

export class ConnectionRecoveryService extends EventEmitter {
  private config: RecoveryConfig;
  private strategies: Map<string, RecoveryStrategy> = new Map();
  private activeSessions: Map<string, RecoverySession> = new Map();
  private connectionService: BluetoothConnectionService;
  private failureHistory: Map<string, ConnectionFailure[]> = new Map();
  private recoveryMetrics: Map<string, RecoveryMetrics[]> = new Map();
  private isRunning = false;

  constructor(
    connectionService: BluetoothConnectionService,
    config?: Partial<RecoveryConfig>
  ) {
    super();
    this.connectionService = connectionService;
    this.config = {
      enabled: true,
      maxConcurrentSessions: 5,
      defaultStrategy: 'progressive_backoff',
      strategyTimeout: 300000, // 5 minutes
      learningEnabled: true,
      adaptiveStrategies: true,
      fallbackBehavior: 'retry_all',
      monitoringEnabled: true,
      metricsRetention: 86400000, // 24 hours
      ...config
    };

    this.initializeDefaultStrategies();
    this.setupEventListeners();
  }

  private initializeDefaultStrategies(): void {
    // Progressive backoff strategy
    this.strategies.set('progressive_backoff', {
      id: 'progressive_backoff',
      name: 'Progressive Backoff',
      description: 'Gradually increase delay between attempts',
      maxAttempts: 5,
      baseDelay: 1000,
      backoffMultiplier: 2,
      successRate: 0.8,
      avgRecoveryTime: 15000,
      conditions: [
        {
          type: 'error_type',
          operator: 'in',
          value: ['connection_lost', 'timeout', 'device_unavailable'],
          weight: 1.0
        }
      ],
      actions: [
        { type: 'wait', parameters: { duration: 'calculated' }, timeout: 30000, retryable: true },
        { type: 'reconnect', parameters: {}, timeout: 15000, retryable: true }
      ],
      fallbackStrategies: ['aggressive_recovery', 'service_reset']
    });

    // Quick recovery strategy
    this.strategies.set('quick_recovery', {
      id: 'quick_recovery',
      name: 'Quick Recovery',
      description: 'Fast recovery for temporary connection issues',
      maxAttempts: 3,
      baseDelay: 500,
      backoffMultiplier: 1.5,
      successRate: 0.6,
      avgRecoveryTime: 5000,
      conditions: [
        {
          type: 'signal_strength',
          operator: 'gt',
          value: -70,
          weight: 0.8
        },
        {
          type: 'retry_count',
          operator: 'lt',
          value: 2,
          weight: 0.6
        }
      ],
      actions: [
        { type: 'reconnect', parameters: {}, timeout: 5000, retryable: true }
      ],
      fallbackStrategies: ['progressive_backoff']
    });

    // Aggressive recovery strategy
    this.strategies.set('aggressive_recovery', {
      id: 'aggressive_recovery',
      name: 'Aggressive Recovery',
      description: 'Comprehensive recovery with multiple techniques',
      maxAttempts: 8,
      baseDelay: 2000,
      backoffMultiplier: 1.8,
      successRate: 0.9,
      avgRecoveryTime: 45000,
      conditions: [
        {
          type: 'retry_count',
          operator: 'gte',
          value: 3,
          weight: 1.0
        },
        {
          type: 'error_type',
          operator: 'in',
          value: ['protocol_error', 'authentication_failed'],
          weight: 0.9
        }
      ],
      actions: [
        { type: 'clear_cache', parameters: {}, timeout: 5000, retryable: false },
        { type: 'reset_connection', parameters: {}, timeout: 10000, retryable: true },
        { type: 'wait', parameters: { duration: 'calculated' }, timeout: 30000, retryable: true },
        { type: 'reconnect', parameters: {}, timeout: 15000, retryable: true }
      ],
      fallbackStrategies: ['service_reset']
    });

    // Service reset strategy
    this.strategies.set('service_reset', {
      id: 'service_reset',
      name: 'Service Reset',
      description: 'Full service restart as last resort',
      maxAttempts: 2,
      baseDelay: 5000,
      backoffMultiplier: 2,
      successRate: 0.95,
      avgRecoveryTime: 60000,
      conditions: [
        {
          type: 'retry_count',
          operator: 'gte',
          value: 5,
          weight: 1.0
        }
      ],
      actions: [
        { type: 'restart_service', parameters: {}, timeout: 30000, retryable: false },
        { type: 'wait', parameters: { duration: 10000 }, timeout: 15000, retryable: true },
        { type: 'reconnect', parameters: {}, timeout: 20000, retryable: true }
      ],
      fallbackStrategies: []
    });
  }

  private setupEventListeners(): void {
    this.connectionService.on('connection_failed', this.handleConnectionFailure.bind(this));
    this.connectionService.on('connection_lost', this.handleConnectionLost.bind(this));
    this.connectionService.on('connection_restored', this.handleConnectionRestored.bind(this));
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('service_started');
    
    // Start background cleanup task
    this.startBackgroundTasks();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Cancel all active sessions
    for (const session of this.activeSessions.values()) {
      await this.cancelRecoverySession(session.id);
    }
    
    this.emit('service_stopped');
  }

  private async handleConnectionFailure(failure: ConnectionFailure): Promise<void> {
    if (!this.config.enabled) return;
    
    // Record failure
    this.recordFailure(failure);
    
    // Start recovery session
    await this.startRecoverySession(failure);
  }

  private async handleConnectionLost(deviceId: string): Promise<void> {
    const failure: ConnectionFailure = {
      deviceId,
      timestamp: new Date(),
      errorType: 'connection_lost',
      errorMessage: 'Connection lost unexpectedly',
      connectionState: 'disconnected',
      previousFailures: this.getPreviousFailureCount(deviceId),
      context: {}
    };
    
    await this.handleConnectionFailure(failure);
  }

  private handleConnectionRestored(deviceId: string): void {
    // Mark any active recovery session as successful
    const session = Array.from(this.activeSessions.values())
      .find(s => s.deviceId === deviceId);
    
    if (session) {
      this.completeRecoverySession(session.id, true);
    }
  }

  private recordFailure(failure: ConnectionFailure): void {
    if (!this.failureHistory.has(failure.deviceId)) {
      this.failureHistory.set(failure.deviceId, []);
    }
    
    const history = this.failureHistory.get(failure.deviceId)!;
    history.push(failure);
    
    // Limit history size
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    this.emit('failure_recorded', failure);
  }

  private getPreviousFailureCount(deviceId: string): number {
    const history = this.failureHistory.get(deviceId) || [];
    const recentTime = Date.now() - 300000; // 5 minutes
    
    return history.filter(f => f.timestamp.getTime() > recentTime).length;
  }

  private async startRecoverySession(failure: ConnectionFailure): Promise<string> {
    // Check concurrent session limit
    if (this.activeSessions.size >= this.config.maxConcurrentSessions) {
      throw new Error('Maximum concurrent recovery sessions reached');
    }
    
    // Select recovery strategy
    const strategy = await this.selectRecoveryStrategy(failure);
    
    // Create recovery session
    const sessionId = this.generateSessionId();
    const session: RecoverySession = {
      id: sessionId,
      deviceId: failure.deviceId,
      startTime: new Date(),
      strategy,
      attemptCount: 0,
      success: false,
      errors: [],
      metrics: {
        attemptDuration: [],
        signalStrengthHistory: [],
        errorHistory: [],
        actionEffectiveness: new Map(),
        resourceUsage: {
          cpu: [],
          memory: [],
          battery: []
        }
      }
    };
    
    this.activeSessions.set(sessionId, session);
    this.emit('recovery_session_started', session);
    
    // Start recovery attempts
    this.executeRecoverySession(sessionId);
    
    return sessionId;
  }

  private async selectRecoveryStrategy(failure: ConnectionFailure): Promise<RecoveryStrategy> {
    let bestStrategy = this.strategies.get(this.config.defaultStrategy)!;
    let bestScore = 0;
    
    for (const strategy of this.strategies.values()) {
      const score = this.calculateStrategyScore(strategy, failure);
      if (score > bestScore) {
        bestScore = score;
        bestStrategy = strategy;
      }
    }
    
    // Apply adaptive learning if enabled
    if (this.config.learningEnabled && this.config.adaptiveStrategies) {
      bestStrategy = await this.applyAdaptiveLearning(bestStrategy, failure);
    }
    
    return bestStrategy;
  }

  private calculateStrategyScore(strategy: RecoveryStrategy, failure: ConnectionFailure): number {
    let score = 0;
    
    for (const condition of strategy.conditions) {
      if (this.evaluateCondition(condition, failure)) {
        score += condition.weight;
      }
    }
    
    // Factor in historical success rate
    score *= strategy.successRate;
    
    // Penalize strategies with long recovery times if quick recovery is preferred
    const timePenalty = Math.max(0, 1 - (strategy.avgRecoveryTime / 60000));
    score += timePenalty * 0.2;
    
    return score;
  }

  private evaluateCondition(condition: RecoveryCondition, failure: ConnectionFailure): boolean {
    let value: any;
    
    switch (condition.type) {
      case 'signal_strength':
        value = failure.signalStrength || -100;
        break;
      case 'error_type':
        value = failure.errorType;
        break;
      case 'connection_state':
        value = failure.connectionState;
        break;
      case 'retry_count':
        value = failure.previousFailures;
        break;
      case 'time_since_failure':
        value = Date.now() - failure.timestamp.getTime();
        break;
      default:
        return false;
    }
    
    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'ne': return value !== condition.value;
      case 'gt': return value > condition.value;
      case 'lt': return value < condition.value;
      case 'gte': return value >= condition.value;
      case 'lte': return value <= condition.value;
      case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
      case 'contains': return String(value).includes(String(condition.value));
      default: return false;
    }
  }

  private async applyAdaptiveLearning(strategy: RecoveryStrategy, failure: ConnectionFailure): Promise<RecoveryStrategy> {
    // Get historical data for this device and error type
    const history = this.recoveryMetrics.get(failure.deviceId) || [];
    
    if (history.length < 5) {
      return strategy; // Not enough data for learning
    }
    
    // Clone strategy for modification
    const adaptedStrategy = { ...strategy };
    
    // Adjust based on recent success patterns
    const recentMetrics = history.slice(-10);
    const avgDuration = recentMetrics.reduce((sum, m) => 
      sum + m.attemptDuration.reduce((s, d) => s + d, 0), 0) / recentMetrics.length;
    
    // Adjust backoff multiplier based on average duration
    if (avgDuration > strategy.avgRecoveryTime * 1.5) {
      adaptedStrategy.backoffMultiplier = Math.min(3, strategy.backoffMultiplier * 1.2);
    } else if (avgDuration < strategy.avgRecoveryTime * 0.7) {
      adaptedStrategy.backoffMultiplier = Math.max(1.1, strategy.backoffMultiplier * 0.9);
    }
    
    return adaptedStrategy;
  }

  private async executeRecoverySession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    try {
      while (session.attemptCount < session.strategy.maxAttempts && this.activeSessions.has(sessionId)) {
        session.attemptCount++;
        
        const attemptStart = Date.now();
        this.emit('recovery_attempt_started', { sessionId, attempt: session.attemptCount });
        
        // Calculate delay for this attempt
        const delay = this.calculateAttemptDelay(session.strategy, session.attemptCount);
        
        if (delay > 0) {
          await this.sleep(delay);
        }
        
        // Execute recovery actions
        let success = false;
        for (const action of session.strategy.actions) {
          session.currentAction = action;
          
          try {
            success = await this.executeRecoveryAction(action, session);
            
            if (success) {
              break; // Connection recovered
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            session.errors.push(errorMessage);
            session.metrics.errorHistory.push(errorMessage);
            
            if (!action.retryable) {
              throw error; // Non-retryable action failed
            }
          }
        }
        
        session.currentAction = undefined;
        session.metrics.attemptDuration.push(Date.now() - attemptStart);
        
        if (success) {
          this.completeRecoverySession(sessionId, true);
          return;
        }
        
        this.emit('recovery_attempt_failed', { sessionId, attempt: session.attemptCount });
      }
      
      // All attempts failed, try fallback strategies
      if (session.strategy.fallbackStrategies.length > 0) {
        await this.executeFallbackStrategies(sessionId);
      } else {
        this.completeRecoverySession(sessionId, false);
      }
      
    } catch (error) {
      session.errors.push(error instanceof Error ? error.message : String(error));
      this.completeRecoverySession(sessionId, false);
    }
  }

  private calculateAttemptDelay(strategy: RecoveryStrategy, attemptNumber: number): number {
    return strategy.baseDelay * Math.pow(strategy.backoffMultiplier, attemptNumber - 1);
  }

  private async executeRecoveryAction(action: RecoveryAction, session: RecoverySession): Promise<boolean> {
    const actionStart = Date.now();
    
    try {
      let success = false;
      
      switch (action.type) {
        case 'wait':
          const duration = action.parameters.duration === 'calculated' 
            ? this.calculateAttemptDelay(session.strategy, session.attemptCount)
            : action.parameters.duration;
          await this.sleep(duration);
          success = true;
          break;
          
        case 'reconnect':
          success = await this.connectionService.reconnect(session.deviceId);
          break;
          
        case 'reset_connection':
          await this.connectionService.resetConnection(session.deviceId);
          success = await this.connectionService.connect(session.deviceId);
          break;
          
        case 'clear_cache':
          await this.connectionService.clearCache(session.deviceId);
          success = true;
          break;
          
        case 'restart_service':
          await this.connectionService.restart();
          success = true;
          break;
          
        case 'switch_adapter':
          success = await this.connectionService.switchAdapter(action.parameters.adapterId);
          break;
          
        case 'reduce_quality':
          success = await this.connectionService.reduceStreamingQuality(session.deviceId);
          break;
          
        default:
          throw new Error(`Unknown recovery action: ${action.type}`);
      }
      
      // Record action effectiveness
      const actionDuration = Date.now() - actionStart;
      const effectiveness = success ? 1.0 : 0.0;
      session.metrics.actionEffectiveness.set(action.type, effectiveness);
      
      this.emit('recovery_action_completed', { 
        sessionId: session.id, 
        action: action.type, 
        success, 
        duration: actionDuration 
      });
      
      return success;
      
    } catch (error) {
      this.emit('recovery_action_failed', { 
        sessionId: session.id, 
        action: action.type, 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async executeFallbackStrategies(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    for (const strategyId of session.strategy.fallbackStrategies) {
      const fallbackStrategy = this.strategies.get(strategyId);
      if (!fallbackStrategy) continue;
      
      // Create new session with fallback strategy
      const fallbackSession: RecoverySession = {
        ...session,
        id: this.generateSessionId(),
        strategy: fallbackStrategy,
        attemptCount: 0,
        startTime: new Date(),
        errors: [],
        metrics: {
          attemptDuration: [],
          signalStrengthHistory: [],
          errorHistory: [],
          actionEffectiveness: new Map(),
          resourceUsage: {
            cpu: [],
            memory: [],
            battery: []
          }
        }
      };
      
      this.activeSessions.set(fallbackSession.id, fallbackSession);
      
      // Remove original session
      this.activeSessions.delete(sessionId);
      
      // Execute fallback strategy
      await this.executeRecoverySession(fallbackSession.id);
      return;
    }
    
    // No fallback strategies succeeded
    this.completeRecoverySession(sessionId, false);
  }

  private completeRecoverySession(sessionId: string, success: boolean): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    session.success = success;
    session.endTime = new Date();
    session.totalRecoveryTime = session.endTime.getTime() - session.startTime.getTime();
    
    // Store metrics
    if (!this.recoveryMetrics.has(session.deviceId)) {
      this.recoveryMetrics.set(session.deviceId, []);
    }
    this.recoveryMetrics.get(session.deviceId)!.push(session.metrics);
    
    // Remove from active sessions
    this.activeSessions.delete(sessionId);
    
    this.emit('recovery_session_completed', { 
      sessionId, 
      deviceId: session.deviceId, 
      success, 
      duration: session.totalRecoveryTime 
    });
    
    // Update strategy success rates if learning is enabled
    if (this.config.learningEnabled) {
      this.updateStrategyMetrics(session.strategy.id, success, session.totalRecoveryTime!);
    }
  }

  private updateStrategyMetrics(strategyId: string, success: boolean, duration: number): void {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return;
    
    // Simple exponential moving average
    const alpha = 0.1;
    strategy.successRate = success 
      ? strategy.successRate * (1 - alpha) + alpha
      : strategy.successRate * (1 - alpha);
    
    strategy.avgRecoveryTime = strategy.avgRecoveryTime * (1 - alpha) + duration * alpha;
    
    this.emit('strategy_metrics_updated', { strategyId, successRate: strategy.successRate, avgRecoveryTime: strategy.avgRecoveryTime });
  }

  private async cancelRecoverySession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    this.activeSessions.delete(sessionId);
    this.emit('recovery_session_cancelled', { sessionId, deviceId: session.deviceId });
  }

  private generateSessionId(): string {
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startBackgroundTasks(): void {
    // Cleanup old metrics periodically
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000); // Every hour
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.config.metricsRetention;
    
    for (const [deviceId, history] of this.failureHistory.entries()) {
      const filtered = history.filter(f => f.timestamp.getTime() > cutoff);
      if (filtered.length === 0) {
        this.failureHistory.delete(deviceId);
      } else {
        this.failureHistory.set(deviceId, filtered);
      }
    }
    
    // Limit recovery metrics
    for (const [deviceId, metrics] of this.recoveryMetrics.entries()) {
      if (metrics.length > 50) {
        this.recoveryMetrics.set(deviceId, metrics.slice(-50));
      }
    }
  }

  // Public API methods
  getActiveRecoverySessions(): RecoverySession[] {
    return Array.from(this.activeSessions.values());
  }

  getRecoveryStrategies(): RecoveryStrategy[] {
    return Array.from(this.strategies.values());
  }

  getFailureHistory(deviceId: string): ConnectionFailure[] {
    return this.failureHistory.get(deviceId) || [];
  }

  getRecoveryMetrics(deviceId: string): RecoveryMetrics[] {
    return this.recoveryMetrics.get(deviceId) || [];
  }

  async addCustomStrategy(strategy: RecoveryStrategy): Promise<void> {
    this.strategies.set(strategy.id, strategy);
    this.emit('strategy_added', strategy);
  }

  async removeStrategy(strategyId: string): Promise<void> {
    if (this.strategies.delete(strategyId)) {
      this.emit('strategy_removed', strategyId);
    }
  }

  updateConfig(config: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config_updated', this.config);
  }
}