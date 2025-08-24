import { EventEmitter } from 'events';
import type { BluetoothDevice } from '../../types';

export interface ConnectionPoolConfig {
  maxConnections: number;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval?: number;
  adaptiveOptimization?: boolean;
}

export interface ConnectionMetrics {
  deviceId: string;
  connectionTime: number;
  lastActivity: Date;
  dataTransferred: number;
  errorCount: number;
  latency: number;
  signalStrength?: number;
}

export interface OptimalConnectionParams {
  minConnectionInterval: number;
  maxConnectionInterval: number;
  slaveLatency: number;
  supervisionTimeout: number;
  preferredMTU: number;
}

export class ConnectionPool extends EventEmitter {
  private config: ConnectionPoolConfig;
  private metrics: Map<string, ConnectionMetrics> = new Map();
  private connectionParams: Map<string, OptimalConnectionParams> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config: ConnectionPoolConfig) {
    super();
    
    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      adaptiveOptimization: true,
      ...config
    };

    if (this.config.healthCheckInterval) {
      this.startHealthChecking();
    }
  }

  async optimizeConnectionForDevice(
    deviceId: string, 
    device: BluetoothDevice,
    usage: 'real_time' | 'periodic' | 'bulk_transfer'
  ): Promise<OptimalConnectionParams> {
    
    console.log(`🔧 Optimizing connection for device ${deviceId}, usage: ${usage}`);

    let params: OptimalConnectionParams;

    switch (usage) {
      case 'real_time':
        // Optimized for low latency (streaming, live control)
        params = {
          minConnectionInterval: 15,    // 18.75ms
          maxConnectionInterval: 30,    // 37.5ms  
          slaveLatency: 0,             // No latency
          supervisionTimeout: 300,      // 3 seconds
          preferredMTU: 517            // Maximum BLE 5.0 MTU
        };
        break;

      case 'periodic':
        // Balanced for regular communication
        params = {
          minConnectionInterval: 40,    // 50ms
          maxConnectionInterval: 80,    // 100ms
          slaveLatency: 2,             // Allow some latency for power saving
          supervisionTimeout: 600,      // 6 seconds
          preferredMTU: 247            // Standard extended MTU
        };
        break;

      case 'bulk_transfer':
        // Optimized for throughput (firmware updates)
        params = {
          minConnectionInterval: 30,    // 37.5ms
          maxConnectionInterval: 50,    // 62.5ms
          slaveLatency: 0,             // No latency for maximum throughput
          supervisionTimeout: 400,      // 4 seconds
          preferredMTU: 517            // Maximum MTU for large transfers
        };
        break;

      default:
        throw new Error(`Unknown usage pattern: ${usage}`);
    }

    this.connectionParams.set(deviceId, params);
    
    // Initialize metrics
    this.metrics.set(deviceId, {
      deviceId,
      connectionTime: Date.now(),
      lastActivity: new Date(),
      dataTransferred: 0,
      errorCount: 0,
      latency: 0
    });

    return params;
  }

  async negotiateOptimalMTU(deviceId: string, maxMTU: number = 517): Promise<number> {
    // Start with maximum possible MTU and negotiate down
    let mtu = Math.min(maxMTU, 517); // BLE 5.0 maximum
    
    console.log(`🔧 Negotiating MTU for device ${deviceId}, starting with ${mtu}`);

    // Simulate MTU negotiation (in real implementation, this would use the actual BLE API)
    const attempts = [517, 247, 185, 158, 131, 104, 77, 50, 23]; // Common MTU values
    
    for (const attemptMtu of attempts) {
      if (attemptMtu <= maxMTU) {
        try {
          // In real implementation, this would call the actual MTU negotiation
          // For now, we'll simulate it
          if (Math.random() > 0.1) { // 90% success rate simulation
            mtu = attemptMtu;
            break;
          }
        } catch (error) {
          console.log(`MTU ${attemptMtu} failed, trying lower value`);
        }
      }
    }

    console.log(`✅ Negotiated MTU: ${mtu} for device ${deviceId}`);
    
    // Update connection params
    const params = this.connectionParams.get(deviceId);
    if (params) {
      params.preferredMTU = mtu;
      this.connectionParams.set(deviceId, params);
    }

    this.emit('mtu-negotiated', { deviceId, mtu });
    return mtu;
  }

  recordActivity(deviceId: string, bytesTransferred: number, latency?: number): void {
    const metrics = this.metrics.get(deviceId);
    if (!metrics) return;

    metrics.lastActivity = new Date();
    metrics.dataTransferred += bytesTransferred;
    
    if (latency !== undefined) {
      // Update rolling average latency
      metrics.latency = (metrics.latency * 0.7) + (latency * 0.3);
    }

    this.metrics.set(deviceId, metrics);

    // Adaptive optimization
    if (this.config.adaptiveOptimization) {
      this.considerAdaptiveOptimization(deviceId);
    }
  }

  recordError(deviceId: string, error: Error): void {
    const metrics = this.metrics.get(deviceId);
    if (!metrics) return;

    metrics.errorCount++;
    this.metrics.set(deviceId, metrics);

    console.warn(`⚠️ Connection error for device ${deviceId}:`, error.message);
    
    // Emit error for handling
    this.emit('connection-error', { deviceId, error, metrics });
  }

  getConnectionMetrics(deviceId: string): ConnectionMetrics | undefined {
    return this.metrics.get(deviceId);
  }

  getAllMetrics(): ConnectionMetrics[] {
    return Array.from(this.metrics.values());
  }

  getOptimalParams(deviceId: string): OptimalConnectionParams | undefined {
    return this.connectionParams.get(deviceId);
  }

  getPoolStats(): {
    totalConnections: number;
    avgLatency: number;
    totalDataTransferred: number;
    avgErrorRate: number;
    healthyConnections: number;
  } {
    const allMetrics = this.getAllMetrics();
    
    if (allMetrics.length === 0) {
      return {
        totalConnections: 0,
        avgLatency: 0,
        totalDataTransferred: 0,
        avgErrorRate: 0,
        healthyConnections: 0
      };
    }

    const avgLatency = allMetrics.reduce((sum, m) => sum + m.latency, 0) / allMetrics.length;
    const totalDataTransferred = allMetrics.reduce((sum, m) => sum + m.dataTransferred, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    const avgErrorRate = totalErrors / allMetrics.length;
    
    // Consider connection healthy if error rate < 5% and latency < 200ms
    const healthyConnections = allMetrics.filter(m => 
      (m.errorCount / Math.max(m.dataTransferred / 1000, 1)) < 0.05 && m.latency < 200
    ).length;

    return {
      totalConnections: allMetrics.length,
      avgLatency: Math.round(avgLatency),
      totalDataTransferred,
      avgErrorRate: Math.round(avgErrorRate * 100) / 100,
      healthyConnections
    };
  }

  private considerAdaptiveOptimization(deviceId: string): void {
    const metrics = this.metrics.get(deviceId);
    if (!metrics) return;

    const params = this.connectionParams.get(deviceId);
    if (!params) return;

    // Optimize based on observed performance
    if (metrics.latency > 150 && params.minConnectionInterval > 15) {
      // High latency - reduce connection interval
      params.minConnectionInterval = Math.max(15, params.minConnectionInterval - 5);
      params.maxConnectionInterval = Math.max(30, params.maxConnectionInterval - 10);
      
      console.log(`🔧 Reducing connection interval for device ${deviceId} due to high latency`);
      this.emit('adaptive-optimization', { deviceId, reason: 'high-latency', params });
      
    } else if (metrics.errorCount > 10 && params.supervisionTimeout < 800) {
      // High error rate - increase supervision timeout
      params.supervisionTimeout = Math.min(800, params.supervisionTimeout + 100);
      
      console.log(`🔧 Increasing supervision timeout for device ${deviceId} due to errors`);
      this.emit('adaptive-optimization', { deviceId, reason: 'high-errors', params });
    }

    this.connectionParams.set(deviceId, params);
  }

  private startHealthChecking(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private performHealthCheck(): void {
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [deviceId, metrics] of this.metrics.entries()) {
      const timeSinceActivity = now.getTime() - metrics.lastActivity.getTime();
      
      if (timeSinceActivity > staleThreshold) {
        console.log(`🏥 Stale connection detected for device ${deviceId}`);
        this.emit('stale-connection', { deviceId, timeSinceActivity });
      }

      // Check error rate
      const connectionTime = (now.getTime() - metrics.connectionTime) / 1000; // seconds
      const errorRate = metrics.errorCount / Math.max(connectionTime / 60, 1); // errors per minute
      
      if (errorRate > 2) { // More than 2 errors per minute
        console.log(`🏥 High error rate detected for device ${deviceId}: ${errorRate} errors/min`);
        this.emit('high-error-rate', { deviceId, errorRate });
      }
    }

    // Emit overall health status
    const stats = this.getPoolStats();
    this.emit('health-check', stats);
  }

  cleanup(deviceId?: string): void {
    if (deviceId) {
      this.metrics.delete(deviceId);
      this.connectionParams.delete(deviceId);
      console.log(`🧹 Cleaned up connection data for device ${deviceId}`);
    } else {
      // Cleanup all
      this.metrics.clear();
      this.connectionParams.clear();
      console.log('🧹 Cleaned up all connection data');
    }
  }

  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    this.cleanup();
    this.removeAllListeners();
    console.log('🧹 ConnectionPool destroyed');
  }
}

export default ConnectionPool;