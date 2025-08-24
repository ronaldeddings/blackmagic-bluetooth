import { EventEmitter } from 'events';

export interface RetryPolicy {
  id: string;
  name: string;
  description: string;
  maxAttempts: number;
  baseDelay: number;
  backoffStrategy: 'fixed' | 'linear' | 'exponential' | 'fibonacci' | 'custom';
  backoffMultiplier?: number;
  maxDelay?: number;
  jitter: boolean;
  jitterRange?: [number, number];
  retryableErrors: string[];
  nonRetryableErrors: string[];
  timeoutPerAttempt?: number;
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

export interface RetryContext<T = any> {
  id: string;
  operation: string;
  args: any[];
  policy: RetryPolicy;
  startTime: Date;
  attempt: number;
  lastError?: Error;
  totalDelay: number;
  isCircuitOpen: boolean;
  metadata: Record<string, T>;
}

export interface RetryResult<T = any> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
  retryDetails: RetryAttemptDetail[];
}

export interface RetryAttemptDetail {
  attempt: number;
  timestamp: Date;
  duration: number;
  success: boolean;
  error?: string;
  delay?: number;
}

export interface RetryStatistics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageAttempts: number;
  averageDuration: number;
  policyUsage: Map<string, number>;
  errorDistribution: Map<string, number>;
  circuitBreakerActivations: number;
  lastReset: Date;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  successCount: number;
}

export type RetryFunction<T> = (...args: any[]) => Promise<T>;

export class RetryManager extends EventEmitter {
  private policies: Map<string, RetryPolicy> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private activeRetries: Map<string, RetryContext> = new Map();
  private statistics: RetryStatistics;
  private isRunning = false;

  constructor() {
    super();
    this.statistics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageAttempts: 0,
      averageDuration: 0,
      policyUsage: new Map(),
      errorDistribution: new Map(),
      circuitBreakerActivations: 0,
      lastReset: new Date()
    };

    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies(): void {
    // Default exponential backoff policy
    this.addPolicy({
      id: 'default_exponential',
      name: 'Default Exponential Backoff',
      description: 'Exponential backoff with jitter for general operations',
      maxAttempts: 3,
      baseDelay: 1000,
      backoffStrategy: 'exponential',
      backoffMultiplier: 2,
      maxDelay: 30000,
      jitter: true,
      jitterRange: [0.1, 0.3],
      retryableErrors: ['timeout', 'network_error', 'service_unavailable', 'connection_lost'],
      nonRetryableErrors: ['authentication_failed', 'authorization_denied', 'invalid_request'],
      timeoutPerAttempt: 10000,
      circuitBreakerEnabled: false
    });

    // Bluetooth connection policy
    this.addPolicy({
      id: 'bluetooth_connection',
      name: 'Bluetooth Connection Retry',
      description: 'Optimized for Bluetooth connection operations',
      maxAttempts: 5,
      baseDelay: 2000,
      backoffStrategy: 'exponential',
      backoffMultiplier: 1.5,
      maxDelay: 15000,
      jitter: true,
      jitterRange: [0.2, 0.4],
      retryableErrors: ['connection_failed', 'device_not_found', 'pairing_failed', 'timeout'],
      nonRetryableErrors: ['device_not_supported', 'bluetooth_disabled', 'permission_denied'],
      timeoutPerAttempt: 8000,
      circuitBreakerEnabled: true,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeout: 30000
    });

    // Camera control policy
    this.addPolicy({
      id: 'camera_control',
      name: 'Camera Control Operations',
      description: 'Retry policy for camera control commands',
      maxAttempts: 4,
      baseDelay: 1500,
      backoffStrategy: 'linear',
      backoffMultiplier: 1.2,
      maxDelay: 8000,
      jitter: false,
      retryableErrors: ['command_timeout', 'busy', 'temporary_failure'],
      nonRetryableErrors: ['invalid_command', 'unsupported_operation', 'device_error'],
      timeoutPerAttempt: 5000,
      circuitBreakerEnabled: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 20000
    });

    // File operations policy
    this.addPolicy({
      id: 'file_operations',
      name: 'File Operations Retry',
      description: 'Retry policy for file system operations',
      maxAttempts: 3,
      baseDelay: 500,
      backoffStrategy: 'exponential',
      backoffMultiplier: 2,
      maxDelay: 5000,
      jitter: true,
      jitterRange: [0.1, 0.2],
      retryableErrors: ['file_locked', 'permission_temporary', 'disk_full'],
      nonRetryableErrors: ['file_not_found', 'permission_denied', 'invalid_path'],
      timeoutPerAttempt: 3000,
      circuitBreakerEnabled: false
    });

    // Network operations policy
    this.addPolicy({
      id: 'network_operations',
      name: 'Network Operations Retry',
      description: 'Retry policy for network and API operations',
      maxAttempts: 4,
      baseDelay: 1000,
      backoffStrategy: 'exponential',
      backoffMultiplier: 2,
      maxDelay: 16000,
      jitter: true,
      jitterRange: [0.1, 0.3],
      retryableErrors: ['network_timeout', 'service_unavailable', 'rate_limited', 'server_error'],
      nonRetryableErrors: ['not_found', 'bad_request', 'unauthorized', 'forbidden'],
      timeoutPerAttempt: 15000,
      circuitBreakerEnabled: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('retry_manager_started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Cancel all active retries
    for (const context of this.activeRetries.values()) {
      this.emit('retry_cancelled', { id: context.id, operation: context.operation });
    }
    this.activeRetries.clear();
    
    this.emit('retry_manager_stopped');
  }

  addPolicy(policy: RetryPolicy): void {
    this.policies.set(policy.id, policy);
    this.emit('policy_added', policy);
  }

  removePolicy(policyId: string): boolean {
    const removed = this.policies.delete(policyId);
    if (removed) {
      this.emit('policy_removed', policyId);
    }
    return removed;
  }

  getPolicy(policyId: string): RetryPolicy | undefined {
    return this.policies.get(policyId);
  }

  getAllPolicies(): RetryPolicy[] {
    return Array.from(this.policies.values());
  }

  async executeWithRetry<T>(
    operation: RetryFunction<T>,
    args: any[] = [],
    policyId = 'default_exponential',
    operationName?: string,
    metadata?: Record<string, any>
  ): Promise<RetryResult<T>> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Retry policy '${policyId}' not found`);
    }

    const contextId = this.generateContextId();
    const context: RetryContext = {
      id: contextId,
      operation: operationName || 'unknown_operation',
      args,
      policy,
      startTime: new Date(),
      attempt: 0,
      totalDelay: 0,
      isCircuitOpen: false,
      metadata: metadata || {}
    };

    this.activeRetries.set(contextId, context);
    this.statistics.totalOperations++;
    this.updatePolicyUsage(policyId);

    try {
      const result = await this.performRetry(operation, context);
      this.activeRetries.delete(contextId);
      
      if (result.success) {
        this.statistics.successfulOperations++;
      } else {
        this.statistics.failedOperations++;
      }
      
      this.updateAverageMetrics(result.attempts, result.totalDuration);
      this.emit('operation_completed', { context, result });
      
      return result;
    } catch (error) {
      this.activeRetries.delete(contextId);
      this.statistics.failedOperations++;
      
      const result: RetryResult<T> = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        attempts: context.attempt,
        totalDuration: Date.now() - context.startTime.getTime(),
        retryDetails: []
      };
      
      this.updateAverageMetrics(result.attempts, result.totalDuration);
      this.emit('operation_failed', { context, result });
      
      return result;
    }
  }

  private async performRetry<T>(
    operation: RetryFunction<T>, 
    context: RetryContext
  ): Promise<RetryResult<T>> {
    const retryDetails: RetryAttemptDetail[] = [];
    
    // Check circuit breaker
    if (context.policy.circuitBreakerEnabled && this.isCircuitOpen(context.operation)) {
      context.isCircuitOpen = true;
      const error = new Error(`Circuit breaker is open for operation: ${context.operation}`);
      this.recordError(error.message);
      
      return {
        success: false,
        error,
        attempts: 0,
        totalDuration: 0,
        retryDetails
      };
    }

    while (context.attempt < context.policy.maxAttempts) {
      context.attempt++;
      const attemptStart = Date.now();
      
      this.emit('retry_attempt_started', { 
        contextId: context.id,
        operation: context.operation,
        attempt: context.attempt 
      });

      try {
        // Set timeout for this attempt if specified
        const result = context.policy.timeoutPerAttempt
          ? await this.withTimeout(operation(...context.args), context.policy.timeoutPerAttempt)
          : await operation(...context.args);

        const duration = Date.now() - attemptStart;
        
        retryDetails.push({
          attempt: context.attempt,
          timestamp: new Date(attemptStart),
          duration,
          success: true
        });

        // Success - reset circuit breaker if applicable
        if (context.policy.circuitBreakerEnabled) {
          this.recordSuccess(context.operation);
        }

        this.emit('retry_attempt_succeeded', {
          contextId: context.id,
          operation: context.operation,
          attempt: context.attempt,
          duration
        });

        return {
          success: true,
          result,
          attempts: context.attempt,
          totalDuration: Date.now() - context.startTime.getTime(),
          retryDetails
        };

      } catch (error) {
        const duration = Date.now() - attemptStart;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        context.lastError = error instanceof Error ? error : new Error(errorMessage);
        
        retryDetails.push({
          attempt: context.attempt,
          timestamp: new Date(attemptStart),
          duration,
          success: false,
          error: errorMessage
        });

        this.recordError(errorMessage);

        this.emit('retry_attempt_failed', {
          contextId: context.id,
          operation: context.operation,
          attempt: context.attempt,
          error: errorMessage,
          duration
        });

        // Check if error is retryable
        if (!this.isErrorRetryable(errorMessage, context.policy)) {
          this.emit('non_retryable_error', {
            contextId: context.id,
            operation: context.operation,
            error: errorMessage
          });
          
          // Record failure for circuit breaker
          if (context.policy.circuitBreakerEnabled) {
            this.recordFailure(context.operation);
          }
          
          return {
            success: false,
            error: context.lastError,
            attempts: context.attempt,
            totalDuration: Date.now() - context.startTime.getTime(),
            retryDetails
          };
        }

        // Record failure for circuit breaker
        if (context.policy.circuitBreakerEnabled) {
          this.recordFailure(context.operation);
          
          // Check if circuit breaker should open
          if (this.shouldOpenCircuit(context.operation)) {
            this.openCircuit(context.operation);
            context.isCircuitOpen = true;
            
            return {
              success: false,
              error: new Error(`Circuit breaker opened after failure: ${errorMessage}`),
              attempts: context.attempt,
              totalDuration: Date.now() - context.startTime.getTime(),
              retryDetails
            };
          }
        }

        // If this isn't the last attempt, wait before retrying
        if (context.attempt < context.policy.maxAttempts) {
          const delay = this.calculateDelay(context.policy, context.attempt);
          context.totalDelay += delay;
          
          if (delay > 0) {
            this.emit('retry_delay_started', {
              contextId: context.id,
              operation: context.operation,
              attempt: context.attempt,
              delay
            });
            
            await this.sleep(delay);
          }
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      error: context.lastError || new Error('All retry attempts failed'),
      attempts: context.attempt,
      totalDuration: Date.now() - context.startTime.getTime(),
      retryDetails
    };
  }

  private calculateDelay(policy: RetryPolicy, attempt: number): number {
    let delay: number;

    switch (policy.backoffStrategy) {
      case 'fixed':
        delay = policy.baseDelay;
        break;
      
      case 'linear':
        delay = policy.baseDelay * (policy.backoffMultiplier || 1) * attempt;
        break;
      
      case 'exponential':
        delay = policy.baseDelay * Math.pow(policy.backoffMultiplier || 2, attempt - 1);
        break;
      
      case 'fibonacci':
        delay = policy.baseDelay * this.fibonacci(attempt);
        break;
      
      default:
        delay = policy.baseDelay;
    }

    // Apply maximum delay limit
    if (policy.maxDelay && delay > policy.maxDelay) {
      delay = policy.maxDelay;
    }

    // Apply jitter if enabled
    if (policy.jitter && policy.jitterRange) {
      const [minJitter, maxJitter] = policy.jitterRange;
      const jitterFactor = minJitter + Math.random() * (maxJitter - minJitter);
      delay = delay * (1 + jitterFactor);
    }

    return Math.floor(delay);
  }

  private fibonacci(n: number): number {
    if (n <= 1) return 1;
    if (n === 2) return 1;
    
    let a = 1, b = 1;
    for (let i = 3; i <= n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return b;
  }

  private isErrorRetryable(errorMessage: string, policy: RetryPolicy): boolean {
    // Check non-retryable errors first
    for (const nonRetryable of policy.nonRetryableErrors) {
      if (errorMessage.toLowerCase().includes(nonRetryable.toLowerCase())) {
        return false;
      }
    }

    // Check retryable errors
    for (const retryable of policy.retryableErrors) {
      if (errorMessage.toLowerCase().includes(retryable.toLowerCase())) {
        return true;
      }
    }

    // If not explicitly listed, default to non-retryable
    return false;
  }

  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
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

  // Circuit breaker methods
  private isCircuitOpen(operation: string): boolean {
    const state = this.circuitBreakers.get(operation);
    if (!state || !state.isOpen) return false;

    // Check if circuit breaker timeout has passed
    if (state.nextAttemptTime && Date.now() >= state.nextAttemptTime.getTime()) {
      // Half-open state - allow one attempt
      state.isOpen = false;
      this.emit('circuit_breaker_half_open', { operation });
      return false;
    }

    return true;
  }

  private shouldOpenCircuit(operation: string): boolean {
    const state = this.circuitBreakers.get(operation);
    if (!state) return false;

    const policy = Array.from(this.policies.values())
      .find(p => p.circuitBreakerEnabled);
    
    if (!policy || !policy.circuitBreakerThreshold) return false;

    return state.failureCount >= policy.circuitBreakerThreshold;
  }

  private openCircuit(operation: string): void {
    const state = this.getOrCreateCircuitState(operation);
    const policy = Array.from(this.policies.values())
      .find(p => p.circuitBreakerEnabled);
    
    if (!policy || !policy.circuitBreakerTimeout) return;

    state.isOpen = true;
    state.nextAttemptTime = new Date(Date.now() + policy.circuitBreakerTimeout);
    
    this.statistics.circuitBreakerActivations++;
    this.emit('circuit_breaker_opened', { operation, nextAttemptTime: state.nextAttemptTime });
  }

  private recordSuccess(operation: string): void {
    const state = this.getOrCreateCircuitState(operation);
    state.successCount++;
    state.failureCount = 0; // Reset failure count on success
    
    if (state.isOpen) {
      state.isOpen = false;
      state.nextAttemptTime = undefined;
      this.emit('circuit_breaker_closed', { operation });
    }
  }

  private recordFailure(operation: string): void {
    const state = this.getOrCreateCircuitState(operation);
    state.failureCount++;
    state.lastFailureTime = new Date();
  }

  private getOrCreateCircuitState(operation: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(operation)) {
      this.circuitBreakers.set(operation, {
        isOpen: false,
        failureCount: 0,
        successCount: 0
      });
    }
    return this.circuitBreakers.get(operation)!;
  }

  private recordError(errorMessage: string): void {
    const count = this.statistics.errorDistribution.get(errorMessage) || 0;
    this.statistics.errorDistribution.set(errorMessage, count + 1);
  }

  private updatePolicyUsage(policyId: string): void {
    const count = this.statistics.policyUsage.get(policyId) || 0;
    this.statistics.policyUsage.set(policyId, count + 1);
  }

  private updateAverageMetrics(attempts: number, duration: number): void {
    const total = this.statistics.totalOperations;
    
    this.statistics.averageAttempts = 
      (this.statistics.averageAttempts * (total - 1) + attempts) / total;
    
    this.statistics.averageDuration = 
      (this.statistics.averageDuration * (total - 1) + duration) / total;
  }

  private generateContextId(): string {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  getStatistics(): RetryStatistics {
    return { ...this.statistics };
  }

  getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  getActiveRetries(): RetryContext[] {
    return Array.from(this.activeRetries.values());
  }

  resetStatistics(): void {
    this.statistics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageAttempts: 0,
      averageDuration: 0,
      policyUsage: new Map(),
      errorDistribution: new Map(),
      circuitBreakerActivations: 0,
      lastReset: new Date()
    };
    this.emit('statistics_reset');
  }

  resetCircuitBreakers(): void {
    this.circuitBreakers.clear();
    this.emit('circuit_breakers_reset');
  }

  manuallyOpenCircuit(operation: string): void {
    this.openCircuit(operation);
    this.emit('circuit_breaker_manually_opened', { operation });
  }

  manuallyCloseCircuit(operation: string): void {
    const state = this.circuitBreakers.get(operation);
    if (state) {
      state.isOpen = false;
      state.nextAttemptTime = undefined;
      state.failureCount = 0;
      this.emit('circuit_breaker_manually_closed', { operation });
    }
  }

  // Convenience methods for common operations
  async retryBluetoothConnection<T>(
    operation: RetryFunction<T>,
    args: any[] = [],
    metadata?: Record<string, any>
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(operation, args, 'bluetooth_connection', 'bluetooth_connection', metadata);
  }

  async retryCameraControl<T>(
    operation: RetryFunction<T>,
    args: any[] = [],
    metadata?: Record<string, any>
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(operation, args, 'camera_control', 'camera_control', metadata);
  }

  async retryFileOperation<T>(
    operation: RetryFunction<T>,
    args: any[] = [],
    metadata?: Record<string, any>
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(operation, args, 'file_operations', 'file_operation', metadata);
  }

  async retryNetworkOperation<T>(
    operation: RetryFunction<T>,
    args: any[] = [],
    metadata?: Record<string, any>
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(operation, args, 'network_operations', 'network_operation', metadata);
  }
}