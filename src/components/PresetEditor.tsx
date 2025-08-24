import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PresetManager, ConfigurationPreset, PresetSettings } from '../services/presets/PresetManager';
import { TemplateSystem, TemplateDefinition, TemplateInstance } from '../services/presets/TemplateSystem';
import './PresetEditor.css';

interface PresetEditorProps {
  presetManager: PresetManager;
  templateSystem: TemplateSystem;
  preset?: ConfigurationPreset; // For editing existing preset
  template?: TemplateDefinition; // For creating from template
  onSave?: (preset: ConfigurationPreset) => void;
  onCancel?: () => void;
  onValidationChange?: (isValid: boolean) => void;
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export const PresetEditor: React.FC<PresetEditorProps> = ({
  presetManager,
  templateSystem,
  preset,
  template,
  onSave,
  onCancel,
  onValidationChange
}) => {
  const [formData, setFormData] = useState<Partial<ConfigurationPreset>>({
    name: '',
    description: '',
    category: 'custom',
    tags: [],
    settings: {},
    metadata: {}
  });

  const [templateInstance, setTemplateInstance] = useState<TemplateInstance | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [activeTab, setActiveTab] = useState<'basic' | 'video' | 'audio' | 'lens' | 'display' | 'recording' | 'advanced'>('basic');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const categories = ['custom', 'production', 'streaming', 'documentary', 'event', 'test'];
  
  // Initialize form data
  useEffect(() => {
    if (preset) {
      // Editing existing preset
      setFormData({
        name: preset.name,
        description: preset.description,
        category: preset.category,
        tags: [...preset.tags],
        settings: JSON.parse(JSON.stringify(preset.settings)),
        metadata: JSON.parse(JSON.stringify(preset.metadata))
      });
    } else if (template) {
      // Creating from template
      const instance = templateSystem.createInstance(template.id);
      setTemplateInstance(instance);
      setFormData({
        name: `New ${template.name}`,
        description: template.description,
        category: template.category,
        tags: [...template.tags],
        settings: instance.generatedSettings,
        metadata: {}
      });
    }
  }, [preset, template, templateSystem]);

  // Validation
  const validateForm = useCallback(() => {
    const errors: ValidationError[] = [];

    // Basic validation
    if (!formData.name?.trim()) {
      errors.push({
        field: 'name',
        message: 'Preset name is required',
        severity: 'error'
      });
    } else if (formData.name.length > 100) {
      errors.push({
        field: 'name',
        message: 'Preset name must be less than 100 characters',
        severity: 'error'
      });
    }

    if (!formData.description?.trim()) {
      errors.push({
        field: 'description',
        message: 'Description is recommended',
        severity: 'warning'
      });
    }

    if (!formData.category) {
      errors.push({
        field: 'category',
        message: 'Category is required',
        severity: 'error'
      });
    }

    // Settings validation
    if (!formData.settings || Object.keys(formData.settings).length === 0) {
      errors.push({
        field: 'settings',
        message: 'At least one setting must be configured',
        severity: 'error'
      });
    }

    // Video settings validation
    if (formData.settings?.video) {
      const video = formData.settings.video;
      
      if (video.framerate && (video.framerate < 1 || video.framerate > 240)) {
        errors.push({
          field: 'video.framerate',
          message: 'Frame rate must be between 1 and 240',
          severity: 'error'
        });
      }

      if (video.bitrate && video.bitrate < 1) {
        errors.push({
          field: 'video.bitrate',
          message: 'Bitrate must be positive',
          severity: 'error'
        });
      }

      if (video.whiteBalance && (video.whiteBalance < 2000 || video.whiteBalance > 10000)) {
        errors.push({
          field: 'video.whiteBalance',
          message: 'White balance must be between 2000K and 10000K',
          severity: 'warning'
        });
      }
    }

    // Audio settings validation
    if (formData.settings?.audio) {
      const audio = formData.settings.audio;
      
      if (audio.sampleRate && ![44100, 48000, 96000].includes(audio.sampleRate)) {
        errors.push({
          field: 'audio.sampleRate',
          message: 'Sample rate should be 44.1kHz, 48kHz, or 96kHz',
          severity: 'warning'
        });
      }

      if (audio.channels && (audio.channels < 1 || audio.channels > 8)) {
        errors.push({
          field: 'audio.channels',
          message: 'Audio channels must be between 1 and 8',
          severity: 'error'
        });
      }
    }

    setValidationErrors(errors);
    
    const hasErrors = errors.some(e => e.severity === 'error');
    const isValid = !hasErrors;
    
    onValidationChange?.(isValid);
    return isValid;
  }, [formData, onValidationChange]);

  // Validate on form changes
  useEffect(() => {
    validateForm();
  }, [validateForm]);

  // Handle form changes
  const handleBasicChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  const handleSettingsChange = useCallback((section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [section]: {
          ...prev.settings?.[section as keyof PresetSettings],
          [field]: value
        }
      }
    }));
    setIsDirty(true);
  }, []);

  const handleTagsChange = useCallback((tags: string[]) => {
    setFormData(prev => ({ ...prev, tags }));
    setIsDirty(true);
  }, []);

  // Handle template variables change
  const handleTemplateVariableChange = useCallback((variableName: string, value: any) => {
    if (!templateInstance) return;

    const newVariables = new Map(templateInstance.variables);
    newVariables.set(variableName, value);
    
    const updatedInstance = templateSystem.updateInstanceVariables(templateInstance.templateId, newVariables);
    setTemplateInstance(updatedInstance);
    
    setFormData(prev => ({
      ...prev,
      settings: updatedInstance.generatedSettings
    }));
    setIsDirty(true);
  }, [templateInstance, templateSystem]);

  // Save preset
  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      let savedPreset: ConfigurationPreset;

      if (preset) {
        // Update existing preset
        savedPreset = await presetManager.updatePreset(preset.id, {
          name: formData.name!,
          description: formData.description!,
          category: formData.category!,
          tags: formData.tags!,
          settings: formData.settings!,
          metadata: formData.metadata
        });
      } else {
        // Create new preset
        savedPreset = await presetManager.createPreset(
          formData.name!,
          formData.description!,
          formData.settings!,
          {
            category: formData.category!,
            tags: formData.tags!,
            ...formData.metadata
          }
        );
      }

      onSave?.(savedPreset);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save preset:', error);
      // Handle error (could add error state)
    } finally {
      setIsSaving(false);
    }
  }, [formData, preset, presetManager, onSave, validateForm]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (isDirty && !confirm('You have unsaved changes. Are you sure you want to cancel?')) {
      return;
    }
    onCancel?.();
  }, [isDirty, onCancel]);

  // Render validation errors
  const renderValidationErrors = () => {
    const errors = validationErrors.filter(e => e.severity === 'error');
    const warnings = validationErrors.filter(e => e.severity === 'warning');

    return (
      <div className="validation-summary">
        {errors.length > 0 && (
          <div className="validation-errors">
            <h4>Errors:</h4>
            <ul>
              {errors.map((error, index) => (
                <li key={index}>{error.message}</li>
              ))}
            </ul>
          </div>
        )}
        
        {warnings.length > 0 && (
          <div className="validation-warnings">
            <h4>Warnings:</h4>
            <ul>
              {warnings.map((warning, index) => (
                <li key={index}>{warning.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Render template variables
  const renderTemplateVariables = () => {
    if (!template || !templateInstance) return null;

    return (
      <div className="template-variables">
        <h3>Template Configuration</h3>
        <p className="template-description">{template.description}</p>
        
        <div className="variables-grid">
          {template.variables.map(variable => (
            <div key={variable.name} className="variable-field">
              <label htmlFor={`var-${variable.name}`}>
                {variable.label}
                {variable.required && <span className="required">*</span>}
              </label>
              
              {variable.description && (
                <p className="variable-description">{variable.description}</p>
              )}

              {variable.type === 'string' && (
                <input
                  id={`var-${variable.name}`}
                  type="text"
                  value={templateInstance.variables.get(variable.name) || ''}
                  onChange={(e) => handleTemplateVariableChange(variable.name, e.target.value)}
                  placeholder={variable.defaultValue}
                />
              )}

              {variable.type === 'number' && (
                <input
                  id={`var-${variable.name}`}
                  type="number"
                  value={templateInstance.variables.get(variable.name) || ''}
                  onChange={(e) => handleTemplateVariableChange(variable.name, Number(e.target.value))}
                  min={variable.min}
                  max={variable.max}
                  step={variable.step}
                />
              )}

              {variable.type === 'range' && (
                <div className="range-input">
                  <input
                    id={`var-${variable.name}`}
                    type="range"
                    value={templateInstance.variables.get(variable.name) || variable.defaultValue}
                    onChange={(e) => handleTemplateVariableChange(variable.name, Number(e.target.value))}
                    min={variable.min}
                    max={variable.max}
                    step={variable.step}
                  />
                  <span className="range-value">
                    {templateInstance.variables.get(variable.name) || variable.defaultValue}
                  </span>
                </div>
              )}

              {variable.type === 'select' && (
                <select
                  id={`var-${variable.name}`}
                  value={templateInstance.variables.get(variable.name) || ''}
                  onChange={(e) => handleTemplateVariableChange(variable.name, e.target.value)}
                >
                  <option value="">Select...</option>
                  {variable.options?.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              )}

              {variable.type === 'boolean' && (
                <label className="checkbox-label">
                  <input
                    id={`var-${variable.name}`}
                    type="checkbox"
                    checked={templateInstance.variables.get(variable.name) || false}
                    onChange={(e) => handleTemplateVariableChange(variable.name, e.target.checked)}
                  />
                  <span>Enabled</span>
                </label>
              )}
            </div>
          ))}
        </div>

        {!templateInstance.isValid && (
          <div className="template-validation-errors">
            <h4>Template Errors:</h4>
            <ul>
              {templateInstance.validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // Render basic information tab
  const renderBasicTab = () => (
    <div className="tab-content">
      <div className="form-section">
        <h3>Basic Information</h3>
        
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="preset-name">
              Name <span className="required">*</span>
            </label>
            <input
              id="preset-name"
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleBasicChange('name', e.target.value)}
              placeholder="Enter preset name"
              maxLength={100}
            />
          </div>

          <div className="form-field">
            <label htmlFor="preset-category">
              Category <span className="required">*</span>
            </label>
            <select
              id="preset-category"
              value={formData.category || ''}
              onChange={(e) => handleBasicChange('category', e.target.value)}
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="preset-description">Description</label>
          <textarea
            id="preset-description"
            value={formData.description || ''}
            onChange={(e) => handleBasicChange('description', e.target.value)}
            placeholder="Describe this preset..."
            rows={3}
          />
        </div>

        <div className="form-field">
          <label htmlFor="preset-tags">Tags</label>
          <div className="tags-input">
            <input
              type="text"
              placeholder="Add tag and press Enter"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  e.preventDefault();
                  const newTag = e.currentTarget.value.trim();
                  if (!formData.tags?.includes(newTag)) {
                    handleTagsChange([...(formData.tags || []), newTag]);
                  }
                  e.currentTarget.value = '';
                }
              }}
            />
            <div className="tags-list">
              {formData.tags?.map(tag => (
                <span key={tag} className="tag">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleTagsChange(formData.tags!.filter(t => t !== tag))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {template && renderTemplateVariables()}
    </div>
  );

  // Render video settings tab
  const renderVideoTab = () => (
    <div className="tab-content">
      <div className="form-section">
        <h3>Video Settings</h3>
        
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="video-codec">Codec</label>
            <select
              id="video-codec"
              value={formData.settings?.video?.codec || ''}
              onChange={(e) => handleSettingsChange('video', 'codec', e.target.value)}
            >
              <option value="">Select codec...</option>
              <option value="H.264">H.264</option>
              <option value="H.265">H.265</option>
              <option value="ProRes">ProRes</option>
              <option value="Blackmagic RAW">Blackmagic RAW</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="video-resolution">Resolution</label>
            <select
              id="video-resolution"
              value={formData.settings?.video?.resolution || ''}
              onChange={(e) => handleSettingsChange('video', 'resolution', e.target.value)}
            >
              <option value="">Select resolution...</option>
              <option value="1280x720">720p (1280x720)</option>
              <option value="1920x1080">1080p (1920x1080)</option>
              <option value="3840x2160">4K UHD (3840x2160)</option>
              <option value="4096x2160">4K DCI (4096x2160)</option>
              <option value="6144x3240">6K (6144x3240)</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="video-framerate">Frame Rate</label>
            <input
              id="video-framerate"
              type="number"
              value={formData.settings?.video?.framerate || ''}
              onChange={(e) => handleSettingsChange('video', 'framerate', Number(e.target.value))}
              min="1"
              max="240"
              step="0.01"
            />
          </div>

          <div className="form-field">
            <label htmlFor="video-quality">Quality</label>
            <select
              id="video-quality"
              value={formData.settings?.video?.quality || ''}
              onChange={(e) => handleSettingsChange('video', 'quality', e.target.value)}
            >
              <option value="">Select quality...</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="highest">Highest</option>
              <option value="constant_quality">Constant Quality</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="video-bitrate">Bitrate (Mbps)</label>
            <input
              id="video-bitrate"
              type="number"
              value={formData.settings?.video?.bitrate ? formData.settings.video.bitrate / 1000000 : ''}
              onChange={(e) => handleSettingsChange('video', 'bitrate', Number(e.target.value) * 1000000)}
              min="0.1"
              step="0.1"
            />
          </div>

          <div className="form-field">
            <label htmlFor="video-colorspace">Color Space</label>
            <select
              id="video-colorspace"
              value={formData.settings?.video?.colorSpace || ''}
              onChange={(e) => handleSettingsChange('video', 'colorSpace', e.target.value)}
            >
              <option value="">Select color space...</option>
              <option value="Rec. 709">Rec. 709</option>
              <option value="Rec. 2020">Rec. 2020</option>
              <option value="P3">P3</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="video-gamma">Gamma Mode</label>
            <select
              id="video-gamma"
              value={formData.settings?.video?.gammaMode || ''}
              onChange={(e) => handleSettingsChange('video', 'gammaMode', e.target.value)}
            >
              <option value="">Select gamma...</option>
              <option value="Video">Video</option>
              <option value="Film">Film</option>
              <option value="Extended Video">Extended Video</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="video-whitebalance">White Balance (K)</label>
            <input
              id="video-whitebalance"
              type="number"
              value={formData.settings?.video?.whiteBalance || ''}
              onChange={(e) => handleSettingsChange('video', 'whiteBalance', Number(e.target.value))}
              min="2000"
              max="10000"
              step="100"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Render audio settings tab
  const renderAudioTab = () => (
    <div className="tab-content">
      <div className="form-section">
        <h3>Audio Settings</h3>
        
        <div className="form-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.settings?.audio?.enabled || false}
              onChange={(e) => handleSettingsChange('audio', 'enabled', e.target.checked)}
            />
            <span>Enable Audio Recording</span>
          </label>
        </div>

        {formData.settings?.audio?.enabled && (
          <>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="audio-channels">Channels</label>
                <select
                  id="audio-channels"
                  value={formData.settings?.audio?.channels || ''}
                  onChange={(e) => handleSettingsChange('audio', 'channels', Number(e.target.value))}
                >
                  <option value="">Select channels...</option>
                  <option value="1">Mono (1)</option>
                  <option value="2">Stereo (2)</option>
                  <option value="4">Quad (4)</option>
                  <option value="6">5.1 (6)</option>
                  <option value="8">7.1 (8)</option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="audio-samplerate">Sample Rate</label>
                <select
                  id="audio-samplerate"
                  value={formData.settings?.audio?.sampleRate || ''}
                  onChange={(e) => handleSettingsChange('audio', 'sampleRate', Number(e.target.value))}
                >
                  <option value="">Select sample rate...</option>
                  <option value="44100">44.1 kHz</option>
                  <option value="48000">48 kHz</option>
                  <option value="96000">96 kHz</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label htmlFor="audio-bitrate">Bitrate (kbps)</label>
                <select
                  id="audio-bitrate"
                  value={formData.settings?.audio?.bitrate || ''}
                  onChange={(e) => handleSettingsChange('audio', 'bitrate', Number(e.target.value))}
                >
                  <option value="">Select bitrate...</option>
                  <option value="128">128 kbps</option>
                  <option value="192">192 kbps</option>
                  <option value="256">256 kbps</option>
                  <option value="320">320 kbps</option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="audio-inputlevel">Input Level (dB)</label>
                <input
                  id="audio-inputlevel"
                  type="number"
                  value={formData.settings?.audio?.inputLevel || ''}
                  onChange={(e) => handleSettingsChange('audio', 'inputLevel', Number(e.target.value))}
                  min="-60"
                  max="0"
                  step="1"
                />
              </div>
            </div>

            <div className="form-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.settings?.audio?.monitoring || false}
                  onChange={(e) => handleSettingsChange('audio', 'monitoring', e.target.checked)}
                />
                <span>Enable Audio Monitoring</span>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="preset-editor">
      <div className="editor-header">
        <h2>{preset ? 'Edit Preset' : 'Create Preset'}</h2>
        {template && <span className="template-badge">From Template: {template.name}</span>}
      </div>

      <div className="editor-nav">
        <button
          className={activeTab === 'basic' ? 'active' : ''}
          onClick={() => setActiveTab('basic')}
        >
          Basic
        </button>
        <button
          className={activeTab === 'video' ? 'active' : ''}
          onClick={() => setActiveTab('video')}
        >
          Video
        </button>
        <button
          className={activeTab === 'audio' ? 'active' : ''}
          onClick={() => setActiveTab('audio')}
        >
          Audio
        </button>
        <button
          className={activeTab === 'lens' ? 'active' : ''}
          onClick={() => setActiveTab('lens')}
        >
          Lens
        </button>
        <button
          className={activeTab === 'display' ? 'active' : ''}
          onClick={() => setActiveTab('display')}
        >
          Display
        </button>
        <button
          className={activeTab === 'recording' ? 'active' : ''}
          onClick={() => setActiveTab('recording')}
        >
          Recording
        </button>
        <button
          className={activeTab === 'advanced' ? 'active' : ''}
          onClick={() => setActiveTab('advanced')}
        >
          Advanced
        </button>
      </div>

      <div className="editor-content">
        {activeTab === 'basic' && renderBasicTab()}
        {activeTab === 'video' && renderVideoTab()}
        {activeTab === 'audio' && renderAudioTab()}
        {/* Other tabs would be implemented similarly */}
        
        {validationErrors.length > 0 && renderValidationErrors()}
      </div>

      <div className="editor-footer">
        <button
          type="button"
          className="cancel-btn"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
        
        <button
          type="button"
          className="save-btn"
          onClick={handleSave}
          disabled={!validateForm() || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Preset'}
        </button>
      </div>
    </div>
  );
};