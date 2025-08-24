import { EventEmitter } from 'events';

export interface ProgressStage {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-100, percentage of total progress
  estimatedDuration: number; // milliseconds
  critical: boolean; // if true, failure here should abort the operation
  skippable: boolean; // if true, this stage can be skipped under certain conditions
  retryable: boolean; // if true, this stage can be retried on failure
  maxRetries: number;
}

export interface ProgressUpdate {
  stageId: string;
  stageName: string;
  stageProgress: number; // 0-100
  overallProgress: number; // 0-100
  currentOperation: string;
  estimatedTimeRemaining: number; // milliseconds
  speed?: {
    value: number;
    unit: 'bytes/s' | 'operations/s' | 'percent/s';
  };
  throughput?: {
    processed: number;
    total: number;
    unit: 'bytes' | 'operations' | 'items';
  };
  warnings: string[];
  metadata?: Record<string, any>;
}

export interface ProgressSession {
  id: string;
  name: string;
  description: string;
  stages: ProgressStage[];
  currentStageIndex: number;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  overallProgress: number;
  lastUpdate: ProgressUpdate;
  retryAttempts: Map<string, number>;
  warnings: string[];
  errors: string[];
  elapsedTime: number;
  estimatedTotalTime: number;
}

export interface ProgressEventHandlers {
  onStageStart?: (stageId: string, session: ProgressSession) => void;
  onStageComplete?: (stageId: string, session: ProgressSession) => void;
  onStageSkip?: (stageId: string, reason: string, session: ProgressSession) => void;
  onStageRetry?: (stageId: string, attempt: number, session: ProgressSession) => void;
  onWarning?: (message: string, session: ProgressSession) => void;
  onError?: (error: string, session: ProgressSession) => void;
}

export class ProgressManager extends EventEmitter {
  private sessions: Map<string, ProgressSession> = new Map();
  private activeSessionId: string | null = null;

  createSession(
    name: string, 
    description: string, 
    stages: ProgressStage[],
    handlers?: ProgressEventHandlers
  ): string {
    const sessionId = `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate stage weights
    const totalWeight = stages.reduce((sum, stage) => sum + stage.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.1) {
      throw new Error(`Stage weights must sum to 100, got ${totalWeight}`);
    }

    const session: ProgressSession = {
      id: sessionId,
      name,
      description,
      stages: stages.map(stage => ({ ...stage, maxRetries: stage.maxRetries || 3 })),
      currentStageIndex: 0,
      startTime: new Date(),
      status: 'pending',
      overallProgress: 0,
      lastUpdate: {
        stageId: stages[0]?.id || 'unknown',
        stageName: stages[0]?.name || 'Unknown',
        stageProgress: 0,
        overallProgress: 0,
        currentOperation: 'Initializing...',
        estimatedTimeRemaining: stages.reduce((sum, stage) => sum + stage.estimatedDuration, 0),
        warnings: []
      },
      retryAttempts: new Map(),
      warnings: [],
      errors: [],
      elapsedTime: 0,
      estimatedTotalTime: stages.reduce((sum, stage) => sum + stage.estimatedDuration, 0)
    };

    this.sessions.set(sessionId, session);
    
    // Set up handlers if provided
    if (handlers) {
      this.setupHandlers(sessionId, handlers);
    }

    this.emit('session-created', session);
    return sessionId;
  }

  private setupHandlers(sessionId: string, handlers: ProgressEventHandlers): void {
    if (handlers.onStageStart) {
      this.on(`stage-start-${sessionId}`, handlers.onStageStart);
    }
    if (handlers.onStageComplete) {
      this.on(`stage-complete-${sessionId}`, handlers.onStageComplete);
    }
    if (handlers.onStageSkip) {
      this.on(`stage-skip-${sessionId}`, handlers.onStageSkip);
    }
    if (handlers.onStageRetry) {
      this.on(`stage-retry-${sessionId}`, handlers.onStageRetry);
    }
    if (handlers.onWarning) {
      this.on(`warning-${sessionId}`, handlers.onWarning);
    }
    if (handlers.onError) {
      this.on(`error-${sessionId}`, handlers.onError);
    }
  }

  startSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'pending') {
      throw new Error(`Session ${sessionId} cannot be started (status: ${session.status})`);
    }

    session.status = 'running';
    session.startTime = new Date();
    this.activeSessionId = sessionId;

    // Start first stage
    if (session.stages.length > 0) {
      this.startStage(sessionId, 0);
    }

    this.emit('session-started', session);
  }

  private startStage(sessionId: string, stageIndex: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const stage = session.stages[stageIndex];
    if (!stage) return;

    session.currentStageIndex = stageIndex;

    this.emit('stage-started', { sessionId, stageId: stage.id, stage });
    this.emit(`stage-start-${sessionId}`, stage.id, session);
  }

  updateProgress(
    sessionId: string,
    stageProgress: number,
    currentOperation?: string,
    metadata?: Record<string, any>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') return;

    const currentStage = session.stages[session.currentStageIndex];
    if (!currentStage) return;

    // Calculate overall progress based on completed stages and current stage progress
    let overallProgress = 0;
    
    // Add progress from completed stages
    for (let i = 0; i < session.currentStageIndex; i++) {
      overallProgress += session.stages[i].weight;
    }
    
    // Add progress from current stage
    overallProgress += (currentStage.weight * stageProgress) / 100;

    // Update elapsed time
    session.elapsedTime = Date.now() - session.startTime.getTime();

    // Calculate estimated time remaining
    const progressRatio = overallProgress / 100;
    const estimatedTotalTime = progressRatio > 0 ? session.elapsedTime / progressRatio : session.estimatedTotalTime;
    const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - session.elapsedTime);

    // Calculate speed if we have throughput data
    let speed: ProgressUpdate['speed'] | undefined;
    if (metadata?.throughput && session.elapsedTime > 0) {
      const processed = metadata.throughput.processed || 0;
      const timeInSeconds = session.elapsedTime / 1000;
      speed = {
        value: processed / timeInSeconds,
        unit: metadata.throughput.unit === 'bytes' ? 'bytes/s' as const : 'operations/s' as const
      };
    }

    const update: ProgressUpdate = {
      stageId: currentStage.id,
      stageName: currentStage.name,
      stageProgress: Math.max(0, Math.min(100, stageProgress)),
      overallProgress: Math.max(0, Math.min(100, overallProgress)),
      currentOperation: currentOperation || session.lastUpdate.currentOperation,
      estimatedTimeRemaining,
      speed,
      throughput: metadata?.throughput,
      warnings: [...session.warnings],
      metadata
    };

    session.overallProgress = update.overallProgress;
    session.lastUpdate = update;

    this.emit('progress-updated', { sessionId, update });

    // Check if current stage is complete
    if (stageProgress >= 100) {
      this.completeStage(sessionId);
    }
  }

  private completeStage(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const currentStage = session.stages[session.currentStageIndex];
    if (!currentStage) return;

    this.emit('stage-completed', { sessionId, stageId: currentStage.id, stage: currentStage });
    this.emit(`stage-complete-${sessionId}`, currentStage.id, session);

    // Move to next stage or complete session
    const nextStageIndex = session.currentStageIndex + 1;
    if (nextStageIndex < session.stages.length) {
      this.startStage(sessionId, nextStageIndex);
    } else {
      this.completeSession(sessionId);
    }
  }

  private completeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.endTime = new Date();
    session.overallProgress = 100;
    session.elapsedTime = session.endTime.getTime() - session.startTime.getTime();

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    this.emit('session-completed', session);
  }

  skipStage(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') return;

    const currentStage = session.stages[session.currentStageIndex];
    if (!currentStage || !currentStage.skippable) {
      throw new Error(`Current stage "${currentStage?.name}" cannot be skipped`);
    }

    this.addWarning(sessionId, `Stage "${currentStage.name}" was skipped: ${reason}`);

    this.emit('stage-skipped', { sessionId, stageId: currentStage.id, reason });
    this.emit(`stage-skip-${sessionId}`, currentStage.id, reason, session);

    // Mark stage as complete and move to next
    this.updateProgress(sessionId, 100, `Skipped: ${reason}`);
  }

  retryStage(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const currentStage = session.stages[session.currentStageIndex];
    if (!currentStage || !currentStage.retryable) {
      throw new Error(`Current stage "${currentStage?.name}" cannot be retried`);
    }

    const attemptCount = session.retryAttempts.get(currentStage.id) || 0;
    if (attemptCount >= currentStage.maxRetries) {
      throw new Error(`Maximum retry attempts (${currentStage.maxRetries}) reached for stage "${currentStage.name}"`);
    }

    const newAttemptCount = attemptCount + 1;
    session.retryAttempts.set(currentStage.id, newAttemptCount);

    this.addWarning(sessionId, `Retrying stage "${currentStage.name}" (attempt ${newAttemptCount}/${currentStage.maxRetries})`);

    this.emit('stage-retry', { sessionId, stageId: currentStage.id, attempt: newAttemptCount });
    this.emit(`stage-retry-${sessionId}`, currentStage.id, newAttemptCount, session);

    // Reset stage progress
    this.updateProgress(sessionId, 0, `Retrying (attempt ${newAttemptCount}/${currentStage.maxRetries})`);
  }

  pauseSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') return;

    session.status = 'paused';
    this.emit('session-paused', session);
  }

  resumeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') return;

    session.status = 'running';
    this.activeSessionId = sessionId;
    this.emit('session-resumed', session);
  }

  cancelSession(sessionId: string, reason?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'cancelled';
    session.endTime = new Date();
    session.elapsedTime = session.endTime.getTime() - session.startTime.getTime();

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    this.addError(sessionId, `Session cancelled: ${reason || 'User requested'}`);
    this.emit('session-cancelled', { session, reason });
  }

  failSession(sessionId: string, error: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'failed';
    session.endTime = new Date();
    session.elapsedTime = session.endTime.getTime() - session.startTime.getTime();

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    this.addError(sessionId, error);
    this.emit('session-failed', { session, error });
  }

  addWarning(sessionId: string, message: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.warnings.push(message);
    session.lastUpdate.warnings = [...session.warnings];

    this.emit('warning', { sessionId, message });
    this.emit(`warning-${sessionId}`, message, session);
  }

  addError(sessionId: string, error: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.errors.push(error);

    this.emit('error', { sessionId, error });
    this.emit(`error-${sessionId}`, error, session);
  }

  getSession(sessionId: string): ProgressSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getActiveSession(): ProgressSession | null {
    return this.activeSessionId ? this.sessions.get(this.activeSessionId) || null : null;
  }

  getAllSessions(): ProgressSession[] {
    return Array.from(this.sessions.values());
  }

  getSessionsByStatus(status: ProgressSession['status']): ProgressSession[] {
    return Array.from(this.sessions.values()).filter(session => session.status === status);
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Cannot remove active sessions
    if (session.status === 'running' || session.status === 'paused') {
      throw new Error(`Cannot remove active session ${sessionId}`);
    }

    this.sessions.delete(sessionId);
    
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    this.emit('session-removed', session);
  }

  clearCompletedSessions(): void {
    const completedSessions = this.getSessionsByStatus('completed');
    const failedSessions = this.getSessionsByStatus('failed');
    const cancelledSessions = this.getSessionsByStatus('cancelled');

    [...completedSessions, ...failedSessions, ...cancelledSessions].forEach(session => {
      this.sessions.delete(session.id);
    });

    this.emit('sessions-cleared', {
      completed: completedSessions.length,
      failed: failedSessions.length,
      cancelled: cancelledSessions.length
    });
  }

  // Utility methods for progress calculation
  static createFirmwareUpdateStages(): ProgressStage[] {
    return [
      {
        id: 'preparation',
        name: 'Preparation',
        description: 'Preparing device and validating prerequisites',
        weight: 10,
        estimatedDuration: 5000,
        critical: true,
        skippable: false,
        retryable: true,
        maxRetries: 3
      },
      {
        id: 'download',
        name: 'Download',
        description: 'Downloading firmware from repository',
        weight: 30,
        estimatedDuration: 60000,
        critical: true,
        skippable: false,
        retryable: true,
        maxRetries: 5
      },
      {
        id: 'validation',
        name: 'Validation',
        description: 'Validating firmware integrity and compatibility',
        weight: 5,
        estimatedDuration: 10000,
        critical: true,
        skippable: false,
        retryable: true,
        maxRetries: 2
      },
      {
        id: 'backup',
        name: 'Backup',
        description: 'Creating backup of current firmware',
        weight: 10,
        estimatedDuration: 30000,
        critical: false,
        skippable: true,
        retryable: true,
        maxRetries: 3
      },
      {
        id: 'flashing',
        name: 'Flashing',
        description: 'Installing firmware to device',
        weight: 35,
        estimatedDuration: 120000,
        critical: true,
        skippable: false,
        retryable: false,
        maxRetries: 0
      },
      {
        id: 'verification',
        name: 'Verification',
        description: 'Verifying firmware installation',
        weight: 10,
        estimatedDuration: 15000,
        critical: true,
        skippable: false,
        retryable: true,
        maxRetries: 3
      }
    ];
  }

  static formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  static formatSpeed(speed: ProgressUpdate['speed']): string {
    if (!speed) return 'N/A';

    const { value, unit } = speed;
    
    if (unit === 'bytes/s') {
      if (value >= 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)} MB/s`;
      } else if (value >= 1024) {
        return `${(value / 1024).toFixed(1)} KB/s`;
      } else {
        return `${value.toFixed(0)} B/s`;
      }
    }
    
    return `${value.toFixed(1)} ${unit}`;
  }

  static formatThroughput(throughput: ProgressUpdate['throughput']): string {
    if (!throughput) return 'N/A';

    const { processed, total, unit } = throughput;
    const percentage = total > 0 ? ((processed / total) * 100).toFixed(1) : '0.0';
    
    if (unit === 'bytes') {
      const formatBytes = (bytes: number) => {
        if (bytes >= 1024 * 1024 * 1024) {
          return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        } else if (bytes >= 1024 * 1024) {
          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        } else if (bytes >= 1024) {
          return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${bytes} B`;
      };
      
      return `${formatBytes(processed)} / ${formatBytes(total)} (${percentage}%)`;
    }
    
    return `${processed} / ${total} ${unit} (${percentage}%)`;
  }
}