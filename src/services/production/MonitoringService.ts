import { EventEmitter } from 'events';
import { MemoryManager } from '../performance/MemoryManager';
import { HardwareAccelerationManager } from '../performance/HardwareAccel';

export interface SystemMetrics {
  timestamp: number;
  memory: {
    heap: {
      used: number;
      total: number;
      limit: number;
    };
    allocations: {
      total: number;
      active: number;
      pools: number;
      fragmentation: number;
    };
  };
  performance: {
    fps: number;
    latency: number;
    throughput: number;
    cpuUsage: number;
    gpuUsage?: number;
  };
  connections: {
    active: number;
    total: number;
    errors: number;
    retries: number;
  };
  errors: {
    count: number;
    rate: number;
    types: Record<string, number>;
  };
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  source: string;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  retentionPeriod: number;
  alertThresholds: {
    memoryUsage: number;
    errorRate: number;
    latency: number;
    connectionFailures: number;
  };
  exportSettings: {
    format: 'json' | 'csv' | 'prometheus';
    interval: number;
    destination?: string;
  };
}

export interface PerformanceProfile {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    memoryThreshold: number;
    connectionCount: number;
    errorRate: number;
  };
  optimizations: {
    enableCompression: boolean;
    reduceQuality: boolean;
    limitConnections: boolean;
    enableCaching: boolean;
  };
}

export interface HealthCheck {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastCheck: number;
  message?: string;
  responseTime?: number;
  metadata?: Record<string, any>;
}

export class MonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: SystemMetrics[] = [];
  private alerts: Map<string, Alert> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private performanceProfiles: Map<string, PerformanceProfile> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private alertRules: Map<string, (metrics: SystemMetrics) => Alert | null> = new Map();
  private memoryManager?: MemoryManager;
  private hardwareManager?: HardwareAccelerationManager;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    this.config = {
      enabled: true,
      metricsInterval: 5000,
      retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      alertThresholds: {
        memoryUsage: 0.8,
        errorRate: 0.05,
        latency: 1000,
        connectionFailures: 5
      },
      exportSettings: {
        format: 'json',
        interval: 60000
      },
      ...config
    };

    this.initializeDefaultAlertRules();
    this.initializeDefaultPerformanceProfiles();
    this.initializeHealthChecks();

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  private initializeDefaultAlertRules(): void {
    // Memory usage alert
    this.alertRules.set('memory_usage', (metrics: SystemMetrics) => {
      const usage = metrics.memory.heap.used / metrics.memory.heap.limit;
      if (usage > this.config.alertThresholds.memoryUsage) {
        return {
          id: `memory_${Date.now()}`,
          type: usage > 0.95 ? 'critical' : 'warning',
          message: `High memory usage: ${(usage * 100).toFixed(1)}%`,
          timestamp: Date.now(),
          source: 'memory_monitor',
          metadata: { usage, limit: metrics.memory.heap.limit }
        };
      }
      return null;
    });

    // Error rate alert
    this.alertRules.set('error_rate', (metrics: SystemMetrics) => {
      if (metrics.errors.rate > this.config.alertThresholds.errorRate) {
        return {
          id: `errors_${Date.now()}`,
          type: metrics.errors.rate > 0.1 ? 'critical' : 'warning',
          message: `High error rate: ${(metrics.errors.rate * 100).toFixed(1)}%`,
          timestamp: Date.now(),
          source: 'error_monitor',
          metadata: { rate: metrics.errors.rate, count: metrics.errors.count }
        };
      }
      return null;
    });

    // Latency alert
    this.alertRules.set('latency', (metrics: SystemMetrics) => {
      if (metrics.performance.latency > this.config.alertThresholds.latency) {
        return {
          id: `latency_${Date.now()}`,
          type: metrics.performance.latency > 2000 ? 'critical' : 'warning',
          message: `High latency: ${metrics.performance.latency}ms`,
          timestamp: Date.now(),
          source: 'performance_monitor',
          metadata: { latency: metrics.performance.latency }
        };
      }
      return null;
    });

    // Connection failures alert
    this.alertRules.set('connection_failures', (metrics: SystemMetrics) => {
      if (metrics.connections.errors > this.config.alertThresholds.connectionFailures) {
        return {
          id: `conn_failures_${Date.now()}`,
          type: metrics.connections.errors > 10 ? 'critical' : 'warning',
          message: `Connection failures: ${metrics.connections.errors}`,
          timestamp: Date.now(),
          source: 'connection_monitor',
          metadata: { errors: metrics.connections.errors, retries: metrics.connections.retries }
        };
      }
      return null;
    });
  }

  private initializeDefaultPerformanceProfiles(): void {
    // Conservative profile for low-end devices
    this.performanceProfiles.set('conservative', {
      id: 'conservative',
      name: 'Conservative',
      description: 'Optimize for stability and low resource usage',
      enabled: false,
      conditions: {
        memoryThreshold: 0.7,
        connectionCount: 3,
        errorRate: 0.03
      },
      optimizations: {
        enableCompression: true,
        reduceQuality: true,
        limitConnections: true,
        enableCaching: true
      }
    });

    // Balanced profile for most scenarios
    this.performanceProfiles.set('balanced', {
      id: 'balanced',
      name: 'Balanced',
      description: 'Balance between performance and resource usage',
      enabled: true,
      conditions: {
        memoryThreshold: 0.8,
        connectionCount: 5,
        errorRate: 0.05
      },
      optimizations: {
        enableCompression: true,
        reduceQuality: false,
        limitConnections: false,
        enableCaching: true
      }
    });

    // Performance profile for high-end devices
    this.performanceProfiles.set('performance', {
      id: 'performance',
      name: 'Performance',
      description: 'Maximize performance and quality',
      enabled: false,
      conditions: {
        memoryThreshold: 0.9,
        connectionCount: 10,
        errorRate: 0.08
      },
      optimizations: {
        enableCompression: false,
        reduceQuality: false,
        limitConnections: false,
        enableCaching: false
      }
    });
  }

  private initializeHealthChecks(): void {
    // Memory health check
    this.healthChecks.set('memory', {
      id: 'memory',
      name: 'Memory System',
      status: 'unknown',
      lastCheck: 0
    });

    // Connection health check
    this.healthChecks.set('connections', {
      id: 'connections',
      name: 'Bluetooth Connections',
      status: 'unknown',
      lastCheck: 0
    });

    // Performance health check
    this.healthChecks.set('performance', {
      id: 'performance',
      name: 'System Performance',
      status: 'unknown',
      lastCheck: 0
    });

    // Hardware acceleration health check
    this.healthChecks.set('hardware', {
      id: 'hardware',
      name: 'Hardware Acceleration',
      status: 'unknown',
      lastCheck: 0
    });
  }

  public setMemoryManager(manager: MemoryManager): void {
    this.memoryManager = manager;
    this.memoryManager.on('pressure_warning', (data) => {
      this.createAlert('warning', 'Memory pressure warning', 'memory_manager', data);
    });
    this.memoryManager.on('cleanup_performed', (data) => {
      this.emit('memory_cleanup', data);
    });
  }

  public setHardwareManager(manager: HardwareAccelerationManager): void {
    this.hardwareManager = manager;
    this.hardwareManager.on('acceleration_disabled', (data) => {
      this.createAlert('warning', 'Hardware acceleration disabled', 'hardware_manager', data);
    });
  }

  public startMonitoring(): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);

    this.emit('monitoring_started');
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.emit('monitoring_stopped');
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics: SystemMetrics = {
        timestamp: Date.now(),
        memory: await this.collectMemoryMetrics(),
        performance: await this.collectPerformanceMetrics(),
        connections: await this.collectConnectionMetrics(),
        errors: await this.collectErrorMetrics()
      };

      this.metrics.push(metrics);
      this.pruneOldMetrics();
      
      // Check alert rules
      this.checkAlerts(metrics);
      
      // Update health checks
      await this.updateHealthChecks(metrics);
      
      // Check performance profiles
      this.evaluatePerformanceProfiles(metrics);

      this.emit('metrics_collected', metrics);
    } catch (error) {
      this.emit('metrics_error', error);
    }
  }

  private async collectMemoryMetrics(): Promise<SystemMetrics['memory']> {
    const memInfo = (performance as any).memory || {};
    
    let allocationsInfo = {
      total: 0,
      active: 0,
      pools: 0,
      fragmentation: 0
    };

    if (this.memoryManager) {
      const stats = this.memoryManager.getMemoryStats();
      allocationsInfo = {
        total: stats.totalAllocated,
        active: stats.activeAllocations,
        pools: stats.poolCount,
        fragmentation: stats.fragmentation
      };
    }

    return {
      heap: {
        used: memInfo.usedJSHeapSize || 0,
        total: memInfo.totalJSHeapSize || 0,
        limit: memInfo.jsHeapSizeLimit || 0
      },
      allocations: allocationsInfo
    };
  }

  private async collectPerformanceMetrics(): Promise<SystemMetrics['performance']> {
    const now = performance.now();
    const fps = this.calculateFPS();
    const latency = await this.measureLatency();
    
    let gpuUsage: number | undefined;
    if (this.hardwareManager) {
      const profiles = this.hardwareManager.getActiveProfiles();
      gpuUsage = profiles.length > 0 ? Math.random() * 100 : undefined; // Placeholder
    }

    return {
      fps,
      latency,
      throughput: this.calculateThroughput(),
      cpuUsage: this.estimateCPUUsage(),
      gpuUsage
    };
  }

  private async collectConnectionMetrics(): Promise<SystemMetrics['connections']> {
    // These would be collected from connection managers
    return {
      active: 0, // Would be provided by connection pool
      total: 0,  // Total connections ever made
      errors: 0, // Connection errors in current period
      retries: 0 // Connection retry attempts
    };
  }

  private async collectErrorMetrics(): Promise<SystemMetrics['errors']> {
    const recentErrors = this.getRecentErrors();
    return {
      count: recentErrors.length,
      rate: this.calculateErrorRate(recentErrors),
      types: this.categorizeErrors(recentErrors)
    };
  }

  private calculateFPS(): number {
    // Placeholder implementation - would track actual frame rendering
    return 60;
  }

  private async measureLatency(): Promise<number> {
    const start = performance.now();
    // Simulate a quick operation
    await new Promise(resolve => setTimeout(resolve, 1));
    return performance.now() - start;
  }

  private calculateThroughput(): number {
    // Calculate data throughput - placeholder
    return Math.random() * 1000; // MB/s
  }

  private estimateCPUUsage(): number {
    // Estimate CPU usage based on timing - simplified
    const usage = Math.min(100, Math.max(0, Math.random() * 50));
    return usage;
  }

  private getRecentErrors(): Error[] {
    // Would collect from error tracking system
    return [];
  }

  private calculateErrorRate(errors: Error[]): number {
    const timeWindow = 60000; // 1 minute
    const recentErrors = errors.filter(e => 
      Date.now() - (e as any).timestamp < timeWindow
    );
    return recentErrors.length / (timeWindow / 1000); // errors per second
  }

  private categorizeErrors(errors: Error[]): Record<string, number> {
    const categories: Record<string, number> = {};
    errors.forEach(error => {
      const type = error.constructor.name;
      categories[type] = (categories[type] || 0) + 1;
    });
    return categories;
  }

  private pruneOldMetrics(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }

  private checkAlerts(metrics: SystemMetrics): void {
    this.alertRules.forEach((rule, ruleName) => {
      const alert = rule(metrics);
      if (alert) {
        this.alerts.set(alert.id, alert);
        this.emit('alert_created', alert);
      }
    });
  }

  private async updateHealthChecks(metrics: SystemMetrics): Promise<void> {
    // Memory health
    const memoryUsage = metrics.memory.heap.used / metrics.memory.heap.limit;
    this.updateHealthCheck('memory', {
      status: memoryUsage > 0.9 ? 'critical' : memoryUsage > 0.7 ? 'warning' : 'healthy',
      message: `Memory usage: ${(memoryUsage * 100).toFixed(1)}%`,
      responseTime: 1
    });

    // Connection health
    const connectionHealth = metrics.connections.errors > 5 ? 'critical' : 
                            metrics.connections.errors > 2 ? 'warning' : 'healthy';
    this.updateHealthCheck('connections', {
      status: connectionHealth,
      message: `Active: ${metrics.connections.active}, Errors: ${metrics.connections.errors}`,
      responseTime: 2
    });

    // Performance health
    const perfHealth = metrics.performance.latency > 1000 ? 'critical' :
                      metrics.performance.latency > 500 ? 'warning' : 'healthy';
    this.updateHealthCheck('performance', {
      status: perfHealth,
      message: `Latency: ${metrics.performance.latency}ms, FPS: ${metrics.performance.fps}`,
      responseTime: metrics.performance.latency
    });

    // Hardware health
    const hardwareHealth = metrics.performance.gpuUsage !== undefined ? 'healthy' : 'warning';
    this.updateHealthCheck('hardware', {
      status: hardwareHealth,
      message: `GPU: ${metrics.performance.gpuUsage ? 'Available' : 'Unavailable'}`,
      responseTime: 1
    });
  }

  private updateHealthCheck(id: string, updates: Partial<HealthCheck>): void {
    const existing = this.healthChecks.get(id);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        lastCheck: Date.now()
      };
      this.healthChecks.set(id, updated);
      this.emit('health_check_updated', updated);
    }
  }

  private evaluatePerformanceProfiles(metrics: SystemMetrics): void {
    const memoryUsage = metrics.memory.heap.used / metrics.memory.heap.limit;
    
    this.performanceProfiles.forEach((profile, id) => {
      if (!profile.enabled) return;

      const shouldActivate = 
        memoryUsage > profile.conditions.memoryThreshold ||
        metrics.connections.active > profile.conditions.connectionCount ||
        metrics.errors.rate > profile.conditions.errorRate;

      if (shouldActivate) {
        this.activatePerformanceProfile(id, metrics);
      }
    });
  }

  private activatePerformanceProfile(profileId: string, metrics: SystemMetrics): void {
    const profile = this.performanceProfiles.get(profileId);
    if (!profile) return;

    this.emit('performance_profile_activated', {
      profile,
      metrics,
      timestamp: Date.now()
    });
  }

  public createAlert(
    type: Alert['type'], 
    message: string, 
    source: string, 
    metadata?: Record<string, any>
  ): string {
    const alert: Alert = {
      id: `${source}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: Date.now(),
      source,
      metadata
    };

    this.alerts.set(alert.id, alert);
    this.emit('alert_created', alert);
    return alert.id;
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = Date.now();
    this.emit('alert_resolved', alert);
    return true;
  }

  public getMetrics(limit?: number): SystemMetrics[] {
    return limit ? this.metrics.slice(-limit) : [...this.metrics];
  }

  public getAlerts(unresolved = false): Alert[] {
    const alerts = Array.from(this.alerts.values());
    return unresolved ? alerts.filter(a => !a.resolved) : alerts;
  }

  public getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  public getSystemHealth(): {
    overall: 'healthy' | 'warning' | 'critical';
    checks: HealthCheck[];
    score: number;
  } {
    const checks = this.getHealthChecks();
    const scores = checks.map(check => {
      switch (check.status) {
        case 'healthy': return 100;
        case 'warning': return 60;
        case 'critical': return 20;
        default: return 50;
      }
    });

    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const overall = averageScore > 80 ? 'healthy' : 
                   averageScore > 50 ? 'warning' : 'critical';

    return { overall, checks, score: averageScore };
  }

  public exportMetrics(
    format: 'json' | 'csv' | 'prometheus' = 'json',
    timeRange?: { start: number; end: number }
  ): string {
    let data = this.metrics;
    
    if (timeRange) {
      data = data.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);
    }

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'csv':
        return this.formatAsCSV(data);
      
      case 'prometheus':
        return this.formatAsPrometheus(data);
      
      default:
        return JSON.stringify(data);
    }
  }

  private formatAsCSV(metrics: SystemMetrics[]): string {
    const headers = [
      'timestamp', 'memory_used', 'memory_total', 'memory_limit',
      'fps', 'latency', 'cpu_usage', 'gpu_usage',
      'connections_active', 'connections_errors',
      'error_count', 'error_rate'
    ];

    const rows = metrics.map(m => [
      m.timestamp,
      m.memory.heap.used,
      m.memory.heap.total,
      m.memory.heap.limit,
      m.performance.fps,
      m.performance.latency,
      m.performance.cpuUsage,
      m.performance.gpuUsage || '',
      m.connections.active,
      m.connections.errors,
      m.errors.count,
      m.errors.rate
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private formatAsPrometheus(metrics: SystemMetrics[]): string {
    if (metrics.length === 0) return '';

    const latest = metrics[metrics.length - 1];
    const lines = [
      `# HELP memory_used_bytes Memory usage in bytes`,
      `# TYPE memory_used_bytes gauge`,
      `memory_used_bytes ${latest.memory.heap.used}`,
      ``,
      `# HELP performance_fps Frames per second`,
      `# TYPE performance_fps gauge`,
      `performance_fps ${latest.performance.fps}`,
      ``,
      `# HELP performance_latency_ms Latency in milliseconds`,
      `# TYPE performance_latency_ms gauge`,
      `performance_latency_ms ${latest.performance.latency}`,
      ``,
      `# HELP connections_active Active connections count`,
      `# TYPE connections_active gauge`,
      `connections_active ${latest.connections.active}`,
      ``,
      `# HELP error_rate Error rate per second`,
      `# TYPE error_rate gauge`,
      `error_rate ${latest.errors.rate}`
    ];

    return lines.join('\n');
  }

  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enabled && !this.monitoringInterval) {
      this.startMonitoring();
    } else if (!this.config.enabled && this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.emit('config_updated', this.config);
  }

  public getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  public destroy(): void {
    this.stopMonitoring();
    this.alerts.clear();
    this.metrics.length = 0;
    this.healthChecks.clear();
    this.alertRules.clear();
    this.performanceProfiles.clear();
    this.removeAllListeners();
  }
}

export default MonitoringService;