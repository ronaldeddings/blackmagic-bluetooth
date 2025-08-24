import { EventEmitter } from 'events';
import { WebBluetoothAdapter } from './WebBluetoothAdapter';
import { DeviceRegistry } from './DeviceRegistry';
import { ConnectionPool } from '../performance/ConnectionPool';
import type { 
  BluetoothDevice, 
  BluetoothOperationResult, 
  ServiceDiscoveryResult,
  CameraCommand,
  ConnectionResult,
  BroadcastResult,
  DeviceConnectionState
} from '../../types';

export interface MultiDeviceConfig {
  maxConnections: number;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface CameraConnection {
  deviceId: string;
  device: BluetoothDevice;
  adapter: WebBluetoothAdapter;
  services: ServiceDiscoveryResult[];
  connectionState: DeviceConnectionState;
  lastActivity: Date;
  isConnected: () => boolean;
  sendCommand: (command: CameraCommand) => Promise<any>;
  disconnect: () => Promise<void>;
}

export class MultiDeviceConnectionManager extends EventEmitter {
  private connections: Map<string, CameraConnection> = new Map();
  private connectionPool: ConnectionPool;
  private deviceRegistry: DeviceRegistry;
  private config: MultiDeviceConfig;

  constructor(config?: Partial<MultiDeviceConfig>) {
    super();
    
    this.config = {
      maxConnections: 8,
      connectionTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
    
    this.connectionPool = new ConnectionPool({
      maxConnections: this.config.maxConnections,
      connectionTimeout: this.config.connectionTimeout,
      retryAttempts: this.config.retryAttempts,
      retryDelay: this.config.retryDelay
    });
    
    this.deviceRegistry = new DeviceRegistry();
    
    // Set up cleanup interval
    setInterval(() => this.cleanupInactiveConnections(), 60000);
  }

  async connectToMultipleDevices(devices: BluetoothDevice[]): Promise<ConnectionResult[]> {
    console.log(`🔗 MultiDeviceManager: Attempting to connect to ${devices.length} devices`);
    
    if (devices.length > this.config.maxConnections) {
      throw new Error(`Cannot connect to more than ${this.config.maxConnections} devices`);
    }

    const connectionPromises = devices.map(device => 
      this.establishOptimalConnection(device).catch(error => ({
        device,
        success: false,
        connection: null,
        error: error.message || 'Connection failed'
      }))
    );
    
    const results = await Promise.all(connectionPromises);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`🔗 MultiDeviceManager: Connected to ${successful.length}/${devices.length} devices`);
    
    if (failed.length > 0) {
      console.warn('🟠 Failed connections:', failed.map(f => f.error));
    }
    
    this.emit('multi-connection-complete', {
      total: devices.length,
      successful: successful.length,
      failed: failed.length,
      results
    });
    
    return results as ConnectionResult[];
  }

  private async establishOptimalConnection(device: BluetoothDevice): Promise<ConnectionResult> {
    try {
      console.log(`🔗 Establishing connection to device: ${device.name || device.id}`);
      
      // Create new adapter for this device
      const adapter = new WebBluetoothAdapter();
      adapter.setDevice(device);
      
      // Attempt connection with optimization
      const connectResult = await adapter.connect(device);
      if (!connectResult.success) {
        throw new Error(connectResult.error || 'Connection failed');
      }

      // Discover services
      const servicesResult = await adapter.discoverServices();
      if (!servicesResult.success || !servicesResult.data) {
        throw new Error(servicesResult.error || 'Service discovery failed');
      }

      // Create connection object
      const connection: CameraConnection = {
        deviceId: device.id,
        device,
        adapter,
        services: servicesResult.data,
        connectionState: {
          connected: true,
          connecting: false,
          device,
          services: [], // Will be populated
          characteristics: new Map(),
          error: null
        },
        lastActivity: new Date(),
        isConnected: () => connection.connectionState.connected,
        sendCommand: async (command: CameraCommand) => {
          connection.lastActivity = new Date();
          return this.sendCommandToDevice(connection, command);
        },
        disconnect: async () => {
          await adapter.disconnect();
          connection.connectionState.connected = false;
          this.connections.delete(device.id);
          this.emit('device-disconnected', { deviceId: device.id, device });
        }
      };

      // Store connection
      this.connections.set(device.id, connection);
      
      // Register device
      await this.deviceRegistry.registerDevice(device, {
        capabilities: this.extractCapabilities(servicesResult.data),
        lastConnected: new Date(),
        connectionCount: await this.deviceRegistry.getConnectionCount(device.id) + 1
      });

      console.log(`✅ Successfully connected to device: ${device.name || device.id}`);
      this.emit('device-connected', { deviceId: device.id, device, connection });

      return {
        device,
        success: true,
        connection,
        error: null
      };
      
    } catch (error) {
      console.error(`❌ Failed to connect to device ${device.name || device.id}:`, error);
      return {
        device,
        success: false,
        connection: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async broadcastCommand(command: CameraCommand, deviceIds?: string[]): Promise<BroadcastResult> {
    const targetConnections = deviceIds 
      ? Array.from(this.connections.values()).filter(conn => deviceIds.includes(conn.deviceId))
      : Array.from(this.connections.values()).filter(conn => conn.isConnected());

    console.log(`📡 Broadcasting command to ${targetConnections.length} devices:`, command.commandId);

    const commandPromises = targetConnections.map(conn => 
      conn.sendCommand(command).then(result => ({
        deviceId: conn.deviceId,
        success: true,
        result
      })).catch(error => ({
        deviceId: conn.deviceId,
        success: false,
        error: error.message || 'Command failed'
      }))
    );
    
    const results = await Promise.all(commandPromises);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`📡 Broadcast complete: ${successful}/${targetConnections.length} successful`);

    return {
      totalDevices: targetConnections.length,
      successful,
      failed,
      results
    };
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    const connection = this.connections.get(deviceId);
    if (!connection) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    await connection.disconnect();
    console.log(`🔌 Disconnected device: ${deviceId}`);
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.values()).map(conn => 
      conn.disconnect().catch(error => 
        console.warn(`Failed to disconnect ${conn.deviceId}:`, error)
      )
    );

    await Promise.all(disconnectPromises);
    this.connections.clear();
    
    console.log('🔌 Disconnected all devices');
    this.emit('all-devices-disconnected');
  }

  getConnectedDevices(): CameraConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.isConnected());
  }

  getConnection(deviceId: string): CameraConnection | undefined {
    return this.connections.get(deviceId);
  }

  getConnectionCount(): number {
    return this.getConnectedDevices().length;
  }

  async getDeviceCapabilities(deviceId: string): Promise<any> {
    const connection = this.connections.get(deviceId);
    if (!connection) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    return this.extractCapabilities(connection.services);
  }

  private async sendCommandToDevice(connection: CameraConnection, command: CameraCommand): Promise<any> {
    // This will be implemented with the advanced protocol handler
    // For now, return a mock response
    console.log(`📤 Sending command ${command.commandId} to device ${connection.deviceId}`);
    
    // Simulate command processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      commandId: command.commandId,
      deviceId: connection.deviceId,
      response: 'Command processed successfully'
    };
  }

  private extractCapabilities(services: ServiceDiscoveryResult[]): any {
    // Extract device capabilities from discovered services
    return {
      supportedServices: services.map(s => s.serviceUuid),
      totalCharacteristics: services.reduce((total, s) => total + s.characteristics.length, 0),
      hasViewfinderStream: services.some(s => s.serviceName.includes('Viewfinder')),
      hasCameraControl: services.some(s => s.serviceName.includes('Camera')),
      hasFirmwareUpdate: services.some(s => s.serviceName.includes('Firmware'))
    };
  }

  private cleanupInactiveConnections(): void {
    const now = new Date();
    const maxInactivity = 5 * 60 * 1000; // 5 minutes

    for (const [deviceId, connection] of this.connections.entries()) {
      if (now.getTime() - connection.lastActivity.getTime() > maxInactivity) {
        if (!connection.isConnected()) {
          console.log(`🧹 Cleaning up inactive connection: ${deviceId}`);
          this.connections.delete(deviceId);
          this.emit('connection-cleaned-up', { deviceId });
        }
      }
    }
  }

  // Health monitoring
  async performHealthCheck(): Promise<{
    totalConnections: number;
    activeConnections: number;
    failedConnections: string[];
    averageLatency: number;
  }> {
    const connections = Array.from(this.connections.values());
    const activeConnections = connections.filter(conn => conn.isConnected());
    const failedConnections: string[] = [];

    // Test each connection
    const latencies: number[] = [];
    
    for (const connection of activeConnections) {
      try {
        const startTime = Date.now();
        // Send a simple ping command
        await connection.sendCommand({
          commandId: 'PING' as any,
          parameters: {},
          priority: 'NORMAL' as any
        });
        latencies.push(Date.now() - startTime);
      } catch (error) {
        failedConnections.push(connection.deviceId);
      }
    }

    const averageLatency = latencies.length > 0 
      ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length 
      : 0;

    return {
      totalConnections: connections.length,
      activeConnections: activeConnections.length,
      failedConnections,
      averageLatency
    };
  }
}

export default MultiDeviceConnectionManager;