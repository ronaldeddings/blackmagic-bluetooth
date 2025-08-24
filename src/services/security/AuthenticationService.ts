import { EventEmitter } from 'events';
import { EncryptionManager } from './EncryptionManager';

export interface AuthenticationConfig {
  sessionTimeout: number; // in milliseconds
  maxLoginAttempts: number;
  lockoutDuration: number; // in milliseconds
  requireStrongPassword: boolean;
  enableTwoFactor: boolean;
  sessionRefreshInterval: number;
  auditLogging: boolean;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  roles: string[];
  permissions: string[];
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
  metadata: Record<string, any>;
}

export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  refreshToken: string;
  deviceFingerprint: string;
}

export interface AuthenticationResult {
  success: boolean;
  user?: User;
  session?: Session;
  token?: string;
  refreshToken?: string;
  error?: string;
  requiresTwoFactor?: boolean;
  lockoutUntil?: Date;
}

export interface LoginCredentials {
  username: string;
  password: string;
  deviceId: string;
  deviceFingerprint: string;
  ipAddress?: string;
  userAgent?: string;
  twoFactorCode?: string;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number; // in days
  preventReuse: number; // number of previous passwords to check
}

export interface SecurityEvent {
  id: string;
  type: 'login_success' | 'login_failure' | 'logout' | 'session_expired' | 'password_change' | 'account_locked' | 'suspicious_activity';
  userId?: string;
  deviceId: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DeviceRegistration {
  deviceId: string;
  deviceName: string;
  fingerprint: string;
  userId: string;
  registeredAt: Date;
  lastSeen: Date;
  trusted: boolean;
  metadata: Record<string, any>;
}

export class AuthenticationService extends EventEmitter {
  private config: AuthenticationConfig;
  private encryptionManager: EncryptionManager;
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private loginAttempts: Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }> = new Map();
  private securityEvents: SecurityEvent[] = [];
  private deviceRegistrations: Map<string, DeviceRegistration> = new Map();
  private passwordHistory: Map<string, string[]> = new Map();
  private sessionCleanupInterval?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(encryptionManager: EncryptionManager, config?: Partial<AuthenticationConfig>) {
    super();
    this.encryptionManager = encryptionManager;
    this.config = {
      sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
      maxLoginAttempts: 5,
      lockoutDuration: 30 * 60 * 1000, // 30 minutes
      requireStrongPassword: true,
      enableTwoFactor: false,
      sessionRefreshInterval: 60 * 60 * 1000, // 1 hour
      auditLogging: true,
      ...config
    };

    this.setupPasswordPolicy();
    this.startSessionCleanup();
    this.loadPersistedData();
  }

  private passwordPolicy: PasswordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90,
    preventReuse: 5
  };

  private setupPasswordPolicy(): void {
    // Password policy can be customized based on security requirements
    if (this.config.requireStrongPassword) {
      this.passwordPolicy = {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxAge: 60,
        preventReuse: 10
      };
    }
  }

  private startSessionCleanup(): void {
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt <= now || !session.isActive) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      const session = this.sessions.get(sessionId);
      if (session) {
        this.logSecurityEvent({
          type: 'session_expired',
          userId: session.userId,
          deviceId: session.deviceId,
          details: { sessionId, reason: 'timeout' },
          severity: 'low'
        });
        
        this.sessions.delete(sessionId);
        this.emit('session_expired', { sessionId, userId: session.userId });
      }
    }

    if (expiredSessions.length > 0) {
      this.savePersistedData();
    }
  }

  private loadPersistedData(): void {
    try {
      // Load users from secure storage
      const usersData = localStorage.getItem('auth_users');
      if (usersData) {
        const decrypted = this.encryptionManager.decrypt(usersData);
        const users = JSON.parse(decrypted);
        this.users = new Map(users.map((u: any) => [u.id, {
          ...u,
          createdAt: new Date(u.createdAt),
          lastLogin: u.lastLogin ? new Date(u.lastLogin) : undefined
        }]));
      }

      // Load device registrations
      const devicesData = localStorage.getItem('auth_devices');
      if (devicesData) {
        const decrypted = this.encryptionManager.decrypt(devicesData);
        const devices = JSON.parse(decrypted);
        this.deviceRegistrations = new Map(devices.map((d: any) => [d.deviceId, {
          ...d,
          registeredAt: new Date(d.registeredAt),
          lastSeen: new Date(d.lastSeen)
        }]));
      }

      // Load password history
      const passwordData = localStorage.getItem('auth_passwords');
      if (passwordData) {
        const decrypted = this.encryptionManager.decrypt(passwordData);
        this.passwordHistory = new Map(JSON.parse(decrypted));
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to load persisted authentication data:', error);
      this.isInitialized = true;
    }
  }

  private savePersistedData(): void {
    try {
      // Save users
      const usersArray = Array.from(this.users.values());
      const usersEncrypted = this.encryptionManager.encrypt(JSON.stringify(usersArray));
      localStorage.setItem('auth_users', usersEncrypted);

      // Save device registrations
      const devicesArray = Array.from(this.deviceRegistrations.values());
      const devicesEncrypted = this.encryptionManager.encrypt(JSON.stringify(devicesArray));
      localStorage.setItem('auth_devices', devicesEncrypted);

      // Save password history
      const passwordsArray = Array.from(this.passwordHistory.entries());
      const passwordsEncrypted = this.encryptionManager.encrypt(JSON.stringify(passwordsArray));
      localStorage.setItem('auth_passwords', passwordsEncrypted);

    } catch (error) {
      console.error('Failed to save persisted authentication data:', error);
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create default admin user if no users exist
    if (this.users.size === 0) {
      await this.createDefaultAdmin();
    }

    this.isInitialized = true;
    this.emit('initialized');
  }

  private async createDefaultAdmin(): Promise<void> {
    const adminUser: User = {
      id: 'admin',
      username: 'admin',
      email: 'admin@blackmagic-bluetooth.local',
      roles: ['admin', 'user'],
      permissions: ['*'], // All permissions
      createdAt: new Date(),
      isActive: true,
      metadata: { isDefault: true }
    };

    this.users.set(adminUser.id, adminUser);
    
    // Set default password (should be changed on first login)
    const defaultPassword = 'admin123!';
    const hashedPassword = await this.hashPassword(defaultPassword);
    this.passwordHistory.set(adminUser.id, [hashedPassword]);

    this.savePersistedData();
    
    this.logSecurityEvent({
      type: 'login_success',
      userId: adminUser.id,
      deviceId: 'system',
      details: { action: 'default_admin_created' },
      severity: 'medium'
    });
  }

  async authenticate(credentials: LoginCredentials): Promise<AuthenticationResult> {
    const { username, password, deviceId, deviceFingerprint, ipAddress, userAgent, twoFactorCode } = credentials;

    // Check if account is locked
    const lockStatus = this.checkAccountLockStatus(username);
    if (lockStatus.isLocked) {
      this.logSecurityEvent({
        type: 'login_failure',
        deviceId,
        details: { username, reason: 'account_locked' },
        severity: 'medium'
      });

      return {
        success: false,
        error: 'Account is locked',
        lockoutUntil: lockStatus.lockedUntil
      };
    }

    // Find user
    const user = Array.from(this.users.values()).find(u => 
      u.username === username && u.isActive
    );

    if (!user) {
      this.recordFailedLogin(username);
      this.logSecurityEvent({
        type: 'login_failure',
        deviceId,
        details: { username, reason: 'user_not_found' },
        severity: 'medium'
      });

      return {
        success: false,
        error: 'Invalid credentials'
      };
    }

    // Verify password
    const passwordHashes = this.passwordHistory.get(user.id) || [];
    const currentPasswordHash = passwordHashes[passwordHashes.length - 1];
    
    if (!currentPasswordHash || !await this.verifyPassword(password, currentPasswordHash)) {
      this.recordFailedLogin(username);
      this.logSecurityEvent({
        type: 'login_failure',
        userId: user.id,
        deviceId,
        details: { reason: 'invalid_password' },
        severity: 'high'
      });

      return {
        success: false,
        error: 'Invalid credentials'
      };
    }

    // Check if device is registered and trusted
    const deviceReg = this.deviceRegistrations.get(deviceId);
    if (!deviceReg || deviceReg.fingerprint !== deviceFingerprint) {
      // New device registration required
      await this.registerDevice({
        deviceId,
        deviceName: userAgent || 'Unknown Device',
        fingerprint: deviceFingerprint,
        userId: user.id,
        registeredAt: new Date(),
        lastSeen: new Date(),
        trusted: false,
        metadata: { ipAddress, userAgent }
      });

      // For security, require manual device approval for now
      this.logSecurityEvent({
        type: 'suspicious_activity',
        userId: user.id,
        deviceId,
        details: { reason: 'new_device_detected', fingerprint: deviceFingerprint },
        severity: 'high'
      });
    }

    // Check two-factor authentication if enabled
    if (this.config.enableTwoFactor && !twoFactorCode) {
      return {
        success: false,
        requiresTwoFactor: true,
        error: 'Two-factor authentication required'
      };
    }

    if (this.config.enableTwoFactor && twoFactorCode) {
      const twoFactorValid = await this.verifyTwoFactor(user.id, twoFactorCode);
      if (!twoFactorValid) {
        this.recordFailedLogin(username);
        this.logSecurityEvent({
          type: 'login_failure',
          userId: user.id,
          deviceId,
          details: { reason: 'invalid_2fa' },
          severity: 'high'
        });

        return {
          success: false,
          error: 'Invalid two-factor code'
        };
      }
    }

    // Create session
    const session = await this.createSession(user, deviceId, deviceFingerprint, ipAddress, userAgent);
    const token = await this.generateAccessToken(session);

    // Update user login info
    user.lastLogin = new Date();
    this.users.set(user.id, user);

    // Clear failed login attempts
    this.loginAttempts.delete(username);

    // Update device last seen
    if (deviceReg) {
      deviceReg.lastSeen = new Date();
      this.deviceRegistrations.set(deviceId, deviceReg);
    }

    this.savePersistedData();

    this.logSecurityEvent({
      type: 'login_success',
      userId: user.id,
      deviceId,
      details: { sessionId: session.id },
      severity: 'low'
    });

    this.emit('user_authenticated', { user, session });

    return {
      success: true,
      user,
      session,
      token,
      refreshToken: session.refreshToken
    };
  }

  private checkAccountLockStatus(username: string): { isLocked: boolean; lockedUntil?: Date } {
    const attempts = this.loginAttempts.get(username);
    if (!attempts) return { isLocked: false };

    if (attempts.lockedUntil && attempts.lockedUntil > new Date()) {
      return { isLocked: true, lockedUntil: attempts.lockedUntil };
    }

    return { isLocked: false };
  }

  private recordFailedLogin(username: string): void {
    const attempts = this.loginAttempts.get(username) || { count: 0, lastAttempt: new Date() };
    attempts.count++;
    attempts.lastAttempt = new Date();

    if (attempts.count >= this.config.maxLoginAttempts) {
      attempts.lockedUntil = new Date(Date.now() + this.config.lockoutDuration);
      
      this.logSecurityEvent({
        type: 'account_locked',
        deviceId: 'system',
        details: { username, attempts: attempts.count },
        severity: 'high'
      });
    }

    this.loginAttempts.set(username, attempts);
  }

  private async createSession(
    user: User,
    deviceId: string,
    deviceFingerprint: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Session> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionTimeout);
    const refreshToken = await this.generateRefreshToken();

    const session: Session = {
      id: sessionId,
      userId: user.id,
      deviceId,
      createdAt: now,
      lastActivity: now,
      expiresAt,
      ipAddress,
      userAgent,
      isActive: true,
      refreshToken,
      deviceFingerprint
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async refreshSession(refreshToken: string): Promise<AuthenticationResult> {
    // Find session by refresh token
    const session = Array.from(this.sessions.values()).find(s => 
      s.refreshToken === refreshToken && s.isActive
    );

    if (!session || session.expiresAt <= new Date()) {
      return {
        success: false,
        error: 'Invalid refresh token'
      };
    }

    // Update session
    session.lastActivity = new Date();
    session.expiresAt = new Date(Date.now() + this.config.sessionTimeout);
    session.refreshToken = await this.generateRefreshToken();

    const user = this.users.get(session.userId);
    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }

    const token = await this.generateAccessToken(session);
    
    this.sessions.set(session.id, session);

    return {
      success: true,
      user,
      session,
      token,
      refreshToken: session.refreshToken
    };
  }

  async logout(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.isActive = false;
    this.sessions.delete(sessionId);

    this.logSecurityEvent({
      type: 'logout',
      userId: session.userId,
      deviceId: session.deviceId,
      details: { sessionId },
      severity: 'low'
    });

    this.emit('user_logout', { sessionId, userId: session.userId });
    
    this.savePersistedData();
    return true;
  }

  async validateSession(token: string): Promise<{ valid: boolean; session?: Session; user?: User }> {
    try {
      const payload = await this.verifyAccessToken(token);
      const session = this.sessions.get(payload.sessionId);
      
      if (!session || !session.isActive || session.expiresAt <= new Date()) {
        return { valid: false };
      }

      // Update last activity
      session.lastActivity = new Date();
      this.sessions.set(session.id, session);

      const user = this.users.get(session.userId);
      if (!user || !user.isActive) {
        return { valid: false };
      }

      return { valid: true, session, user };
    } catch (error) {
      return { valid: false };
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    // Verify current password
    const passwordHashes = this.passwordHistory.get(userId) || [];
    const currentPasswordHash = passwordHashes[passwordHashes.length - 1];
    
    if (!currentPasswordHash || !await this.verifyPassword(currentPassword, currentPasswordHash)) {
      return false;
    }

    // Validate new password
    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Check password reuse
    const canReusePassword = await this.checkPasswordReuse(userId, newPassword);
    if (!canReusePassword) {
      throw new Error(`Cannot reuse recent passwords`);
    }

    // Hash and store new password
    const newPasswordHash = await this.hashPassword(newPassword);
    const updatedHistory = [...passwordHashes, newPasswordHash].slice(-this.passwordPolicy.preventReuse);
    this.passwordHistory.set(userId, updatedHistory);

    this.savePersistedData();

    this.logSecurityEvent({
      type: 'password_change',
      userId,
      deviceId: 'system',
      details: {},
      severity: 'low'
    });

    return true;
  }

  private validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.passwordPolicy.minLength) {
      errors.push(`Password must be at least ${this.passwordPolicy.minLength} characters long`);
    }

    if (this.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.passwordPolicy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.passwordPolicy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return { valid: errors.length === 0, errors };
  }

  private async checkPasswordReuse(userId: string, newPassword: string): Promise<boolean> {
    const passwordHashes = this.passwordHistory.get(userId) || [];
    
    for (const hash of passwordHashes) {
      if (await this.verifyPassword(newPassword, hash)) {
        return false;
      }
    }
    
    return true;
  }

  async registerDevice(registration: DeviceRegistration): Promise<void> {
    this.deviceRegistrations.set(registration.deviceId, registration);
    this.savePersistedData();
    
    this.logSecurityEvent({
      type: 'suspicious_activity',
      userId: registration.userId,
      deviceId: registration.deviceId,
      details: { action: 'device_registered', fingerprint: registration.fingerprint },
      severity: 'medium'
    });

    this.emit('device_registered', registration);
  }

  async createUser(userData: Partial<User>, password: string): Promise<User> {
    if (!this.isInitialized) {
      throw new Error('Authentication service not initialized');
    }

    const userId = this.generateUserId();
    const user: User = {
      id: userId,
      username: userData.username!,
      email: userData.email,
      roles: userData.roles || ['user'],
      permissions: userData.permissions || [],
      createdAt: new Date(),
      isActive: true,
      metadata: userData.metadata || {}
    };

    // Validate and hash password
    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    const hashedPassword = await this.hashPassword(password);
    this.passwordHistory.set(userId, [hashedPassword]);

    this.users.set(userId, user);
    this.savePersistedData();

    this.emit('user_created', user);
    return user;
  }

  private async hashPassword(password: string): Promise<string> {
    // Use encryption manager to hash password securely
    return this.encryptionManager.hash(password);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return this.encryptionManager.verifyHash(password, hash);
  }

  private async generateAccessToken(session: Session): Promise<string> {
    const payload = {
      sessionId: session.id,
      userId: session.userId,
      deviceId: session.deviceId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(session.expiresAt.getTime() / 1000)
    };

    return this.encryptionManager.signJWT(payload, '1h');
  }

  private async verifyAccessToken(token: string): Promise<any> {
    return this.encryptionManager.verifyJWT(token);
  }

  private async generateRefreshToken(): Promise<string> {
    return this.encryptionManager.generateSecureToken(32);
  }

  private async verifyTwoFactor(userId: string, code: string): Promise<boolean> {
    // Placeholder for 2FA implementation
    // In a real implementation, this would verify TOTP codes or similar
    return code === '123456'; // Demo code
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logSecurityEvent(eventData: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    const event: SecurityEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...eventData
    };

    this.securityEvents.push(event);

    // Keep only recent events (last 1000)
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    if (this.config.auditLogging) {
      console.log(`[SECURITY] ${event.type}: ${JSON.stringify(event.details)}`);
    }

    this.emit('security_event', event);
  }

  // Public API methods
  getUsers(): User[] {
    return Array.from(this.users.values()).map(user => ({
      ...user,
      // Don't expose sensitive data
    }));
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getSessions(): Session[] {
    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }

  getSecurityEvents(limit = 100): SecurityEvent[] {
    return this.securityEvents.slice(-limit);
  }

  getDeviceRegistrations(userId?: string): DeviceRegistration[] {
    const devices = Array.from(this.deviceRegistrations.values());
    return userId ? devices.filter(d => d.userId === userId) : devices;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    Object.assign(user, updates);
    this.users.set(userId, user);
    this.savePersistedData();

    this.emit('user_updated', user);
    return true;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    // Deactivate instead of deleting to maintain audit trail
    user.isActive = false;
    this.users.set(userId, user);

    // Invalidate all user sessions
    const userSessions = Array.from(this.sessions.values()).filter(s => s.userId === userId);
    for (const session of userSessions) {
      session.isActive = false;
    }

    this.savePersistedData();

    this.logSecurityEvent({
      type: 'suspicious_activity',
      userId,
      deviceId: 'system',
      details: { action: 'user_deactivated' },
      severity: 'medium'
    });

    this.emit('user_deleted', userId);
    return true;
  }

  async approveDevice(deviceId: string): Promise<boolean> {
    const device = this.deviceRegistrations.get(deviceId);
    if (!device) return false;

    device.trusted = true;
    this.deviceRegistrations.set(deviceId, device);
    this.savePersistedData();

    this.logSecurityEvent({
      type: 'suspicious_activity',
      userId: device.userId,
      deviceId,
      details: { action: 'device_approved' },
      severity: 'low'
    });

    this.emit('device_approved', device);
    return true;
  }

  async revokeDevice(deviceId: string): Promise<boolean> {
    const device = this.deviceRegistrations.get(deviceId);
    if (!device) return false;

    // Invalidate all sessions for this device
    const deviceSessions = Array.from(this.sessions.values()).filter(s => s.deviceId === deviceId);
    for (const session of deviceSessions) {
      session.isActive = false;
      this.sessions.delete(session.id);
    }

    this.deviceRegistrations.delete(deviceId);
    this.savePersistedData();

    this.logSecurityEvent({
      type: 'suspicious_activity',
      userId: device.userId,
      deviceId,
      details: { action: 'device_revoked' },
      severity: 'medium'
    });

    this.emit('device_revoked', deviceId);
    return true;
  }

  updateConfig(config: Partial<AuthenticationConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config_updated', this.config);
  }

  getConfig(): AuthenticationConfig {
    return { ...this.config };
  }

  destroy(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
      this.sessionCleanupInterval = undefined;
    }
    
    this.removeAllListeners();
  }
}