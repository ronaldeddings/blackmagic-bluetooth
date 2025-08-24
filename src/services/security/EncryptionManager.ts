import { EventEmitter } from 'events';

export interface EncryptionConfig {
  algorithm: 'AES-GCM' | 'AES-CBC';
  keySize: 128 | 192 | 256;
  deriveKeys: boolean;
  keyRotationInterval: number; // in milliseconds
  enableHSM: boolean; // Hardware Security Module support
  auditEncryption: boolean;
}

export interface EncryptionKey {
  id: string;
  algorithm: string;
  keyData: CryptoKey;
  createdAt: Date;
  expiresAt?: Date;
  usage: KeyUsage[];
  isActive: boolean;
}

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  keyId: string;
  algorithm: string;
  authTag?: string;
}

export interface DecryptionResult {
  decrypted: string;
  keyId: string;
  algorithm: string;
}

export interface KeyRotationEvent {
  oldKeyId: string;
  newKeyId: string;
  algorithm: string;
  timestamp: Date;
}

export interface EncryptionMetrics {
  totalOperations: number;
  encryptionCount: number;
  decryptionCount: number;
  keyRotations: number;
  failedOperations: number;
  averageOperationTime: number;
  keyUsage: Map<string, number>;
}

export class EncryptionManager extends EventEmitter {
  private config: EncryptionConfig;
  private keys: Map<string, EncryptionKey> = new Map();
  private activeKeyId: string | null = null;
  private keyRotationInterval?: NodeJS.Timeout;
  private metrics: EncryptionMetrics;
  private isInitialized = false;

  constructor(config?: Partial<EncryptionConfig>) {
    super();
    
    this.config = {
      algorithm: 'AES-GCM',
      keySize: 256,
      deriveKeys: true,
      keyRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
      enableHSM: false,
      auditEncryption: true,
      ...config
    };

    this.metrics = {
      totalOperations: 0,
      encryptionCount: 0,
      decryptionCount: 0,
      keyRotations: 0,
      failedOperations: 0,
      averageOperationTime: 0,
      keyUsage: new Map()
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Generate initial master key
      await this.generateMasterKey();
      
      // Start key rotation if configured
      if (this.config.keyRotationInterval > 0) {
        this.startKeyRotation();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      
      if (this.config.auditEncryption) {
        console.log('[ENCRYPTION] Manager initialized with', this.config);
      }
      
    } catch (error) {
      this.emit('initialization_error', error);
      throw error;
    }
  }

  private async generateMasterKey(): Promise<string> {
    try {
      const key = await window.crypto.subtle.generateKey(
        {
          name: this.config.algorithm,
          length: this.config.keySize
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );

      const keyId = this.generateKeyId();
      const encryptionKey: EncryptionKey = {
        id: keyId,
        algorithm: this.config.algorithm,
        keyData: key,
        createdAt: new Date(),
        usage: ['encrypt', 'decrypt'],
        isActive: true
      };

      this.keys.set(keyId, encryptionKey);
      this.activeKeyId = keyId;

      if (this.config.auditEncryption) {
        console.log('[ENCRYPTION] Generated master key:', keyId);
      }

      return keyId;

    } catch (error) {
      this.metrics.failedOperations++;
      throw new Error(`Failed to generate master key: ${error}`);
    }
  }

  private async generateKey(usage: KeyUsage[] = ['encrypt', 'decrypt']): Promise<EncryptionKey> {
    const key = await window.crypto.subtle.generateKey(
      {
        name: this.config.algorithm,
        length: this.config.keySize
      },
      true,
      usage
    );

    const keyId = this.generateKeyId();
    const encryptionKey: EncryptionKey = {
      id: keyId,
      algorithm: this.config.algorithm,
      keyData: key,
      createdAt: new Date(),
      usage,
      isActive: true
    };

    return encryptionKey;
  }

  async encrypt(data: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Encryption manager not initialized');
    }

    const startTime = performance.now();

    try {
      const activeKey = this.getActiveKey();
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(data);

      let encrypted: ArrayBuffer;
      let iv: Uint8Array;
      let authTag: Uint8Array | undefined;

      if (this.config.algorithm === 'AES-GCM') {
        iv = window.crypto.getRandomValues(new Uint8Array(12));
        
        encrypted = await window.crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv: iv,
            length: 128
          },
          activeKey.keyData,
          dataBytes
        );
      } else {
        // AES-CBC
        iv = window.crypto.getRandomValues(new Uint8Array(16));
        
        encrypted = await window.crypto.subtle.encrypt(
          {
            name: 'AES-CBC',
            iv: iv
          },
          activeKey.keyData,
          dataBytes
        );
      }

      const result: EncryptionResult = {
        encrypted: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv),
        keyId: activeKey.id,
        algorithm: activeKey.algorithm,
        authTag: authTag ? this.arrayBufferToBase64(authTag) : undefined
      };

      // Update metrics
      this.updateMetrics('encrypt', performance.now() - startTime, activeKey.id);

      if (this.config.auditEncryption) {
        console.log('[ENCRYPTION] Data encrypted with key:', activeKey.id);
      }

      return JSON.stringify(result);

    } catch (error) {
      this.metrics.failedOperations++;
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  async decrypt(encryptedData: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Encryption manager not initialized');
    }

    const startTime = performance.now();

    try {
      const result: EncryptionResult = JSON.parse(encryptedData);
      const key = this.keys.get(result.keyId);
      
      if (!key) {
        throw new Error(`Encryption key not found: ${result.keyId}`);
      }

      const encryptedBytes = this.base64ToArrayBuffer(result.encrypted);
      const iv = this.base64ToArrayBuffer(result.iv);

      let decrypted: ArrayBuffer;

      if (result.algorithm === 'AES-GCM') {
        decrypted = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv
          },
          key.keyData,
          encryptedBytes
        );
      } else {
        // AES-CBC
        decrypted = await window.crypto.subtle.decrypt(
          {
            name: 'AES-CBC',
            iv: iv
          },
          key.keyData,
          encryptedBytes
        );
      }

      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decrypted);

      // Update metrics
      this.updateMetrics('decrypt', performance.now() - startTime, key.id);

      if (this.config.auditEncryption) {
        console.log('[ENCRYPTION] Data decrypted with key:', key.id);
      }

      return decryptedText;

    } catch (error) {
      this.metrics.failedOperations++;
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  async hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBytes);
    return this.arrayBufferToBase64(hashBuffer);
  }

  async verifyHash(data: string, hash: string): Promise<boolean> {
    const computedHash = await this.hash(data);
    return computedHash === hash;
  }

  async generateSecureToken(length = 32): Promise<string> {
    const bytes = window.crypto.getRandomValues(new Uint8Array(length));
    return this.arrayBufferToBase64(bytes);
  }

  async signJWT(payload: any, expiresIn: string): Promise<string> {
    // Simple JWT implementation for demonstration
    // In production, use a proper JWT library
    
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.parseExpiresIn(expiresIn);
    
    const jwtPayload = {
      ...payload,
      iat: now,
      exp: exp
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(jwtPayload));
    
    const signingKey = await this.getSigningKey();
    const signature = await this.sign(`${encodedHeader}.${encodedPayload}`, signingKey);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  async verifyJWT(token: string): Promise<any> {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new Error('Invalid JWT format');
    }

    const header = JSON.parse(this.base64UrlDecode(encodedHeader));
    const payload = JSON.parse(this.base64UrlDecode(encodedPayload));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('JWT expired');
    }

    // Verify signature
    const signingKey = await this.getSigningKey();
    const expectedSignature = await this.sign(`${encodedHeader}.${encodedPayload}`, signingKey);
    
    if (signature !== expectedSignature) {
      throw new Error('Invalid JWT signature');
    }

    return payload;
  }

  private async getSigningKey(): Promise<CryptoKey> {
    // For JWT signing, we'll use HMAC
    let signingKey = Array.from(this.keys.values()).find(k => 
      k.usage.includes('sign') && k.isActive
    );

    if (!signingKey) {
      // Generate signing key
      const key = await window.crypto.subtle.generateKey(
        {
          name: 'HMAC',
          hash: 'SHA-256'
        },
        true,
        ['sign', 'verify']
      );

      const keyId = this.generateKeyId();
      signingKey = {
        id: keyId,
        algorithm: 'HMAC',
        keyData: key,
        createdAt: new Date(),
        usage: ['sign', 'verify'],
        isActive: true
      };

      this.keys.set(keyId, signingKey);
    }

    return signingKey.keyData;
  }

  private async sign(data: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    
    const signature = await window.crypto.subtle.sign(
      'HMAC',
      key,
      dataBytes
    );
    
    return this.base64UrlEncode(signature);
  }

  async rotateKeys(): Promise<KeyRotationEvent> {
    if (!this.activeKeyId) {
      throw new Error('No active key to rotate');
    }

    try {
      const oldKeyId = this.activeKeyId;
      const oldKey = this.keys.get(oldKeyId);
      
      if (!oldKey) {
        throw new Error('Active key not found');
      }

      // Generate new key
      const newKey = await this.generateKey(oldKey.usage);
      this.keys.set(newKey.id, newKey);
      
      // Mark old key as inactive but keep it for decryption
      oldKey.isActive = false;
      
      // Set new key as active
      this.activeKeyId = newKey.id;
      
      const rotationEvent: KeyRotationEvent = {
        oldKeyId,
        newKeyId: newKey.id,
        algorithm: newKey.algorithm,
        timestamp: new Date()
      };

      this.metrics.keyRotations++;

      if (this.config.auditEncryption) {
        console.log('[ENCRYPTION] Key rotated:', rotationEvent);
      }

      this.emit('key_rotated', rotationEvent);
      
      return rotationEvent;

    } catch (error) {
      this.metrics.failedOperations++;
      throw new Error(`Key rotation failed: ${error}`);
    }
  }

  private startKeyRotation(): void {
    this.keyRotationInterval = setInterval(() => {
      this.rotateKeys().catch(error => {
        console.error('[ENCRYPTION] Automatic key rotation failed:', error);
        this.emit('key_rotation_error', error);
      });
    }, this.config.keyRotationInterval);
  }

  private stopKeyRotation(): void {
    if (this.keyRotationInterval) {
      clearInterval(this.keyRotationInterval);
      this.keyRotationInterval = undefined;
    }
  }

  private getActiveKey(): EncryptionKey {
    if (!this.activeKeyId) {
      throw new Error('No active encryption key');
    }

    const key = this.keys.get(this.activeKeyId);
    if (!key || !key.isActive) {
      throw new Error('Active key not found or inactive');
    }

    return key;
  }

  private updateMetrics(operation: 'encrypt' | 'decrypt', duration: number, keyId: string): void {
    this.metrics.totalOperations++;
    
    if (operation === 'encrypt') {
      this.metrics.encryptionCount++;
    } else {
      this.metrics.decryptionCount++;
    }

    // Update average operation time
    const totalTime = this.metrics.averageOperationTime * (this.metrics.totalOperations - 1) + duration;
    this.metrics.averageOperationTime = totalTime / this.metrics.totalOperations;

    // Update key usage
    const currentUsage = this.metrics.keyUsage.get(keyId) || 0;
    this.metrics.keyUsage.set(keyId, currentUsage + 1);
  }

  private generateKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private base64UrlEncode(data: string | ArrayBuffer): string {
    let base64: string;
    
    if (typeof data === 'string') {
      base64 = btoa(data);
    } else {
      const bytes = new Uint8Array(data);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64 = btoa(binary);
    }
    
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private base64UrlDecode(base64Url: string): string {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    const paddedBase64 = padding ? base64 + '='.repeat(4 - padding) : base64;
    return atob(paddedBase64);
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid expiresIn format');
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: throw new Error('Invalid time unit');
    }
  }

  // Public API methods
  getActiveKeyId(): string | null {
    return this.activeKeyId;
  }

  getKeys(): EncryptionKey[] {
    return Array.from(this.keys.values()).map(key => ({
      ...key,
      keyData: undefined as any // Don't expose key data
    }));
  }

  getMetrics(): EncryptionMetrics {
    return {
      ...this.metrics,
      keyUsage: new Map(this.metrics.keyUsage)
    };
  }

  async exportKey(keyId: string): Promise<JsonWebKey> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }

    return await window.crypto.subtle.exportKey('jwk', key.keyData);
  }

  async importKey(jwk: JsonWebKey, keyId?: string, usage?: KeyUsage[]): Promise<string> {
    const keyData = await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: jwk.alg || this.config.algorithm,
        length: this.config.keySize
      },
      true,
      usage || ['encrypt', 'decrypt']
    );

    const id = keyId || this.generateKeyId();
    const encryptionKey: EncryptionKey = {
      id,
      algorithm: jwk.alg || this.config.algorithm,
      keyData,
      createdAt: new Date(),
      usage: usage || ['encrypt', 'decrypt'],
      isActive: false // Don't activate imported keys by default
    };

    this.keys.set(id, encryptionKey);
    
    if (this.config.auditEncryption) {
      console.log('[ENCRYPTION] Key imported:', id);
    }

    this.emit('key_imported', encryptionKey);
    
    return id;
  }

  async deleteKey(keyId: string): Promise<boolean> {
    if (keyId === this.activeKeyId) {
      throw new Error('Cannot delete active key');
    }

    const deleted = this.keys.delete(keyId);
    
    if (deleted && this.config.auditEncryption) {
      console.log('[ENCRYPTION] Key deleted:', keyId);
    }

    return deleted;
  }

  updateConfig(config: Partial<EncryptionConfig>): void {
    const oldInterval = this.config.keyRotationInterval;
    this.config = { ...this.config, ...config };

    // Restart key rotation if interval changed
    if (this.config.keyRotationInterval !== oldInterval) {
      this.stopKeyRotation();
      if (this.config.keyRotationInterval > 0) {
        this.startKeyRotation();
      }
    }

    this.emit('config_updated', this.config);
  }

  getConfig(): EncryptionConfig {
    return { ...this.config };
  }

  isReady(): boolean {
    return this.isInitialized && this.activeKeyId !== null;
  }

  destroy(): void {
    this.stopKeyRotation();
    this.keys.clear();
    this.activeKeyId = null;
    this.isInitialized = false;
    this.removeAllListeners();
  }
}