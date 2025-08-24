// Web Bluetooth API type extensions
export interface BluetoothServiceUUID {
  readonly uuid: number;
  readonly name: string;
  readonly verified: {
    readonly littleEndian: {
      readonly occurrences: number;
      readonly firstOffset: number;
    };
    readonly bigEndian: {
      readonly occurrences: number;
      readonly firstOffset: number;
    };
  };
}

export interface HCICommand {
  readonly pattern: readonly number[];
  readonly name: string;
  readonly verified: {
    readonly occurrences: number;
    readonly firstOffset: number;
    readonly context: string;
  };
}

export interface AdvertisingPattern {
  readonly pattern: readonly number[];
  readonly name: string;
  readonly verified: {
    readonly occurrences: number;
    readonly firstOffset: number;
  };
}

export interface BluetoothSignature {
  readonly occurrences: number;
  readonly firstOffset: number;
  readonly context: string;
}

export interface DeviceConnectionState {
  connected: boolean;
  connecting: boolean;
  device: BluetoothDevice | null;
  services: BluetoothRemoteGATTService[];
  characteristics: Map<string, BluetoothRemoteGATTCharacteristic>;
  error: string | null;
}

export interface ServiceDiscoveryResult {
  serviceUuid: string;
  serviceName: string;
  characteristics: Array<{
    uuid: string;
    properties: string[];
    value: DataView | null;
  }>;
}

export interface SecurityAssessment {
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  services: string[];
  recommendations: string[];
}

export interface FirmwareAnalysis {
  version: string | null;
  updateCapable: boolean;
  otaPatterns: number;
  dfuPatterns: number;
  totalOccurrences: number;
}

export interface MemoryAnalysis {
  offset: number;
  hexContext: string;
  asciiContext: string;
  serviceType: string;
}

// Data Processing Types
export interface ProcessedServiceData {
  uuid: string;
  name: string;
  characteristics: ProcessedCharacteristic[];
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  verificationStatus: 'verified' | 'unknown' | 'suspicious';
}

export interface ProcessedCharacteristic {
  uuid: string;
  properties: string[];
  value: any;
  readable: boolean;
  writable: boolean;
  notifiable: boolean;
}

export interface FirmwareAnalysisResult {
  version: string | null;
  updateCapable: boolean;
  otaPatterns: number;
  dfuPatterns: number;
  totalOccurrences: number;
}

// UI State Types
export interface AppState {
  connectionState: DeviceConnectionState;
  discoveredServices: ServiceDiscoveryResult[];
  processedServices: ProcessedServiceData[];
  securityAssessment: SecurityAssessment | null;
  firmwareAnalysis: FirmwareAnalysis | null;
  isScanning: boolean;
  availableDevices: BluetoothDevice[];
}

export interface BluetoothOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// File Transfer Types
export interface FileTransferOperation {
  id: string;
  type: 'upload' | 'download';
  fileName: string;
  progress: number;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  error?: string;
}

// Audio Management Types
export interface AudioConfiguration {
  source: 'microphone' | 'line-in' | 'bluetooth';
  sink: 'speakers' | 'headphones' | 'bluetooth';
  quality: 'low' | 'medium' | 'high';
  routing: 'mono' | 'stereo';
}

// Re-export Web Bluetooth types
export type BluetoothDevice = {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  watchingAdvertisements?: boolean;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
};

export type BluetoothRemoteGATTServer = {
  device: BluetoothDevice;
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUIDAlt): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(service?: BluetoothServiceUUIDAlt): Promise<BluetoothRemoteGATTService[]>;
};

export type BluetoothRemoteGATTService = {
  device: BluetoothDevice;
  uuid: string;
  isPrimary: boolean;
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
  getIncludedService(service: BluetoothServiceUUIDAlt): Promise<BluetoothRemoteGATTService>;
  getIncludedServices(service?: BluetoothServiceUUIDAlt): Promise<BluetoothRemoteGATTService[]>;
};

export type BluetoothRemoteGATTCharacteristic = {
  service: BluetoothRemoteGATTService;
  uuid: string;
  properties: BluetoothCharacteristicProperties;
  value?: DataView;
  getDescriptor(descriptor: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor>;
  getDescriptors(descriptor?: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor[]>;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};

export type BluetoothCharacteristicProperties = {
  broadcast: boolean;
  read: boolean;
  writeWithoutResponse: boolean;
  write: boolean;
  notify: boolean;
  indicate: boolean;
  authenticatedSignedWrites: boolean;
  reliableWrite: boolean;
  writableAuxiliaries: boolean;
};

export type BluetoothRemoteGATTDescriptor = {
  characteristic: BluetoothRemoteGATTCharacteristic;
  uuid: string;
  value?: DataView;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
};

type BluetoothServiceUUIDAlt = string | number;
type BluetoothCharacteristicUUID = string | number;
type BluetoothDescriptorUUID = string | number;