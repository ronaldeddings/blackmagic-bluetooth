import { VERIFIED_SERVICE_UUIDS } from '../bluetooth/constants';
import type { SecurityAssessment, BluetoothServiceUUID } from '@/types';

export class SecurityAnalyzer {
  private static instance: SecurityAnalyzer;
  private riskThresholds = {
    critical: ['Nordic DFU Service', 'File Transfer Profile'],
    high: ['Human Interface Device', 'Object Push Profile', 'Audio Source'],
    medium: ['Generic Access Profile', 'Generic Attribute Profile', 'Device Information Service', 'Audio Sink'],
    low: ['Battery Service']
  };

  private constructor() {}

  static getInstance(): SecurityAnalyzer {
    if (!SecurityAnalyzer.instance) {
      SecurityAnalyzer.instance = new SecurityAnalyzer();
    }
    return SecurityAnalyzer.instance;
  }

  /**
   * Generate comprehensive security assessment
   */
  generateSecurityAssessment(services: BluetoothRemoteGATTService[]): SecurityAssessment {
    const serviceNames = services.map(s => this.getServiceName(s.uuid));
    const riskLevels = this.assessServiceRisks(serviceNames);
    
    const highestRisk = this.determineHighestRisk(riskLevels);
    const recommendations = this.generateRecommendations(serviceNames, riskLevels);

    return {
      riskLevel: highestRisk,
      services: serviceNames,
      recommendations
    };
  }

  /**
   * Assess risks for individual services
   */
  private assessServiceRisks(serviceNames: string[]): Record<string, 'Critical' | 'High' | 'Medium' | 'Low'> {
    const risks: Record<string, 'Critical' | 'High' | 'Medium' | 'Low'> = {};

    serviceNames.forEach(serviceName => {
      if (this.riskThresholds.critical.some(critical => serviceName.includes(critical))) {
        risks[serviceName] = 'Critical';
      } else if (this.riskThresholds.high.some(high => serviceName.includes(high))) {
        risks[serviceName] = 'High';
      } else if (this.riskThresholds.medium.some(medium => serviceName.includes(medium))) {
        risks[serviceName] = 'Medium';
      } else {
        risks[serviceName] = 'Low';
      }
    });

    return risks;
  }

  /**
   * Determine the highest risk level from all services
   */
  private determineHighestRisk(risks: Record<string, 'Critical' | 'High' | 'Medium' | 'Low'>): 'Critical' | 'High' | 'Medium' | 'Low' {
    const riskValues = Object.values(risks);
    
    if (riskValues.includes('Critical')) return 'Critical';
    if (riskValues.includes('High')) return 'High';
    if (riskValues.includes('Medium')) return 'Medium';
    return 'Low';
  }

  /**
   * Generate security recommendations based on discovered services
   */
  private generateRecommendations(
    serviceNames: string[], 
    risks: Record<string, 'Critical' | 'High' | 'Medium' | 'Low'>
  ): string[] {
    const recommendations: string[] = [];

    // Check for critical services
    const hasDFU = serviceNames.some(name => name.includes('DFU'));
    const hasFileTransfer = serviceNames.some(name => name.includes('File Transfer'));
    const hasHID = serviceNames.some(name => name.includes('Human Interface'));
    const hasObjectPush = serviceNames.some(name => name.includes('Object Push'));
    const hasAudioSource = serviceNames.some(name => name.includes('Audio Source'));

    if (hasDFU) {
      recommendations.push('🚨 CRITICAL: Nordic DFU Service detected - Firmware modification possible');
      recommendations.push('📋 Monitor all DFU operations and implement access controls');
      recommendations.push('🔒 Consider disabling DFU service when not actively updating firmware');
    }

    if (hasFileTransfer) {
      recommendations.push('🚨 CRITICAL: File Transfer Profile detected - File system access possible');
      recommendations.push('📋 Implement strict file access controls and validation');
      recommendations.push('🔍 Monitor all file transfer operations for suspicious activity');
    }

    if (hasHID) {
      recommendations.push('⚠️ HIGH RISK: Human Interface Device service - Remote control capability');
      recommendations.push('📋 Implement user confirmation for critical camera operations');
      recommendations.push('🔐 Consider implementing operation timeouts and session limits');
    }

    if (hasObjectPush) {
      recommendations.push('⚠️ HIGH RISK: Object Push Profile - File upload capability detected');
      recommendations.push('📋 Validate all uploaded files and scan for malicious content');
      recommendations.push('💾 Implement file size limits and type restrictions');
    }

    if (hasAudioSource) {
      recommendations.push('⚠️ HIGH RISK: Audio Source service - Microphone access for surveillance');
      recommendations.push('📋 Monitor audio streaming sessions and implement privacy controls');
      recommendations.push('🔇 Provide clear indicators when audio is being accessed');
    }

    // General recommendations
    recommendations.push('📊 Regularly audit Bluetooth connections and active services');
    recommendations.push('🔄 Keep firmware updated to patch known vulnerabilities');
    recommendations.push('📝 Maintain logs of all Bluetooth operations for security analysis');
    
    if (risks['Critical'] || risks['High']) {
      recommendations.push('🚫 Disable Bluetooth when not actively needed');
      recommendations.push('🛡️ Implement network segmentation for camera devices');
    }

    return recommendations;
  }

  /**
   * Get detailed risk analysis for a specific service
   */
  analyzeServiceSecurity(serviceUuid: string) {
    const serviceName = this.getServiceName(serviceUuid);
    const service = Object.values(VERIFIED_SERVICE_UUIDS).find(s => 
      this.formatUuidForWebBluetooth(s.uuid) === serviceUuid
    );

    if (!service) {
      return {
        serviceName,
        riskLevel: 'Low' as const,
        threats: ['Unknown service - limited threat assessment available'],
        mitigations: ['Monitor service usage', 'Disable if not needed']
      };
    }

    return this.getServiceThreatProfile(service);
  }

  /**
   * Get threat profile for a specific service
   */
  private getServiceThreatProfile(service: BluetoothServiceUUID) {
    const serviceName = service.name;
    let riskLevel: 'Critical' | 'High' | 'Medium' | 'Low' = 'Low';
    const threats: string[] = [];
    const mitigations: string[] = [];

    switch (serviceName) {
      case 'Nordic DFU Service':
        riskLevel = 'Critical';
        threats.push(
          'Firmware replacement and modification',
          'Bootloader compromise',
          'Persistent backdoor installation',
          'Device bricking through malformed updates'
        );
        mitigations.push(
          'Implement cryptographic signature verification',
          'Use secure boot process',
          'Restrict DFU access to authenticated users only',
          'Maintain firmware rollback capability'
        );
        break;

      case 'File Transfer Profile':
        riskLevel = 'Critical';
        threats.push(
          'Unauthorized file system access',
          'Data exfiltration',
          'Malicious file injection',
          'Storage exhaustion attacks'
        );
        mitigations.push(
          'Implement strict file access controls',
          'Validate all file operations',
          'Use sandboxed file access',
          'Monitor file system operations'
        );
        break;

      case 'Human Interface Device':
        riskLevel = 'High';
        threats.push(
          'Unauthorized camera control',
          'Recording manipulation',
          'Settings modification',
          'Remote operation without user consent'
        );
        mitigations.push(
          'Require user confirmation for critical operations',
          'Implement operation logging',
          'Use session timeouts',
          'Provide visual indicators for remote control'
        );
        break;

      case 'Object Push Profile':
        riskLevel = 'High';
        threats.push(
          'Malicious file uploads',
          'Storage space exhaustion',
          'Configuration file manipulation',
          'Script injection attacks'
        );
        mitigations.push(
          'Validate file types and content',
          'Implement file size limits',
          'Scan uploads for malicious content',
          'Use secure file handling practices'
        );
        break;

      case 'Audio Source':
        riskLevel = 'High';
        threats.push(
          'Unauthorized microphone access',
          'Audio surveillance',
          'Privacy violations',
          'Covert recording'
        );
        mitigations.push(
          'Provide clear audio access indicators',
          'Implement user consent mechanisms',
          'Monitor audio streaming sessions',
          'Allow user to disable audio access'
        );
        break;

      case 'Generic Access Profile':
      case 'Generic Attribute Profile':
      case 'Device Information Service':
        riskLevel = 'Medium';
        threats.push(
          'Device fingerprinting',
          'Information disclosure',
          'Connection manipulation'
        );
        mitigations.push(
          'Limit exposed device information',
          'Monitor connection attempts',
          'Implement rate limiting'
        );
        break;

      default:
        riskLevel = 'Low';
        threats.push('Standard service with minimal security risk');
        mitigations.push('Follow standard Bluetooth security practices');
    }

    return {
      serviceName,
      riskLevel,
      threats,
      mitigations,
      occurrences: service.verified.littleEndian.occurrences + service.verified.bigEndian.occurrences
    };
  }

  /**
   * Generate security audit report
   */
  generateAuditReport(services: BluetoothRemoteGATTService[]) {
    const assessment = this.generateSecurityAssessment(services);
    const serviceDetails = services.map(s => this.analyzeServiceSecurity(s.uuid));
    
    const criticalServices = serviceDetails.filter(s => s.riskLevel === 'Critical');
    const highRiskServices = serviceDetails.filter(s => s.riskLevel === 'High');
    const mediumRiskServices = serviceDetails.filter(s => s.riskLevel === 'Medium');
    const lowRiskServices = serviceDetails.filter(s => s.riskLevel === 'Low');

    return {
      summary: assessment,
      serviceBreakdown: {
        critical: criticalServices,
        high: highRiskServices,
        medium: mediumRiskServices,
        low: lowRiskServices
      },
      totalServices: services.length,
      riskDistribution: {
        critical: criticalServices.length,
        high: highRiskServices.length,
        medium: mediumRiskServices.length,
        low: lowRiskServices.length
      },
      overallRisk: assessment.riskLevel,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Check if operation should require additional security measures
   */
  requiresSecurityConfirmation(serviceUuid: string, operation: string): boolean {
    const serviceName = this.getServiceName(serviceUuid);
    
    // Always require confirmation for critical services
    if (this.riskThresholds.critical.some(critical => serviceName.includes(critical))) {
      return true;
    }

    // Require confirmation for high-risk operations on high-risk services
    if (this.riskThresholds.high.some(high => serviceName.includes(high))) {
      const highRiskOperations = ['write', 'execute', 'upload', 'download', 'control'];
      return highRiskOperations.some(op => operation.toLowerCase().includes(op));
    }

    return false;
  }

  /**
   * Format UUID for Web Bluetooth API
   */
  private formatUuidForWebBluetooth(uuid: number): string {
    const hex = uuid.toString(16).padStart(4, '0');
    return `0000${hex}-0000-1000-8000-00805f9b34fb`;
  }

  /**
   * Get service name from UUID
   */
  private getServiceName(uuid: string): string {
    const serviceMap: Record<string, string> = {
      '00001800-0000-1000-8000-00805f9b34fb': 'Generic Access Profile',
      '00001801-0000-1000-8000-00805f9b34fb': 'Generic Attribute Profile',
      '0000180a-0000-1000-8000-00805f9b34fb': 'Device Information Service',
      '0000180f-0000-1000-8000-00805f9b34fb': 'Battery Service',
      '00001812-0000-1000-8000-00805f9b34fb': 'Human Interface Device',
      '0000110a-0000-1000-8000-00805f9b34fb': 'Audio Source',
      '0000110b-0000-1000-8000-00805f9b34fb': 'Audio Sink',
      '00001105-0000-1000-8000-00805f9b34fb': 'Object Push Profile',
      '00001106-0000-1000-8000-00805f9b34fb': 'File Transfer Profile',
      '0000fe59-0000-1000-8000-00805f9b34fb': 'Nordic DFU Service'
    };

    return serviceMap[uuid] || `Unknown Service (${uuid})`;
  }
}