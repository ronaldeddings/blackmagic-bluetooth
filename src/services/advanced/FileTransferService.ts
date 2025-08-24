import type { FileTransferOperation, BluetoothOperationResult } from '@/types';

export class FileTransferService {
  private static instance: FileTransferService;
  private transfers: Map<string, FileTransferOperation> = new Map();
  private transferHistory: FileTransferOperation[] = [];

  private constructor() {}

  static getInstance(): FileTransferService {
    if (!FileTransferService.instance) {
      FileTransferService.instance = new FileTransferService();
    }
    return FileTransferService.instance;
  }

  async uploadFile(
    file: File,
    targetCharacteristic: BluetoothRemoteGATTCharacteristic
  ): Promise<BluetoothOperationResult<string>> {
    const transferId = this.generateTransferId();
    
    const operation: FileTransferOperation = {
      id: transferId,
      type: 'upload',
      fileName: file.name,
      progress: 0,
      status: 'pending'
    };

    this.transfers.set(transferId, operation);

    try {
      this.updateTransferStatus(transferId, 'in-progress', 0);

      if (!targetCharacteristic.properties.write && !targetCharacteristic.properties.writeWithoutResponse) {
        throw new Error('Characteristic does not support writing');
      }

      const chunkSize = 20; // MTU size for Bluetooth LE
      const fileBuffer = await file.arrayBuffer();
      const totalChunks = Math.ceil(fileBuffer.byteLength / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileBuffer.byteLength);
        const chunk = fileBuffer.slice(start, end);

        if (targetCharacteristic.properties.writeWithoutResponse) {
          await targetCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await targetCharacteristic.writeValueWithResponse(chunk);
        }

        const progress = Math.round((i + 1) / totalChunks * 100);
        this.updateTransferStatus(transferId, 'in-progress', progress);

        await this.delay(10);
      }

      this.updateTransferStatus(transferId, 'completed', 100);
      this.archiveTransfer(transferId);

      return { 
        success: true, 
        data: transferId
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      this.updateTransferStatus(transferId, 'error', undefined, errorMessage);
      this.archiveTransfer(transferId);
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  async downloadFile(
    sourceCharacteristic: BluetoothRemoteGATTCharacteristic,
    fileName: string,
    expectedSize?: number
  ): Promise<BluetoothOperationResult<Blob>> {
    const transferId = this.generateTransferId();
    
    const operation: FileTransferOperation = {
      id: transferId,
      type: 'download',
      fileName,
      progress: 0,
      status: 'pending'
    };

    this.transfers.set(transferId, operation);

    try {
      this.updateTransferStatus(transferId, 'in-progress', 0);

      if (!sourceCharacteristic.properties.read && !sourceCharacteristic.properties.notify) {
        throw new Error('Characteristic does not support reading or notifications');
      }

      const chunks: ArrayBuffer[] = [];

      if (sourceCharacteristic.properties.notify) {
        return await this.downloadViaNotifications(
          sourceCharacteristic,
          transferId,
          fileName,
          expectedSize
        );
      } else {
        const data = await sourceCharacteristic.readValue();
        chunks.push(data.buffer);
      }

      this.updateTransferStatus(transferId, 'completed', 100);
      this.archiveTransfer(transferId);

      const blob = new Blob(chunks);
      return { 
        success: true, 
        data: blob
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      this.updateTransferStatus(transferId, 'error', undefined, errorMessage);
      this.archiveTransfer(transferId);
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  private async downloadViaNotifications(
    characteristic: BluetoothRemoteGATTCharacteristic,
    transferId: string,
    _fileName: string,
    expectedSize?: number
  ): Promise<BluetoothOperationResult<Blob>> {
    return new Promise(async (resolve) => {
      const chunks: ArrayBuffer[] = [];
      let totalReceived = 0;
      let timeout: ReturnType<typeof setTimeout>;

      const handleData = (event: Event) => {
        const target = event.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          chunks.push(target.value.buffer.slice(0));
          totalReceived += target.value.byteLength;
          
          if (expectedSize) {
            const progress = Math.min(Math.round((totalReceived / expectedSize) * 100), 99);
            this.updateTransferStatus(transferId, 'in-progress', progress);
            
            if (totalReceived >= expectedSize) {
              cleanup();
              resolve({ 
                success: true, 
                data: new Blob(chunks)
              });
            }
          }
          
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            cleanup();
            resolve({ 
              success: true, 
              data: new Blob(chunks)
            });
          }, 5000);
        }
      };

      const cleanup = () => {
        characteristic.removeEventListener('characteristicvaluechanged', handleData);
        characteristic.stopNotifications().catch(console.warn);
        clearTimeout(timeout);
      };

      try {
        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', handleData);
        
        timeout = setTimeout(() => {
          cleanup();
          resolve({ 
            success: false, 
            error: 'Download timeout - no data received'
          });
        }, 30000);
        
      } catch (error) {
        cleanup();
        resolve({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to start notifications'
        });
      }
    });
  }

  getActiveTransfers(): FileTransferOperation[] {
    return Array.from(this.transfers.values());
  }

  getTransferHistory(): FileTransferOperation[] {
    return [...this.transferHistory];
  }

  getTransferById(id: string): FileTransferOperation | undefined {
    return this.transfers.get(id) || this.transferHistory.find(t => t.id === id);
  }

  cancelTransfer(id: string): boolean {
    const transfer = this.transfers.get(id);
    if (transfer && transfer.status === 'in-progress') {
      this.updateTransferStatus(id, 'error', undefined, 'Transfer cancelled by user');
      this.archiveTransfer(id);
      return true;
    }
    return false;
  }

  clearHistory(): void {
    this.transferHistory = [];
  }

  private generateTransferId(): string {
    return `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateTransferStatus(
    id: string, 
    status: FileTransferOperation['status'], 
    progress?: number,
    error?: string
  ): void {
    const transfer = this.transfers.get(id);
    if (transfer) {
      transfer.status = status;
      if (progress !== undefined) {
        transfer.progress = progress;
      }
      if (error) {
        transfer.error = error;
      }
    }
  }

  private archiveTransfer(id: string): void {
    const transfer = this.transfers.get(id);
    if (transfer) {
      this.transferHistory.push({ ...transfer });
      this.transfers.delete(id);
      
      if (this.transferHistory.length > 100) {
        this.transferHistory = this.transferHistory.slice(-50);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validateFileTransferCapability(
    service: BluetoothRemoteGATTService
  ): Promise<{
    canUpload: boolean;
    canDownload: boolean;
    supportedOperations: string[];
  }> {
    try {
      const characteristics = await service.getCharacteristics();
      
      const uploadCapable = characteristics.some(char => 
        char.properties.write || char.properties.writeWithoutResponse
      );
      
      const downloadCapable = characteristics.some(char => 
        char.properties.read || char.properties.notify
      );
      
      const supportedOperations: string[] = [];
      
      if (uploadCapable) {
        supportedOperations.push('upload', 'firmware_update', 'configuration_upload');
      }
      
      if (downloadCapable) {
        supportedOperations.push('download', 'log_download', 'configuration_download');
      }
      
      if (uploadCapable && downloadCapable) {
        supportedOperations.push('bidirectional_sync', 'file_exchange');
      }

      return {
        canUpload: uploadCapable,
        canDownload: downloadCapable,
        supportedOperations
      };
      
    } catch (error) {
      console.error('File transfer capability validation failed:', error);
      return {
        canUpload: false,
        canDownload: false,
        supportedOperations: []
      };
    }
  }
}