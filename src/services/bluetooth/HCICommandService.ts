import { VERIFIED_HCI_COMMANDS } from './constants';
import type { HCICommand, BluetoothOperationResult } from '@/types';

export class HCICommandService {
  private static instance: HCICommandService;
  private commandHistory: Array<{
    command: string;
    timestamp: Date;
    success: boolean;
    response?: ArrayBuffer;
    error?: string;
  }> = [];

  private constructor() {}

  static getInstance(): HCICommandService {
    if (!HCICommandService.instance) {
      HCICommandService.instance = new HCICommandService();
    }
    return HCICommandService.instance;
  }

  /**
   * Execute HCI Reset command
   */
  async executeReset(): Promise<BluetoothOperationResult<ArrayBuffer>> {
    const command = VERIFIED_HCI_COMMANDS.HCI_RESET;
    return this.executeCommand(command, 'HCI_RESET');
  }

  /**
   * Execute HCI Set Event Mask command
   */
  async executeSetEventMask(eventMask: number = 0xFFFFFFFF): Promise<BluetoothOperationResult<ArrayBuffer>> {
    const command = VERIFIED_HCI_COMMANDS.HCI_SET_EVENT_MASK;
    const parameters = this.numberToBytes(eventMask, 8); // 8 bytes for event mask
    return this.executeCommand(command, 'HCI_SET_EVENT_MASK', parameters);
  }

  /**
   * Execute HCI Inquiry command
   */
  async executeInquiry(
    inquiryLength: number = 0x30,
    numResponses: number = 0x00
  ): Promise<BluetoothOperationResult<ArrayBuffer>> {
    const command = VERIFIED_HCI_COMMANDS.HCI_INQUIRY;
    const parameters = [
      0x33, 0x8B, 0x9E, // LAP (General/Unlimited Inquiry Access Code)
      inquiryLength,    // Inquiry length
      numResponses      // Number of responses
    ];
    return this.executeCommand(command, 'HCI_INQUIRY', parameters);
  }

  /**
   * Execute HCI Read BD_ADDR command
   */
  async executeReadBdAddr(): Promise<BluetoothOperationResult<ArrayBuffer>> {
    const command = VERIFIED_HCI_COMMANDS.HCI_READ_BD_ADDR;
    return this.executeCommand(command, 'HCI_READ_BD_ADDR');
  }

  /**
   * Execute HCI Change Local Name command
   */
  async executeChangeLocalName(name: string): Promise<BluetoothOperationResult<ArrayBuffer>> {
    const command = VERIFIED_HCI_COMMANDS.HCI_CHANGE_LOCAL_NAME;
    const nameBytes = this.stringToBytes(name, 248); // 248 bytes for local name
    return this.executeCommand(command, 'HCI_CHANGE_LOCAL_NAME', nameBytes);
  }

  /**
   * Execute HCI Write Scan Enable command
   */
  async executeWriteScanEnable(
    inquiryScan: boolean = true,
    pageScan: boolean = true
  ): Promise<BluetoothOperationResult<ArrayBuffer>> {
    const command = VERIFIED_HCI_COMMANDS.HCI_WRITE_SCAN_ENABLE;
    let scanEnable = 0x00;
    if (inquiryScan) scanEnable |= 0x01;
    if (pageScan) scanEnable |= 0x02;
    
    return this.executeCommand(command, 'HCI_WRITE_SCAN_ENABLE', [scanEnable]);
  }

  /**
   * Execute HCI Write Class of Device command
   */
  async executeWriteClassOfDevice(classOfDevice: number): Promise<BluetoothOperationResult<ArrayBuffer>> {
    const command = VERIFIED_HCI_COMMANDS.HCI_WRITE_CLASS_OF_DEVICE;
    const parameters = this.numberToBytes(classOfDevice, 3);
    return this.executeCommand(command, 'HCI_WRITE_CLASS_OF_DEVICE', parameters);
  }

  /**
   * Execute HCI Write Simple Pairing Mode command
   */
  async executeWriteSimplePairingMode(enabled: boolean): Promise<BluetoothOperationResult<ArrayBuffer>> {
    const command = VERIFIED_HCI_COMMANDS.HCI_WRITE_SIMPLE_PAIRING_MODE;
    return this.executeCommand(command, 'HCI_WRITE_SIMPLE_PAIRING_MODE', [enabled ? 0x01 : 0x00]);
  }

  /**
   * Execute HCI Write LE Host Support command
   */
  async executeWriteLEHostSupport(
    leSupported: boolean = true,
    simultaneousLeHost: boolean = true
  ): Promise<BluetoothOperationResult<ArrayBuffer>> {
    const command = VERIFIED_HCI_COMMANDS.HCI_WRITE_LE_HOST_SUPPORT;
    const parameters = [
      leSupported ? 0x01 : 0x00,
      simultaneousLeHost ? 0x01 : 0x00
    ];
    return this.executeCommand(command, 'HCI_WRITE_LE_HOST_SUPPORT', parameters);
  }

  /**
   * Generic HCI command execution
   */
  private async executeCommand(
    command: HCICommand,
    commandName: string,
    parameters: number[] = []
  ): Promise<BluetoothOperationResult<ArrayBuffer>> {
    try {
      // Build HCI command packet
      const packet = this.buildHCIPacket(command.pattern, parameters);
      
      // Log command execution
      console.log(`Executing ${commandName}:`, 
        Array.from(packet).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
      );

      // For Web Bluetooth, we can't directly send HCI commands
      // This would require a bridge service or custom characteristic
      // For now, we'll simulate the command execution
      const result = await this.simulateHCICommand(packet, commandName);

      // Record in history
      this.commandHistory.push({
        command: commandName,
        timestamp: new Date(),
        success: result.success,
        response: result.data,
        error: result.error
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'HCI command failed';
      
      this.commandHistory.push({
        command: commandName,
        timestamp: new Date(),
        success: false,
        error: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Build HCI command packet
   */
  private buildHCIPacket(pattern: readonly number[], parameters: number[]): Uint8Array {
    const packet = new Uint8Array(pattern.length + 1 + parameters.length);
    let offset = 0;

    // Copy command pattern
    for (let i = 0; i < pattern.length; i++) {
      packet[offset] = pattern[i]!;
      offset++;
    }

    // Add parameter length
    packet[offset] = parameters.length;
    offset++;

    // Add parameters
    for (let i = 0; i < parameters.length; i++) {
      packet[offset] = parameters[i]!;
      offset++;
    }

    return packet;
  }

  /**
   * Simulate HCI command execution (for Web Bluetooth limitations)
   */
  private async simulateHCICommand(
    _packet: Uint8Array,
    commandName: string
  ): Promise<BluetoothOperationResult<ArrayBuffer>> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Generate mock response based on command
    let response: Uint8Array;

    switch (commandName) {
      case 'HCI_RESET':
        response = new Uint8Array([0x04, 0x0E, 0x04, 0x01, 0x03, 0x0C, 0x00]); // Command Complete
        break;
      case 'HCI_READ_BD_ADDR':
        response = new Uint8Array([
          0x04, 0x0E, 0x0A, 0x01, 0x09, 0x0C, 0x00, // Command Complete header
          0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC         // Mock BD_ADDR
        ]);
        break;
      case 'HCI_INQUIRY':
        response = new Uint8Array([0x04, 0x0F, 0x04, 0x00, 0x01, 0x01, 0x0C]); // Command Status
        break;
      default:
        response = new Uint8Array([0x04, 0x0E, 0x04, 0x01, 0x00, 0x00, 0x00]); // Generic success
    }

    console.log(`${commandName} response:`, 
      Array.from(response).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
    );

    return { success: true, data: response.buffer };
  }

  /**
   * Validate HCI command pattern
   */
  isValidHCICommand(pattern: number[]): boolean {
    return Object.values(VERIFIED_HCI_COMMANDS).some(cmd => 
      cmd.pattern.length === pattern.length &&
      cmd.pattern.every((byte, index) => byte === pattern[index])
    );
  }

  /**
   * Get command history
   */
  getCommandHistory() {
    return [...this.commandHistory];
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.commandHistory = [];
  }

  /**
   * Get command statistics
   */
  getStatistics() {
    const total = this.commandHistory.length;
    const successful = this.commandHistory.filter(cmd => cmd.success).length;
    const failed = total - successful;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(1) + '%' : '0%'
    };
  }

  /**
   * Convert number to byte array
   */
  private numberToBytes(value: number, length: number): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < length; i++) {
      bytes.push((value >> (8 * i)) & 0xFF);
    }
    return bytes;
  }

  /**
   * Convert string to byte array with padding
   */
  private stringToBytes(str: string, length: number): number[] {
    const bytes: number[] = [];
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    
    for (let i = 0; i < length; i++) {
      bytes.push(i < encoded.length ? encoded[i]! : 0);
    }
    
    return bytes;
  }
}