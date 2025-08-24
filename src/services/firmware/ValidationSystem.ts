import { EventEmitter } from 'events';
import { FirmwareInfo } from './FirmwareUpdateService';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: 'compatibility' | 'safety' | 'performance' | 'stability';
  enabled: boolean;
  validator: (context: ValidationContext) => Promise<ValidationResult>;
}

export interface ValidationContext {
  deviceId: string;
  deviceInfo: DeviceInfo;
  currentFirmware: FirmwareInfo;
  targetFirmware: FirmwareInfo;
  environment: ValidationEnvironment;
  userPreferences: UserValidationPreferences;
}

export interface DeviceInfo {
  model: string;
  serialNumber: string;
  hardwareRevision: string;
  bootloaderVersion: string;
  currentFirmwareVersion: string;
  batteryLevel?: number;
  temperatureCelsius?: number;
  storageSpace?: {
    total: number;
    free: number;
  };
  connectedAccessories: string[];
  lastUpdateDate?: Date;
  updateHistory: FirmwareUpdateRecord[];
}

export interface FirmwareUpdateRecord {
  version: string;
  date: Date;
  successful: boolean;
  rollbackRequired: boolean;
  notes?: string;
}

export interface ValidationEnvironment {
  connectionType: 'bluetooth' | 'usb' | 'ethernet';
  signalStrength: number; // 0-100
  networkStability: 'poor' | 'fair' | 'good' | 'excellent';
  powerSource: 'battery' | 'ac' | 'unknown';
  ambientTemperature?: number;
  interferenceLevel: 'none' | 'low' | 'medium' | 'high';
}

export interface UserValidationPreferences {
  skipNonCriticalWarnings: boolean;
  allowBetaFirmware: boolean;
  requirePowerConnection: boolean;
  minimumBatteryLevel: number;
  backupRequired: boolean;
  testModeEnabled: boolean;
}

export interface ValidationResult {
  ruleId: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  suggestedActions?: string[];
  canProceedWithWarning?: boolean;
  estimatedRisk: 'low' | 'medium' | 'high' | 'critical';
  affectedFeatures?: string[];
}

export interface ValidationReport {
  deviceId: string;
  targetFirmware: string;
  timestamp: Date;
  overallResult: 'pass' | 'warning' | 'fail';
  results: ValidationResult[];
  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    errors: number;
    criticalErrors: number;
  };
  recommendations: string[];
  canProceed: boolean;
  requiresUserConsent: boolean;
}

export class ValidationSystem extends EventEmitter {
  private rules: Map<string, ValidationRule> = new Map();
  private validationHistory: Map<string, ValidationReport[]> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    const rules: ValidationRule[] = [
      {
        id: 'model-compatibility',
        name: 'Model Compatibility',
        description: 'Verify firmware is compatible with device model',
        severity: 'error',
        category: 'compatibility',
        enabled: true,
        validator: this.validateModelCompatibility.bind(this)
      },
      {
        id: 'bootloader-version',
        name: 'Bootloader Version',
        description: 'Check if bootloader version is sufficient',
        severity: 'error',
        category: 'compatibility',
        enabled: true,
        validator: this.validateBootloaderVersion.bind(this)
      },
      {
        id: 'battery-level',
        name: 'Battery Level',
        description: 'Ensure sufficient battery for update',
        severity: 'warning',
        category: 'safety',
        enabled: true,
        validator: this.validateBatteryLevel.bind(this)
      },
      {
        id: 'connection-stability',
        name: 'Connection Stability',
        description: 'Check connection quality for reliable update',
        severity: 'warning',
        category: 'safety',
        enabled: true,
        validator: this.validateConnectionStability.bind(this)
      },
      {
        id: 'storage-space',
        name: 'Storage Space',
        description: 'Verify sufficient storage for firmware installation',
        severity: 'error',
        category: 'compatibility',
        enabled: true,
        validator: this.validateStorageSpace.bind(this)
      },
      {
        id: 'version-downgrade',
        name: 'Version Downgrade',
        description: 'Warn about potential issues with downgrading firmware',
        severity: 'warning',
        category: 'stability',
        enabled: true,
        validator: this.validateVersionDowngrade.bind(this)
      },
      {
        id: 'beta-firmware',
        name: 'Beta Firmware',
        description: 'Warn about installing beta or unstable firmware',
        severity: 'warning',
        category: 'stability',
        enabled: true,
        validator: this.validateBetaFirmware.bind(this)
      },
      {
        id: 'recent-update',
        name: 'Recent Update',
        description: 'Check for too frequent updates',
        severity: 'info',
        category: 'stability',
        enabled: true,
        validator: this.validateRecentUpdate.bind(this)
      },
      {
        id: 'temperature-check',
        name: 'Device Temperature',
        description: 'Ensure device is not overheating',
        severity: 'warning',
        category: 'safety',
        enabled: true,
        validator: this.validateTemperature.bind(this)
      },
      {
        id: 'accessory-compatibility',
        name: 'Accessory Compatibility',
        description: 'Check if connected accessories are compatible',
        severity: 'warning',
        category: 'compatibility',
        enabled: true,
        validator: this.validateAccessoryCompatibility.bind(this)
      },
      {
        id: 'breaking-changes',
        name: 'Breaking Changes',
        description: 'Warn about features that may be removed or changed',
        severity: 'warning',
        category: 'compatibility',
        enabled: true,
        validator: this.validateBreakingChanges.bind(this)
      },
      {
        id: 'power-source',
        name: 'Power Source',
        description: 'Recommend AC power for firmware updates',
        severity: 'info',
        category: 'safety',
        enabled: true,
        validator: this.validatePowerSource.bind(this)
      }
    ];

    rules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  async validateUpdate(context: ValidationContext): Promise<ValidationReport> {
    const enabledRules = Array.from(this.rules.values()).filter(rule => rule.enabled);
    const results: ValidationResult[] = [];
    
    this.emit('validation-started', { deviceId: context.deviceId, totalRules: enabledRules.length });

    // Run all validation rules
    for (const rule of enabledRules) {
      try {
        const result = await rule.validator(context);
        results.push(result);
        
        this.emit('validation-rule-completed', { 
          deviceId: context.deviceId,
          ruleId: rule.id,
          result
        });
      } catch (error) {
        const errorResult: ValidationResult = {
          ruleId: rule.id,
          passed: false,
          severity: 'error',
          message: `Validation rule failed: ${error.message}`,
          estimatedRisk: 'medium',
          canProceedWithWarning: false
        };
        results.push(errorResult);
      }
    }

    // Generate report
    const report = this.generateReport(context, results);
    
    // Store validation history
    if (!this.validationHistory.has(context.deviceId)) {
      this.validationHistory.set(context.deviceId, []);
    }
    this.validationHistory.get(context.deviceId)!.push(report);

    this.emit('validation-completed', report);
    return report;
  }

  private generateReport(context: ValidationContext, results: ValidationResult[]): ValidationReport {
    const errors = results.filter(r => r.severity === 'error');
    const warnings = results.filter(r => r.severity === 'warning');
    const criticalErrors = results.filter(r => r.severity === 'error' && r.estimatedRisk === 'critical');

    const overallResult = criticalErrors.length > 0 ? 'fail' :
                         errors.length > 0 ? 'fail' :
                         warnings.length > 0 ? 'warning' : 'pass';

    const canProceed = criticalErrors.length === 0 && 
                      (errors.length === 0 || errors.every(e => e.canProceedWithWarning));

    const requiresUserConsent = warnings.length > 0 || 
                               errors.some(e => e.canProceedWithWarning);

    const recommendations = this.generateRecommendations(results, context);

    return {
      deviceId: context.deviceId,
      targetFirmware: context.targetFirmware.version,
      timestamp: new Date(),
      overallResult,
      results,
      summary: {
        totalChecks: results.length,
        passed: results.filter(r => r.passed).length,
        warnings: warnings.length,
        errors: errors.length,
        criticalErrors: criticalErrors.length
      },
      recommendations,
      canProceed,
      requiresUserConsent
    };
  }

  private generateRecommendations(results: ValidationResult[], context: ValidationContext): string[] {
    const recommendations: string[] = [];

    // Power recommendations
    if (context.environment.powerSource === 'battery' && context.deviceInfo.batteryLevel && context.deviceInfo.batteryLevel < 80) {
      recommendations.push('Connect to AC power before starting the update to prevent interruptions.');
    }

    // Connection recommendations
    if (context.environment.signalStrength < 70) {
      recommendations.push('Move closer to improve Bluetooth connection strength.');
    }

    // Storage recommendations
    if (context.deviceInfo.storageSpace && context.deviceInfo.storageSpace.free < context.targetFirmware.size * 2) {
      recommendations.push('Free up storage space before updating.');
    }

    // Backup recommendations
    if (context.userPreferences.backupRequired) {
      recommendations.push('Create a backup of current firmware before proceeding.');
    }

    // Temperature recommendations
    if (context.deviceInfo.temperatureCelsius && context.deviceInfo.temperatureCelsius > 35) {
      recommendations.push('Allow device to cool down before updating.');
    }

    // Add specific recommendations from failed validations
    results.forEach(result => {
      if (result.suggestedActions) {
        recommendations.push(...result.suggestedActions);
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  // Validation rule implementations
  private async validateModelCompatibility(context: ValidationContext): Promise<ValidationResult> {
    const isCompatible = context.targetFirmware.compatibility.supportedModels.includes(context.deviceInfo.model);

    return {
      ruleId: 'model-compatibility',
      passed: isCompatible,
      severity: 'error',
      message: isCompatible 
        ? `Firmware is compatible with ${context.deviceInfo.model}`
        : `Firmware is not compatible with ${context.deviceInfo.model}`,
      details: isCompatible 
        ? `Supported models: ${context.targetFirmware.compatibility.supportedModels.join(', ')}`
        : `This firmware only supports: ${context.targetFirmware.compatibility.supportedModels.join(', ')}`,
      estimatedRisk: isCompatible ? 'low' : 'critical',
      canProceedWithWarning: false
    };
  }

  private async validateBootloaderVersion(context: ValidationContext): Promise<ValidationResult> {
    const currentBootloader = context.deviceInfo.bootloaderVersion;
    const requiredBootloader = context.targetFirmware.compatibility.minBootloaderVersion;
    
    const isCompatible = this.compareVersions(currentBootloader, requiredBootloader) >= 0;

    return {
      ruleId: 'bootloader-version',
      passed: isCompatible,
      severity: 'error',
      message: isCompatible
        ? `Bootloader version ${currentBootloader} is compatible`
        : `Bootloader version ${currentBootloader} is too old`,
      details: isCompatible
        ? `Current: ${currentBootloader}, Required: ${requiredBootloader}+`
        : `Current: ${currentBootloader}, Required: ${requiredBootloader}+`,
      estimatedRisk: isCompatible ? 'low' : 'critical',
      canProceedWithWarning: false,
      suggestedActions: isCompatible ? [] : ['Update bootloader before installing firmware']
    };
  }

  private async validateBatteryLevel(context: ValidationContext): Promise<ValidationResult> {
    const batteryLevel = context.deviceInfo.batteryLevel ?? 100;
    const requiredLevel = context.userPreferences.minimumBatteryLevel;
    const isAcceptable = batteryLevel >= requiredLevel;

    return {
      ruleId: 'battery-level',
      passed: isAcceptable,
      severity: 'warning',
      message: isAcceptable
        ? `Battery level ${batteryLevel}% is sufficient`
        : `Battery level ${batteryLevel}% is below recommended ${requiredLevel}%`,
      estimatedRisk: batteryLevel < 20 ? 'high' : batteryLevel < 50 ? 'medium' : 'low',
      canProceedWithWarning: batteryLevel > 20,
      suggestedActions: isAcceptable ? [] : ['Charge device or connect to AC power']
    };
  }

  private async validateConnectionStability(context: ValidationContext): Promise<ValidationResult> {
    const signalStrength = context.environment.signalStrength;
    const stability = context.environment.networkStability;
    
    const isStable = signalStrength >= 60 && ['good', 'excellent'].includes(stability);

    return {
      ruleId: 'connection-stability',
      passed: isStable,
      severity: 'warning',
      message: isStable
        ? `Connection is stable (${signalStrength}% signal, ${stability})`
        : `Connection may be unstable (${signalStrength}% signal, ${stability})`,
      estimatedRisk: signalStrength < 40 ? 'high' : signalStrength < 60 ? 'medium' : 'low',
      canProceedWithWarning: signalStrength > 30,
      suggestedActions: isStable ? [] : ['Move closer to device', 'Remove interference sources']
    };
  }

  private async validateStorageSpace(context: ValidationContext): Promise<ValidationResult> {
    const storageInfo = context.deviceInfo.storageSpace;
    if (!storageInfo) {
      return {
        ruleId: 'storage-space',
        passed: true,
        severity: 'info',
        message: 'Storage space information not available',
        estimatedRisk: 'low'
      };
    }

    const requiredSpace = context.targetFirmware.size * 1.5; // 50% overhead
    const hasSpace = storageInfo.free >= requiredSpace;

    return {
      ruleId: 'storage-space',
      passed: hasSpace,
      severity: 'error',
      message: hasSpace
        ? `Sufficient storage space available`
        : `Insufficient storage space`,
      details: `Required: ${Math.round(requiredSpace / 1024 / 1024)}MB, Available: ${Math.round(storageInfo.free / 1024 / 1024)}MB`,
      estimatedRisk: hasSpace ? 'low' : 'high',
      canProceedWithWarning: false,
      suggestedActions: hasSpace ? [] : ['Free up storage space', 'Remove unused files or recordings']
    };
  }

  private async validateVersionDowngrade(context: ValidationContext): Promise<ValidationResult> {
    const currentVersion = context.currentFirmware.version;
    const targetVersion = context.targetFirmware.version;
    
    const isDowngrade = this.compareVersions(targetVersion, currentVersion) < 0;

    return {
      ruleId: 'version-downgrade',
      passed: !isDowngrade,
      severity: 'warning',
      message: isDowngrade
        ? `Downgrading from ${currentVersion} to ${targetVersion}`
        : `Upgrading from ${currentVersion} to ${targetVersion}`,
      details: isDowngrade
        ? 'Downgrading may cause compatibility issues or loss of features'
        : 'This is a normal firmware upgrade',
      estimatedRisk: isDowngrade ? 'medium' : 'low',
      canProceedWithWarning: true,
      suggestedActions: isDowngrade ? ['Create backup before downgrading', 'Review changelog for removed features'] : []
    };
  }

  private async validateBetaFirmware(context: ValidationContext): Promise<ValidationResult> {
    const isBeta = !context.targetFirmware.isStable;
    const allowBeta = context.userPreferences.allowBetaFirmware;

    return {
      ruleId: 'beta-firmware',
      passed: !isBeta || allowBeta,
      severity: 'warning',
      message: isBeta
        ? `Installing beta firmware ${context.targetFirmware.version}`
        : `Installing stable firmware ${context.targetFirmware.version}`,
      details: isBeta
        ? 'Beta firmware may contain bugs and is not recommended for production use'
        : 'This is stable, production-ready firmware',
      estimatedRisk: isBeta ? 'medium' : 'low',
      canProceedWithWarning: allowBeta,
      suggestedActions: isBeta && !allowBeta ? ['Enable beta firmware in preferences', 'Consider using stable version'] : []
    };
  }

  private async validateRecentUpdate(context: ValidationContext): Promise<ValidationResult> {
    const lastUpdate = context.deviceInfo.lastUpdateDate;
    const daysSinceUpdate = lastUpdate 
      ? Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;

    const tooRecent = daysSinceUpdate < 1;

    return {
      ruleId: 'recent-update',
      passed: !tooRecent,
      severity: 'info',
      message: tooRecent
        ? `Device was updated ${daysSinceUpdate} day(s) ago`
        : lastUpdate 
          ? `Last updated ${daysSinceUpdate} day(s) ago`
          : 'No recent update history',
      details: tooRecent
        ? 'Frequent updates may indicate instability or configuration issues'
        : '',
      estimatedRisk: tooRecent ? 'low' : 'low',
      canProceedWithWarning: true,
      suggestedActions: tooRecent ? ['Consider waiting before updating again'] : []
    };
  }

  private async validateTemperature(context: ValidationContext): Promise<ValidationResult> {
    const temperature = context.deviceInfo.temperatureCelsius;
    if (temperature === undefined) {
      return {
        ruleId: 'temperature-check',
        passed: true,
        severity: 'info',
        message: 'Device temperature not available',
        estimatedRisk: 'low'
      };
    }

    const isAcceptable = temperature < 40;

    return {
      ruleId: 'temperature-check',
      passed: isAcceptable,
      severity: 'warning',
      message: isAcceptable
        ? `Device temperature ${temperature}°C is normal`
        : `Device temperature ${temperature}°C is elevated`,
      estimatedRisk: temperature > 50 ? 'high' : temperature > 40 ? 'medium' : 'low',
      canProceedWithWarning: temperature < 50,
      suggestedActions: isAcceptable ? [] : ['Allow device to cool down', 'Ensure proper ventilation']
    };
  }

  private async validateAccessoryCompatibility(context: ValidationContext): Promise<ValidationResult> {
    const connectedAccessories = context.deviceInfo.connectedAccessories;
    const incompatibleAccessories = connectedAccessories.filter(accessory => 
      context.targetFirmware.compatibility.deprecatedFeatures.some(feature => 
        accessory.toLowerCase().includes(feature.toLowerCase())
      )
    );

    const hasIncompatible = incompatibleAccessories.length > 0;

    return {
      ruleId: 'accessory-compatibility',
      passed: !hasIncompatible,
      severity: 'warning',
      message: hasIncompatible
        ? `Some connected accessories may be incompatible`
        : 'All connected accessories appear compatible',
      details: hasIncompatible
        ? `Potentially incompatible: ${incompatibleAccessories.join(', ')}`
        : `Connected: ${connectedAccessories.join(', ')}`,
      estimatedRisk: hasIncompatible ? 'medium' : 'low',
      canProceedWithWarning: true,
      affectedFeatures: hasIncompatible ? incompatibleAccessories : [],
      suggestedActions: hasIncompatible ? ['Disconnect incompatible accessories', 'Check accessory firmware compatibility'] : []
    };
  }

  private async validateBreakingChanges(context: ValidationContext): Promise<ValidationResult> {
    const deprecatedFeatures = context.targetFirmware.compatibility.deprecatedFeatures;
    const hasBreakingChanges = deprecatedFeatures.length > 0;

    return {
      ruleId: 'breaking-changes',
      passed: !hasBreakingChanges,
      severity: 'warning',
      message: hasBreakingChanges
        ? 'This update removes or changes some features'
        : 'No breaking changes in this update',
      details: hasBreakingChanges
        ? `Deprecated features: ${deprecatedFeatures.join(', ')}`
        : 'All current features remain supported',
      estimatedRisk: hasBreakingChanges ? 'medium' : 'low',
      canProceedWithWarning: true,
      affectedFeatures: deprecatedFeatures,
      suggestedActions: hasBreakingChanges ? ['Review changelog for feature changes', 'Update workflows that depend on deprecated features'] : []
    };
  }

  private async validatePowerSource(context: ValidationContext): Promise<ValidationResult> {
    const powerSource = context.environment.powerSource;
    const requireAC = context.userPreferences.requirePowerConnection;
    const hasAC = powerSource === 'ac';

    return {
      ruleId: 'power-source',
      passed: !requireAC || hasAC,
      severity: 'info',
      message: hasAC
        ? 'Device is connected to AC power'
        : `Device is running on ${powerSource} power`,
      details: requireAC && !hasAC
        ? 'AC power is recommended for firmware updates'
        : '',
      estimatedRisk: 'low',
      canProceedWithWarning: true,
      suggestedActions: requireAC && !hasAC ? ['Connect to AC power before updating'] : []
    };
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  // Rule management methods
  addRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
    this.emit('rule-added', rule);
  }

  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);
      this.emit('rule-removed', rule);
    }
  }

  updateRule(ruleId: string, updates: Partial<ValidationRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      const updatedRule = { ...rule, ...updates };
      this.rules.set(ruleId, updatedRule);
      this.emit('rule-updated', updatedRule);
    }
  }

  getRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  getRule(ruleId: string): ValidationRule | null {
    return this.rules.get(ruleId) || null;
  }

  enableRule(ruleId: string): void {
    this.updateRule(ruleId, { enabled: true });
  }

  disableRule(ruleId: string): void {
    this.updateRule(ruleId, { enabled: false });
  }

  getValidationHistory(deviceId: string): ValidationReport[] {
    return this.validationHistory.get(deviceId) || [];
  }

  clearValidationHistory(deviceId?: string): void {
    if (deviceId) {
      this.validationHistory.delete(deviceId);
    } else {
      this.validationHistory.clear();
    }
  }
}