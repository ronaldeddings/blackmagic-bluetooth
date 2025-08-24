import { EventEmitter } from 'events';

export interface FirmwareInfo {
  version: string;
  buildNumber: string;
  releaseDate: Date;
  model: string;
  size: number;
  checksum: string;
  url?: string;
  localPath?: string;
  changelog: string[];
  isStable: boolean;
  requiredBootloader?: string;
  compatibility: {
    minBootloaderVersion: string;
    supportedModels: string[];
    deprecatedFeatures: string[];
    newFeatures: string[];
  };
}

export interface UpdateProgress {
  stage: 'preparing' | 'downloading' | 'validating' | 'flashing' | 'verifying' | 'completing';
  progress: number; // 0-100
  speed?: number; // bytes per second
  eta?: number; // seconds remaining
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  error?: string;
  warnings: string[];
}

export interface UpdateSession {
  id: string;
  deviceId: string;
  deviceModel: string;
  currentFirmware: string;
  targetFirmware: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: UpdateProgress;
  backupPath?: string;
  rollbackAvailable: boolean;
}

export interface FirmwareRepository {
  id: string;
  name: string;
  url: string;
  type: 'official' | 'beta' | 'custom';
  enabled: boolean;
  lastSync: Date;
  authRequired: boolean;
}

export class FirmwareUpdateService extends EventEmitter {
  private updateSessions: Map<string, UpdateSession> = new Map();
  private repositories: Map<string, FirmwareRepository> = new Map();
  private availableFirmware: Map<string, FirmwareInfo[]> = new Map();
  private updateQueue: string[] = [];
  private maxConcurrentUpdates = 2;
  private activeUpdates = 0;

  constructor() {
    super();
    this.initializeDefaultRepositories();
  }

  private initializeDefaultRepositories(): void {
    const officialRepo: FirmwareRepository = {
      id: 'blackmagic-official',
      name: 'Blackmagic Design Official',
      url: 'https://api.blackmagicdesign.com/firmware',
      type: 'official',
      enabled: true,
      lastSync: new Date(0),
      authRequired: false
    };

    const betaRepo: FirmwareRepository = {
      id: 'blackmagic-beta',
      name: 'Blackmagic Design Beta',
      url: 'https://beta.blackmagicdesign.com/firmware',
      type: 'beta',
      enabled: false,
      authRequired: true
    };

    this.repositories.set(officialRepo.id, officialRepo);
    this.repositories.set(betaRepo.id, betaRepo);
  }

  async checkForUpdates(deviceId: string, currentVersion: string, model: string): Promise<FirmwareInfo[]> {
    try {
      // Sync repositories if needed
      await this.syncRepositories();

      // Get available firmware for device model
      const modelFirmware = this.availableFirmware.get(model) || [];
      
      // Filter newer versions
      const updates = modelFirmware.filter(fw => this.isNewerVersion(fw.version, currentVersion));
      
      // Sort by version (newest first)
      updates.sort((a, b) => this.compareVersions(b.version, a.version));

      this.emit('updates-checked', { deviceId, currentVersion, availableUpdates: updates });
      
      return updates;
    } catch (error) {
      this.emit('update-check-failed', { deviceId, error: error.message });
      throw error;
    }
  }

  async downloadFirmware(firmwareInfo: FirmwareInfo, onProgress?: (progress: number) => void): Promise<string> {
    if (firmwareInfo.localPath && await this.verifyFile(firmwareInfo.localPath, firmwareInfo.checksum)) {
      return firmwareInfo.localPath;
    }

    if (!firmwareInfo.url) {
      throw new Error('No download URL available for firmware');
    }

    try {
      const localPath = await this.downloadFile(firmwareInfo.url, onProgress);
      
      // Verify downloaded file
      const isValid = await this.verifyFile(localPath, firmwareInfo.checksum);
      if (!isValid) {
        throw new Error('Downloaded firmware file is corrupted');
      }

      // Update firmware info with local path
      firmwareInfo.localPath = localPath;
      
      return localPath;
    } catch (error) {
      this.emit('download-failed', { firmware: firmwareInfo, error: error.message });
      throw error;
    }
  }

  async startUpdate(
    deviceId: string,
    firmwareInfo: FirmwareInfo,
    options: {
      createBackup?: boolean;
      skipValidation?: boolean;
      forceUpdate?: boolean;
    } = {}
  ): Promise<string> {
    // Create update session
    const sessionId = `update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: UpdateSession = {
      id: sessionId,
      deviceId,
      deviceModel: firmwareInfo.model,
      currentFirmware: 'unknown', // Would be determined from device
      targetFirmware: firmwareInfo.version,
      startTime: new Date(),
      status: 'pending',
      progress: {
        stage: 'preparing',
        progress: 0,
        currentStep: 'Initializing update',
        totalSteps: 6,
        completedSteps: 0,
        warnings: []
      },
      rollbackAvailable: false
    };

    this.updateSessions.set(sessionId, session);

    // Add to queue or start immediately
    if (this.activeUpdates < this.maxConcurrentUpdates) {
      this.executeUpdate(session, firmwareInfo, options);
    } else {
      this.updateQueue.push(sessionId);
    }

    this.emit('update-started', session);
    return sessionId;
  }

  private async executeUpdate(
    session: UpdateSession,
    firmwareInfo: FirmwareInfo,
    options: {
      createBackup?: boolean;
      skipValidation?: boolean;
      forceUpdate?: boolean;
    }
  ): Promise<void> {
    this.activeUpdates++;
    session.status = 'running';

    try {
      // Stage 1: Prepare device
      await this.updateProgress(session, {
        stage: 'preparing',
        progress: 10,
        currentStep: 'Preparing device for update',
        completedSteps: 1
      });

      // Check device compatibility
      if (!options.skipValidation) {
        await this.validateDeviceCompatibility(session.deviceId, firmwareInfo);
      }

      // Create backup if requested
      if (options.createBackup) {
        session.backupPath = await this.createFirmwareBackup(session.deviceId);
        session.rollbackAvailable = true;
      }

      // Stage 2: Download firmware
      await this.updateProgress(session, {
        stage: 'downloading',
        progress: 20,
        currentStep: 'Downloading firmware',
        completedSteps: 2
      });

      const firmwarePath = await this.downloadFirmware(firmwareInfo, (downloadProgress) => {
        this.updateProgress(session, {
          stage: 'downloading',
          progress: 20 + (downloadProgress * 0.3), // 20-50%
          currentStep: `Downloading firmware: ${Math.round(downloadProgress)}%`,
          completedSteps: 2
        });
      });

      // Stage 3: Validate firmware
      await this.updateProgress(session, {
        stage: 'validating',
        progress: 50,
        currentStep: 'Validating firmware',
        completedSteps: 3
      });

      if (!options.skipValidation) {
        const isValid = await this.verifyFile(firmwarePath, firmwareInfo.checksum);
        if (!isValid) {
          throw new Error('Firmware validation failed');
        }
      }

      // Stage 4: Flash firmware
      await this.updateProgress(session, {
        stage: 'flashing',
        progress: 60,
        currentStep: 'Flashing firmware to device',
        completedSteps: 4
      });

      await this.flashFirmware(session.deviceId, firmwarePath, (flashProgress) => {
        this.updateProgress(session, {
          stage: 'flashing',
          progress: 60 + (flashProgress * 0.25), // 60-85%
          currentStep: `Flashing firmware: ${Math.round(flashProgress)}%`,
          completedSteps: 4
        });
      });

      // Stage 5: Verify update
      await this.updateProgress(session, {
        stage: 'verifying',
        progress: 85,
        currentStep: 'Verifying firmware update',
        completedSteps: 5
      });

      const verificationResult = await this.verifyFirmwareUpdate(session.deviceId, firmwareInfo.version);
      if (!verificationResult.success) {
        throw new Error(`Firmware verification failed: ${verificationResult.error}`);
      }

      // Stage 6: Complete
      await this.updateProgress(session, {
        stage: 'completing',
        progress: 100,
        currentStep: 'Update completed successfully',
        completedSteps: 6
      });

      session.status = 'completed';
      session.endTime = new Date();

      this.emit('update-completed', session);

    } catch (error) {
      session.status = 'failed';
      session.endTime = new Date();
      session.progress.error = error.message;

      this.emit('update-failed', { session, error });

      // Attempt rollback if backup is available
      if (session.rollbackAvailable && session.backupPath) {
        try {
          await this.rollbackFirmware(session.deviceId, session.backupPath);
          this.emit('rollback-completed', session);
        } catch (rollbackError) {
          this.emit('rollback-failed', { session, error: rollbackError });
        }
      }
    } finally {
      this.activeUpdates--;
      this.processQueue();
    }
  }

  private async updateProgress(session: UpdateSession, updates: Partial<UpdateProgress>): Promise<void> {
    session.progress = { ...session.progress, ...updates };
    this.emit('update-progress', session);
  }

  private async validateDeviceCompatibility(deviceId: string, firmwareInfo: FirmwareInfo): Promise<void> {
    // In a real implementation, this would:
    // 1. Get device info via Bluetooth
    // 2. Check model compatibility
    // 3. Verify bootloader version
    // 4. Check for any blocking conditions

    // Simulate validation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Example validation logic
    const deviceInfo = await this.getDeviceInfo(deviceId);
    
    if (!firmwareInfo.compatibility.supportedModels.includes(deviceInfo.model)) {
      throw new Error(`Firmware not compatible with device model ${deviceInfo.model}`);
    }

    if (this.compareVersions(deviceInfo.bootloaderVersion, firmwareInfo.compatibility.minBootloaderVersion) < 0) {
      throw new Error(`Bootloader version ${deviceInfo.bootloaderVersion} is too old. Minimum required: ${firmwareInfo.compatibility.minBootloaderVersion}`);
    }
  }

  private async createFirmwareBackup(deviceId: string): Promise<string> {
    // In a real implementation, this would:
    // 1. Read current firmware from device
    // 2. Save to local storage
    // 3. Return backup file path

    const backupPath = `./firmware-backups/backup-${deviceId}-${Date.now()}.bin`;
    
    // Simulate backup creation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return backupPath;
  }

  private async downloadFile(url: string, onProgress?: (progress: number) => void): Promise<string> {
    // Simulate file download with progress
    const filename = `./firmware-cache/fw-${Date.now()}.bin`;
    
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(resolve => setTimeout(resolve, 100));
      onProgress?.(i);
    }

    return filename;
  }

  private async verifyFile(filePath: string, expectedChecksum: string): Promise<boolean> {
    // In a real implementation, this would calculate file checksum and compare
    // Simulate verification
    await new Promise(resolve => setTimeout(resolve, 500));
    return true; // Assume verification passes
  }

  private async flashFirmware(deviceId: string, firmwarePath: string, onProgress?: (progress: number) => void): Promise<void> {
    // In a real implementation, this would:
    // 1. Put device in bootloader mode
    // 2. Transfer firmware data via Bluetooth
    // 3. Verify each block
    // 4. Reboot device

    // Simulate flashing process
    for (let i = 0; i <= 100; i += 2) {
      await new Promise(resolve => setTimeout(resolve, 150));
      onProgress?.(i);
    }
  }

  private async verifyFirmwareUpdate(deviceId: string, expectedVersion: string): Promise<{ success: boolean; error?: string }> {
    // In a real implementation, this would:
    // 1. Reconnect to device after reboot
    // 2. Query firmware version
    // 3. Compare with expected version

    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true };
  }

  private async rollbackFirmware(deviceId: string, backupPath: string): Promise<void> {
    // In a real implementation, this would restore the backup firmware
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  private async getDeviceInfo(deviceId: string): Promise<{
    model: string;
    firmwareVersion: string;
    bootloaderVersion: string;
  }> {
    // In a real implementation, this would query the device
    return {
      model: 'URSA Mini Pro',
      firmwareVersion: '7.0.1',
      bootloaderVersion: '1.2.3'
    };
  }

  private async syncRepositories(): Promise<void> {
    const promises = Array.from(this.repositories.values())
      .filter(repo => repo.enabled)
      .map(repo => this.syncRepository(repo));

    await Promise.allSettled(promises);
  }

  private async syncRepository(repository: FirmwareRepository): Promise<void> {
    try {
      // In a real implementation, this would fetch from the repository API
      // For now, we'll simulate with some mock data

      const mockFirmware: FirmwareInfo[] = [
        {
          version: '8.0.2',
          buildNumber: '20240115.1',
          releaseDate: new Date('2024-01-15'),
          model: 'URSA Mini Pro',
          size: 52428800, // 50MB
          checksum: 'sha256:abc123...',
          url: `${repository.url}/ursa-mini-pro/8.0.2/firmware.bin`,
          changelog: [
            'Improved Bluetooth connectivity',
            'Fixed audio sync issues',
            'Enhanced color accuracy'
          ],
          isStable: true,
          compatibility: {
            minBootloaderVersion: '1.2.0',
            supportedModels: ['URSA Mini Pro', 'URSA Mini Pro G2'],
            deprecatedFeatures: [],
            newFeatures: ['New color space support', 'Improved stabilization']
          }
        },
        {
          version: '8.1.0',
          buildNumber: '20240201.1',
          releaseDate: new Date('2024-02-01'),
          model: 'URSA Mini Pro',
          size: 54525952, // 52MB
          checksum: 'sha256:def456...',
          url: `${repository.url}/ursa-mini-pro/8.1.0/firmware.bin`,
          changelog: [
            'Major performance improvements',
            'New recording formats',
            'UI/UX enhancements'
          ],
          isStable: repository.type === 'official',
          compatibility: {
            minBootloaderVersion: '1.2.0',
            supportedModels: ['URSA Mini Pro', 'URSA Mini Pro G2'],
            deprecatedFeatures: ['Legacy codec support'],
            newFeatures: ['4K 120fps recording', 'AI-powered auto focus']
          }
        }
      ];

      // Store firmware by model
      mockFirmware.forEach(fw => {
        if (!this.availableFirmware.has(fw.model)) {
          this.availableFirmware.set(fw.model, []);
        }
        this.availableFirmware.get(fw.model)!.push(fw);
      });

      repository.lastSync = new Date();
      this.emit('repository-synced', repository);

    } catch (error) {
      this.emit('repository-sync-failed', { repository, error: error.message });
    }
  }

  private processQueue(): void {
    if (this.updateQueue.length > 0 && this.activeUpdates < this.maxConcurrentUpdates) {
      const sessionId = this.updateQueue.shift();
      const session = this.updateSessions.get(sessionId!);
      
      if (session && session.status === 'pending') {
        // Find firmware info for this session
        // In a real implementation, you'd store this with the session
        // For now, we'll skip the queue processing
      }
    }
  }

  private isNewerVersion(version1: string, version2: string): boolean {
    return this.compareVersions(version1, version2) > 0;
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  async pauseUpdate(sessionId: string): Promise<void> {
    const session = this.updateSessions.get(sessionId);
    if (session && session.status === 'running') {
      session.status = 'paused';
      this.emit('update-paused', session);
    }
  }

  async resumeUpdate(sessionId: string): Promise<void> {
    const session = this.updateSessions.get(sessionId);
    if (session && session.status === 'paused') {
      session.status = 'running';
      this.emit('update-resumed', session);
      // In a real implementation, you'd resume the actual update process
    }
  }

  async cancelUpdate(sessionId: string): Promise<void> {
    const session = this.updateSessions.get(sessionId);
    if (session && ['pending', 'running', 'paused'].includes(session.status)) {
      session.status = 'cancelled';
      session.endTime = new Date();
      this.emit('update-cancelled', session);
      
      // Remove from queue if pending
      const queueIndex = this.updateQueue.indexOf(sessionId);
      if (queueIndex > -1) {
        this.updateQueue.splice(queueIndex, 1);
      }
    }
  }

  getUpdateSession(sessionId: string): UpdateSession | null {
    return this.updateSessions.get(sessionId) || null;
  }

  getActiveSessions(): UpdateSession[] {
    return Array.from(this.updateSessions.values())
      .filter(session => ['pending', 'running', 'paused'].includes(session.status));
  }

  async addRepository(repository: Omit<FirmwareRepository, 'id' | 'lastSync'>): Promise<FirmwareRepository> {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newRepo: FirmwareRepository = {
      ...repository,
      id,
      lastSync: new Date(0)
    };

    this.repositories.set(id, newRepo);
    this.emit('repository-added', newRepo);

    if (newRepo.enabled) {
      await this.syncRepository(newRepo);
    }

    return newRepo;
  }

  getRepositories(): FirmwareRepository[] {
    return Array.from(this.repositories.values());
  }

  async removeRepository(repositoryId: string): Promise<void> {
    const repository = this.repositories.get(repositoryId);
    if (repository && repository.type !== 'official') {
      this.repositories.delete(repositoryId);
      this.emit('repository-removed', repository);
    }
  }

  getAvailableFirmware(model?: string): Map<string, FirmwareInfo[]> {
    if (model) {
      const modelFirmware = this.availableFirmware.get(model);
      return modelFirmware ? new Map([[model, modelFirmware]]) : new Map();
    }
    return new Map(this.availableFirmware);
  }
}