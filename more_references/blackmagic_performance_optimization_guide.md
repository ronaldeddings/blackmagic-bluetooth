# Blackmagic Camera Performance Optimization & Memory Management Guide

## Production-Grade Performance Engineering

Comprehensive performance optimization strategies for high-performance Blackmagic camera protocol implementations.

## Table of Contents

1. [Performance Architecture](#performance-architecture)
2. [Connection Optimization](#connection-optimization)
3. [Memory Management](#memory-management)
4. [Message Processing Optimization](#message-processing-optimization)
5. [Streaming Performance](#streaming-performance)
6. [Resource Pool Management](#resource-pool-management)
7. [Monitoring and Metrics](#monitoring-and-metrics)
8. [Platform-Specific Optimizations](#platform-specific-optimizations)

## Performance Architecture

### High-Performance System Design

```typescript
// Performance-Optimized Protocol Implementation
class HighPerformanceBlackmagicProtocol {
  private connectionPool: ConnectionPool;
  private messageQueue: PriorityMessageQueue;
  private memoryManager: AdvancedMemoryManager;
  private streamProcessor: OptimizedStreamProcessor;
  private metricsCollector: PerformanceMetricsCollector;
  private resourceScheduler: ResourceScheduler;
  
  constructor(config: PerformanceConfig) {
    this.initializeOptimizedComponents(config);
  }
  
  private initializeOptimizedComponents(config: PerformanceConfig): void {
    // Connection pool with optimal sizing
    this.connectionPool = new ConnectionPool({
      minConnections: 1,
      maxConnections: config.maxConcurrentConnections || 3,
      connectionTimeout: config.connectionTimeout || 5000,
      keepAliveInterval: config.keepAliveInterval || 30000,
      optimizeForLatency: config.prioritizeLatency || false,
    });
    
    // Priority-based message queue
    this.messageQueue = new PriorityMessageQueue({
      maxSize: config.messageQueueSize || 1000,
      processingThreads: config.processingThreads || 2,
      backpressureThreshold: config.backpressureThreshold || 0.8,
    });
    
    // Advanced memory management
    this.memoryManager = new AdvancedMemoryManager({
      initialPoolSize: config.initialMemoryPool || 10485760, // 10MB
      maxPoolSize: config.maxMemoryPool || 52428800, // 50MB
      gcThreshold: config.gcThreshold || 0.8,
      preallocationStrategy: config.preallocationStrategy || 'conservative',
    });
    
    // Optimized stream processing
    this.streamProcessor = new OptimizedStreamProcessor({
      bufferSize: config.streamBufferSize || 1048576, // 1MB
      maxConcurrentStreams: config.maxStreams || 4,
      useHardwareAcceleration: config.hwAcceleration || false,
    });
  }
  
  async optimizeForWorkload(workloadProfile: WorkloadProfile): Promise<void> {
    // Adaptive optimization based on workload characteristics
    switch (workloadProfile.type) {
      case 'low_latency':
        await this.optimizeForLowLatency(workloadProfile);
        break;
      case 'high_throughput':
        await this.optimizeForHighThroughput(workloadProfile);
        break;
      case 'balanced':
        await this.optimizeForBalanced(workloadProfile);
        break;
      case 'battery_efficient':
        await this.optimizeForBatteryLife(workloadProfile);
        break;
    }
  }
  
  private async optimizeForLowLatency(profile: WorkloadProfile): Promise<void> {
    // Connection optimizations
    await this.connectionPool.setParameters({
      connectionInterval: 7.5, // ms - minimum interval
      slaveLatency: 0,
      supervisionTimeout: 300,
      mtuSize: 517, // Maximum MTU
    });
    
    // Message processing optimizations
    this.messageQueue.enableFastPath(true);
    this.messageQueue.setPriorityWeights({
      critical: 1.0,
      high: 0.8,
      normal: 0.5,
      low: 0.1,
    });
    
    // Memory optimizations
    this.memoryManager.enableLowLatencyMode();
    this.memoryManager.preallocateBuffers(64, 1024); // 64 1KB buffers
  }
  
  private async optimizeForHighThroughput(profile: WorkloadProfile): Promise<void> {
    // Batch processing optimizations
    this.messageQueue.enableBatchProcessing({
      batchSize: 10,
      maxBatchDelay: 5, // ms
    });
    
    // Connection optimizations for throughput
    await this.connectionPool.setParameters({
      connectionInterval: 15, // ms - longer interval for throughput
      mtuSize: 517,
      dataLengthExtension: true,
    });
    
    // Memory optimizations for bulk processing
    this.memoryManager.enableBulkMode();
    this.memoryManager.preallocateBuffers(32, 4096); // 32 4KB buffers
  }
}

// Performance Configuration
interface PerformanceConfig {
  // Connection settings
  maxConcurrentConnections?: number;
  connectionTimeout?: number;
  keepAliveInterval?: number;
  prioritizeLatency?: boolean;
  
  // Processing settings
  messageQueueSize?: number;
  processingThreads?: number;
  backpressureThreshold?: number;
  
  // Memory settings
  initialMemoryPool?: number;
  maxMemoryPool?: number;
  gcThreshold?: number;
  preallocationStrategy?: 'aggressive' | 'conservative' | 'adaptive';
  
  // Streaming settings
  streamBufferSize?: number;
  maxStreams?: number;
  hwAcceleration?: boolean;
}

// Workload Profiles
interface WorkloadProfile {
  type: 'low_latency' | 'high_throughput' | 'balanced' | 'battery_efficient';
  expectedMessageRate: number; // messages per second
  expectedDataVolume: number; // bytes per second
  concurrentStreams: number;
  connectionDuration: number; // seconds
  priorityDistribution: {
    critical: number; // percentage
    high: number;
    normal: number;
    low: number;
  };
}
```

## Connection Optimization

### Advanced Connection Management

```typescript
// Optimized Connection Pool
class ConnectionPool {
  private connections: Map<string, PooledConnection> = new Map();
  private config: ConnectionPoolConfig;
  private healthChecker: ConnectionHealthChecker;
  private loadBalancer: ConnectionLoadBalancer;
  private metricsCollector: ConnectionMetrics;
  
  constructor(config: ConnectionPoolConfig) {
    this.config = config;
    this.healthChecker = new ConnectionHealthChecker();
    this.loadBalancer = new ConnectionLoadBalancer();
    this.metricsCollector = new ConnectionMetrics();
  }
  
  async acquireOptimalConnection(requirements: ConnectionRequirements): Promise<PooledConnection> {
    // Find best available connection
    let connection = this.findBestConnection(requirements);
    
    if (!connection || !this.isConnectionOptimal(connection, requirements)) {
      connection = await this.createOptimizedConnection(requirements);
    }
    
    await this.optimizeConnectionForRequirements(connection, requirements);
    return connection;
  }
  
  private findBestConnection(requirements: ConnectionRequirements): PooledConnection | null {
    const candidates = Array.from(this.connections.values())
      .filter(conn => this.isConnectionSuitable(conn, requirements));
    
    if (candidates.length === 0) return null;
    
    // Score connections based on performance metrics
    const scored = candidates.map(conn => ({
      connection: conn,
      score: this.calculateConnectionScore(conn, requirements)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    return scored[0].connection;
  }
  
  private calculateConnectionScore(connection: PooledConnection, requirements: ConnectionRequirements): number {
    let score = 0;
    
    // RSSI score (0-30 points)
    score += Math.max(0, (connection.rssi + 100) * 0.3);
    
    // Latency score (0-25 points)
    const latencyScore = Math.max(0, 25 - (connection.averageLatency / 4));
    score += latencyScore;
    
    // Throughput score (0-25 points)
    const throughputScore = Math.min(25, connection.throughputMbps * 5);
    score += throughputScore;
    
    // Reliability score (0-20 points)
    score += connection.successRate * 20;
    
    return score;
  }
  
  private async createOptimizedConnection(requirements: ConnectionRequirements): Promise<PooledConnection> {
    const device = await this.selectOptimalDevice(requirements);
    const connection = new PooledConnection(device);
    
    // Optimize connection parameters
    await connection.negotiate({
      mtu: this.calculateOptimalMTU(requirements),
      connectionInterval: this.calculateOptimalInterval(requirements),
      latency: requirements.latencyTolerant ? 1 : 0,
      timeout: 300,
    });
    
    // Enable performance features
    await connection.enableFeatures({
      dataLengthExtension: requirements.highThroughput,
      phy2M: device.supports2MPhysical(),
      connectionEventLengthExtension: requirements.highThroughput,
    });
    
    this.connections.set(connection.id, connection);
    return connection;
  }
  
  private calculateOptimalMTU(requirements: ConnectionRequirements): number {
    if (requirements.prioritizeLatency) {
      return 185; // Smaller MTU for lower latency
    } else if (requirements.highThroughput) {
      return 517; // Maximum MTU for throughput
    }
    return 244; // Balanced MTU
  }
  
  private calculateOptimalInterval(requirements: ConnectionRequirements): number {
    if (requirements.prioritizeLatency) {
      return 7.5; // Minimum interval (7.5ms)
    } else if (requirements.batteryOptimized) {
      return 100; // Longer interval for battery life
    }
    return 30; // Balanced interval
  }
}

// Connection Health Monitoring
class ConnectionHealthChecker {
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private checkInterval: number = 5000; // 5 seconds
  
  startHealthChecking(connection: PooledConnection): void {
    const checkTimer = setInterval(async () => {
      const health = await this.performHealthCheck(connection);
      this.healthChecks.set(connection.id, health);
      
      if (!health.healthy) {
        await this.handleUnhealthyConnection(connection, health);
      }
    }, this.checkInterval);
    
    connection.setHealthCheckTimer(checkTimer);
  }
  
  private async performHealthCheck(connection: PooledConnection): Promise<HealthCheckResult> {
    const health = new HealthCheckResult();
    
    try {
      // Latency check
      const latency = await this.measureLatency(connection);
      health.latency = latency;
      health.latencyHealthy = latency < 100;
      
      // Throughput check
      const throughput = await this.measureThroughput(connection);
      health.throughput = throughput;
      health.throughputHealthy = throughput > 100; // >100 Kbps
      
      // Error rate check
      const errorRate = connection.getErrorRate();
      health.errorRate = errorRate;
      health.errorRateHealthy = errorRate < 0.05; // <5%
      
      // Overall health
      health.healthy = health.latencyHealthy && 
                      health.throughputHealthy && 
                      health.errorRateHealthy;
      
    } catch (error) {
      health.healthy = false;
      health.error = error.message;
    }
    
    return health;
  }
  
  private async handleUnhealthyConnection(connection: PooledConnection, health: HealthCheckResult): Promise<void> {
    console.warn(`Unhealthy connection detected: ${connection.id}`);
    console.warn(`Health issues: ${this.describeHealthIssues(health)}`);
    
    // Attempt recovery
    if (health.latency > 200) {
      await this.optimizeForLatency(connection);
    }
    
    if (health.throughput < 50) {
      await this.optimizeForThroughput(connection);
    }
    
    if (health.errorRate > 0.1) {
      await this.resetConnection(connection);
    }
  }
}

// Advanced Connection Parameters
interface ConnectionRequirements {
  prioritizeLatency: boolean;
  highThroughput: boolean;
  batteryOptimized: boolean;
  latencyTolerant: boolean;
  expectedDataRate: number; // bytes/second
  expectedSessionDuration: number; // seconds
}

class HealthCheckResult {
  healthy: boolean = false;
  latency: number = 0;
  latencyHealthy: boolean = false;
  throughput: number = 0;
  throughputHealthy: boolean = false;
  errorRate: number = 0;
  errorRateHealthy: boolean = false;
  error?: string;
}
```

## Memory Management

### Zero-Copy and Memory Pool Optimization

```typescript
// Advanced Memory Manager
class AdvancedMemoryManager {
  private bufferPools: Map<number, BufferPool> = new Map();
  private allocationTracker: AllocationTracker;
  private gcScheduler: GCScheduler;
  private config: MemoryConfig;
  
  constructor(config: MemoryConfig) {
    this.config = config;
    this.allocationTracker = new AllocationTracker();
    this.gcScheduler = new GCScheduler(config.gcThreshold);
    
    this.initializeBufferPools();
  }
  
  private initializeBufferPools(): void {
    // Common buffer sizes for protocol messages
    const commonSizes = [64, 128, 256, 512, 1024, 2048, 4096, 8192];
    
    for (const size of commonSizes) {
      this.bufferPools.set(size, new BufferPool(size, this.calculatePoolSize(size)));
    }
  }
  
  private calculatePoolSize(bufferSize: number): number {
    // Larger pools for smaller buffers (more frequently used)
    const baseSize = this.config.initialPoolSize / bufferSize;
    return Math.max(8, Math.min(128, baseSize));
  }
  
  acquireBuffer(size: number): ManagedBuffer {
    // Find best-fit buffer pool
    const poolSize = this.findBestFitPoolSize(size);
    const pool = this.bufferPools.get(poolSize);
    
    if (!pool) {
      // Fallback to direct allocation for unusual sizes
      return this.createDirectBuffer(size);
    }
    
    const buffer = pool.acquire();
    if (!buffer) {
      // Pool exhausted, create new buffer
      return this.createManagedBuffer(poolSize);
    }
    
    this.allocationTracker.trackAcquisition(buffer);
    return buffer;
  }
  
  releaseBuffer(buffer: ManagedBuffer): void {
    if (!buffer.managed) {
      // Direct buffer, can be garbage collected
      return;
    }
    
    const pool = this.bufferPools.get(buffer.size);
    if (pool) {
      // Clear buffer before returning to pool
      buffer.clear();
      pool.release(buffer);
    }
    
    this.allocationTracker.trackRelease(buffer);
  }
  
  private findBestFitPoolSize(requestedSize: number): number {
    const availableSizes = Array.from(this.bufferPools.keys()).sort((a, b) => a - b);
    
    for (const size of availableSizes) {
      if (size >= requestedSize) {
        return size;
      }
    }
    
    // If no pool is large enough, use the largest available
    return availableSizes[availableSizes.length - 1];
  }
  
  // Zero-copy message processing
  createZeroCopyMessage(data: Uint8Array): ZeroCopyMessage {
    // Create message without copying data
    const message = new ZeroCopyMessage();
    message.setDataView(new DataView(data.buffer, data.byteOffset, data.byteLength));
    
    return message;
  }
  
  // Pre-allocation for predictable workloads
  preallocateBuffers(count: number, size: number): void {
    const pool = this.bufferPools.get(size);
    if (!pool) {
      this.bufferPools.set(size, new BufferPool(size, count));
      return;
    }
    
    for (let i = 0; i < count; i++) {
      const buffer = this.createManagedBuffer(size);
      pool.release(buffer);
    }
  }
  
  // Memory pressure handling
  handleMemoryPressure(): void {
    // Trim buffer pools
    for (const pool of this.bufferPools.values()) {
      pool.trim(0.5); // Remove 50% of unused buffers
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Schedule more aggressive GC
    this.gcScheduler.enableAggressiveMode();
  }
  
  getMemoryStats(): MemoryStats {
    let totalAllocated = 0;
    let totalPooled = 0;
    
    for (const [size, pool] of this.bufferPools) {
      const poolStats = pool.getStats();
      totalAllocated += poolStats.totalAllocated * size;
      totalPooled += poolStats.available * size;
    }
    
    return {
      totalAllocated,
      totalPooled,
      activeAllocations: this.allocationTracker.getActiveCount(),
      poolEfficiency: totalPooled / totalAllocated,
      memoryPressure: this.calculateMemoryPressure(),
    };
  }
}

// Buffer Pool Implementation
class BufferPool {
  private available: ManagedBuffer[] = [];
  private size: number;
  private maxSize: number;
  private totalCreated: number = 0;
  
  constructor(bufferSize: number, initialSize: number) {
    this.size = bufferSize;
    this.maxSize = initialSize * 2; // Allow 2x growth
    
    // Pre-allocate initial buffers
    for (let i = 0; i < initialSize; i++) {
      this.available.push(this.createBuffer());
    }
  }
  
  acquire(): ManagedBuffer | null {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }
    
    // Create new buffer if under limit
    if (this.totalCreated < this.maxSize) {
      return this.createBuffer();
    }
    
    return null; // Pool exhausted
  }
  
  release(buffer: ManagedBuffer): void {
    if (this.available.length < this.maxSize / 2) {
      this.available.push(buffer);
    }
    // Otherwise, let buffer be garbage collected
  }
  
  private createBuffer(): ManagedBuffer {
    this.totalCreated++;
    return new ManagedBuffer(new Uint8Array(this.size), this.size, true);
  }
  
  trim(factor: number): void {
    const targetSize = Math.floor(this.available.length * (1 - factor));
    this.available.splice(targetSize);
  }
  
  getStats(): PoolStats {
    return {
      size: this.size,
      available: this.available.length,
      totalAllocated: this.totalCreated,
      maxSize: this.maxSize,
    };
  }
}

// Managed Buffer
class ManagedBuffer {
  public readonly data: Uint8Array;
  public readonly size: number;
  public readonly managed: boolean;
  private inUse: boolean = false;
  
  constructor(data: Uint8Array, size: number, managed: boolean) {
    this.data = data;
    this.size = size;
    this.managed = managed;
  }
  
  clear(): void {
    this.data.fill(0);
    this.inUse = false;
  }
  
  markInUse(): void {
    this.inUse = true;
  }
  
  isInUse(): boolean {
    return this.inUse;
  }
}

// Zero-Copy Message
class ZeroCopyMessage {
  private dataView: DataView;
  private offset: number = 0;
  
  setDataView(view: DataView): void {
    this.dataView = view;
    this.offset = 0;
  }
  
  readUint32(): number {
    const value = this.dataView.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }
  
  readUint16(): number {
    const value = this.dataView.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }
  
  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + this.offset, length);
    this.offset += length;
    return bytes;
  }
  
  // No copying - just return view of existing data
  getPayloadView(length: number): Uint8Array {
    return new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + this.offset, length);
  }
}
```

## Message Processing Optimization

### High-Performance Message Pipeline

```typescript
// Optimized Message Processing Pipeline
class MessageProcessingPipeline {
  private stages: ProcessingStage[] = [];
  private workerPool: WorkerPool;
  private priorityQueue: PriorityQueue<ProcessingTask>;
  private batchProcessor: BatchProcessor;
  private cacheManager: MessageCacheManager;
  
  constructor(config: PipelineConfig) {
    this.workerPool = new WorkerPool(config.workerThreads || 4);
    this.priorityQueue = new PriorityQueue<ProcessingTask>();
    this.batchProcessor = new BatchProcessor(config.batchSize || 10);
    this.cacheManager = new MessageCacheManager(config.cacheSize || 1000);
    
    this.initializeProcessingStages();
  }
  
  private initializeProcessingStages(): void {
    this.stages = [
      new ValidationStage(),
      new DecodingStage(),
      new ProcessingStage(),
      new ResponseGenerationStage(),
      new EncodingStage(),
    ];
  }
  
  async processMessage(message: IncomingMessage): Promise<ProcessedMessage> {
    // Check cache first for duplicate detection
    const cached = this.cacheManager.get(message.getId());
    if (cached) {
      return cached;
    }
    
    // Create processing task
    const task = new ProcessingTask(message, this.calculatePriority(message));
    
    // Fast path for high-priority messages
    if (task.priority === Priority.CRITICAL) {
      return this.processFastPath(task);
    }
    
    // Add to queue for batch processing
    this.priorityQueue.enqueue(task);
    
    // Trigger batch processing if queue is full
    if (this.priorityQueue.size() >= this.batchProcessor.getBatchSize()) {
      this.processBatch();
    }
    
    return task.getResultPromise();
  }
  
  private async processFastPath(task: ProcessingTask): Promise<ProcessedMessage> {
    // Bypass queue for critical messages
    try {
      const result = await this.executeStages(task);
      this.cacheManager.set(task.message.getId(), result);
      task.resolve(result);
      return result;
    } catch (error) {
      task.reject(error);
      throw error;
    }
  }
  
  private processBatch(): void {
    const batch = this.priorityQueue.dequeueBatch(this.batchProcessor.getBatchSize());
    
    if (batch.length === 0) return;
    
    // Process batch in worker thread
    this.workerPool.execute(async () => {
      const results = await this.batchProcessor.process(batch, this.stages);
      
      // Resolve all tasks in batch
      for (let i = 0; i < batch.length; i++) {
        const task = batch[i];
        const result = results[i];
        
        if (result.error) {
          task.reject(result.error);
        } else {
          this.cacheManager.set(task.message.getId(), result.data);
          task.resolve(result.data);
        }
      }
    });
  }
  
  private calculatePriority(message: IncomingMessage): Priority {
    // Determine priority based on message type and context
    const messageType = message.getType();
    
    switch (messageType) {
      case MessageType.HEARTBEAT:
        return Priority.LOW;
      case MessageType.CAMERA_STATUS_REQUEST:
        return Priority.NORMAL;
      case MessageType.RECORDING_START:
      case MessageType.RECORDING_STOP:
        return Priority.HIGH;
      case MessageType.ERROR_RESPONSE:
        return Priority.CRITICAL;
      default:
        return Priority.NORMAL;
    }
  }
  
  // Adaptive processing based on system load
  adjustProcessingStrategy(systemLoad: SystemLoad): void {
    if (systemLoad.cpu > 0.8) {
      // High CPU - increase batch size to reduce overhead
      this.batchProcessor.setBatchSize(20);
      this.priorityQueue.enableDropStrategy(Priority.LOW);
    } else if (systemLoad.memory > 0.8) {
      // High memory - reduce batch size and enable aggressive GC
      this.batchProcessor.setBatchSize(5);
      this.cacheManager.enableAggressiveEviction();
    } else {
      // Normal operation
      this.batchProcessor.setBatchSize(10);
      this.priorityQueue.disableDropStrategy();
      this.cacheManager.disableAggressiveEviction();
    }
  }
}

// Batch Processing for Efficiency
class BatchProcessor {
  private batchSize: number;
  private processingStrategies: Map<string, BatchStrategy> = new Map();
  
  constructor(batchSize: number) {
    this.batchSize = batchSize;
    this.initializeBatchStrategies();
  }
  
  private initializeBatchStrategies(): void {
    // Different strategies for different message types
    this.processingStrategies.set('validation', new ParallelBatchStrategy());
    this.processingStrategies.set('decoding', new PipelineBatchStrategy());
    this.processingStrategies.set('processing', new SequentialBatchStrategy());
  }
  
  async process(
    tasks: ProcessingTask[], 
    stages: ProcessingStage[]
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    
    for (const stage of stages) {
      const strategy = this.processingStrategies.get(stage.getName()) || new SequentialBatchStrategy();
      
      try {
        const stageResults = await strategy.execute(tasks, stage);
        
        // Merge results
        for (let i = 0; i < tasks.length; i++) {
          if (!results[i]) {
            results[i] = new BatchResult();
          }
          results[i].addStageResult(stage.getName(), stageResults[i]);
        }
        
      } catch (error) {
        // Mark all tasks as failed for this stage
        for (let i = 0; i < tasks.length; i++) {
          if (!results[i]) {
            results[i] = new BatchResult();
          }
          results[i].setError(error);
        }
      }
    }
    
    return results;
  }
}

// Parallel Processing Strategy
class ParallelBatchStrategy implements BatchStrategy {
  async execute(tasks: ProcessingTask[], stage: ProcessingStage): Promise<any[]> {
    // Process all tasks in parallel
    const promises = tasks.map(task => stage.process(task.message));
    return Promise.all(promises);
  }
}

// Pipeline Processing Strategy
class PipelineBatchStrategy implements BatchStrategy {
  async execute(tasks: ProcessingTask[], stage: ProcessingStage): Promise<any[]> {
    const results: any[] = [];
    const concurrency = 4; // Process 4 at a time
    
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      const batchPromises = batch.map(task => stage.process(task.message));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }
}

// Message Cache Manager
class MessageCacheManager {
  private cache: Map<string, ProcessedMessage> = new Map();
  private accessTimes: Map<string, number> = new Map();
  private maxSize: number;
  private aggressiveEviction: boolean = false;
  
  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }
  
  get(key: string): ProcessedMessage | null {
    const result = this.cache.get(key);
    if (result) {
      this.accessTimes.set(key, Date.now());
    }
    return result || null;
  }
  
  set(key: string, value: ProcessedMessage): void {
    if (this.cache.size >= this.maxSize) {
      this.evictOldEntries();
    }
    
    this.cache.set(key, value);
    this.accessTimes.set(key, Date.now());
  }
  
  private evictOldEntries(): void {
    const entriesToEvict = this.aggressiveEviction ? 
      Math.floor(this.maxSize * 0.3) : 
      Math.floor(this.maxSize * 0.1);
    
    // Sort by access time (oldest first)
    const sortedEntries = Array.from(this.accessTimes.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, entriesToEvict);
    
    for (const [key] of sortedEntries) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
    }
  }
  
  enableAggressiveEviction(): void {
    this.aggressiveEviction = true;
  }
  
  disableAggressiveEviction(): void {
    this.aggressiveEviction = false;
  }
}
```

## Streaming Performance

### High-Throughput Stream Processing

```typescript
// Optimized Stream Processor
class OptimizedStreamProcessor {
  private streamBuffers: Map<string, CircularStreamBuffer> = new Map();
  private codecManager: HardwareCodecManager;
  private frameProcessor: FrameProcessor;
  private networkOptimizer: NetworkOptimizer;
  private qualityController: AdaptiveQualityController;
  
  constructor(config: StreamProcessorConfig) {
    this.codecManager = new HardwareCodecManager(config.useHardwareAcceleration);
    this.frameProcessor = new FrameProcessor(config.frameProcessingThreads || 2);
    this.networkOptimizer = new NetworkOptimizer();
    this.qualityController = new AdaptiveQualityController();
  }
  
  async startOptimizedStream(streamConfig: OptimizedStreamConfig): Promise<StreamHandle> {
    const streamId = this.generateStreamId();
    
    // Create optimized buffer
    const buffer = new CircularStreamBuffer({
      size: streamConfig.bufferSize || 2097152, // 2MB
      frameCapacity: streamConfig.frameCapacity || 60, // 2 seconds at 30fps
      lowWaterMark: streamConfig.lowWaterMark || 0.2,
      highWaterMark: streamConfig.highWaterMark || 0.8,
    });
    
    this.streamBuffers.set(streamId, buffer);
    
    // Initialize hardware codec if available
    let codec: VideoCodec;
    if (this.codecManager.isHardwareAvailable()) {
      codec = await this.codecManager.createHardwareCodec(streamConfig.codecConfig);
    } else {
      codec = await this.codecManager.createSoftwareCodec(streamConfig.codecConfig);
    }
    
    // Start processing pipeline
    const handle = new StreamHandle(streamId, buffer, codec);
    this.startStreamProcessingPipeline(handle, streamConfig);
    
    return handle;
  }
  
  private startStreamProcessingPipeline(handle: StreamHandle, config: OptimizedStreamConfig): void {
    // Frame reception and buffering
    this.startFrameReceptionLoop(handle);
    
    // Frame processing and decoding
    this.startFrameProcessingLoop(handle, config);
    
    // Quality adaptation
    this.startQualityAdaptationLoop(handle);
    
    // Network optimization
    this.startNetworkOptimizationLoop(handle);
  }
  
  private startFrameReceptionLoop(handle: StreamHandle): void {
    const receptionLoop = async () => {
      while (handle.isActive()) {
        try {
          const frameData = await handle.receiveFrameData();
          
          // Add frame to buffer with zero-copy if possible
          const success = handle.buffer.tryAddFrame(frameData, true); // zero-copy = true
          
          if (!success) {
            // Buffer full - adaptive response
            await this.handleBufferOverflow(handle);
          }
          
        } catch (error) {
          handle.reportError(error);
        }
        
        // Yield to other tasks
        await this.yieldToScheduler();
      }
    };
    
    // Run reception loop in high-priority thread
    this.frameProcessor.runHighPriority(receptionLoop);
  }
  
  private startFrameProcessingLoop(handle: StreamHandle, config: OptimizedStreamConfig): void {
    const processingLoop = async () => {
      while (handle.isActive()) {
        const frame = handle.buffer.getNextFrame();
        
        if (!frame) {
          await this.waitForFrames(handle.buffer);
          continue;
        }
        
        try {
          // Decode frame
          const decodedFrame = await handle.codec.decode(frame);
          
          // Apply post-processing if needed
          if (config.enablePostProcessing) {
            await this.frameProcessor.postProcess(decodedFrame);
          }
          
          // Emit processed frame
          handle.emitFrame(decodedFrame);
          
        } catch (error) {
          handle.reportError(error);
        }
      }
    };
    
    // Run processing loop in normal priority thread
    this.frameProcessor.runNormalPriority(processingLoop);
  }
  
  private async handleBufferOverflow(handle: StreamHandle): Promise<void> {
    const buffer = handle.buffer;
    
    // Strategy 1: Drop oldest frames
    const droppedCount = buffer.dropOldFrames(0.3); // Drop 30% oldest frames
    
    if (droppedCount === 0) {
      // Strategy 2: Request quality reduction
      await this.qualityController.requestQualityReduction(handle.streamId);
    }
    
    // Strategy 3: Increase buffer size temporarily
    if (buffer.getUtilization() > 0.9) {
      buffer.expandCapacity(1.5); // 50% increase
    }
  }
  
  private startQualityAdaptationLoop(handle: StreamHandle): void {
    const adaptationLoop = async () => {
      const stats = handle.getStreamStats();
      
      // Analyze performance metrics
      const adaptation = this.qualityController.analyzeAndAdapt({
        bufferUtilization: handle.buffer.getUtilization(),
        frameDropRate: stats.frameDropRate,
        averageLatency: stats.averageLatency,
        throughput: stats.throughput,
        networkQuality: this.networkOptimizer.getNetworkQuality(),
      });
      
      if (adaptation.shouldAdapt) {
        await this.applyQualityAdaptation(handle, adaptation);
      }
    };
    
    // Run adaptation loop every 2 seconds
    setInterval(adaptationLoop, 2000);
  }
  
  private async applyQualityAdaptation(handle: StreamHandle, adaptation: QualityAdaptation): Promise<void> {
    const currentConfig = handle.getStreamConfig();
    
    // Apply bitrate changes
    if (adaptation.targetBitrate !== currentConfig.bitrate) {
      await handle.codec.updateBitrate(adaptation.targetBitrate);
      currentConfig.bitrate = adaptation.targetBitrate;
    }
    
    // Apply resolution changes
    if (adaptation.targetResolution) {
      await handle.codec.updateResolution(adaptation.targetResolution);
      currentConfig.resolution = adaptation.targetResolution;
    }
    
    // Apply frame rate changes
    if (adaptation.targetFrameRate !== currentConfig.frameRate) {
      await handle.codec.updateFrameRate(adaptation.targetFrameRate);
      currentConfig.frameRate = adaptation.targetFrameRate;
    }
    
    console.log(`Quality adapted: bitrate=${adaptation.targetBitrate}, resolution=${adaptation.targetResolution?.width}x${adaptation.targetResolution?.height}, fps=${adaptation.targetFrameRate}`);
  }
}

// Circular Stream Buffer with Zero-Copy Optimization
class CircularStreamBuffer {
  private buffer: Uint8Array;
  private frames: StreamFrame[] = [];
  private readIndex: number = 0;
  private writeIndex: number = 0;
  private config: BufferConfig;
  private stats: BufferStats = new BufferStats();
  
  constructor(config: BufferConfig) {
    this.config = config;
    this.buffer = new Uint8Array(config.size);
  }
  
  tryAddFrame(frameData: Uint8Array, zeroCopy: boolean = false): boolean {
    const requiredSize = frameData.length + 12; // 12 bytes for frame header
    
    if (this.getAvailableSpace() < requiredSize) {
      return false; // Buffer full
    }
    
    const frame = new StreamFrame();
    frame.timestamp = performance.now();
    frame.size = frameData.length;
    
    if (zeroCopy && this.canUseZeroCopy(frameData)) {
      // Zero-copy: just reference the existing buffer
      frame.dataView = new DataView(frameData.buffer, frameData.byteOffset, frameData.byteLength);
      frame.zeroCopy = true;
    } else {
      // Copy data to circular buffer
      frame.offset = this.writeIndex;
      this.copyToBuffer(frameData, this.writeIndex);
      frame.zeroCopy = false;
    }
    
    this.frames[this.writeIndex % this.config.frameCapacity] = frame;
    this.writeIndex++;
    
    this.stats.framesAdded++;
    return true;
  }
  
  getNextFrame(): StreamFrame | null {
    if (this.readIndex >= this.writeIndex) {
      return null; // No frames available
    }
    
    const frame = this.frames[this.readIndex % this.config.frameCapacity];
    this.readIndex++;
    
    this.stats.framesRead++;
    return frame;
  }
  
  private canUseZeroCopy(data: Uint8Array): boolean {
    // Check if data buffer is suitable for zero-copy
    return data.buffer instanceof ArrayBuffer && 
           data.byteOffset % 4 === 0 && // Aligned
           data.length > 256; // Worthwhile for larger frames
  }
  
  private copyToBuffer(source: Uint8Array, offset: number): void {
    // Handle circular buffer wrapping
    const remainingSpace = this.buffer.length - offset;
    
    if (source.length <= remainingSpace) {
      // Fits in one piece
      this.buffer.set(source, offset);
    } else {
      // Split across buffer boundary
      this.buffer.set(source.subarray(0, remainingSpace), offset);
      this.buffer.set(source.subarray(remainingSpace), 0);
    }
  }
  
  getUtilization(): number {
    return (this.writeIndex - this.readIndex) / this.config.frameCapacity;
  }
  
  getAvailableSpace(): number {
    const usedFrames = this.writeIndex - this.readIndex;
    return this.config.frameCapacity - usedFrames;
  }
  
  dropOldFrames(percentage: number): number {
    const framesToDrop = Math.floor((this.writeIndex - this.readIndex) * percentage);
    this.readIndex += framesToDrop;
    
    this.stats.framesDropped += framesToDrop;
    return framesToDrop;
  }
  
  expandCapacity(multiplier: number): void {
    const newCapacity = Math.floor(this.config.frameCapacity * multiplier);
    
    // Create new larger buffer
    const newBuffer = new Uint8Array(Math.floor(this.buffer.length * multiplier));
    newBuffer.set(this.buffer);
    
    // Update configuration
    this.config.frameCapacity = newCapacity;
    this.buffer = newBuffer;
    
    console.log(`Buffer capacity expanded to ${newCapacity} frames`);
  }
}

// Hardware Codec Manager
class HardwareCodecManager {
  private useHardware: boolean;
  private availableCodecs: Map<string, CodecInfo> = new Map();
  
  constructor(useHardware: boolean) {
    this.useHardware = useHardware;
    this.detectAvailableCodecs();
  }
  
  private detectAvailableCodecs(): void {
    // Detect hardware-accelerated codecs (browser/platform specific)
    if (typeof VideoDecoder !== 'undefined') {
      // WebCodecs API available
      this.availableCodecs.set('h264-hw', {
        name: 'H.264 Hardware',
        type: 'hardware',
        supported: true,
        maxResolution: { width: 4096, height: 2160 },
        maxFrameRate: 60,
      });
    }
    
    // Always have software fallback
    this.availableCodecs.set('h264-sw', {
      name: 'H.264 Software',
      type: 'software',
      supported: true,
      maxResolution: { width: 1920, height: 1080 },
      maxFrameRate: 30,
    });
  }
  
  isHardwareAvailable(): boolean {
    return this.useHardware && 
           Array.from(this.availableCodecs.values()).some(codec => codec.type === 'hardware');
  }
  
  async createHardwareCodec(config: CodecConfig): Promise<VideoCodec> {
    const codecInfo = this.availableCodecs.get('h264-hw');
    if (!codecInfo) {
      throw new Error('Hardware codec not available');
    }
    
    return new HardwareVideoCodec(config, codecInfo);
  }
  
  async createSoftwareCodec(config: CodecConfig): Promise<VideoCodec> {
    const codecInfo = this.availableCodecs.get('h264-sw');
    return new SoftwareVideoCodec(config, codecInfo!);
  }
}
```

## Performance Monitoring

### Real-time Performance Metrics

```typescript
// Comprehensive Performance Monitor
class PerformanceMetricsCollector {
  private metrics: PerformanceMetrics = new PerformanceMetrics();
  private collectors: MetricCollector[] = [];
  private isRunning: boolean = false;
  private reportingInterval: number = 1000; // 1 second
  
  constructor() {
    this.initializeCollectors();
  }
  
  private initializeCollectors(): void {
    this.collectors = [
      new ConnectionMetricsCollector(),
      new MemoryMetricsCollector(),
      new MessageProcessingMetricsCollector(),
      new StreamingMetricsCollector(),
      new SystemMetricsCollector(),
    ];
  }
  
  startCollection(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    // Start each collector
    for (const collector of this.collectors) {
      collector.start();
    }
    
    // Start reporting loop
    this.startReportingLoop();
  }
  
  stopCollection(): void {
    this.isRunning = false;
    
    for (const collector of this.collectors) {
      collector.stop();
    }
  }
  
  private startReportingLoop(): void {
    const reportingLoop = () => {
      if (!this.isRunning) return;
      
      // Collect metrics from all collectors
      this.collectCurrentMetrics();
      
      // Analyze performance
      const analysis = this.analyzePerformance();
      
      // Generate alerts if needed
      this.checkPerformanceAlerts(analysis);
      
      // Schedule next collection
      setTimeout(reportingLoop, this.reportingInterval);
    };
    
    reportingLoop();
  }
  
  private collectCurrentMetrics(): void {
    const timestamp = Date.now();
    
    for (const collector of this.collectors) {
      const collectorMetrics = collector.collect();
      this.metrics.addCollectorMetrics(collector.getName(), collectorMetrics, timestamp);
    }
  }
  
  private analyzePerformance(): PerformanceAnalysis {
    const analysis = new PerformanceAnalysis();
    
    // Connection performance analysis
    const connectionMetrics = this.metrics.getConnectionMetrics();
    analysis.connectionHealth = this.analyzeConnectionHealth(connectionMetrics);
    
    // Memory usage analysis
    const memoryMetrics = this.metrics.getMemoryMetrics();
    analysis.memoryHealth = this.analyzeMemoryHealth(memoryMetrics);
    
    // Message processing analysis
    const processingMetrics = this.metrics.getProcessingMetrics();
    analysis.processingHealth = this.analyzeProcessingHealth(processingMetrics);
    
    // Overall system health
    analysis.overallHealth = this.calculateOverallHealth(analysis);
    
    return analysis;
  }
  
  private analyzeConnectionHealth(metrics: ConnectionMetrics): HealthScore {
    const score = new HealthScore();
    
    // Latency scoring
    if (metrics.averageLatency < 50) {
      score.latencyScore = 100;
    } else if (metrics.averageLatency < 100) {
      score.latencyScore = 80;
    } else if (metrics.averageLatency < 200) {
      score.latencyScore = 60;
    } else {
      score.latencyScore = 30;
    }
    
    // Throughput scoring
    if (metrics.throughput > 1000) { // >1Mbps
      score.throughputScore = 100;
    } else if (metrics.throughput > 500) {
      score.throughputScore = 80;
    } else if (metrics.throughput > 100) {
      score.throughputScore = 60;
    } else {
      score.throughputScore = 30;
    }
    
    // Error rate scoring
    if (metrics.errorRate < 0.01) { // <1%
      score.reliabilityScore = 100;
    } else if (metrics.errorRate < 0.05) { // <5%
      score.reliabilityScore = 70;
    } else if (metrics.errorRate < 0.1) { // <10%
      score.reliabilityScore = 40;
    } else {
      score.reliabilityScore = 10;
    }
    
    score.overall = (score.latencyScore + score.throughputScore + score.reliabilityScore) / 3;
    return score;
  }
  
  private checkPerformanceAlerts(analysis: PerformanceAnalysis): void {
    // Connection alerts
    if (analysis.connectionHealth.overall < 50) {
      this.emitAlert('connection_degraded', {
        severity: 'warning',
        message: 'Connection performance is degraded',
        metrics: analysis.connectionHealth,
        recommendations: [
          'Check signal strength',
          'Optimize connection parameters',
          'Consider reconnection'
        ]
      });
    }
    
    // Memory alerts
    if (analysis.memoryHealth.overall < 30) {
      this.emitAlert('memory_pressure', {
        severity: 'critical',
        message: 'High memory pressure detected',
        metrics: analysis.memoryHealth,
        recommendations: [
          'Enable aggressive garbage collection',
          'Reduce buffer sizes',
          'Implement memory pressure handling'
        ]
      });
    }
    
    // Processing alerts
    if (analysis.processingHealth.overall < 40) {
      this.emitAlert('processing_overload', {
        severity: 'warning',
        message: 'Message processing is overloaded',
        metrics: analysis.processingHealth,
        recommendations: [
          'Increase worker thread count',
          'Enable batch processing',
          'Implement backpressure handling'
        ]
      });
    }
  }
  
  private emitAlert(type: string, alert: PerformanceAlert): void {
    console.warn(`Performance Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);
    console.warn('Recommendations:', alert.recommendations.join(', '));
    
    // Could emit to external monitoring systems
    // EventEmitter.emit('performance_alert', { type, alert });
  }
  
  getCurrentMetrics(): PerformanceSnapshot {
    return {
      timestamp: Date.now(),
      connection: this.metrics.getLatestConnectionMetrics(),
      memory: this.metrics.getLatestMemoryMetrics(),
      processing: this.metrics.getLatestProcessingMetrics(),
      streaming: this.metrics.getLatestStreamingMetrics(),
      system: this.metrics.getLatestSystemMetrics(),
    };
  }
  
  getHistoricalData(duration: number): HistoricalMetrics {
    const endTime = Date.now();
    const startTime = endTime - duration;
    
    return {
      timeRange: { start: startTime, end: endTime },
      connectionHistory: this.metrics.getConnectionHistory(startTime, endTime),
      memoryHistory: this.metrics.getMemoryHistory(startTime, endTime),
      processingHistory: this.metrics.getProcessingHistory(startTime, endTime),
    };
  }
}

// Metric Collectors
abstract class MetricCollector {
  protected isRunning: boolean = false;
  
  abstract getName(): string;
  abstract start(): void;
  abstract stop(): void;
  abstract collect(): CollectorMetrics;
}

class ConnectionMetricsCollector extends MetricCollector {
  private connections: Map<string, BLEConnection> = new Map();
  
  getName(): string {
    return 'connection';
  }
  
  start(): void {
    this.isRunning = true;
    // Register for connection events
  }
  
  stop(): void {
    this.isRunning = false;
  }
  
  collect(): CollectorMetrics {
    const metrics = new CollectorMetrics();
    
    let totalLatency = 0;
    let totalThroughput = 0;
    let totalErrors = 0;
    let totalMessages = 0;
    
    for (const connection of this.connections.values()) {
      const connStats = connection.getStatistics();
      totalLatency += connStats.averageLatency;
      totalThroughput += connStats.throughput;
      totalErrors += connStats.errorCount;
      totalMessages += connStats.messageCount;
    }
    
    const connectionCount = this.connections.size;
    
    metrics.set('averageLatency', connectionCount > 0 ? totalLatency / connectionCount : 0);
    metrics.set('totalThroughput', totalThroughput);
    metrics.set('errorRate', totalMessages > 0 ? totalErrors / totalMessages : 0);
    metrics.set('activeConnections', connectionCount);
    
    return metrics;
  }
  
  registerConnection(connection: BLEConnection): void {
    this.connections.set(connection.getId(), connection);
  }
  
  unregisterConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }
}

class MemoryMetricsCollector extends MetricCollector {
  getName(): string {
    return 'memory';
  }
  
  start(): void {
    this.isRunning = true;
  }
  
  stop(): void {
    this.isRunning = false;
  }
  
  collect(): CollectorMetrics {
    const metrics = new CollectorMetrics();
    
    // Use performance.memory API if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      
      metrics.set('usedJSHeapSize', memory.usedJSHeapSize);
      metrics.set('totalJSHeapSize', memory.totalJSHeapSize);
      metrics.set('jsHeapSizeLimit', memory.jsHeapSizeLimit);
      
      const heapUtilization = memory.usedJSHeapSize / memory.totalJSHeapSize;
      metrics.set('heapUtilization', heapUtilization);
      
      const memoryPressure = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      metrics.set('memoryPressure', memoryPressure);
    } else {
      // Fallback estimates
      metrics.set('usedJSHeapSize', 0);
      metrics.set('totalJSHeapSize', 0);
      metrics.set('jsHeapSizeLimit', 0);
      metrics.set('heapUtilization', 0);
      metrics.set('memoryPressure', 0);
    }
    
    return metrics;
  }
}

// Performance Data Structures
class PerformanceMetrics {
  private connectionData: TimeSeries<ConnectionMetrics> = new TimeSeries();
  private memoryData: TimeSeries<MemoryMetrics> = new TimeSeries();
  private processingData: TimeSeries<ProcessingMetrics> = new TimeSeries();
  private streamingData: TimeSeries<StreamingMetrics> = new TimeSeries();
  private systemData: TimeSeries<SystemMetrics> = new TimeSeries();
  
  addCollectorMetrics(collectorName: string, metrics: CollectorMetrics, timestamp: number): void {
    switch (collectorName) {
      case 'connection':
        this.connectionData.add(timestamp, this.parseConnectionMetrics(metrics));
        break;
      case 'memory':
        this.memoryData.add(timestamp, this.parseMemoryMetrics(metrics));
        break;
      case 'processing':
        this.processingData.add(timestamp, this.parseProcessingMetrics(metrics));
        break;
      case 'streaming':
        this.streamingData.add(timestamp, this.parseStreamingMetrics(metrics));
        break;
      case 'system':
        this.systemData.add(timestamp, this.parseSystemMetrics(metrics));
        break;
    }
  }
  
  private parseConnectionMetrics(metrics: CollectorMetrics): ConnectionMetrics {
    return {
      averageLatency: metrics.get('averageLatency') || 0,
      throughput: metrics.get('totalThroughput') || 0,
      errorRate: metrics.get('errorRate') || 0,
      activeConnections: metrics.get('activeConnections') || 0,
    };
  }
  
  getConnectionHistory(startTime: number, endTime: number): DataPoint<ConnectionMetrics>[] {
    return this.connectionData.getRange(startTime, endTime);
  }
  
  getLatestConnectionMetrics(): ConnectionMetrics | null {
    return this.connectionData.getLatest();
  }
}

class TimeSeries<T> {
  private data: DataPoint<T>[] = [];
  private maxSize: number = 1000; // Keep last 1000 data points
  
  add(timestamp: number, value: T): void {
    this.data.push(new DataPoint(timestamp, value));
    
    // Trim old data
    if (this.data.length > this.maxSize) {
      this.data.shift();
    }
  }
  
  getRange(startTime: number, endTime: number): DataPoint<T>[] {
    return this.data.filter(point => 
      point.timestamp >= startTime && point.timestamp <= endTime
    );
  }
  
  getLatest(): T | null {
    return this.data.length > 0 ? this.data[this.data.length - 1].value : null;
  }
}

class DataPoint<T> {
  timestamp: number;
  value: T;
  
  constructor(timestamp: number, value: T) {
    this.timestamp = timestamp;
    this.value = value;
  }
}

class CollectorMetrics {
  private values: Map<string, number> = new Map();
  
  set(key: string, value: number): void {
    this.values.set(key, value);
  }
  
  get(key: string): number | undefined {
    return this.values.get(key);
  }
}

// Usage Example
async function setupOptimizedProtocol(): Promise<void> {
  // Create high-performance protocol instance
  const protocol = new HighPerformanceBlackmagicProtocol({
    maxConcurrentConnections: 2,
    connectionTimeout: 3000,
    prioritizeLatency: true,
    messageQueueSize: 500,
    processingThreads: 4,
    initialMemoryPool: 20971520, // 20MB
    streamBufferSize: 2097152, // 2MB
    hwAcceleration: true,
  });
  
  // Define workload profile
  const workloadProfile: WorkloadProfile = {
    type: 'low_latency',
    expectedMessageRate: 30, // 30 messages per second
    expectedDataVolume: 1048576, // 1MB per second
    concurrentStreams: 1,
    connectionDuration: 3600, // 1 hour
    priorityDistribution: {
      critical: 10,
      high: 20,
      normal: 60,
      low: 10,
    },
  };
  
  // Optimize for workload
  await protocol.optimizeForWorkload(workloadProfile);
  
  // Start performance monitoring
  const metricsCollector = new PerformanceMetricsCollector();
  metricsCollector.startCollection();
  
  console.log('High-performance Blackmagic protocol initialized');
}
```

This comprehensive performance optimization guide provides production-ready strategies for:

1. **Connection Optimization**: Advanced connection pooling, health monitoring, and parameter optimization
2. **Memory Management**: Zero-copy operations, buffer pooling, and intelligent garbage collection
3. **Message Processing**: Batch processing, priority queues, and adaptive processing strategies
4. **Streaming Performance**: Hardware-accelerated codecs, circular buffers, and quality adaptation
5. **Performance Monitoring**: Real-time metrics collection, analysis, and automated alerting

The guide emphasizes real-world performance considerations and provides concrete implementations that can be directly integrated into production applications.