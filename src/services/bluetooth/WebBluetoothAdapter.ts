import { WEB_BLUETOOTH_SERVICES } from './constants';
import type { 
  BluetoothOperationResult, 
  DeviceConnectionState, 
  ServiceDiscoveryResult 
} from '@/types';

export class WebBluetoothAdapter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private connectionState: DeviceConnectionState = {
    connected: false,
    connecting: false,
    device: null,
    services: [],
    characteristics: new Map(),
    error: null
  };

  private readonly retryAttempts = 3;
  private readonly retryDelay = 1000;

  constructor() {
    this.checkBrowserSupport();
  }

  /**
   * Check if Web Bluetooth is supported
   */
  private checkBrowserSupport(): void {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth is not supported in this browser. Please use Chrome/Edge with HTTPS.');
    }
  }

  /**
   * Request device with Bluetooth LE scanning
   */
  async requestDevice(): Promise<BluetoothOperationResult<BluetoothDevice>> {
    console.log('🔵 WebBluetoothAdapter: Starting device request...');
    try {
      this.connectionState.connecting = true;
      this.connectionState.error = null;
      console.log('🔵 Connection state updated: connecting =', this.connectionState.connecting);

      console.log('🔵 Requesting device with acceptAllDevices: true');
      const requestOptions = {
        acceptAllDevices: true,
        optionalServices: [
          // Standard Bluetooth services
          WEB_BLUETOOTH_SERVICES.GENERIC_ACCESS,
          WEB_BLUETOOTH_SERVICES.GENERIC_ATTRIBUTE,
          WEB_BLUETOOTH_SERVICES.DEVICE_INFORMATION,
          WEB_BLUETOOTH_SERVICES.BATTERY_SERVICE,
          WEB_BLUETOOTH_SERVICES.HID_SERVICE,
          WEB_BLUETOOTH_SERVICES.NORDIC_DFU,
          // Additional common services for broader device support
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
          '0000fe59-0000-1000-8000-00805f9b34fb', // Nordic DFU
          '00001105-0000-1000-8000-00805f9b34fb', // OBEX Object Push
          '0000110a-0000-1000-8000-00805f9b34fb', // Audio Source
          '0000110b-0000-1000-8000-00805f9b34fb', // Audio Sink
          '00001200-0000-1000-8000-00805f9b34fb', // PnP Information
          '0000fffe-0000-1000-8000-00805f9b34fb', // File Transfer Profile
          // Custom services that might be present on various devices
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
          '0000fff0-0000-1000-8000-00805f9b34fb', // Custom service UUID pattern
          '12345678-1234-5678-1234-123456789abc'  // Example custom service
        ]
      };
      console.log('🔵 Request options:', requestOptions);

      const device = await navigator.bluetooth.requestDevice(requestOptions);
      
      console.log('🔵 Device selected from browser dialog:', {
        id: device.id,
        name: device.name,
        gatt: device.gatt ? 'available' : 'not available',
        gattConnected: device.gatt?.connected
      });

      this.device = device;
      this.connectionState.device = device;
      this.setupDeviceEventListeners();
      
      console.log('🔵 Device stored in adapter:', {
        adapterDevice: this.device ? 'set' : 'null',
        connectionStateDevice: this.connectionState.device ? 'set' : 'null'
      });

      return { success: true, data: device };
    } catch (error) {
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle specific Web Bluetooth API errors
        if (error.name === 'NotFoundError') {
          errorMessage = 'No device selected. User cancelled the device selection dialog.';
        } else if (error.name === 'SecurityError') {
          errorMessage = 'Web Bluetooth access denied. Ensure you are using HTTPS.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Web Bluetooth is not supported in this browser.';
        } else if (error.name === 'InvalidStateError') {
          errorMessage = 'Bluetooth adapter is not available or turned off.';
        }
      }
      
      console.log('🔴 Error in requestDevice:', errorMessage, error);
      this.connectionState.error = errorMessage;
      return { success: false, error: errorMessage };
    } finally {
      this.connectionState.connecting = false;
      console.log('🔵 Request device completed, connecting =', this.connectionState.connecting);
    }
  }

  /**
   * Connect to the selected device
   */
  async connect(device?: BluetoothDevice): Promise<BluetoothOperationResult<void>> {
    // If a device is provided, use it and store it
    if (device) {
      console.log('🔵 WebBluetoothAdapter: Connecting with provided device:', {
        id: device.id,
        name: device.name,
        gatt: device.gatt ? 'available' : 'not available'
      });
      this.device = device;
      this.connectionState.device = device;
      this.setupDeviceEventListeners();
    }
    
    if (!this.device) {
      return { success: false, error: 'No device selected or provided' };
    }

    return this.executeWithRetry(async () => {
      this.connectionState.connecting = true;
      this.connectionState.error = null;

      if (!this.device!.gatt) {
        throw new Error('Device GATT server not available');
      }

      console.log('🔵 WebBluetoothAdapter: Connecting to GATT server...');
      
      // Set up connection timeout
      const connectionTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Connection timeout - device did not respond within 10 seconds'));
        }, 10000);
      });
      
      // Race connection against timeout
      this.server = await Promise.race([
        this.device!.gatt!.connect(),
        connectionTimeout
      ]);
      
      this.connectionState.connected = true;
      this.connectionState.connecting = false;

      console.log('🔵 WebBluetoothAdapter: Connected to device:', this.device!.name);
      return { success: true };
    });
  }

  /**
   * Disconnect from the device
   */
  async disconnect(): Promise<void> {
    if (this.server && this.server.connected) {
      this.server.disconnect();
    }
    
    this.connectionState.connected = false;
    this.connectionState.connecting = false;
    this.connectionState.services = [];
    this.connectionState.characteristics.clear();
    
    console.log('Disconnected from device');
  }

  /**
   * Discover services on the connected device
   */
  async discoverServices(): Promise<BluetoothOperationResult<ServiceDiscoveryResult[]>> {
    if (!this.server || !this.server.connected) {
      return { success: false, error: 'Not connected to device' };
    }

    try {
      const services = await this.server.getPrimaryServices();
      const discoveredServices: ServiceDiscoveryResult[] = [];
      this.connectionState.services = services;

      for (const service of services) {
        const serviceName = this.getServiceName(service.uuid);
        const characteristics = await this.discoverCharacteristics(service);
        
        discoveredServices.push({
          serviceUuid: service.uuid,
          serviceName,
          characteristics
        });
      }

      return { success: true, data: discoveredServices };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Service discovery failed';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Discover characteristics for a service
   */
  private async discoverCharacteristics(service: BluetoothRemoteGATTService) {
    try {
      const characteristics = await service.getCharacteristics();
      const result = [];

      for (const char of characteristics) {
        this.connectionState.characteristics.set(char.uuid, char);
        
        let value = null;
        if (char.properties.read) {
          try {
            value = await char.readValue();
          } catch (error) {
            console.warn(`Failed to read characteristic ${char.uuid}:`, error);
          }
        }

        result.push({
          uuid: char.uuid,
          properties: Object.keys(char.properties).filter(prop => 
            char.properties[prop as keyof BluetoothCharacteristicProperties]
          ),
          value
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to discover characteristics:', error);
      return [];
    }
  }

  /**
   * Read characteristic value
   */
  async readCharacteristic(characteristicUuid: string): Promise<BluetoothOperationResult<DataView>> {
    const characteristic = this.connectionState.characteristics.get(characteristicUuid);
    
    if (!characteristic) {
      return { success: false, error: 'Characteristic not found' };
    }

    if (!characteristic.properties.read) {
      return { success: false, error: 'Characteristic is not readable' };
    }

    try {
      const value = await characteristic.readValue();
      return { success: true, data: value };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Read failed';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Write characteristic value
   */
  async writeCharacteristic(
    characteristicUuid: string, 
    value: ArrayBuffer
  ): Promise<BluetoothOperationResult<void>> {
    const characteristic = this.connectionState.characteristics.get(characteristicUuid);
    
    if (!characteristic) {
      return { success: false, error: 'Characteristic not found' };
    }

    if (!characteristic.properties.write && !characteristic.properties.writeWithoutResponse) {
      return { success: false, error: 'Characteristic is not writable' };
    }

    try {
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(value);
      } else {
        await characteristic.writeValueWithResponse(value);
      }
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Write failed';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Subscribe to characteristic notifications
   */
  async subscribeToNotifications(
    characteristicUuid: string,
    callback: (value: DataView) => void
  ): Promise<BluetoothOperationResult<void>> {
    const characteristic = this.connectionState.characteristics.get(characteristicUuid);
    
    if (!characteristic) {
      return { success: false, error: 'Characteristic not found' };
    }

    if (!characteristic.properties.notify && !characteristic.properties.indicate) {
      return { success: false, error: 'Characteristic does not support notifications' };
    }

    try {
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          callback(target.value);
        }
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Subscription failed';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): DeviceConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Setup device event listeners
   */
  private setupDeviceEventListeners(): void {
    if (!this.device) return;

    // Handle device disconnection
    this.device.addEventListener('gattserverdisconnected', (event) => {
      console.log('🔵 WebBluetoothAdapter: Device disconnected unexpectedly:', {
        deviceId: this.device?.id,
        deviceName: this.device?.name
      });
      
      this.connectionState.connected = false;
      this.connectionState.connecting = false;
      this.connectionState.error = 'Device disconnected unexpectedly';
      this.server = null;
    });

    // Handle service changes (if device supports it)
    if ('ongattservicechanged' in this.device) {
      this.device.addEventListener('gattservicechanged', () => {
        console.log('🔵 WebBluetoothAdapter: Device services changed, may need to rediscover');
      });
    }
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<BluetoothOperationResult<T>>
  ): Promise<BluetoothOperationResult<T>> {
    let lastError: string = 'Unknown error';

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Operation failed';
        console.warn(`Attempt ${attempt} failed:`, lastError);
        
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    this.connectionState.error = lastError;
    this.connectionState.connecting = false;
    return { success: false, error: lastError };
  }

  /**
   * Get service name from UUID
   */
  private getServiceName(uuid: string): string {
    const serviceMap: Record<string, string> = {
      [WEB_BLUETOOTH_SERVICES.GENERIC_ACCESS]: 'Generic Access Profile',
      [WEB_BLUETOOTH_SERVICES.GENERIC_ATTRIBUTE]: 'Generic Attribute Profile',
      [WEB_BLUETOOTH_SERVICES.DEVICE_INFORMATION]: 'Device Information Service',
      [WEB_BLUETOOTH_SERVICES.BATTERY_SERVICE]: 'Battery Service',
      [WEB_BLUETOOTH_SERVICES.HID_SERVICE]: 'Human Interface Device',
      [WEB_BLUETOOTH_SERVICES.NORDIC_DFU]: 'Nordic DFU Service'
    };

    return serviceMap[uuid] || `Unknown Service (${uuid})`;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if device is supported Blackmagic camera
   */
  isBlackmagicDevice(): boolean {
    if (!this.device || !this.device.name) return false;
    
    const deviceName = this.device.name.toLowerCase();
    return deviceName.includes('blackmagic') || 
           deviceName.includes('bmd') || 
           deviceName.includes('ursa') || 
           deviceName.includes('pocket');
  }

  /**
   * Set device for connection (used when device is selected externally)
   */
  setDevice(device: BluetoothDevice): void {
    console.log('🔵 WebBluetoothAdapter: Setting device:', {
      id: device.id,
      name: device.name,
      gatt: device.gatt ? 'available' : 'not available'
    });
    this.device = device;
    this.connectionState.device = device;
    this.setupDeviceEventListeners();
  }

  /**
   * Get current device
   */
  getDevice(): BluetoothDevice | null {
    return this.device;
  }

  /**
   * Get device information
   */
  getDeviceInfo() {
    return {
      id: this.device?.id || 'Unknown',
      name: this.device?.name || 'Unknown Device',
      connected: this.connectionState.connected,
      services: this.connectionState.services.length,
      characteristics: this.connectionState.characteristics.size
    };
  }
}