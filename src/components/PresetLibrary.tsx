import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PresetManager, ConfigurationPreset } from '../services/presets/PresetManager';
import { TemplateSystem, TemplateDefinition } from '../services/presets/TemplateSystem';
import './PresetLibrary.css';

interface PresetLibraryProps {
  presetManager: PresetManager;
  templateSystem: TemplateSystem;
  onPresetSelect?: (preset: ConfigurationPreset) => void;
  onPresetApply?: (preset: ConfigurationPreset, deviceIds: string[]) => void;
  onPresetEdit?: (preset: ConfigurationPreset) => void;
  selectedDevices?: string[];
}

interface FilterState {
  category: string;
  searchQuery: string;
  sortBy: 'name' | 'created' | 'usage' | 'rating';
  sortOrder: 'asc' | 'desc';
  showTemplates: boolean;
  showFavorites: boolean;
}

export const PresetLibrary: React.FC<PresetLibraryProps> = ({
  presetManager,
  templateSystem,
  onPresetSelect,
  onPresetApply,
  onPresetEdit,
  selectedDevices = []
}) => {
  const [presets, setPresets] = useState<ConfigurationPreset[]>([]);
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<ConfigurationPreset | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showPreview, setShowPreview] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    searchQuery: '',
    sortBy: 'name',
    sortOrder: 'asc',
    showTemplates: false,
    showFavorites: false
  });

  // Categories derived from presets and templates
  const categories = useMemo(() => {
    const presetCategories = Array.from(new Set(presets.map(p => p.category)));
    const templateCategories = Array.from(new Set(templates.map(t => t.category)));
    const allCategories = [...new Set([...presetCategories, ...templateCategories])];
    return ['all', ...allCategories.sort()];
  }, [presets, templates]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let items: (ConfigurationPreset | TemplateDefinition)[] = filters.showTemplates 
      ? templates 
      : presets;

    // Apply filters
    if (filters.category !== 'all') {
      items = items.filter(item => item.category === filters.category);
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        ('tags' in item && item.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    if (filters.showFavorites && !filters.showTemplates) {
      items = (items as ConfigurationPreset[]).filter(preset => preset.isFavorite);
    }

    // Sort items
    items.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created':
          comparison = new Date(a.created).getTime() - new Date(b.created).getTime();
          break;
        case 'usage':
          if ('usageCount' in a && 'usageCount' in b) {
            comparison = a.usageCount - b.usageCount;
          }
          break;
        case 'rating':
          if ('rating' in a && 'rating' in b) {
            comparison = (a.rating || 0) - (b.rating || 0);
          }
          break;
      }

      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return items;
  }, [presets, templates, filters]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [loadedPresets, loadedTemplates] = await Promise.all([
          presetManager.getPresets(),
          templateSystem.getTemplates()
        ]);
        
        setPresets(loadedPresets);
        setTemplates(loadedTemplates);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load presets');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [presetManager, templateSystem]);

  // Event handlers
  const handlePresetSelect = useCallback((item: ConfigurationPreset | TemplateDefinition) => {
    if ('settings' in item) {
      // It's a preset
      const preset = item as ConfigurationPreset;
      setSelectedPreset(preset);
      onPresetSelect?.(preset);
    } else {
      // It's a template - would need to create instance first
      console.log('Template selected:', item.name);
    }
  }, [onPresetSelect]);

  const handlePresetApply = useCallback(async (preset: ConfigurationPreset) => {
    if (selectedDevices.length === 0) {
      setError('No devices selected');
      return;
    }

    try {
      await presetManager.applyPreset(preset.id, selectedDevices);
      onPresetApply?.(preset, selectedDevices);
      
      // Update usage count
      await presetManager.incrementUsage(preset.id);
      
      // Reload presets to reflect usage update
      const updatedPresets = await presetManager.getPresets();
      setPresets(updatedPresets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply preset');
    }
  }, [selectedDevices, presetManager, onPresetApply]);

  const handleToggleFavorite = useCallback(async (preset: ConfigurationPreset) => {
    try {
      if (preset.isFavorite) {
        await presetManager.removeFromFavorites(preset.id);
      } else {
        await presetManager.addToFavorites(preset.id);
      }
      
      // Reload presets
      const updatedPresets = await presetManager.getPresets();
      setPresets(updatedPresets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favorite');
    }
  }, [presetManager]);

  const handleRatePreset = useCallback(async (preset: ConfigurationPreset, rating: number) => {
    try {
      const updatedPreset = await presetManager.updatePreset(preset.id, { rating });
      
      // Update local state
      setPresets(prevPresets =>
        prevPresets.map(p => p.id === preset.id ? updatedPreset : p)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rate preset');
    }
  }, [presetManager]);

  const handleDeletePreset = useCallback(async (preset: ConfigurationPreset) => {
    if (!confirm(`Are you sure you want to delete "${preset.name}"?`)) {
      return;
    }

    try {
      await presetManager.deletePreset(preset.id);
      
      // Remove from local state
      setPresets(prevPresets => prevPresets.filter(p => p.id !== preset.id));
      
      if (selectedPreset?.id === preset.id) {
        setSelectedPreset(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete preset');
    }
  }, [presetManager, selectedPreset]);

  const handleExportPreset = useCallback(async (preset: ConfigurationPreset) => {
    try {
      const exported = await presetManager.exportPreset(preset.id);
      
      // Create download
      const blob = new Blob([JSON.stringify(exported, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${preset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export preset');
    }
  }, [presetManager]);

  const renderPresetCard = (item: ConfigurationPreset | TemplateDefinition, isTemplate: boolean = false) => {
    const preset = item as ConfigurationPreset;
    const template = item as TemplateDefinition;

    return (
      <div
        key={item.id}
        className={`preset-card ${selectedPreset?.id === item.id ? 'selected' : ''} ${isTemplate ? 'template' : ''}`}
        onClick={() => handlePresetSelect(item)}
      >
        <div className="preset-header">
          <h3 className="preset-name">{item.name}</h3>
          <div className="preset-actions">
            {!isTemplate && (
              <>
                <button
                  className={`favorite-btn ${preset.isFavorite ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite(preset);
                  }}
                  title={preset.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  ⭐
                </button>
                <div className="preset-menu">
                  <button className="menu-btn" onClick={(e) => e.stopPropagation()}>⋯</button>
                  <div className="menu-dropdown">
                    <button onClick={() => onPresetEdit?.(preset)}>Edit</button>
                    <button onClick={() => handleExportPreset(preset)}>Export</button>
                    <button onClick={() => handleDeletePreset(preset)}>Delete</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="preset-description">{item.description}</p>

        <div className="preset-meta">
          <span className="preset-category">{item.category}</span>
          {!isTemplate && (
            <>
              <span className="preset-usage">Used {preset.usageCount} times</span>
              {preset.rating && (
                <div className="preset-rating">
                  {'★'.repeat(Math.round(preset.rating))}{'☆'.repeat(5 - Math.round(preset.rating))}
                </div>
              )}
            </>
          )}
          {isTemplate && (
            <span className="template-badge">Template</span>
          )}
        </div>

        <div className="preset-tags">
          {('tags' in item) && item.tags.map(tag => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>

        <div className="preset-footer">
          <span className="preset-date">
            {new Date(item.created).toLocaleDateString()}
          </span>
          {!isTemplate && (
            <button
              className="apply-btn"
              onClick={(e) => {
                e.stopPropagation();
                handlePresetApply(preset);
              }}
              disabled={selectedDevices.length === 0}
            >
              Apply
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderListItem = (item: ConfigurationPreset | TemplateDefinition, isTemplate: boolean = false) => {
    const preset = item as ConfigurationPreset;

    return (
      <div
        key={item.id}
        className={`preset-list-item ${selectedPreset?.id === item.id ? 'selected' : ''} ${isTemplate ? 'template' : ''}`}
        onClick={() => handlePresetSelect(item)}
      >
        <div className="item-main">
          <div className="item-info">
            <h4 className="item-name">{item.name}</h4>
            <p className="item-description">{item.description}</p>
            <div className="item-meta">
              <span className="item-category">{item.category}</span>
              {!isTemplate && <span className="item-usage">{preset.usageCount} uses</span>}
              <span className="item-date">{new Date(item.created).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="item-actions">
            {!isTemplate && (
              <>
                <button
                  className={`favorite-btn ${preset.isFavorite ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite(preset);
                  }}
                >
                  ⭐
                </button>
                <button
                  className="apply-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePresetApply(preset);
                  }}
                  disabled={selectedDevices.length === 0}
                >
                  Apply
                </button>
              </>
            )}
          </div>
        </div>

        {!isTemplate && preset.rating && (
          <div className="item-rating">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                className={`star ${star <= Math.round(preset.rating!) ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRatePreset(preset, star);
                }}
              >
                ★
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="preset-library loading">
        <div className="loading-spinner">Loading presets...</div>
      </div>
    );
  }

  return (
    <div className="preset-library">
      <div className="library-header">
        <h2>Preset Library</h2>
        
        <div className="header-controls">
          <div className="view-toggle">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
          
          <button
            className={`toggle-templates ${filters.showTemplates ? 'active' : ''}`}
            onClick={() => setFilters(prev => ({ ...prev, showTemplates: !prev.showTemplates }))}
          >
            {filters.showTemplates ? 'Show Presets' : 'Show Templates'}
          </button>
        </div>
      </div>

      <div className="library-filters">
        <div className="filter-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search presets..."
              value={filters.searchQuery}
              onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            />
          </div>

          <select
            value={filters.category}
            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
          >
            <option value="name">Name</option>
            <option value="created">Date Created</option>
            {!filters.showTemplates && (
              <>
                <option value="usage">Usage</option>
                <option value="rating">Rating</option>
              </>
            )}
          </select>

          <button
            className={`sort-order ${filters.sortOrder}`}
            onClick={() => setFilters(prev => ({
              ...prev,
              sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
            }))}
          >
            {filters.sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          {!filters.showTemplates && (
            <button
              className={`favorites-filter ${filters.showFavorites ? 'active' : ''}`}
              onClick={() => setFilters(prev => ({ ...prev, showFavorites: !prev.showFavorites }))}
            >
              Favorites Only
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="library-content">
        <div className={`presets-container ${viewMode}`}>
          {filteredItems.length === 0 ? (
            <div className="no-presets">
              <p>No {filters.showTemplates ? 'templates' : 'presets'} found.</p>
              {filters.searchQuery && (
                <button onClick={() => setFilters(prev => ({ ...prev, searchQuery: '' }))}>
                  Clear search
                </button>
              )}
            </div>
          ) : (
            filteredItems.map(item =>
              viewMode === 'grid'
                ? renderPresetCard(item, filters.showTemplates)
                : renderListItem(item, filters.showTemplates)
            )
          )}
        </div>

        {selectedPreset && showPreview && (
          <div className="preset-preview">
            <div className="preview-header">
              <h3>{selectedPreset.name}</h3>
              <button onClick={() => setShowPreview(false)}>×</button>
            </div>
            
            <div className="preview-content">
              <p>{selectedPreset.description}</p>
              
              <div className="preset-settings-preview">
                <h4>Settings</h4>
                <pre>{JSON.stringify(selectedPreset.settings, null, 2)}</pre>
              </div>
              
              <div className="preview-actions">
                <button onClick={() => onPresetEdit?.(selectedPreset)}>
                  Edit Preset
                </button>
                <button 
                  onClick={() => handlePresetApply(selectedPreset)}
                  disabled={selectedDevices.length === 0}
                >
                  Apply to Selected Devices
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="library-footer">
        <div className="selection-info">
          {selectedDevices.length > 0 ? (
            <span>{selectedDevices.length} device(s) selected</span>
          ) : (
            <span className="warning">Select devices to apply presets</span>
          )}
        </div>
        
        <div className="library-stats">
          <span>{presets.length} presets</span>
          <span>{templates.length} templates</span>
        </div>
      </div>
    </div>
  );
};