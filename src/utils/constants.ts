export const APP_CONFIG = {
  name: 'Blackmagic Bluetooth Interface',
  version: '1.0.0',
  description: 'Web-based Bluetooth interface for Blackmagic cameras',
  maxRetryAttempts: 3,
  connectionTimeout: 5000,
  scanTimeout: 10000
};

export const BLUETOOTH_CONFIG = {
  connectionOptions: {
    acceptAllDevices: true,
    optionalServices: [
      '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
      '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
      '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
      '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
      '00001812-0000-1000-8000-00805f9b34fb', // HID
      '0000fe59-0000-1000-8000-00805f9b34fb', // Nordic DFU
      '00001105-0000-1000-8000-00805f9b34fb', // OBEX Object Push
      '0000110a-0000-1000-8000-00805f9b34fb', // Audio Source
      '0000110b-0000-1000-8000-00805f9b34fb', // Audio Sink
      '00001200-0000-1000-8000-00805f9b34fb', // PnP Information
      '0000fffe-0000-1000-8000-00805f9b34fb'  // File Transfer Profile
    ]
  }
};

export const UI_CONSTANTS = {
  themes: {
    dark: 'dark',
    light: 'light',
    auto: 'auto'
  },
  breakpoints: {
    mobile: '768px',
    tablet: '1024px',
    desktop: '1200px'
  },
  animations: {
    fast: '0.15s',
    normal: '0.3s',
    slow: '0.5s'
  }
};

export const STORAGE_KEYS = {
  theme: 'bmi_theme',
  lastDevice: 'bmi_last_device',
  connectionHistory: 'bmi_connection_history',
  userPreferences: 'bmi_user_preferences',
  analysisResults: 'bmi_analysis_results'
};

export const ERROR_MESSAGES = {
  bluetoothNotSupported: 'Web Bluetooth is not supported in this browser. Please use Chrome or Edge with HTTPS.',
  deviceNotFound: 'No Bluetooth devices found. Make sure your device is powered on and in pairing mode.',
  connectionFailed: 'Failed to connect to device. Please try again.',
  serviceDiscoveryFailed: 'Failed to discover device services.',
  characteristicReadFailed: 'Failed to read characteristic value.',
  characteristicWriteFailed: 'Failed to write characteristic value.',
  unknownError: 'An unknown error occurred. Please try again.'
};