import React, { useState, useCallback, useMemo } from 'react';
import { SecurityAnalyzer } from '@/services/analysis/SecurityAnalyzer';
import { FirmwareAnalyzer } from '@/services/analysis/FirmwareAnalyzer';
import { DataProcessor } from '@/utils';
import type { 
  ServiceDiscoveryResult, 
  SecurityAssessment,
  FirmwareAnalysis 
} from '@/types';
import './ServiceExplorer.css';

interface ServiceExplorerProps {
  services: ServiceDiscoveryResult[];
  onSecurityAssessment: (assessment: SecurityAssessment) => void;
  onFirmwareAnalysis: (analysis: FirmwareAnalysis) => void;
}

export const ServiceExplorer: React.FC<ServiceExplorerProps> = ({
  services,
  onSecurityAssessment,
  onFirmwareAnalysis
}) => {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [showCharacteristics, setShowCharacteristics] = useState<Record<string, boolean>>({});

  const securityAnalyzer = useMemo(() => SecurityAnalyzer.getInstance(), []);
  const firmwareAnalyzer = useMemo(() => FirmwareAnalyzer.getInstance(), []);
  const dataProcessor = useMemo(() => DataProcessor.getInstance(), []);

  const processedServices = useMemo(() => {
    return dataProcessor.processDiscoveredServices(services);
  }, [services, dataProcessor]);

  const serviceStats = useMemo(() => {
    return dataProcessor.aggregateServiceStatistics(processedServices);
  }, [processedServices, dataProcessor]);

  const handleServiceSelect = useCallback((serviceUuid: string) => {
    setSelectedService(selectedService === serviceUuid ? null : serviceUuid);
  }, [selectedService]);

  const toggleCharacteristics = useCallback((serviceUuid: string) => {
    setShowCharacteristics(prev => ({
      ...prev,
      [serviceUuid]: !prev[serviceUuid]
    }));
  }, []);

  const runAnalysis = useCallback(async () => {
    if (services.length === 0) return;

    try {
      // Mock services for analysis (Web Bluetooth services don't have the exact interface needed)
      const mockServices = services.map(() => ({} as BluetoothRemoteGATTService));

      // Generate security assessment
      const securityAssessment = securityAnalyzer.generateSecurityAssessment(mockServices);
      onSecurityAssessment(securityAssessment);

      // Generate firmware analysis
      const firmwareAnalysis = await firmwareAnalyzer.analyzeFirmware(mockServices);
      onFirmwareAnalysis(firmwareAnalysis);

      setAnalysisComplete(true);
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  }, [services, securityAnalyzer, firmwareAnalyzer, onSecurityAssessment, onFirmwareAnalysis]);

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Critical': return '#e53e3e';
      case 'High': return '#dd6b20';
      case 'Medium': return '#d69e2e';
      case 'Low': return '#38a169';
      default: return '#718096';
    }
  };

  const getVerificationColor = (status: string) => {
    switch (status) {
      case 'verified': return '#38a169';
      case 'unknown': return '#d69e2e';
      case 'suspicious': return '#e53e3e';
      default: return '#718096';
    }
  };

  if (services.length === 0) {
    return (
      <div className="service-explorer">
        <div className="no-services">
          <div className="no-services-icon">🔍</div>
          <p>No services discovered</p>
          <small>Connect to a device first to explore its services</small>
        </div>
      </div>
    );
  }

  return (
    <div className="service-explorer">
      <div className="explorer-header">
        <h3>Service Explorer</h3>
        <div className="header-actions">
          <button 
            className="analysis-button"
            onClick={runAnalysis}
            disabled={analysisComplete}
          >
            {analysisComplete ? '✅ Analysis Complete' : '🔬 Run Analysis'}
          </button>
        </div>
      </div>

      <div className="service-stats">
        <div className="stat-card">
          <div className="stat-value">{serviceStats.totalServices}</div>
          <div className="stat-label">Services</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{serviceStats.totalCharacteristics}</div>
          <div className="stat-label">Characteristics</div>
        </div>
        <div className="stat-card">
          <div 
            className="stat-value" 
            style={{ color: getRiskColor(serviceStats.overallRisk) }}
          >
            {serviceStats.overallRisk}
          </div>
          <div className="stat-label">Risk Level</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{serviceStats.verificationScore}%</div>
          <div className="stat-label">Verified</div>
        </div>
      </div>

      <div className="services-list">
        {processedServices.map((service) => (
          <div key={service.uuid} className="service-item">
            <div 
              className="service-header"
              onClick={() => handleServiceSelect(service.uuid)}
            >
              <div className="service-info">
                <div className="service-name">
                  {service.name}
                </div>
                <div className="service-uuid">
                  {service.uuid}
                </div>
              </div>
              <div className="service-badges">
                <span 
                  className="risk-badge"
                  style={{ 
                    backgroundColor: getRiskColor(service.riskLevel),
                    color: 'white'
                  }}
                >
                  {service.riskLevel}
                </span>
                <span 
                  className="verification-badge"
                  style={{ 
                    backgroundColor: getVerificationColor(service.verificationStatus),
                    color: 'white'
                  }}
                >
                  {service.verificationStatus}
                </span>
                <span className="characteristic-count">
                  {service.characteristics.length} chars
                </span>
              </div>
              <div className="service-expand">
                {selectedService === service.uuid ? '▼' : '▶'}
              </div>
            </div>

            {selectedService === service.uuid && (
              <div className="service-details">
                <div className="service-actions">
                  <button 
                    className="toggle-chars-button"
                    onClick={() => toggleCharacteristics(service.uuid)}
                  >
                    {showCharacteristics[service.uuid] ? 
                      'Hide Characteristics' : 
                      `Show ${service.characteristics.length} Characteristics`}
                  </button>
                </div>

                {showCharacteristics[service.uuid] && (
                  <div className="characteristics-list">
                    {service.characteristics.map((characteristic) => (
                      <div key={characteristic.uuid} className="characteristic-item">
                        <div className="characteristic-header">
                          <span className="characteristic-uuid">
                            {characteristic.uuid}
                          </span>
                          <div className="characteristic-properties">
                            {characteristic.properties.map(prop => (
                              <span key={prop} className={`property-badge ${prop}`}>
                                {prop}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        {characteristic.value && (
                          <div className="characteristic-value">
                            <strong>Value:</strong> 
                            <code>{JSON.stringify(characteristic.value)}</code>
                          </div>
                        )}

                        <div className="characteristic-capabilities">
                          {characteristic.readable && (
                            <span className="capability readable">📖 Readable</span>
                          )}
                          {characteristic.writable && (
                            <span className="capability writable">✏️ Writable</span>
                          )}
                          {characteristic.notifiable && (
                            <span className="capability notifiable">🔔 Notifiable</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {analysisComplete && (
        <div className="analysis-summary">
          <h4>Analysis Complete</h4>
          <div className="analysis-results">
            <div className="result-item">
              <span className="result-label">Security Assessment:</span>
              <span className="result-value">Generated</span>
            </div>
            <div className="result-item">
              <span className="result-label">Firmware Analysis:</span>
              <span className="result-value">Generated</span>
            </div>
            <div className="result-item">
              <span className="result-label">Risk Distribution:</span>
              <span className="result-value">
                🔴 {serviceStats.riskDistribution.critical} Critical, 
                🟠 {serviceStats.riskDistribution.high} High, 
                🟡 {serviceStats.riskDistribution.medium} Medium, 
                🟢 {serviceStats.riskDistribution.low} Low
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};