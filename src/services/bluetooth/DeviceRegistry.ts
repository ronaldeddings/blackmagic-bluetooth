import { LocalStorageService } from '../storage/LocalStorageService';
import type { BluetoothDevice } from '../../types';

export interface DeviceInfo {
  id: string;
  name?: string;
  alias?: string;
  model?: string;
  lastConnected: Date;
  connectionCount: number;
  capabilities?: DeviceCapabilities;
  preferences?: DevicePreferences;
  metadata?: Record<string, any>;
}

export interface DeviceCapabilities {
  supportedServices: string[];
  totalCharacteristics: number;
  hasViewfinderStream: boolean;
  hasCameraControl: boolean;
  hasFirmwareUpdate: boolean;
  maxResolution?: { width: number; height: number };
  supportedCodecs?: string[];
  batteryCapable?: boolean;
}

export interface DevicePreferences {
  autoConnect?: boolean;
  preferredQuality?: 'low' | 'medium' | 'high' | 'ultra';
  notifications?: boolean;
  streamSettings?: {
    resolution: { width: number; height: number };
    frameRate: number;
    quality: string;
  };
}

export class DeviceRegistry {
  private storage: LocalStorageService;
  private devices: Map<string, DeviceInfo> = new Map();
  private readonly STORAGE_KEY = 'blackmagic-device-registry';

  constructor() {
    this.storage = LocalStorageService.getInstance();
    this.loadDevices();
  }

  async registerDevice(
    device: BluetoothDevice, 
    info: Partial<DeviceInfo>
  ): Promise<DeviceInfo> {
    const deviceInfo: DeviceInfo = {
      id: device.id,
      name: device.name || 'Unknown Device',
      lastConnected: new Date(),
      connectionCount: 1,
      ...info
    };

    const existingDevice = this.devices.get(device.id);
    if (existingDevice) {
      // Update existing device
      deviceInfo.connectionCount = existingDevice.connectionCount + 1;
      deviceInfo.alias = existingDevice.alias; // Preserve user alias
      deviceInfo.preferences = { ...existingDevice.preferences, ...info.preferences };
    }

    this.devices.set(device.id, deviceInfo);
    await this.saveDevices();

    console.log(`📝 Registered device: ${deviceInfo.name} (${device.id})`);
    return deviceInfo;
  }

  async updateDevice(deviceId: string, updates: Partial<DeviceInfo>): Promise<DeviceInfo> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const updatedDevice = { ...device, ...updates };
    this.devices.set(deviceId, updatedDevice);
    await this.saveDevices();

    return updatedDevice;
  }

  async setDeviceAlias(deviceId: string, alias: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    device.alias = alias;
    this.devices.set(deviceId, device);
    await this.saveDevices();

    console.log(`📝 Set alias for device ${deviceId}: ${alias}`);
  }

  async setDevicePreferences(
    deviceId: string, 
    preferences: Partial<DevicePreferences>
  ): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    device.preferences = { ...device.preferences, ...preferences };
    this.devices.set(deviceId, device);
    await this.saveDevices();

    console.log(`⚙️ Updated preferences for device ${deviceId}`);
  }

  getDevice(deviceId: string): DeviceInfo | undefined {
    return this.devices.get(deviceId);
  }

  getAllDevices(): DeviceInfo[] {
    return Array.from(this.devices.values()).sort((a, b) => 
      b.lastConnected.getTime() - a.lastConnected.getTime()
    );
  }

  getRecentDevices(limit: number = 10): DeviceInfo[] {
    return this.getAllDevices().slice(0, limit);
  }

  getFavoriteDevices(): DeviceInfo[] {
    return this.getAllDevices().filter(device => 
      device.preferences?.autoConnect === true
    );
  }

  async getConnectionCount(deviceId: string): Promise<number> {
    const device = this.devices.get(deviceId);
    return device?.connectionCount || 0;
  }

  async removeDevice(deviceId: string): Promise<void> {
    this.devices.delete(deviceId);
    await this.saveDevices();
    console.log(`🗑️ Removed device: ${deviceId}`);
  }

  async clearRegistry(): Promise<void> {
    this.devices.clear();
    await this.saveDevices();
    console.log('🗑️ Cleared device registry');
  }

  // Search and filtering
  searchDevices(query: string): DeviceInfo[] {
    const lowercaseQuery = query.toLowerCase();
    return this.getAllDevices().filter(device => 
      device.name?.toLowerCase().includes(lowercaseQuery) ||
      device.alias?.toLowerCase().includes(lowercaseQuery) ||
      device.model?.toLowerCase().includes(lowercaseQuery) ||
      device.id.toLowerCase().includes(lowercaseQuery)
    );
  }

  filterByCapability(capability: keyof DeviceCapabilities): DeviceInfo[] {
    return this.getAllDevices().filter(device => 
      device.capabilities?.[capability] === true
    );
  }

  getDevicesByModel(model: string): DeviceInfo[] {
    return this.getAllDevices().filter(device => 
      device.model === model
    );
  }

  // Statistics and analytics
  getRegistryStats(): {
    totalDevices: number;
    recentlyConnected: number; // within last 7 days
    favoriteDevices: number;
    averageConnections: number;
    topModels: { model: string; count: number }[];
  } {
    const devices = this.getAllDevices();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const recentlyConnected = devices.filter(device => 
      device.lastConnected > weekAgo
    ).length;

    const favoriteDevices = devices.filter(device => 
      device.preferences?.autoConnect === true
    ).length;

    const totalConnections = devices.reduce((sum, device) => 
      sum + device.connectionCount, 0
    );
    const averageConnections = devices.length > 0 ? totalConnections / devices.length : 0;

    // Count devices by model
    const modelCounts = new Map<string, number>();
    devices.forEach(device => {
      if (device.model) {
        const count = modelCounts.get(device.model) || 0;
        modelCounts.set(device.model, count + 1);
      }
    });

    const topModels = Array.from(modelCounts.entries())
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalDevices: devices.length,
      recentlyConnected,
      favoriteDevices,
      averageConnections: Math.round(averageConnections * 100) / 100,
      topModels
    };
  }

  // Export/Import functionality
  async exportRegistry(): Promise<string> {
    const data = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      devices: Array.from(this.devices.entries()).map(([id, device]) => ({
        ...device,
        lastConnected: device.lastConnected.toISOString()
      }))
    };

    return JSON.stringify(data, null, 2);
  }

  async importRegistry(jsonData: string, mergeMode: boolean = true): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.version || !data.devices || !Array.isArray(data.devices)) {
        throw new Error('Invalid registry data format');
      }

      if (!mergeMode) {
        this.devices.clear();
      }

      for (const deviceData of data.devices) {
        const device: DeviceInfo = {
          ...deviceData,
          lastConnected: new Date(deviceData.lastConnected)
        };
        this.devices.set(device.id, device);
      }

      await this.saveDevices();
      console.log(`📥 Imported ${data.devices.length} devices`);
      
    } catch (error) {
      console.error('Failed to import registry:', error);
      throw new Error('Failed to import registry data');
    }
  }

  private async loadDevices(): Promise<void> {
    try {
      const data = await this.storage.getItem<Record<string, any>>(this.STORAGE_KEY);
      if (data) {
        for (const [id, deviceData] of Object.entries(data)) {
          this.devices.set(id, {
            ...deviceData,
            lastConnected: new Date(deviceData.lastConnected)
          } as DeviceInfo);
        }
        console.log(`📥 Loaded ${this.devices.size} devices from storage`);
      }
    } catch (error) {
      console.warn('Failed to load device registry:', error);
    }
  }

  private async saveDevices(): Promise<void> {
    try {
      const data: Record<string, any> = {};
      for (const [id, device] of this.devices.entries()) {
        data[id] = {
          ...device,
          lastConnected: device.lastConnected.toISOString()
        };
      }
      
      await this.storage.setItem(this.STORAGE_KEY, data);
    } catch (error) {
      console.error('Failed to save device registry:', error);
    }
  }

  // Device groups and organization
  async createDeviceGroup(name: string, deviceIds: string[]): Promise<string> {
    const groupId = `group_${Date.now()}`;
    const groupData = {
      id: groupId,
      name,
      deviceIds,
      createdAt: new Date().toISOString()
    };

    await this.storage.setItem(`device-group-${groupId}`, groupData);
    console.log(`👥 Created device group: ${name} with ${deviceIds.length} devices`);
    
    return groupId;
  }

  async getDeviceGroups(): Promise<Array<{
    id: string;
    name: string;
    deviceIds: string[];
    devices: DeviceInfo[];
    createdAt: string;
  }>> {
    const groups: any[] = [];
    const keys = await this.storage.getKeys();
    
    for (const key of keys) {
      if (key.startsWith('device-group-')) {
        try {
          const groupData = await this.storage.getItem(key);
          if (groupData) {
            const devices = groupData.deviceIds
              .map((id: string) => this.devices.get(id))
              .filter((device: DeviceInfo | undefined) => device !== undefined);
            
            groups.push({
              ...groupData,
              devices
            });
          }
        } catch (error) {
          console.warn(`Failed to load device group ${key}:`, error);
        }
      }
    }

    return groups.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export default DeviceRegistry;