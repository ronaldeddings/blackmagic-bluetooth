import { STORAGE_KEYS } from '@/utils/constants';
import type { 
  BluetoothDevice, 
  ServiceDiscoveryResult, 
  SecurityAssessment,
  FirmwareAnalysis,
  AudioConfiguration 
} from '@/types';

interface StoredDevice {
  id: string;
  name: string;
  lastConnected: string;
  services: ServiceDiscoveryResult[];
}

interface ConnectionHistoryEntry {
  deviceId: string;
  deviceName: string;
  connectedAt: string;
  disconnectedAt?: string;
  serviceCount: number;
  success: boolean;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  autoConnect: boolean;
  enableNotifications: boolean;
  defaultAudioConfig: AudioConfiguration;
  exportFormat: 'json' | 'csv' | 'both';
}

interface AnalysisResultsCache {
  deviceId: string;
  timestamp: string;
  securityAssessment: SecurityAssessment;
  firmwareAnalysis: FirmwareAnalysis;
  services: ServiceDiscoveryResult[];
}

export class LocalStorageService {
  private static instance: LocalStorageService;

  private constructor() {}

  static getInstance(): LocalStorageService {
    if (!LocalStorageService.instance) {
      LocalStorageService.instance = new LocalStorageService();
    }
    return LocalStorageService.instance;
  }

  // Device Management
  async saveDevice(device: BluetoothDevice, services: ServiceDiscoveryResult[]): Promise<void> {
    try {
      const storedDevice: StoredDevice = {
        id: device.id,
        name: device.name || 'Unknown Device',
        lastConnected: new Date().toISOString(),
        services
      };

      await this.setItem(STORAGE_KEYS.lastDevice, storedDevice);
      
      // Add to connection history
      const historyEntry: ConnectionHistoryEntry = {
        deviceId: device.id,
        deviceName: device.name || 'Unknown Device',
        connectedAt: new Date().toISOString(),
        serviceCount: services.length,
        success: true
      };
      
      await this.addToConnectionHistory(historyEntry);
      
    } catch (error) {
      console.error('Failed to save device:', error);
    }
  }

  async getLastDevice(): Promise<StoredDevice | null> {
    try {
      return await this.getItem<StoredDevice>(STORAGE_KEYS.lastDevice);
    } catch (error) {
      console.error('Failed to get last device:', error);
      return null;
    }
  }

  async clearLastDevice(): Promise<void> {
    try {
      await this.removeItem(STORAGE_KEYS.lastDevice);
    } catch (error) {
      console.error('Failed to clear last device:', error);
    }
  }

  // Connection History
  async getConnectionHistory(): Promise<ConnectionHistoryEntry[]> {
    try {
      const history = await this.getItem<ConnectionHistoryEntry[]>(STORAGE_KEYS.connectionHistory);
      return history || [];
    } catch (error) {
      console.error('Failed to get connection history:', error);
      return [];
    }
  }

  private async addToConnectionHistory(entry: ConnectionHistoryEntry): Promise<void> {
    try {
      const history = await this.getConnectionHistory();
      history.unshift(entry); // Add to beginning
      
      // Keep only last 50 entries
      if (history.length > 50) {
        history.splice(50);
      }
      
      await this.setItem(STORAGE_KEYS.connectionHistory, history);
    } catch (error) {
      console.error('Failed to add to connection history:', error);
    }
  }

  async clearConnectionHistory(): Promise<void> {
    try {
      await this.removeItem(STORAGE_KEYS.connectionHistory);
    } catch (error) {
      console.error('Failed to clear connection history:', error);
    }
  }

  // User Preferences
  async getUserPreferences(): Promise<UserPreferences> {
    try {
      const preferences = await this.getItem<UserPreferences>(STORAGE_KEYS.userPreferences);
      return preferences || this.getDefaultPreferences();
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  async saveUserPreferences(preferences: Partial<UserPreferences>): Promise<void> {
    try {
      const current = await this.getUserPreferences();
      const updated = { ...current, ...preferences };
      await this.setItem(STORAGE_KEYS.userPreferences, updated);
    } catch (error) {
      console.error('Failed to save user preferences:', error);
    }
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      theme: 'auto',
      autoConnect: false,
      enableNotifications: true,
      defaultAudioConfig: {
        source: 'microphone',
        sink: 'speakers',
        quality: 'medium',
        routing: 'stereo'
      },
      exportFormat: 'json'
    };
  }

  // Analysis Results Cache
  async saveAnalysisResults(
    deviceId: string,
    securityAssessment: SecurityAssessment,
    firmwareAnalysis: FirmwareAnalysis,
    services: ServiceDiscoveryResult[]
  ): Promise<void> {
    try {
      const cache: AnalysisResultsCache = {
        deviceId,
        timestamp: new Date().toISOString(),
        securityAssessment,
        firmwareAnalysis,
        services
      };

      const cacheKey = `${STORAGE_KEYS.analysisResults}_${deviceId}`;
      await this.setItem(cacheKey, cache);
      
    } catch (error) {
      console.error('Failed to save analysis results:', error);
    }
  }

  async getAnalysisResults(deviceId: string): Promise<AnalysisResultsCache | null> {
    try {
      const cacheKey = `${STORAGE_KEYS.analysisResults}_${deviceId}`;
      return await this.getItem<AnalysisResultsCache>(cacheKey);
    } catch (error) {
      console.error('Failed to get analysis results:', error);
      return null;
    }
  }

  async clearAnalysisResults(deviceId?: string): Promise<void> {
    try {
      if (deviceId) {
        const cacheKey = `${STORAGE_KEYS.analysisResults}_${deviceId}`;
        await this.removeItem(cacheKey);
      } else {
        // Clear all analysis results
        const keys = this.getAllKeys();
        const analysisKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.analysisResults));
        
        for (const key of analysisKeys) {
          await this.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Failed to clear analysis results:', error);
    }
  }

  // Theme Management
  async getTheme(): Promise<string> {
    try {
      const theme = await this.getItem<string>(STORAGE_KEYS.theme);
      return theme || 'auto';
    } catch (error) {
      console.error('Failed to get theme:', error);
      return 'auto';
    }
  }

  async saveTheme(theme: string): Promise<void> {
    try {
      await this.setItem(STORAGE_KEYS.theme, theme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  }

  // Export Functionality
  async exportAllData(): Promise<{
    devices: StoredDevice[];
    connectionHistory: ConnectionHistoryEntry[];
    preferences: UserPreferences;
    analysisResults: Record<string, AnalysisResultsCache>;
  }> {
    try {
      const [
        lastDevice,
        connectionHistory,
        preferences
      ] = await Promise.all([
        this.getLastDevice(),
        this.getConnectionHistory(),
        this.getUserPreferences()
      ]);

      // Get all analysis results
      const keys = this.getAllKeys();
      const analysisKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.analysisResults));
      const analysisResults: Record<string, AnalysisResultsCache> = {};
      
      for (const key of analysisKeys) {
        const result = await this.getItem<AnalysisResultsCache>(key);
        if (result) {
          const deviceId = key.replace(`${STORAGE_KEYS.analysisResults}_`, '');
          analysisResults[deviceId] = result;
        }
      }

      return {
        devices: lastDevice ? [lastDevice] : [],
        connectionHistory,
        preferences,
        analysisResults
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw new Error('Export failed');
    }
  }

  async importData(data: {
    devices?: StoredDevice[];
    connectionHistory?: ConnectionHistoryEntry[];
    preferences?: UserPreferences;
    analysisResults?: Record<string, AnalysisResultsCache>;
  }): Promise<void> {
    try {
      if (data.devices && data.devices.length > 0) {
        await this.setItem(STORAGE_KEYS.lastDevice, data.devices[0]);
      }

      if (data.connectionHistory) {
        await this.setItem(STORAGE_KEYS.connectionHistory, data.connectionHistory);
      }

      if (data.preferences) {
        await this.setItem(STORAGE_KEYS.userPreferences, data.preferences);
      }

      if (data.analysisResults) {
        for (const [deviceId, results] of Object.entries(data.analysisResults)) {
          const cacheKey = `${STORAGE_KEYS.analysisResults}_${deviceId}`;
          await this.setItem(cacheKey, results);
        }
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Import failed');
    }
  }

  // Storage Statistics
  async getStorageStats(): Promise<{
    totalSize: number;
    itemCount: number;
    breakdown: Record<string, number>;
  }> {
    try {
      const keys = this.getAllKeys();
      let totalSize = 0;
      const breakdown: Record<string, number> = {};

      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value) {
          const size = new Blob([value]).size;
          totalSize += size;
          breakdown[key] = size;
        }
      }

      return {
        totalSize,
        itemCount: keys.length,
        breakdown
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        totalSize: 0,
        itemCount: 0,
        breakdown: {}
      };
    }
  }

  // Clear All Data
  async clearAllData(): Promise<void> {
    try {
      const keys = this.getAllKeys();
      const appKeys = keys.filter(key => key.startsWith('bmi_'));
      
      for (const key of appKeys) {
        await this.removeItem(key);
      }
    } catch (error) {
      console.error('Failed to clear all data:', error);
    }
  }

  // Private helper methods
  private async getItem<T>(key: string): Promise<T | null> {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Failed to get item ${key}:`, error);
      return null;
    }
  }

  private async setItem(key: string, value: any): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to set item ${key}:`, error);
      throw error;
    }
  }

  private async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove item ${key}:`, error);
    }
  }

  private getAllKeys(): string[] {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          keys.push(key);
        }
      }
      return keys;
    } catch (error) {
      console.error('Failed to get all keys:', error);
      return [];
    }
  }
}