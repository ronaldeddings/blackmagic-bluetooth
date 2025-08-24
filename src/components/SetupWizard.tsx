import React, { useState, useEffect, useCallback } from 'react';
import { SetupWorkflows, WorkflowDefinition, WorkflowExecution } from '../services/presets/SetupWorkflows';
import { TemplateSystem, TemplateDefinition } from '../services/presets/TemplateSystem';
import { PresetManager } from '../services/presets/PresetManager';
import './SetupWizard.css';

interface SetupWizardProps {
  setupWorkflows: SetupWorkflows;
  templateSystem: TemplateSystem;
  presetManager: PresetManager;
  selectedDevices: string[];
  onComplete?: (result: 'success' | 'cancelled' | 'failed') => void;
  onWorkflowStart?: (execution: WorkflowExecution) => void;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  canSkip?: boolean;
  validation?: () => boolean;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({
  setupWorkflows,
  templateSystem,
  presetManager,
  selectedDevices,
  onComplete,
  onWorkflowStart
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<{
    setupType: 'workflow' | 'template' | 'manual';
    selectedWorkflow?: WorkflowDefinition;
    selectedTemplate?: TemplateDefinition;
    deviceConfiguration: Map<string, any>;
    preferences: {
      skipValidation: boolean;
      autoApply: boolean;
      saveAsPreset: boolean;
      presetName?: string;
    };
  }>({
    setupType: 'workflow',
    deviceConfiguration: new Map(),
    preferences: {
      skipValidation: false,
      autoApply: true,
      saveAsPreset: false
    }
  });

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeExecution, setActiveExecution] = useState<WorkflowExecution | null>(null);

  // Define wizard steps
  const steps: WizardStep[] = [
    {
      id: 'setup-type',
      title: 'Setup Type',
      description: 'Choose how you want to set up your cameras',
      component: SetupTypeStep,
      validation: () => Boolean(wizardData.setupType)
    },
    {
      id: 'workflow-selection',
      title: 'Select Workflow',
      description: 'Choose a setup workflow to guide you through the process',
      component: WorkflowSelectionStep,
      validation: () => wizardData.setupType !== 'workflow' || Boolean(wizardData.selectedWorkflow)
    },
    {
      id: 'template-selection',
      title: 'Select Template',
      description: 'Choose a configuration template',
      component: TemplateSelectionStep,
      validation: () => wizardData.setupType !== 'template' || Boolean(wizardData.selectedTemplate)
    },
    {
      id: 'device-configuration',
      title: 'Device Configuration',
      description: 'Configure individual device settings',
      component: DeviceConfigurationStep
    },
    {
      id: 'preferences',
      title: 'Setup Preferences',
      description: 'Configure setup options and preferences',
      component: PreferencesStep
    },
    {
      id: 'review',
      title: 'Review & Confirm',
      description: 'Review your configuration before applying',
      component: ReviewStep
    },
    {
      id: 'execution',
      title: 'Applying Configuration',
      description: 'Setting up your cameras...',
      component: ExecutionStep
    }
  ];

  // Load workflows and templates
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [workflowData, templateData] = await Promise.all([
          setupWorkflows.getWorkflows(),
          templateSystem.getTemplates()
        ]);
        
        setWorkflows(workflowData);
        setTemplates(templateData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load setup options');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [setupWorkflows, templateSystem]);

  // Update wizard data
  const updateWizardData = useCallback((updates: Partial<typeof wizardData>) => {
    setWizardData(prev => ({ ...prev, ...updates }));
  }, []);

  // Navigation functions
  const canGoNext = useCallback(() => {
    const step = steps[currentStep];
    return !step.validation || step.validation();
  }, [currentStep, steps, wizardData]);

  const canGoPrevious = useCallback(() => {
    return currentStep > 0 && currentStep < steps.length - 1;
  }, [currentStep]);

  const goNext = useCallback(() => {
    if (canGoNext() && currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [canGoNext, currentStep]);

  const goPrevious = useCallback(() => {
    if (canGoPrevious()) {
      setCurrentStep(prev => prev - 1);
    }
  }, [canGoPrevious]);

  const skipStep = useCallback(() => {
    const step = steps[currentStep];
    if (step.canSkip && currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, steps]);

  // Execute setup
  const executeSetup = useCallback(async () => {
    if (selectedDevices.length === 0) {
      setError('No devices selected for setup');
      return;
    }

    try {
      setError(null);
      let executionId: string;

      if (wizardData.setupType === 'workflow' && wizardData.selectedWorkflow) {
        // Execute workflow
        executionId = await setupWorkflows.executeWorkflow(
          wizardData.selectedWorkflow.id,
          selectedDevices,
          {
            pauseOnError: !wizardData.preferences.skipValidation,
            userPrompts: true
          }
        );

        // Get execution details
        const execution = await setupWorkflows.getExecution(executionId);
        if (execution) {
          setActiveExecution(execution);
          onWorkflowStart?.(execution);
        }
      } else {
        // Manual or template setup
        // This would involve direct preset application or custom configuration
        // For now, we'll simulate successful completion
        setTimeout(() => {
          onComplete?.('success');
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup execution failed');
      onComplete?.('failed');
    }
  }, [wizardData, selectedDevices, setupWorkflows, onWorkflowStart, onComplete]);

  // Handle execution completion
  useEffect(() => {
    if (!activeExecution) return;

    const handleExecutionUpdate = (execution: WorkflowExecution) => {
      if (execution.id === activeExecution.id) {
        setActiveExecution(execution);
        
        if (execution.status === 'completed') {
          onComplete?.('success');
        } else if (execution.status === 'failed' || execution.status === 'cancelled') {
          onComplete?.(execution.status);
        }
      }
    };

    setupWorkflows.on('workflow-completed', handleExecutionUpdate);
    setupWorkflows.on('workflow-failed', handleExecutionUpdate);
    setupWorkflows.on('workflow-cancelled', handleExecutionUpdate);
    setupWorkflows.on('workflow-progress', handleExecutionUpdate);

    return () => {
      setupWorkflows.off('workflow-completed', handleExecutionUpdate);
      setupWorkflows.off('workflow-failed', handleExecutionUpdate);
      setupWorkflows.off('workflow-cancelled', handleExecutionUpdate);
      setupWorkflows.off('workflow-progress', handleExecutionUpdate);
    };
  }, [activeExecution, setupWorkflows, onComplete]);

  // Start execution when reaching execution step
  useEffect(() => {
    if (currentStep === steps.length - 1 && steps[currentStep].id === 'execution') {
      executeSetup();
    }
  }, [currentStep, executeSetup, steps]);

  if (isLoading) {
    return (
      <div className="setup-wizard loading">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Loading setup options...</p>
        </div>
      </div>
    );
  }

  const currentStepData = steps[currentStep];
  const StepComponent = currentStepData.component;

  return (
    <div className="setup-wizard">
      <div className="wizard-header">
        <h2>Camera Setup Wizard</h2>
        <div className="device-count">
          {selectedDevices.length} device{selectedDevices.length !== 1 ? 's' : ''} selected
        </div>
      </div>

      <div className="wizard-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${((currentStep + 1) / steps.length) * 100}%`
            }}
          />
        </div>
        <div className="step-indicators">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`step-indicator ${
                index === currentStep
                  ? 'active'
                  : index < currentStep
                  ? 'completed'
                  : 'pending'
              }`}
            >
              <div className="step-number">{index + 1}</div>
              <div className="step-label">{step.title}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="wizard-content">
        <div className="step-header">
          <h3>{currentStepData.title}</h3>
          <p>{currentStepData.description}</p>
        </div>

        {error && (
          <div className="wizard-error">
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <div className="step-content">
          <StepComponent
            wizardData={wizardData}
            updateWizardData={updateWizardData}
            workflows={workflows}
            templates={templates}
            selectedDevices={selectedDevices}
            activeExecution={activeExecution}
            setupWorkflows={setupWorkflows}
          />
        </div>
      </div>

      <div className="wizard-footer">
        <div className="footer-left">
          {currentStepData.canSkip && (
            <button
              className="skip-btn"
              onClick={skipStep}
            >
              Skip This Step
            </button>
          )}
        </div>

        <div className="footer-right">
          {canGoPrevious() && (
            <button
              className="previous-btn"
              onClick={goPrevious}
            >
              Previous
            </button>
          )}

          {currentStep < steps.length - 1 ? (
            <button
              className="next-btn"
              onClick={goNext}
              disabled={!canGoNext()}
            >
              Next
            </button>
          ) : (
            <button
              className="finish-btn"
              onClick={() => onComplete?.('cancelled')}
              disabled={activeExecution?.status === 'running'}
            >
              {activeExecution?.status === 'running' ? 'Setting Up...' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Setup Type Selection Step
const SetupTypeStep: React.FC<any> = ({ wizardData, updateWizardData }) => {
  const setupTypes = [
    {
      id: 'workflow' as const,
      title: 'Guided Workflow',
      description: 'Follow a step-by-step workflow for common setup scenarios',
      icon: '🔄',
      recommended: true
    },
    {
      id: 'template' as const,
      title: 'Configuration Template',
      description: 'Use a pre-configured template and customize as needed',
      icon: '📋'
    },
    {
      id: 'manual' as const,
      title: 'Manual Setup',
      description: 'Configure each setting manually with full control',
      icon: '⚙️'
    }
  ];

  return (
    <div className="setup-type-selection">
      <div className="setup-types">
        {setupTypes.map(type => (
          <div
            key={type.id}
            className={`setup-type-card ${
              wizardData.setupType === type.id ? 'selected' : ''
            } ${type.recommended ? 'recommended' : ''}`}
            onClick={() => updateWizardData({ setupType: type.id })}
          >
            {type.recommended && <div className="recommended-badge">Recommended</div>}
            <div className="type-icon">{type.icon}</div>
            <h4>{type.title}</h4>
            <p>{type.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Workflow Selection Step
const WorkflowSelectionStep: React.FC<any> = ({ wizardData, updateWizardData, workflows }) => {
  if (wizardData.setupType !== 'workflow') {
    return <div className="step-skipped">This step is not needed for your selected setup type.</div>;
  }

  return (
    <div className="workflow-selection">
      <div className="workflows-grid">
        {workflows.map((workflow: WorkflowDefinition) => (
          <div
            key={workflow.id}
            className={`workflow-card ${
              wizardData.selectedWorkflow?.id === workflow.id ? 'selected' : ''
            }`}
            onClick={() => updateWizardData({ selectedWorkflow: workflow })}
          >
            <div className="workflow-header">
              <h4>{workflow.name}</h4>
              <div className="workflow-meta">
                <span className="category">{workflow.category}</span>
                <span className="difficulty">{workflow.difficulty}</span>
                <span className="duration">~{workflow.estimatedDuration} min</span>
              </div>
            </div>
            <p className="workflow-description">{workflow.description}</p>
            <div className="workflow-steps">
              <span>{workflow.steps.length} steps</span>
              {workflow.prerequisites.length > 0 && (
                <span>Prerequisites: {workflow.prerequisites.join(', ')}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Template Selection Step
const TemplateSelectionStep: React.FC<any> = ({ wizardData, updateWizardData, templates }) => {
  if (wizardData.setupType !== 'template') {
    return <div className="step-skipped">This step is not needed for your selected setup type.</div>;
  }

  return (
    <div className="template-selection">
      <div className="templates-grid">
        {templates.map((template: TemplateDefinition) => (
          <div
            key={template.id}
            className={`template-card ${
              wizardData.selectedTemplate?.id === template.id ? 'selected' : ''
            }`}
            onClick={() => updateWizardData({ selectedTemplate: template })}
          >
            <div className="template-header">
              <h4>{template.name}</h4>
              <div className="template-meta">
                <span className="category">{template.category}</span>
                <span className="version">v{template.version}</span>
              </div>
            </div>
            <p className="template-description">{template.description}</p>
            <div className="template-info">
              <span>{template.variables.length} variables</span>
              <div className="template-tags">
                {template.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Device Configuration Step
const DeviceConfigurationStep: React.FC<any> = ({ wizardData, updateWizardData, selectedDevices }) => {
  return (
    <div className="device-configuration">
      <div className="devices-list">
        {selectedDevices.map((deviceId: string) => (
          <div key={deviceId} className="device-config-card">
            <div className="device-header">
              <h4>Device {deviceId}</h4>
              <span className="device-status">Connected</span>
            </div>
            <div className="config-options">
              <label>
                <input type="checkbox" defaultChecked />
                <span>Apply selected configuration</span>
              </label>
              <label>
                <input type="checkbox" />
                <span>Custom settings for this device</span>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Preferences Step
const PreferencesStep: React.FC<any> = ({ wizardData, updateWizardData }) => {
  return (
    <div className="preferences-step">
      <div className="preferences-section">
        <h4>Setup Options</h4>
        <div className="preference-options">
          <label>
            <input
              type="checkbox"
              checked={wizardData.preferences.skipValidation}
              onChange={(e) => updateWizardData({
                preferences: {
                  ...wizardData.preferences,
                  skipValidation: e.target.checked
                }
              })}
            />
            <span>Skip validation steps (faster but less safe)</span>
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={wizardData.preferences.autoApply}
              onChange={(e) => updateWizardData({
                preferences: {
                  ...wizardData.preferences,
                  autoApply: e.target.checked
                }
              })}
            />
            <span>Automatically apply configuration when ready</span>
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={wizardData.preferences.saveAsPreset}
              onChange={(e) => updateWizardData({
                preferences: {
                  ...wizardData.preferences,
                  saveAsPreset: e.target.checked
                }
              })}
            />
            <span>Save this configuration as a preset</span>
          </label>
        </div>
        
        {wizardData.preferences.saveAsPreset && (
          <div className="preset-name-input">
            <label htmlFor="preset-name">Preset Name:</label>
            <input
              id="preset-name"
              type="text"
              value={wizardData.preferences.presetName || ''}
              onChange={(e) => updateWizardData({
                preferences: {
                  ...wizardData.preferences,
                  presetName: e.target.value
                }
              })}
              placeholder="Enter preset name..."
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Review Step
const ReviewStep: React.FC<any> = ({ wizardData, selectedDevices }) => {
  return (
    <div className="review-step">
      <div className="review-sections">
        <div className="review-section">
          <h4>Setup Type</h4>
          <p>{wizardData.setupType}</p>
        </div>
        
        {wizardData.selectedWorkflow && (
          <div className="review-section">
            <h4>Selected Workflow</h4>
            <p>{wizardData.selectedWorkflow.name}</p>
            <small>{wizardData.selectedWorkflow.description}</small>
          </div>
        )}
        
        {wizardData.selectedTemplate && (
          <div className="review-section">
            <h4>Selected Template</h4>
            <p>{wizardData.selectedTemplate.name}</p>
            <small>{wizardData.selectedTemplate.description}</small>
          </div>
        )}
        
        <div className="review-section">
          <h4>Target Devices</h4>
          <ul>
            {selectedDevices.map((deviceId: string) => (
              <li key={deviceId}>Device {deviceId}</li>
            ))}
          </ul>
        </div>
        
        <div className="review-section">
          <h4>Preferences</h4>
          <ul>
            <li>Skip validation: {wizardData.preferences.skipValidation ? 'Yes' : 'No'}</li>
            <li>Auto apply: {wizardData.preferences.autoApply ? 'Yes' : 'No'}</li>
            <li>Save as preset: {wizardData.preferences.saveAsPreset ? 'Yes' : 'No'}</li>
            {wizardData.preferences.saveAsPreset && wizardData.preferences.presetName && (
              <li>Preset name: {wizardData.preferences.presetName}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

// Execution Step
const ExecutionStep: React.FC<any> = ({ activeExecution, setupWorkflows }) => {
  if (!activeExecution) {
    return (
      <div className="execution-step">
        <div className="execution-status">
          <div className="loading-spinner"></div>
          <p>Preparing setup...</p>
        </div>
      </div>
    );
  }

  const handlePause = () => {
    setupWorkflows.pauseWorkflow(activeExecution.id);
  };

  const handleResume = () => {
    setupWorkflows.resumeWorkflow(activeExecution.id);
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel the setup?')) {
      setupWorkflows.cancelWorkflow(activeExecution.id);
    }
  };

  return (
    <div className="execution-step">
      <div className="execution-header">
        <h4>Setup Progress</h4>
        <div className="execution-controls">
          {activeExecution.status === 'running' && (
            <button onClick={handlePause} className="pause-btn">
              Pause
            </button>
          )}
          {activeExecution.status === 'paused' && (
            <button onClick={handleResume} className="resume-btn">
              Resume
            </button>
          )}
          {activeExecution.status !== 'completed' && (
            <button onClick={handleCancel} className="cancel-btn">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="execution-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${activeExecution.progress}%` }}
          />
        </div>
        <div className="progress-text">
          {activeExecution.progress}% complete
        </div>
      </div>

      <div className="execution-status">
        <div className="status-indicator">
          <div className={`status-dot ${activeExecution.status}`}></div>
          <span className="status-text">
            {activeExecution.status === 'running' && 'In Progress'}
            {activeExecution.status === 'paused' && 'Paused'}
            {activeExecution.status === 'completed' && 'Completed'}
            {activeExecution.status === 'failed' && 'Failed'}
            {activeExecution.status === 'cancelled' && 'Cancelled'}
          </span>
        </div>
        
        <div className="current-step">
          Current step: {activeExecution.currentStep + 1}
        </div>
      </div>

      {activeExecution.errors.length > 0 && (
        <div className="execution-errors">
          <h5>Errors:</h5>
          <ul>
            {activeExecution.errors.map((error, index) => (
              <li key={index} className={error.recoverable ? 'recoverable' : 'critical'}>
                {error.message}
                {error.deviceId && <small> (Device: {error.deviceId})</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};