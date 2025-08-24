import { EventEmitter } from 'events';
import type { CameraCommand } from '../../types';

export interface BluetoothMessage {
  id: string;
  deviceId: string;
  commandId: string;
  type: 'command' | 'response' | 'notification' | 'error';
  data: ArrayBuffer;
  timestamp: Date;
  sequenceNumber?: number;
  expectedResponse?: boolean;
}

export interface MessagePacket {
  header: MessageHeader;
  payload: ArrayBuffer;
  checksum: number;
}

export interface MessageHeader {
  version: number;
  messageType: number;
  commandId: number;
  payloadLength: number;
  deviceId: string;
  sequenceNumber: number;
}

export interface ParsedCommand {
  commandId: string;
  parameters: Record<string, any>;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  requiresResponse: boolean;
}

export interface CommandResponse {
  commandId: string;
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
}

// Blackmagic Protocol Constants
const PROTOCOL = {
  HEADER_SIZE: 12,
  MAX_PAYLOAD_SIZE: 1024,
  PROTOCOL_VERSION: 1,
  MESSAGE_TYPES: {
    COMMAND: 0x01,
    RESPONSE: 0x02,
    NOTIFICATION: 0x03,
    ERROR: 0x04,
    HEARTBEAT: 0x05
  },
  COMMAND_IDS: {
    // Recording Commands
    RECORDING_START: 0x10,
    RECORDING_STOP: 0x11,
    RECORDING_PAUSE: 0x12,
    
    // Camera Settings
    SET_RESOLUTION: 0x20,
    SET_FRAMERATE: 0x21,
    SET_ISO: 0x22,
    SET_APERTURE: 0x23,
    SET_WHITE_BALANCE: 0x24,
    SET_CODEC: 0x25,
    
    // System Commands
    GET_STATUS: 0x30,
    GET_SETTINGS: 0x31,
    SET_TIMECODE: 0x32,
    FACTORY_RESET: 0x33,
    
    // Stream Commands
    START_STREAM: 0x40,
    STOP_STREAM: 0x41,
    STREAM_CONFIG: 0x42,
    
    // Utility Commands
    PING: 0x50,
    GET_INFO: 0x51,
    CALIBRATE: 0x52
  }
} as const;

export class MessageHandler extends EventEmitter {
  private messageQueue: BluetoothMessage[] = [];
  private sequenceNumber = 0;
  private pendingResponses: Map<string, {
    resolve: (response: CommandResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private isProcessing = false;
  private maxQueueSize = 100;
  private messageTimeout = 10000; // 10 seconds

  constructor() {
    super();
    this.startMessageProcessor();
    console.log('📨 MessageHandler initialized');
  }

  /**
   * Send command to camera via Bluetooth
   */
  async sendCommand(deviceId: string, command: CameraCommand): Promise<CommandResponse> {
    const message = this.createCommandMessage(deviceId, command);
    
    return new Promise((resolve, reject) => {
      const messageId = message.id;
      
      // Set up response handler if expecting response
      if (message.expectedResponse) {
        const timeout = setTimeout(() => {
          this.pendingResponses.delete(messageId);
          reject(new Error(`Command timeout: ${command.commandId}`));
        }, this.messageTimeout);

        this.pendingResponses.set(messageId, {
          resolve,
          reject,
          timeout
        });
      }

      // Add to message queue
      this.queueMessage(message);

      // If not expecting response, resolve immediately
      if (!message.expectedResponse) {
        resolve({
          commandId: command.commandId,
          success: true
        });
      }
    });
  }

  /**
   * Send raw data to device
   */
  async sendRawData(deviceId: string, data: ArrayBuffer): Promise<void> {
    // This would interface with the actual Bluetooth connection
    console.log(`📤 Sending ${data.byteLength} bytes to ${deviceId}`);
    
    // Simulate network delay
    await this.delay(10, 50);
    
    // Emit sent event
    this.emit('data-sent', { deviceId, data });
  }

  /**
   * Handle incoming data from device
   */
  async handleIncomingData(deviceId: string, data: ArrayBuffer): Promise<void> {
    try {
      const messages = this.parseIncomingData(deviceId, data);
      
      for (const message of messages) {
        await this.processIncomingMessage(message);
      }
    } catch (error) {
      console.error(`❌ Failed to handle incoming data from ${deviceId}:`, error);
      this.emit('message-error', { deviceId, error });
    }
  }

  /**
   * Create command message from CameraCommand
   */
  private createCommandMessage(deviceId: string, command: CameraCommand): BluetoothMessage {
    const commandId = this.mapCommandIdToProtocol(command.commandId);
    const sequenceNumber = ++this.sequenceNumber;
    
    const header: MessageHeader = {
      version: PROTOCOL.PROTOCOL_VERSION,
      messageType: PROTOCOL.MESSAGE_TYPES.COMMAND,
      commandId,
      payloadLength: 0,
      deviceId,
      sequenceNumber
    };

    const payload = this.serializeCommandParameters(command.parameters || {});
    header.payloadLength = payload.byteLength;

    const packet: MessagePacket = {
      header,
      payload,
      checksum: this.calculateChecksum(header, payload)
    };

    const data = this.serializePacket(packet);
    const expectedResponse = this.commandRequiresResponse(command.commandId);

    return {
      id: `${deviceId}_${sequenceNumber}`,
      deviceId,
      commandId: command.commandId,
      type: 'command',
      data,
      timestamp: new Date(),
      sequenceNumber,
      expectedResponse
    };
  }

  /**
   * Parse incoming data into messages
   */
  private parseIncomingData(deviceId: string, data: ArrayBuffer): BluetoothMessage[] {
    const messages: BluetoothMessage[] = [];
    let offset = 0;
    const view = new DataView(data);

    while (offset < data.byteLength - PROTOCOL.HEADER_SIZE) {
      try {
        // Parse message header
        const header: MessageHeader = {
          version: view.getUint8(offset),
          messageType: view.getUint8(offset + 1),
          commandId: view.getUint16(offset + 2, true),
          payloadLength: view.getUint32(offset + 4, true),
          deviceId: deviceId,
          sequenceNumber: view.getUint16(offset + 8, true)
        };

        // Validate header
        if (header.version !== PROTOCOL.PROTOCOL_VERSION) {
          console.warn(`⚠️ Unsupported protocol version: ${header.version}`);
          break;
        }

        if (header.payloadLength > PROTOCOL.MAX_PAYLOAD_SIZE) {
          console.warn(`⚠️ Payload too large: ${header.payloadLength}`);
          break;
        }

        // Extract payload
        const payloadStart = offset + PROTOCOL.HEADER_SIZE;
        const payloadEnd = payloadStart + header.payloadLength;
        
        if (payloadEnd > data.byteLength) {
          console.warn('⚠️ Incomplete message received');
          break;
        }

        const payload = data.slice(payloadStart, payloadEnd);
        
        // Verify checksum (simplified)
        const receivedChecksum = view.getUint16(payloadEnd, true);
        const calculatedChecksum = this.calculateChecksum(header, payload);
        
        if (receivedChecksum !== calculatedChecksum) {
          console.warn('⚠️ Checksum mismatch');
          offset = payloadEnd + 2;
          continue;
        }

        // Create message
        const message: BluetoothMessage = {
          id: `${deviceId}_${header.sequenceNumber}`,
          deviceId,
          commandId: this.mapProtocolToCommandId(header.commandId),
          type: this.mapMessageType(header.messageType),
          data: payload,
          timestamp: new Date(),
          sequenceNumber: header.sequenceNumber
        };

        messages.push(message);
        offset = payloadEnd + 2; // Move past checksum

      } catch (error) {
        console.error('❌ Failed to parse message:', error);
        break;
      }
    }

    return messages;
  }

  /**
   * Process incoming message
   */
  private async processIncomingMessage(message: BluetoothMessage): Promise<void> {
    console.log(`📨 Processing ${message.type} message: ${message.commandId} from ${message.deviceId}`);

    switch (message.type) {
      case 'response':
        await this.handleResponse(message);
        break;
      case 'notification':
        await this.handleNotification(message);
        break;
      case 'error':
        await this.handleError(message);
        break;
      default:
        console.warn(`⚠️ Unknown message type: ${message.type}`);
    }

    this.emit('message-received', message);
  }

  /**
   * Handle command response
   */
  private async handleResponse(message: BluetoothMessage): Promise<void> {
    const messageId = `${message.deviceId}_${message.sequenceNumber}`;
    const pendingResponse = this.pendingResponses.get(messageId);

    if (!pendingResponse) {
      console.warn(`⚠️ No pending response for message ${messageId}`);
      return;
    }

    try {
      const responseData = this.parseResponseData(message.data);
      const response: CommandResponse = {
        commandId: message.commandId,
        success: true,
        data: responseData
      };

      clearTimeout(pendingResponse.timeout);
      pendingResponse.resolve(response);
      this.pendingResponses.delete(messageId);

      this.emit('camera-response', {
        deviceId: message.deviceId,
        commandId: message.commandId,
        response: responseData
      });

    } catch (error) {
      clearTimeout(pendingResponse.timeout);
      pendingResponse.reject(error as Error);
      this.pendingResponses.delete(messageId);
    }
  }

  /**
   * Handle notification message
   */
  private async handleNotification(message: BluetoothMessage): Promise<void> {
    try {
      const notificationData = this.parseResponseData(message.data);
      
      this.emit('camera-notification', {
        deviceId: message.deviceId,
        type: message.commandId,
        data: notificationData
      });

      // Handle specific notification types
      switch (message.commandId) {
        case 'BATTERY_LOW':
          this.emit('battery-low', { deviceId: message.deviceId, level: notificationData.level });
          break;
        case 'STORAGE_FULL':
          this.emit('storage-full', { deviceId: message.deviceId });
          break;
        case 'RECORDING_STARTED':
          this.emit('recording-started', { deviceId: message.deviceId, filename: notificationData.filename });
          break;
        case 'RECORDING_STOPPED':
          this.emit('recording-stopped', { deviceId: message.deviceId, duration: notificationData.duration });
          break;
      }

    } catch (error) {
      console.error(`❌ Failed to handle notification from ${message.deviceId}:`, error);
    }
  }

  /**
   * Handle error message
   */
  private async handleError(message: BluetoothMessage): Promise<void> {
    try {
      const errorData = this.parseResponseData(message.data);
      
      this.emit('camera-error', {
        deviceId: message.deviceId,
        commandId: message.commandId,
        error: errorData.message || 'Unknown error',
        code: errorData.code
      });

    } catch (error) {
      console.error(`❌ Failed to handle error message from ${message.deviceId}:`, error);
    }
  }

  /**
   * Queue message for processing
   */
  private queueMessage(message: BluetoothMessage): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      // Remove oldest message
      const dropped = this.messageQueue.shift();
      console.warn(`⚠️ Message queue full, dropped message ${dropped?.id}`);
    }

    this.messageQueue.push(message);
  }

  /**
   * Start message processor
   */
  private startMessageProcessor(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processMessageQueue();
  }

  /**
   * Process message queue
   */
  private async processMessageQueue(): Promise<void> {
    while (this.isProcessing) {
      if (this.messageQueue.length === 0) {
        await this.delay(10, 10);
        continue;
      }

      const message = this.messageQueue.shift()!;
      
      try {
        await this.sendRawData(message.deviceId, message.data);
        this.emit('message-sent', message);
      } catch (error) {
        console.error(`❌ Failed to send message ${message.id}:`, error);
        this.emit('message-error', { message, error });
      }

      // Small delay to prevent overwhelming the connection
      await this.delay(5, 5);
    }
  }

  /**
   * Serialize command parameters
   */
  private serializeCommandParameters(parameters: Record<string, any>): ArrayBuffer {
    // Simple JSON serialization for demo
    // In real implementation, this would use binary protocol
    const json = JSON.stringify(parameters);
    const encoder = new TextEncoder();
    return encoder.encode(json);
  }

  /**
   * Parse response data
   */
  private parseResponseData(data: ArrayBuffer): any {
    try {
      const decoder = new TextDecoder();
      const json = decoder.decode(data);
      return JSON.parse(json);
    } catch (error) {
      console.warn('⚠️ Failed to parse response data as JSON, returning raw data');
      return { raw: data };
    }
  }

  /**
   * Serialize packet to ArrayBuffer
   */
  private serializePacket(packet: MessagePacket): ArrayBuffer {
    const totalSize = PROTOCOL.HEADER_SIZE + packet.payload.byteLength + 2; // +2 for checksum
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // Write header
    view.setUint8(0, packet.header.version);
    view.setUint8(1, packet.header.messageType);
    view.setUint16(2, packet.header.commandId, true);
    view.setUint32(4, packet.header.payloadLength, true);
    view.setUint16(8, packet.header.sequenceNumber, true);
    
    // Write payload
    if (packet.payload.byteLength > 0) {
      const payloadView = new Uint8Array(buffer, PROTOCOL.HEADER_SIZE);
      const sourceView = new Uint8Array(packet.payload);
      payloadView.set(sourceView);
    }

    // Write checksum
    view.setUint16(PROTOCOL.HEADER_SIZE + packet.payload.byteLength, packet.checksum, true);

    return buffer;
  }

  /**
   * Calculate simple checksum
   */
  private calculateChecksum(header: MessageHeader, payload: ArrayBuffer): number {
    // Simple XOR checksum for demo
    let checksum = header.commandId ^ header.payloadLength ^ header.sequenceNumber;
    
    const payloadView = new Uint8Array(payload);
    for (let i = 0; i < payloadView.length; i++) {
      checksum ^= payloadView[i];
    }

    return checksum & 0xFFFF;
  }

  /**
   * Map CameraCommand ID to protocol command ID
   */
  private mapCommandIdToProtocol(commandId: string): number {
    const mapping: Record<string, number> = {
      'RECORDING_START': PROTOCOL.COMMAND_IDS.RECORDING_START,
      'RECORDING_STOP': PROTOCOL.COMMAND_IDS.RECORDING_STOP,
      'RECORDING_PAUSE': PROTOCOL.COMMAND_IDS.RECORDING_PAUSE,
      'SET_RESOLUTION': PROTOCOL.COMMAND_IDS.SET_RESOLUTION,
      'SET_FRAMERATE': PROTOCOL.COMMAND_IDS.SET_FRAMERATE,
      'SET_ISO': PROTOCOL.COMMAND_IDS.SET_ISO,
      'SET_APERTURE': PROTOCOL.COMMAND_IDS.SET_APERTURE,
      'SET_WHITE_BALANCE': PROTOCOL.COMMAND_IDS.SET_WHITE_BALANCE,
      'SET_CODEC': PROTOCOL.COMMAND_IDS.SET_CODEC,
      'GET_STATUS': PROTOCOL.COMMAND_IDS.GET_STATUS,
      'GET_SETTINGS': PROTOCOL.COMMAND_IDS.GET_SETTINGS,
      'PING': PROTOCOL.COMMAND_IDS.PING
    };

    return mapping[commandId] || 0x00;
  }

  /**
   * Map protocol command ID to CameraCommand ID
   */
  private mapProtocolToCommandId(commandId: number): string {
    const reverseMapping: Record<number, string> = {};
    for (const [key, value] of Object.entries(PROTOCOL.COMMAND_IDS)) {
      reverseMapping[value] = key;
    }

    return reverseMapping[commandId] || 'UNKNOWN';
  }

  /**
   * Map message type number to string
   */
  private mapMessageType(messageType: number): BluetoothMessage['type'] {
    switch (messageType) {
      case PROTOCOL.MESSAGE_TYPES.COMMAND: return 'command';
      case PROTOCOL.MESSAGE_TYPES.RESPONSE: return 'response';
      case PROTOCOL.MESSAGE_TYPES.NOTIFICATION: return 'notification';
      case PROTOCOL.MESSAGE_TYPES.ERROR: return 'error';
      default: return 'command';
    }
  }

  /**
   * Check if command requires response
   */
  private commandRequiresResponse(commandId: string): boolean {
    const noResponseCommands = [
      'RECORDING_START',
      'RECORDING_STOP',
      'RECORDING_PAUSE'
    ];

    return !noResponseCommands.includes(commandId);
  }

  /**
   * Utility delay function
   */
  private delay(min: number, max: number): Promise<void> {
    const delay = min + Math.random() * (max - min);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Stop message processing and cleanup
   */
  destroy(): void {
    this.isProcessing = false;
    
    // Clear pending responses
    for (const [messageId, pendingResponse] of this.pendingResponses.entries()) {
      clearTimeout(pendingResponse.timeout);
      pendingResponse.reject(new Error('MessageHandler destroyed'));
    }
    this.pendingResponses.clear();
    
    // Clear queue
    this.messageQueue = [];
    
    this.removeAllListeners();
    console.log('🧹 MessageHandler destroyed');
  }
}

export default MessageHandler;