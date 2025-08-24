import type { 
  ServiceDiscoveryResult,
  ProcessedServiceData,
  FirmwareAnalysisResult 
} from '@/types';

export class DataProcessor {
  private static instance: DataProcessor;

  private constructor() {}

  static getInstance(): DataProcessor {
    if (!DataProcessor.instance) {
      DataProcessor.instance = new DataProcessor();
    }
    return DataProcessor.instance;
  }

  processDiscoveredServices(services: ServiceDiscoveryResult[]): ProcessedServiceData[] {
    return services.map(service => ({
      uuid: service.serviceUuid,
      name: service.serviceName,
      characteristics: service.characteristics.map(char => ({
        uuid: char.uuid,
        properties: char.properties,
        value: char.value ? this.parseCharacteristicValue(char.value) : null,
        readable: char.properties.includes('read'),
        writable: char.properties.includes('write') || char.properties.includes('writeWithoutResponse'),
        notifiable: char.properties.includes('notify') || char.properties.includes('indicate')
      })),
      riskLevel: this.assessServiceRisk(service.serviceName),
      verificationStatus: this.verifyServicePattern(service.serviceUuid)
    }));
  }

  private parseCharacteristicValue(value: DataView): any {
    try {
      const bytes = new Uint8Array(value.buffer);
      
      if (bytes.length === 0) return null;
      
      if (this.isUtf8String(bytes)) {
        return new TextDecoder().decode(bytes);
      }
      
      if (bytes.length === 1) {
        return bytes[0];
      }
      
      if (bytes.length === 2) {
        return value.getUint16(0, true);
      }
      
      if (bytes.length === 4) {
        return value.getUint32(0, true);
      }
      
      return Array.from(bytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
    } catch (error) {
      console.warn('Failed to parse characteristic value:', error);
      return null;
    }
  }

  private isUtf8String(bytes: Uint8Array): boolean {
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return /^[\x20-\x7E\s]*$/.test(decoded);
    } catch {
      return false;
    }
  }

  private assessServiceRisk(serviceName: string): 'Critical' | 'High' | 'Medium' | 'Low' {
    if (serviceName.includes('DFU') || serviceName.includes('File Transfer')) {
      return 'Critical';
    }
    if (serviceName.includes('Human Interface') || 
        serviceName.includes('Object Push') ||
        serviceName.includes('Audio Source')) {
      return 'High';
    }
    if (serviceName.includes('Generic Access') || 
        serviceName.includes('Generic Attribute') ||
        serviceName.includes('Device Information') ||
        serviceName.includes('Audio Sink')) {
      return 'Medium';
    }
    return 'Low';
  }

  private verifyServicePattern(uuid: string): 'verified' | 'unknown' | 'suspicious' {
    const knownServices = [
      '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
      '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
      '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
      '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
      '00001812-0000-1000-8000-00805f9b34fb', // HID
      '0000fe59-0000-1000-8000-00805f9b34fb'  // Nordic DFU
    ];

    if (knownServices.includes(uuid)) {
      return 'verified';
    }

    if (uuid.startsWith('0000') && uuid.endsWith('-0000-1000-8000-00805f9b34fb')) {
      return 'unknown';
    }

    return 'suspicious';
  }

  aggregateServiceStatistics(services: ProcessedServiceData[]) {
    const stats = {
      totalServices: services.length,
      totalCharacteristics: services.reduce((sum, service) => sum + service.characteristics.length, 0),
      riskDistribution: {
        critical: services.filter(s => s.riskLevel === 'Critical').length,
        high: services.filter(s => s.riskLevel === 'High').length,
        medium: services.filter(s => s.riskLevel === 'Medium').length,
        low: services.filter(s => s.riskLevel === 'Low').length
      },
      verificationStatus: {
        verified: services.filter(s => s.verificationStatus === 'verified').length,
        unknown: services.filter(s => s.verificationStatus === 'unknown').length,
        suspicious: services.filter(s => s.verificationStatus === 'suspicious').length
      },
      capabilities: {
        readable: services.reduce((sum, service) => 
          sum + service.characteristics.filter(c => c.readable).length, 0),
        writable: services.reduce((sum, service) => 
          sum + service.characteristics.filter(c => c.writable).length, 0),
        notifiable: services.reduce((sum, service) => 
          sum + service.characteristics.filter(c => c.notifiable).length, 0)
      }
    };

    return {
      ...stats,
      overallRisk: this.calculateOverallRisk(stats.riskDistribution),
      verificationScore: this.calculateVerificationScore(stats.verificationStatus, stats.totalServices)
    };
  }

  private calculateOverallRisk(riskDistribution: Record<string, number>): 'Critical' | 'High' | 'Medium' | 'Low' {
    if ((riskDistribution.critical || 0) > 0) return 'Critical';
    if ((riskDistribution.high || 0) > 0) return 'High';
    if ((riskDistribution.medium || 0) > 0) return 'Medium';
    return 'Low';
  }

  private calculateVerificationScore(verificationStatus: Record<string, number>, total: number): number {
    return Math.round(((verificationStatus.verified || 0) / total) * 100);
  }

  generateAnalysisReport(
    services: ProcessedServiceData[],
    firmwareAnalysis: FirmwareAnalysisResult,
    securityAssessment: any
  ) {
    const stats = this.aggregateServiceStatistics(services);
    
    return {
      timestamp: new Date().toISOString(),
      deviceInfo: {
        servicesDiscovered: services.length,
        verificationScore: stats.verificationScore,
        overallRisk: stats.overallRisk
      },
      firmwareInfo: {
        version: firmwareAnalysis.version,
        updateCapable: firmwareAnalysis.updateCapable,
        otaPatterns: firmwareAnalysis.otaPatterns,
        dfuPatterns: firmwareAnalysis.dfuPatterns
      },
      securityAssessment: {
        riskLevel: securityAssessment.riskLevel,
        recommendations: securityAssessment.recommendations,
        criticalServices: services.filter(s => s.riskLevel === 'Critical').map(s => s.name)
      },
      statistics: stats,
      services: services.map(service => ({
        name: service.name,
        uuid: service.uuid,
        riskLevel: service.riskLevel,
        verificationStatus: service.verificationStatus,
        characteristicCount: service.characteristics.length,
        capabilities: {
          read: service.characteristics.filter(c => c.readable).length,
          write: service.characteristics.filter(c => c.writable).length,
          notify: service.characteristics.filter(c => c.notifiable).length
        }
      }))
    };
  }

  exportToCSV(data: any[], filename: string): void {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv');
  }

  exportToJSON(data: any, filename: string): void {
    const jsonContent = JSON.stringify(data, null, 2);
    this.downloadFile(jsonContent, `${filename}.json`, 'application/json');
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}