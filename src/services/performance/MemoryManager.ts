import { EventEmitter } from 'events';

export interface MemoryAllocation {
  id: string;
  type: 'buffer' | 'cache' | 'stream' | 'temporary' | 'persistent';
  size: number;
  allocatedAt: Date;
  lastAccessed: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner: string; // Component or service that owns this allocation
  data?: ArrayBuffer | Uint8Array;
  metadata: Record<string, any>;
}

export interface MemoryPool {
  id: string;
  type: string;
  maxSize: number;
  currentSize: number;
  allocations: Map<string, MemoryAllocation>;
  fragmentationRatio: number;
  hitRate: number;
  missRate: number;
}

export interface MemoryStats {
  totalAllocated: number;
  totalAvailable: number;
  poolStats: Map<string, MemoryPool>;
  fragmentationLevel: number;
  gcPressure: number;
  allocationRate: number; // allocations per second
  deallocationRate: number; // deallocations per second
  averageLifetime: number; // average allocation lifetime in ms
  topAllocators: Array<{ owner: string; totalSize: number; count: number }>;
}

export interface MemoryPressureLevel {
  level: 'low' | 'medium' | 'high' | 'critical';
  availableMemory: number;
  totalMemory: number;
  utilizationPercentage: number;
  recommendedActions: string[];
}

export class MemoryManager extends EventEmitter {
  private allocations: Map<string, MemoryAllocation> = new Map();
  private pools: Map<string, MemoryPool> = new Map();
  private maxMemoryLimit: number;
  private warningThreshold: number;
  private criticalThreshold: number;
  private gcInterval: number = 30000; // 30 seconds
  private gcTimer: NodeJS.Timeout | null = null;
  private allocationHistory: Array<{ timestamp: Date; type: 'alloc' | 'dealloc'; size: number }> = [];
  private readonly historyMaxSize = 1000;

  constructor(maxMemoryMB: number = 512) {
    super();
    this.maxMemoryLimit = maxMemoryMB * 1024 * 1024; // Convert to bytes
    this.warningThreshold = this.maxMemoryLimit * 0.8; // 80%
    this.criticalThreshold = this.maxMemoryLimit * 0.95; // 95%
    
    this.initializePools();
    this.startGarbageCollector();
    this.startMemoryMonitoring();
  }

  private initializePools(): void {
    // Video buffer pool for frame data
    this.createPool('video-buffers', 200 * 1024 * 1024); // 200MB for video frames
    
    // Audio buffer pool
    this.createPool('audio-buffers', 50 * 1024 * 1024); // 50MB for audio
    
    // Network buffer pool for Bluetooth data
    this.createPool('network-buffers', 20 * 1024 * 1024); // 20MB for network
    
    // Cache pool for frequently accessed data
    this.createPool('cache', 100 * 1024 * 1024); // 100MB for caching
    
    // Temporary allocation pool
    this.createPool('temporary', 50 * 1024 * 1024); // 50MB for temporary data
    
    // Persistent data pool
    this.createPool('persistent', 92 * 1024 * 1024); // Remaining space for persistent data
  }

  private createPool(id: string, maxSize: number): void {
    const pool: MemoryPool = {
      id,
      type: id,
      maxSize,
      currentSize: 0,
      allocations: new Map(),
      fragmentationRatio: 0,
      hitRate: 0,
      missRate: 0
    };
    
    this.pools.set(id, pool);
  }

  private startGarbageCollector(): void {
    this.gcTimer = setInterval(() => {
      this.runGarbageCollection();
    }, this.gcInterval);
  }

  private startMemoryMonitoring(): void {
    // Monitor memory pressure every 5 seconds
    setInterval(() => {
      const stats = this.getMemoryStats();
      const pressure = this.getMemoryPressureLevel();
      
      this.emit('memory-stats', stats);
      
      if (pressure.level !== 'low') {
        this.emit('memory-pressure', pressure);
        
        if (pressure.level === 'critical') {
          this.handleCriticalMemoryPressure();
        }
      }
    }, 5000);
  }

  allocateMemory(
    type: MemoryAllocation['type'],
    size: number,
    owner: string,
    priority: MemoryAllocation['priority'] = 'medium',
    poolId?: string,
    metadata: Record<string, any> = {}
  ): string {
    // Check if allocation would exceed limits
    if (this.getTotalAllocatedMemory() + size > this.maxMemoryLimit) {
      // Try to free some memory first
      this.freeMemoryByPriority('low', size);
      
      if (this.getTotalAllocatedMemory() + size > this.maxMemoryLimit) {
        throw new Error(`Memory allocation would exceed limit. Requested: ${size}, Available: ${this.getAvailableMemory()}`);
      }
    }

    // Determine which pool to use
    const targetPoolId = poolId || this.selectOptimalPool(type, size);
    const pool = this.pools.get(targetPoolId);
    
    if (!pool) {
      throw new Error(`Memory pool ${targetPoolId} not found`);
    }

    // Check pool capacity
    if (pool.currentSize + size > pool.maxSize) {
      // Try to free some memory from this pool
      this.freePoolMemoryByPriority(targetPoolId, 'low', size);
      
      if (pool.currentSize + size > pool.maxSize) {
        // Try a different pool or throw error
        const alternatePoolId = this.findAlternatePool(type, size);
        if (alternatePoolId) {
          return this.allocateMemory(type, size, owner, priority, alternatePoolId, metadata);
        } else {
          throw new Error(`Insufficient memory in pool ${targetPoolId}. Requested: ${size}, Available: ${pool.maxSize - pool.currentSize}`);
        }
      }
    }

    // Create allocation
    const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const allocation: MemoryAllocation = {
      id,
      type,
      size,
      allocatedAt: new Date(),
      lastAccessed: new Date(),
      priority,
      owner,
      metadata: {
        ...metadata,
        poolId: targetPoolId
      }
    };

    // Allocate actual memory
    try {
      allocation.data = new ArrayBuffer(size);
    } catch (error) {
      throw new Error(`Failed to allocate ${size} bytes: ${error.message}`);
    }

    // Update records
    this.allocations.set(id, allocation);
    pool.allocations.set(id, allocation);
    pool.currentSize += size;

    // Update statistics
    this.allocationHistory.push({
      timestamp: new Date(),
      type: 'alloc',
      size
    });
    
    // Keep history size manageable
    if (this.allocationHistory.length > this.historyMaxSize) {
      this.allocationHistory.shift();
    }

    this.emit('memory-allocated', { id, allocation });
    
    return id;
  }

  deallocateMemory(id: string): void {
    const allocation = this.allocations.get(id);
    if (!allocation) {
      console.warn(`Attempted to deallocate non-existent memory allocation: ${id}`);
      return;
    }

    const poolId = allocation.metadata.poolId;
    const pool = this.pools.get(poolId);

    if (pool) {
      pool.allocations.delete(id);
      pool.currentSize -= allocation.size;
    }

    this.allocations.delete(id);

    // Update statistics
    this.allocationHistory.push({
      timestamp: new Date(),
      type: 'dealloc',
      size: allocation.size
    });

    // Clear the data
    if (allocation.data) {
      allocation.data = undefined;
    }

    this.emit('memory-deallocated', { id, allocation });
  }

  private selectOptimalPool(type: MemoryAllocation['type'], size: number): string {
    switch (type) {
      case 'buffer':
        if (size > 1024 * 1024) { // > 1MB, likely video
          return 'video-buffers';
        } else if (size > 64 * 1024) { // > 64KB, likely audio
          return 'audio-buffers';
        } else {
          return 'network-buffers';
        }
      case 'stream':
        return size > 512 * 1024 ? 'video-buffers' : 'audio-buffers';
      case 'cache':
        return 'cache';
      case 'temporary':
        return 'temporary';
      case 'persistent':
        return 'persistent';
      default:
        return 'temporary';
    }
  }

  private findAlternatePool(type: MemoryAllocation['type'], size: number): string | null {
    // Find pools with enough free space
    const availablePools = Array.from(this.pools.entries())
      .filter(([_, pool]) => pool.maxSize - pool.currentSize >= size)
      .sort(([_, poolA], [__, poolB]) => 
        (poolB.maxSize - poolB.currentSize) - (poolA.maxSize - poolA.currentSize)
      );

    return availablePools.length > 0 ? availablePools[0][0] : null;
  }

  private freeMemoryByPriority(priority: MemoryAllocation['priority'], targetSize: number): number {
    let freedSize = 0;
    const allocationsToFree: string[] = [];

    // Find allocations with the specified priority
    for (const [id, allocation] of this.allocations) {
      if (allocation.priority === priority) {
        allocationsToFree.push(id);
        freedSize += allocation.size;
        
        if (freedSize >= targetSize) {
          break;
        }
      }
    }

    // Free the allocations
    for (const id of allocationsToFree) {
      this.deallocateMemory(id);
    }

    return freedSize;
  }

  private freePoolMemoryByPriority(poolId: string, priority: MemoryAllocation['priority'], targetSize: number): number {
    const pool = this.pools.get(poolId);
    if (!pool) return 0;

    let freedSize = 0;
    const allocationsToFree: string[] = [];

    // Find allocations in this pool with the specified priority
    for (const [id, allocation] of pool.allocations) {
      if (allocation.priority === priority) {
        allocationsToFree.push(id);
        freedSize += allocation.size;
        
        if (freedSize >= targetSize) {
          break;
        }
      }
    }

    // Free the allocations
    for (const id of allocationsToFree) {
      this.deallocateMemory(id);
    }

    return freedSize;
  }

  private runGarbageCollection(): void {
    const now = new Date();
    const maxAge = 5 * 60 * 1000; // 5 minutes for temporary allocations
    const allocationsToFree: string[] = [];
    let freedMemory = 0;

    // Find old temporary allocations
    for (const [id, allocation] of this.allocations) {
      if (allocation.type === 'temporary' && 
          now.getTime() - allocation.lastAccessed.getTime() > maxAge) {
        allocationsToFree.push(id);
        freedMemory += allocation.size;
      }
    }

    // Free old allocations
    for (const id of allocationsToFree) {
      this.deallocateMemory(id);
    }

    // Update pool fragmentation ratios
    this.updatePoolFragmentation();

    if (allocationsToFree.length > 0) {
      this.emit('garbage-collected', {
        freed: allocationsToFree.length,
        memoryFreed: freedMemory,
        timestamp: now
      });
    }
  }

  private updatePoolFragmentation(): void {
    for (const pool of this.pools.values()) {
      // Calculate fragmentation ratio (simplified)
      const allocationCount = pool.allocations.size;
      const averageAllocationSize = allocationCount > 0 ? pool.currentSize / allocationCount : 0;
      const theoreticalFragments = pool.maxSize / averageAllocationSize;
      
      pool.fragmentationRatio = allocationCount > 0 ? 
        Math.min(1, allocationCount / theoreticalFragments) : 0;
    }
  }

  private handleCriticalMemoryPressure(): void {
    // Emergency memory cleanup
    const freedLow = this.freeMemoryByPriority('low', this.maxMemoryLimit * 0.1);
    const freedMedium = this.freeMemoryByPriority('medium', this.maxMemoryLimit * 0.05);
    
    // Force garbage collection
    this.runGarbageCollection();
    
    // Clear caches
    this.clearCache('cache');
    
    this.emit('critical-memory-cleanup', {
      freedLow,
      freedMedium,
      timestamp: new Date()
    });
  }

  accessMemory(id: string): ArrayBuffer | Uint8Array | null {
    const allocation = this.allocations.get(id);
    if (!allocation) {
      return null;
    }

    allocation.lastAccessed = new Date();
    
    // Update pool hit rate
    const poolId = allocation.metadata.poolId;
    const pool = this.pools.get(poolId);
    if (pool) {
      // Simplified hit rate calculation
      pool.hitRate = Math.min(1, pool.hitRate + 0.01);
    }

    return allocation.data || null;
  }

  updateMemoryMetadata(id: string, metadata: Record<string, any>): void {
    const allocation = this.allocations.get(id);
    if (allocation) {
      allocation.metadata = { ...allocation.metadata, ...metadata };
      allocation.lastAccessed = new Date();
    }
  }

  clearCache(poolId: string): number {
    const pool = this.pools.get(poolId);
    if (!pool) return 0;

    let clearedSize = 0;
    const allocationsToFree: string[] = [];

    for (const [id, allocation] of pool.allocations) {
      if (allocation.type === 'cache') {
        allocationsToFree.push(id);
        clearedSize += allocation.size;
      }
    }

    for (const id of allocationsToFree) {
      this.deallocateMemory(id);
    }

    this.emit('cache-cleared', { poolId, clearedSize, count: allocationsToFree.length });
    
    return clearedSize;
  }

  defragmentPool(poolId: string): void {
    const pool = this.pools.get(poolId);
    if (!pool) return;

    // For ArrayBuffer-based allocations, we can't actually defragment,
    // but we can reorganize allocation tracking and optimize future allocations
    
    const allocations = Array.from(pool.allocations.values())
      .sort((a, b) => a.size - b.size); // Sort by size for better allocation patterns

    // This is a simplified defragmentation - in a real implementation,
    // you might copy data to new contiguous buffers
    
    this.emit('pool-defragmented', { poolId, allocationCount: allocations.length });
  }

  getTotalAllocatedMemory(): number {
    let total = 0;
    for (const allocation of this.allocations.values()) {
      total += allocation.size;
    }
    return total;
  }

  getAvailableMemory(): number {
    return this.maxMemoryLimit - this.getTotalAllocatedMemory();
  }

  getMemoryStats(): MemoryStats {
    const totalAllocated = this.getTotalAllocatedMemory();
    const totalAvailable = this.getAvailableMemory();
    
    // Calculate allocation rates
    const recentHistory = this.allocationHistory
      .filter(entry => Date.now() - entry.timestamp.getTime() < 60000); // Last minute
    
    const allocations = recentHistory.filter(e => e.type === 'alloc');
    const deallocations = recentHistory.filter(e => e.type === 'dealloc');
    
    const allocationRate = allocations.length / 60; // per second
    const deallocationRate = deallocations.length / 60; // per second
    
    // Calculate average lifetime
    const currentAllocations = Array.from(this.allocations.values());
    const averageLifetime = currentAllocations.length > 0 ?
      currentAllocations.reduce((sum, alloc) => 
        sum + (Date.now() - alloc.allocatedAt.getTime()), 0) / currentAllocations.length : 0;

    // Top allocators
    const allocatorStats = new Map<string, { totalSize: number; count: number }>();
    for (const allocation of currentAllocations) {
      const existing = allocatorStats.get(allocation.owner) || { totalSize: 0, count: 0 };
      existing.totalSize += allocation.size;
      existing.count += 1;
      allocatorStats.set(allocation.owner, existing);
    }
    
    const topAllocators = Array.from(allocatorStats.entries())
      .map(([owner, stats]) => ({ owner, ...stats }))
      .sort((a, b) => b.totalSize - a.totalSize)
      .slice(0, 10);

    // Calculate overall fragmentation
    const fragmentationLevel = Array.from(this.pools.values())
      .reduce((sum, pool, _, arr) => sum + pool.fragmentationRatio, 0) / this.pools.size;

    // Calculate GC pressure (simplified)
    const gcPressure = totalAllocated > this.warningThreshold ? 
      (totalAllocated - this.warningThreshold) / (this.maxMemoryLimit - this.warningThreshold) : 0;

    return {
      totalAllocated,
      totalAvailable,
      poolStats: new Map(this.pools),
      fragmentationLevel,
      gcPressure,
      allocationRate,
      deallocationRate,
      averageLifetime,
      topAllocators
    };
  }

  getMemoryPressureLevel(): MemoryPressureLevel {
    const totalAllocated = this.getTotalAllocatedMemory();
    const utilizationPercentage = (totalAllocated / this.maxMemoryLimit) * 100;
    
    let level: MemoryPressureLevel['level'];
    const recommendedActions: string[] = [];

    if (utilizationPercentage >= 95) {
      level = 'critical';
      recommendedActions.push(
        'Free low priority allocations immediately',
        'Clear all caches',
        'Reduce video buffer sizes',
        'Disable non-essential features'
      );
    } else if (utilizationPercentage >= 80) {
      level = 'high';
      recommendedActions.push(
        'Free low priority allocations',
        'Clear temporary data',
        'Reduce cache sizes',
        'Consider reducing video quality'
      );
    } else if (utilizationPercentage >= 60) {
      level = 'medium';
      recommendedActions.push(
        'Monitor memory usage closely',
        'Consider clearing old temporary data',
        'Optimize allocation patterns'
      );
    } else {
      level = 'low';
    }

    return {
      level,
      availableMemory: this.getAvailableMemory(),
      totalMemory: this.maxMemoryLimit,
      utilizationPercentage,
      recommendedActions
    };
  }

  getAllocation(id: string): MemoryAllocation | null {
    return this.allocations.get(id) || null;
  }

  getAllocations(): MemoryAllocation[] {
    return Array.from(this.allocations.values());
  }

  getAllocationsByOwner(owner: string): MemoryAllocation[] {
    return Array.from(this.allocations.values())
      .filter(allocation => allocation.owner === owner);
  }

  getAllocationsByType(type: MemoryAllocation['type']): MemoryAllocation[] {
    return Array.from(this.allocations.values())
      .filter(allocation => allocation.type === type);
  }

  getPoolStats(poolId: string): MemoryPool | null {
    return this.pools.get(poolId) || null;
  }

  setGCInterval(intervalMs: number): void {
    this.gcInterval = intervalMs;
    
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.startGarbageCollector();
    }
  }

  destroy(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }

    // Free all allocations
    const allocationIds = Array.from(this.allocations.keys());
    for (const id of allocationIds) {
      this.deallocateMemory(id);
    }

    this.removeAllListeners();
  }
}