import { EventEmitter } from 'events';

export interface DebugSession {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  deviceId?: string;
  filters: DebugFilter[];
  capturedEvents: DebugEvent[];
  breakpoints: Breakpoint[];
  configuration: DebugConfiguration;
}

export interface DebugFilter {
  id: string;
  name: string;
  enabled: boolean;
  type: 'event_type' | 'device_id' | 'command' | 'data_size' | 'custom';
  condition: FilterCondition;
  action: 'include' | 'exclude' | 'highlight' | 'break';
}

export interface FilterCondition {
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'greater_than' | 'less_than' | 'range';
  value: any;
  caseSensitive?: boolean;
}

export interface DebugEvent {
  id: string;
  timestamp: Date;
  sessionId: string;
  deviceId?: string;
  type: 'command_sent' | 'response_received' | 'connection_event' | 'error' | 'state_change' | 'data_transfer';
  direction: 'incoming' | 'outgoing' | 'internal';
  command?: string;
  data: any;
  metadata: DebugEventMetadata;
  highlighted?: boolean;
  notes?: string;
}

export interface DebugEventMetadata {
  size: number;
  duration?: number;
  sequenceNumber?: number;
  correlationId?: string;
  stackTrace?: string[];
  networkInfo?: {
    signalStrength?: number;
    latency?: number;
    bandwidth?: number;
  };
  protocolInfo?: {
    version?: string;
    flags?: string[];
    checksum?: string;
  };
}

export interface Breakpoint {
  id: string;
  name: string;
  enabled: boolean;
  condition: BreakpointCondition;
  action: 'pause' | 'log' | 'evaluate';
  actionData?: any;
  hitCount: number;
  isOneTime: boolean;
}

export interface BreakpointCondition {
  type: 'event_type' | 'command' | 'error' | 'state' | 'custom_expression';
  expression: string;
  parameters?: Record<string, any>;
}

export interface DebugConfiguration {
  maxEvents: number;
  captureStackTrace: boolean;
  captureNetworkInfo: boolean;
  captureProtocolDetails: boolean;
  autoSave: boolean;
  exportFormat: 'json' | 'csv' | 'pcap';
  realTimeAnalysis: boolean;
  performanceMonitoring: boolean;
}

export interface ProtocolAnalysis {
  totalEvents: number;
  eventTypeDistribution: Map<string, number>;
  commandFrequency: Map<string, number>;
  errorRates: Map<string, number>;
  averageLatency: number;
  dataTransferStats: {
    totalBytes: number;
    averageTransferRate: number;
    peakTransferRate: number;
  };
  connectionStability: {
    disconnections: number;
    reconnections: number;
    averageConnectionDuration: number;
  };
  performanceMetrics: PerformanceMetrics;
}

export interface PerformanceMetrics {
  cpu: {
    average: number;
    peak: number;
    samples: number[];
  };
  memory: {
    average: number;
    peak: number;
    samples: number[];
  };
  network: {
    latency: number[];
    bandwidth: number[];
    packetLoss: number;
  };
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'pcap' | 'wireshark';
  dateRange?: [Date, Date];
  eventTypes?: string[];
  includeMetadata: boolean;
  compression?: boolean;
}

export class ProtocolDebugger extends EventEmitter {
  private sessions: Map<string, DebugSession> = new Map();
  private activeSessionId: string | null = null;
  private eventBuffer: DebugEvent[] = [];
  private analysisCache: Map<string, ProtocolAnalysis> = new Map();
  private performanceMonitor?: NodeJS.Timeout;
  private autoSaveInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupDefaultFilters();
  }

  private setupDefaultFilters(): void {
    // Default filters are created per session
  }

  createSession(name: string, deviceId?: string): string {
    const sessionId = this.generateSessionId();
    
    const session: DebugSession = {
      id: sessionId,
      name,
      startTime: new Date(),
      isActive: false,
      deviceId,
      filters: this.createDefaultFilters(),
      capturedEvents: [],
      breakpoints: [],
      configuration: {
        maxEvents: 10000,
        captureStackTrace: true,
        captureNetworkInfo: true,
        captureProtocolDetails: true,
        autoSave: true,
        exportFormat: 'json',
        realTimeAnalysis: true,
        performanceMonitoring: true
      }
    };

    this.sessions.set(sessionId, session);
    this.emit('session_created', { sessionId, name, deviceId });
    
    return sessionId;
  }

  private createDefaultFilters(): DebugFilter[] {
    return [
      {
        id: 'filter_errors',
        name: 'Highlight Errors',
        enabled: true,
        type: 'event_type',
        condition: { operator: 'equals', value: 'error' },
        action: 'highlight'
      },
      {
        id: 'filter_commands',
        name: 'Include All Commands',
        enabled: true,
        type: 'event_type',
        condition: { operator: 'equals', value: 'command_sent' },
        action: 'include'
      },
      {
        id: 'filter_responses',
        name: 'Include All Responses',
        enabled: true,
        type: 'event_type',
        condition: { operator: 'equals', value: 'response_received' },
        action: 'include'
      },
      {
        id: 'filter_large_data',
        name: 'Highlight Large Data Transfers',
        enabled: false,
        type: 'data_size',
        condition: { operator: 'greater_than', value: 1024 * 1024 }, // 1MB
        action: 'highlight'
      }
    ];
  }

  startSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.isActive) {
      throw new Error('Session is already active');
    }

    // Stop current active session if any
    if (this.activeSessionId) {
      this.stopSession(this.activeSessionId);
    }

    session.isActive = true;
    this.activeSessionId = sessionId;

    // Start performance monitoring if enabled
    if (session.configuration.performanceMonitoring) {
      this.startPerformanceMonitoring();
    }

    // Start auto-save if enabled
    if (session.configuration.autoSave) {
      this.startAutoSave(sessionId);
    }

    this.emit('session_started', { sessionId });
  }

  stopSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.isActive = false;
    session.endTime = new Date();

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    this.stopPerformanceMonitoring();
    this.stopAutoSave();

    this.emit('session_stopped', { sessionId });
  }

  captureEvent(eventData: Partial<DebugEvent>): void {
    if (!this.activeSessionId) return;

    const session = this.sessions.get(this.activeSessionId);
    if (!session || !session.isActive) return;

    const event: DebugEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      sessionId: this.activeSessionId,
      type: eventData.type || 'data_transfer',
      direction: eventData.direction || 'internal',
      data: eventData.data || {},
      metadata: this.enrichMetadata(eventData.metadata || {}),
      ...eventData
    };

    // Apply filters
    const shouldCapture = this.applyFilters(event, session.filters);
    if (!shouldCapture) return;

    // Check event limit
    if (session.capturedEvents.length >= session.configuration.maxEvents) {
      // Remove oldest event
      session.capturedEvents.shift();
    }

    session.capturedEvents.push(event);

    // Check breakpoints
    this.checkBreakpoints(event, session.breakpoints);

    // Update real-time analysis
    if (session.configuration.realTimeAnalysis) {
      this.updateAnalysis(session.id);
    }

    this.emit('event_captured', { sessionId: session.id, event });
  }

  private enrichMetadata(metadata: Partial<DebugEventMetadata>): DebugEventMetadata {
    const enriched: DebugEventMetadata = {
      size: 0,
      ...metadata
    };

    const session = this.sessions.get(this.activeSessionId!);
    if (!session) return enriched;

    // Calculate data size
    if (metadata.size === undefined) {
      try {
        enriched.size = new TextEncoder().encode(JSON.stringify(metadata)).length;
      } catch {
        enriched.size = 0;
      }
    }

    // Capture stack trace if enabled
    if (session.configuration.captureStackTrace) {
      enriched.stackTrace = this.captureStackTrace();
    }

    // Add sequence number
    enriched.sequenceNumber = session.capturedEvents.length + 1;

    // Generate correlation ID for command-response pairs
    if (!enriched.correlationId) {
      enriched.correlationId = this.generateCorrelationId();
    }

    return enriched;
  }

  private captureStackTrace(): string[] {
    const stack = new Error().stack;
    if (!stack) return [];
    
    return stack
      .split('\n')
      .slice(3) // Remove Error constructor and captureStackTrace calls
      .map(line => line.trim())
      .filter(line => line.startsWith('at '))
      .slice(0, 10); // Limit to 10 frames
  }

  private applyFilters(event: DebugEvent, filters: DebugFilter[]): boolean {
    let shouldInclude = true;
    let shouldHighlight = false;

    for (const filter of filters) {
      if (!filter.enabled) continue;

      const matches = this.evaluateFilterCondition(event, filter);
      if (!matches) continue;

      switch (filter.action) {
        case 'include':
          shouldInclude = true;
          break;
        case 'exclude':
          shouldInclude = false;
          break;
        case 'highlight':
          shouldHighlight = true;
          break;
        case 'break':
          this.triggerBreakpoint(event, filter);
          break;
      }
    }

    if (shouldHighlight) {
      event.highlighted = true;
    }

    return shouldInclude;
  }

  private evaluateFilterCondition(event: DebugEvent, filter: DebugFilter): boolean {
    let value: any;

    switch (filter.type) {
      case 'event_type':
        value = event.type;
        break;
      case 'device_id':
        value = event.deviceId;
        break;
      case 'command':
        value = event.command;
        break;
      case 'data_size':
        value = event.metadata.size;
        break;
      case 'custom':
        // Custom filters would be evaluated here
        return true;
      default:
        return false;
    }

    return this.evaluateCondition(value, filter.condition);
  }

  private evaluateCondition(value: any, condition: FilterCondition): boolean {
    const { operator, value: conditionValue, caseSensitive = false } = condition;
    
    if (typeof value === 'string' && typeof conditionValue === 'string' && !caseSensitive) {
      value = value.toLowerCase();
      condition.value = conditionValue.toLowerCase();
    }

    switch (operator) {
      case 'equals':
        return value === conditionValue;
      case 'contains':
        return String(value).includes(String(conditionValue));
      case 'starts_with':
        return String(value).startsWith(String(conditionValue));
      case 'ends_with':
        return String(value).endsWith(String(conditionValue));
      case 'regex':
        return new RegExp(conditionValue).test(String(value));
      case 'greater_than':
        return Number(value) > Number(conditionValue);
      case 'less_than':
        return Number(value) < Number(conditionValue);
      case 'range':
        const [min, max] = conditionValue;
        return Number(value) >= Number(min) && Number(value) <= Number(max);
      default:
        return false;
    }
  }

  private checkBreakpoints(event: DebugEvent, breakpoints: Breakpoint[]): void {
    for (const breakpoint of breakpoints) {
      if (!breakpoint.enabled) continue;

      const matches = this.evaluateBreakpointCondition(event, breakpoint.condition);
      if (!matches) continue;

      breakpoint.hitCount++;

      switch (breakpoint.action) {
        case 'pause':
          this.emit('breakpoint_hit', { event, breakpoint });
          break;
        case 'log':
          console.log(`Breakpoint hit: ${breakpoint.name}`, event);
          break;
        case 'evaluate':
          this.evaluateBreakpointAction(event, breakpoint);
          break;
      }

      if (breakpoint.isOneTime) {
        breakpoint.enabled = false;
      }
    }
  }

  private evaluateBreakpointCondition(event: DebugEvent, condition: BreakpointCondition): boolean {
    switch (condition.type) {
      case 'event_type':
        return event.type === condition.expression;
      case 'command':
        return event.command === condition.expression;
      case 'error':
        return event.type === 'error' && 
               (event.data?.message || '').includes(condition.expression);
      case 'custom_expression':
        // Would evaluate JavaScript expression in safe context
        return this.evaluateCustomExpression(event, condition.expression);
      default:
        return false;
    }
  }

  private evaluateCustomExpression(event: DebugEvent, expression: string): boolean {
    // Simple expression evaluation - in real implementation, use safe eval
    try {
      // Create a safe context with event data
      const context = {
        event,
        type: event.type,
        command: event.command,
        size: event.metadata.size,
        duration: event.metadata.duration
      };
      
      // Very basic expression evaluation (should use proper safe eval library)
      if (expression.includes('size > ')) {
        const threshold = parseInt(expression.split('size > ')[1]);
        return context.size > threshold;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  private evaluateBreakpointAction(event: DebugEvent, breakpoint: Breakpoint): void {
    // Execute custom action data if provided
    if (breakpoint.actionData) {
      this.emit('breakpoint_action', { event, breakpoint, actionData: breakpoint.actionData });
    }
  }

  private triggerBreakpoint(event: DebugEvent, filter: DebugFilter): void {
    this.emit('filter_break', { event, filter });
  }

  analyzeSession(sessionId: string): ProtocolAnalysis {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Check cache
    const cacheKey = `${sessionId}_${session.capturedEvents.length}`;
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    const events = session.capturedEvents;
    const analysis: ProtocolAnalysis = {
      totalEvents: events.length,
      eventTypeDistribution: new Map(),
      commandFrequency: new Map(),
      errorRates: new Map(),
      averageLatency: 0,
      dataTransferStats: {
        totalBytes: 0,
        averageTransferRate: 0,
        peakTransferRate: 0
      },
      connectionStability: {
        disconnections: 0,
        reconnections: 0,
        averageConnectionDuration: 0
      },
      performanceMetrics: {
        cpu: { average: 0, peak: 0, samples: [] },
        memory: { average: 0, peak: 0, samples: [] },
        network: { latency: [], bandwidth: [], packetLoss: 0 }
      }
    };

    // Analyze event type distribution
    for (const event of events) {
      const count = analysis.eventTypeDistribution.get(event.type) || 0;
      analysis.eventTypeDistribution.set(event.type, count + 1);

      if (event.command) {
        const cmdCount = analysis.commandFrequency.get(event.command) || 0;
        analysis.commandFrequency.set(event.command, cmdCount + 1);
      }

      if (event.type === 'error') {
        const errorType = event.data?.type || 'unknown';
        const errorCount = analysis.errorRates.get(errorType) || 0;
        analysis.errorRates.set(errorType, errorCount + 1);
      }

      // Accumulate data transfer stats
      analysis.dataTransferStats.totalBytes += event.metadata.size;

      // Collect latency data
      if (event.metadata.duration) {
        analysis.performanceMetrics.network.latency.push(event.metadata.duration);
      }
    }

    // Calculate averages
    const latencies = analysis.performanceMetrics.network.latency;
    if (latencies.length > 0) {
      analysis.averageLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    }

    if (events.length > 0 && session.endTime) {
      const duration = session.endTime.getTime() - session.startTime.getTime();
      analysis.dataTransferStats.averageTransferRate = 
        (analysis.dataTransferStats.totalBytes / duration) * 1000; // bytes per second
    }

    // Analyze connection stability
    let connectionEvents = events.filter(e => e.type === 'connection_event');
    analysis.connectionStability.disconnections = 
      connectionEvents.filter(e => e.data?.action === 'disconnect').length;
    analysis.connectionStability.reconnections = 
      connectionEvents.filter(e => e.data?.action === 'connect').length;

    // Cache the analysis
    this.analysisCache.set(cacheKey, analysis);

    return analysis;
  }

  private updateAnalysis(sessionId: string): void {
    // Invalidate cache for real-time analysis
    const cacheKeys = Array.from(this.analysisCache.keys()).filter(key => 
      key.startsWith(sessionId)
    );
    
    for (const key of cacheKeys) {
      this.analysisCache.delete(key);
    }

    const analysis = this.analyzeSession(sessionId);
    this.emit('analysis_updated', { sessionId, analysis });
  }

  addFilter(sessionId: string, filter: DebugFilter): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.filters.push(filter);
    this.emit('filter_added', { sessionId, filter });
  }

  removeFilter(sessionId: string, filterId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const index = session.filters.findIndex(f => f.id === filterId);
    if (index === -1) return false;

    session.filters.splice(index, 1);
    this.emit('filter_removed', { sessionId, filterId });
    
    return true;
  }

  addBreakpoint(sessionId: string, breakpoint: Breakpoint): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.breakpoints.push(breakpoint);
    this.emit('breakpoint_added', { sessionId, breakpoint });
  }

  removeBreakpoint(sessionId: string, breakpointId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const index = session.breakpoints.findIndex(b => b.id === breakpointId);
    if (index === -1) return false;

    session.breakpoints.splice(index, 1);
    this.emit('breakpoint_removed', { sessionId, breakpointId });
    
    return true;
  }

  exportSession(sessionId: string, options: ExportOptions): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    let events = session.capturedEvents;

    // Apply date range filter
    if (options.dateRange) {
      const [start, end] = options.dateRange;
      events = events.filter(e => e.timestamp >= start && e.timestamp <= end);
    }

    // Apply event type filter
    if (options.eventTypes) {
      events = events.filter(e => options.eventTypes!.includes(e.type));
    }

    switch (options.format) {
      case 'json':
        return this.exportAsJSON(events, options.includeMetadata);
      case 'csv':
        return this.exportAsCSV(events, options.includeMetadata);
      case 'pcap':
        return this.exportAsPCAP(events);
      case 'wireshark':
        return this.exportAsWireshark(events);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private exportAsJSON(events: DebugEvent[], includeMetadata: boolean): string {
    const exportData = {
      exportTime: new Date(),
      eventCount: events.length,
      events: includeMetadata ? events : events.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        type: e.type,
        direction: e.direction,
        command: e.command,
        data: e.data
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  private exportAsCSV(events: DebugEvent[], includeMetadata: boolean): string {
    const headers = ['ID', 'Timestamp', 'Type', 'Direction', 'Command', 'Data Size'];
    if (includeMetadata) {
      headers.push('Duration', 'Sequence', 'Correlation ID');
    }

    const rows = [headers.join(',')];
    
    for (const event of events) {
      const row = [
        event.id,
        event.timestamp.toISOString(),
        event.type,
        event.direction,
        event.command || '',
        event.metadata.size.toString()
      ];

      if (includeMetadata) {
        row.push(
          event.metadata.duration?.toString() || '',
          event.metadata.sequenceNumber?.toString() || '',
          event.metadata.correlationId || ''
        );
      }

      // Escape commas and quotes
      const escapedRow = row.map(field => {
        if (field.includes(',') || field.includes('"')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      });

      rows.push(escapedRow.join(','));
    }

    return rows.join('\n');
  }

  private exportAsPCAP(events: DebugEvent[]): string {
    // Simplified PCAP export (would need proper binary format in real implementation)
    const pcapData = {
      magic: 0xa1b2c3d4,
      version: [2, 4],
      timezone: 0,
      accuracy: 0,
      snapLength: 65535,
      dataLink: 1,
      packets: events.map(event => ({
        timestamp: Math.floor(event.timestamp.getTime() / 1000),
        capturedLength: event.metadata.size,
        originalLength: event.metadata.size,
        data: event.data
      }))
    };

    return JSON.stringify(pcapData);
  }

  private exportAsWireshark(events: DebugEvent[]): string {
    // Generate Wireshark-compatible format
    const wiresharkData = events.map(event => ({
      'No.': event.metadata.sequenceNumber,
      'Time': event.timestamp.toISOString(),
      'Source': event.direction === 'outgoing' ? 'Client' : 'Device',
      'Destination': event.direction === 'outgoing' ? 'Device' : 'Client',
      'Protocol': 'BlackmagicBT',
      'Length': event.metadata.size,
      'Info': `${event.type}: ${event.command || ''}`
    }));

    return JSON.stringify(wiresharkData, null, 2);
  }

  private startPerformanceMonitoring(): void {
    this.performanceMonitor = setInterval(() => {
      // Collect performance metrics
      const metrics = this.collectPerformanceMetrics();
      
      if (this.activeSessionId) {
        this.captureEvent({
          type: 'data_transfer',
          direction: 'internal',
          data: { performanceMetrics: metrics },
          metadata: { size: 0 }
        });
      }
    }, 1000);
  }

  private stopPerformanceMonitoring(): void {
    if (this.performanceMonitor) {
      clearInterval(this.performanceMonitor);
      this.performanceMonitor = undefined;
    }
  }

  private collectPerformanceMetrics(): any {
    const metrics: any = {};

    // Collect memory usage
    if (typeof performance !== 'undefined' && performance.memory) {
      metrics.memory = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }

    // Collect timing metrics
    if (typeof performance !== 'undefined') {
      metrics.timing = {
        now: performance.now(),
        timeOrigin: performance.timeOrigin
      };
    }

    return metrics;
  }

  private startAutoSave(sessionId: string): void {
    this.autoSaveInterval = setInterval(() => {
      const session = this.sessions.get(sessionId);
      if (session && session.isActive) {
        const exportData = this.exportSession(sessionId, {
          format: session.configuration.exportFormat,
          includeMetadata: true
        });
        
        this.emit('auto_save', { sessionId, data: exportData });
      }
    }, 60000); // Auto-save every minute
  }

  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = undefined;
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  // Public API methods
  getSessions(): DebugSession[] {
    return Array.from(this.sessions.values());
  }

  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSession(): DebugSession | null {
    return this.activeSessionId ? this.sessions.get(this.activeSessionId) || null : null;
  }

  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.isActive) {
      this.stopSession(sessionId);
    }

    this.sessions.delete(sessionId);
    this.emit('session_deleted', { sessionId });
    
    return true;
  }

  clearEvents(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.capturedEvents = [];
      this.emit('events_cleared', { sessionId });
    }
  }

  addNote(sessionId: string, eventId: string, note: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const event = session.capturedEvents.find(e => e.id === eventId);
    if (event) {
      event.notes = note;
      this.emit('note_added', { sessionId, eventId, note });
    }
  }
}