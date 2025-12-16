import { useState } from 'react';
import { ORCA_CONFIG_SETTINGS_PROFILE_COUNT } from '@shared/orca_config_idl_generated';
import type { SettingsDraft } from '../../schema/settingsBlob';
import { DIGITAL_INPUTS, ORCA_DUMMY_FIELD, digitalInputLabel, isLockedDigitalDestination, isLockedDigitalSource, ANALOG_INPUTS, analogInputLabel, ORCA_ANALOG_MAPPING_DISABLED } from '../../schema/orcaMappings';
import { ControllerVisualizer } from './ControllerVisualizer';

type Props = {
  draft: SettingsDraft;
  disabled?: boolean;
  onChange: (next: SettingsDraft) => void;
};

function cloneDraft(draft: SettingsDraft): SettingsDraft {
  return {
    ...draft,
    profileLabels: [...draft.profileLabels],
    digitalMappings: draft.digitalMappings.map((m) => [...m]),
    analogMappings: draft.analogMappings.map((m) => [...m]),
    dpadLayer: { ...draft.dpadLayer, enable: { ...draft.dpadLayer.enable }, up: { ...draft.dpadLayer.up }, down: { ...draft.dpadLayer.down }, left: { ...draft.dpadLayer.left }, right: { ...draft.dpadLayer.right } },
    triggerPolicy: { ...draft.triggerPolicy },
  };
}

export function MappingEditorCard({ draft, disabled, onChange }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);

  const activeProfile = draft.activeProfile;
  const digitalMapping = draft.digitalMappings[activeProfile] ?? [];
  const analogMapping = draft.analogMappings[activeProfile] ?? [];
  const label = draft.profileLabels[activeProfile] ?? '';

  const digitalSourceOptions = DIGITAL_INPUTS.filter((d) => !isLockedDigitalSource(d.id)).sort((a, b) => {
    if (a.id === ORCA_DUMMY_FIELD) return -1;
    if (b.id === ORCA_DUMMY_FIELD) return 1;
    return a.id - b.id;
  });

  function setActiveProfile(next: number) {
    const updated = cloneDraft(draft);
    updated.activeProfile = next;
    onChange(updated);
  }

  function setProfileLabel(next: string) {
    const updated = cloneDraft(draft);
    updated.profileLabels[activeProfile] = next;
    onChange(updated);
  }

  function setDigitalMapping(dest: number, src: number) {
    const updated = cloneDraft(draft);
    updated.digitalMappings[activeProfile] = [...(updated.digitalMappings[activeProfile] ?? [])];
    updated.digitalMappings[activeProfile]![dest] = src;
    onChange(updated);
  }

  function setAnalogMapping(dest: number, src: number) {
    const updated = cloneDraft(draft);
    updated.analogMappings[activeProfile] = [...(updated.analogMappings[activeProfile] ?? [])];
    updated.analogMappings[activeProfile]![dest] = src;
    onChange(updated);
  }

  function resetAllMappings() {
    const updated = cloneDraft(draft);
    updated.digitalMappings[activeProfile] = Array.from({ length: digitalMapping.length }, (_, i) => i);
    updated.analogMappings[activeProfile] = Array.from({ length: analogMapping.length }, (_, i) => i);
    onChange(updated);
  }

  // Count how many buttons are remapped
  const digitalRemappedCount = digitalMapping.filter((src, dest) => src !== dest).length;
  const analogRemappedCount = analogMapping.filter((src, dest) => src !== dest).length;
  const totalRemapped = digitalRemappedCount + analogRemappedCount;

  return (
    <div className="card animate-slide-up">
      {/* Card Header */}
      <div className="card-header">
        <div>
          <h2 className="card-title">Button & Analog Mapping</h2>
          <p className="card-subtitle">Click a button on the controller to remap it</p>
        </div>
        <div className="row">
          {totalRemapped > 0 && (
            <span className="pill pill-accent">{totalRemapped} remapped</span>
          )}
          <button onClick={resetAllMappings} disabled={disabled} className="danger">
            Reset All
          </button>
        </div>
      </div>

      {/* Profile Tabs */}
      <div className="profile-tabs">
        {Array.from({ length: ORCA_CONFIG_SETTINGS_PROFILE_COUNT }, (_, i) => (
          <button
            key={i}
            className={`profile-tab ${activeProfile === i ? 'active' : ''}`}
            onClick={() => setActiveProfile(i)}
            disabled={disabled}
          >
            {draft.profileLabels[i]?.trim() || `Profile ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Profile Label Editor */}
      <div className="row" style={{ marginTop: 'var(--spacing-md)' }}>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Profile Name:
        </span>
        {editingLabel ? (
          <input
            type="text"
            value={label}
            onChange={(e) => setProfileLabel(e.target.value)}
            onBlur={() => setEditingLabel(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingLabel(false)}
            autoFocus
            disabled={disabled}
            style={{ width: 200 }}
            placeholder={`Profile ${activeProfile + 1}`}
          />
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            disabled={disabled}
            style={{
              background: 'transparent',
              border: '1px dashed var(--color-border)',
              color: 'var(--color-text-primary)'
            }}
          >
            {label.trim() || `Profile ${activeProfile + 1}`}
            <span style={{ marginLeft: 8, opacity: 0.5 }}>✏️</span>
          </button>
        )}
      </div>

      {/* Controller Visualizer - Combined Digital + Analog */}
      <ControllerVisualizer
        digitalMapping={digitalMapping}
        analogMapping={analogMapping}
        disabled={disabled}
        onDigitalMappingChange={setDigitalMapping}
        onAnalogMappingChange={setAnalogMapping}
      />

      {/* Advanced Table View (Collapsible) */}
      <div style={{ marginTop: 'var(--spacing-lg)' }}>
        <div
          className="section-header"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <h3>Advanced Table View</h3>
          <div className={`section-toggle ${showAdvanced ? 'open' : ''}`}>
            ▼
          </div>
        </div>

        {showAdvanced && (
          <div className="section-content animate-fade-in" style={{ marginTop: 'var(--spacing-md)' }}>
            {/* Digital Mapping Table */}
            <h4 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--color-accent-primary)' }}>Digital Buttons</h4>
            <div style={{ overflowX: 'auto', marginBottom: 'var(--spacing-lg)' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Output</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {digitalMapping.map((src, dest) => {
                    const locked = isLockedDigitalDestination(dest);
                    const buttonLabel = digitalInputLabel(dest);
                    const isModified = src !== dest;
                    return (
                      <tr key={dest}>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {buttonLabel}
                            <span style={{ opacity: 0.5, fontSize: 'var(--font-size-xs)' }}>({dest})</span>
                            {locked && <span className="pill pill-neutral">Locked</span>}
                            {isModified && !locked && <span className="pill pill-accent">Modified</span>}
                          </span>
                        </td>
                        <td>
                          <select
                            value={locked ? dest : src}
                            disabled={disabled || locked}
                            onChange={(e) => setDigitalMapping(dest, Number(e.target.value))}
                          >
                            {digitalSourceOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label} ({opt.id})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Analog Mapping Table */}
            <h4 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--color-accent-secondary)' }}>Analog Inputs</h4>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Output</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {analogMapping.map((src, dest) => {
                    const isModified = src !== dest;
                    return (
                      <tr key={dest}>
                        <td>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {analogInputLabel(dest)}
                            <span style={{ opacity: 0.5, fontSize: 'var(--font-size-xs)' }}>({dest})</span>
                            {isModified && <span className="pill pill-accent" style={{ background: 'rgba(168, 85, 247, 0.2)', borderColor: 'rgba(168, 85, 247, 0.4)' }}>Modified</span>}
                          </span>
                        </td>
                        <td>
                          <select
                            value={src}
                            disabled={disabled}
                            onChange={(e) => setAnalogMapping(dest, Number(e.target.value))}
                          >
                            <option value={ORCA_ANALOG_MAPPING_DISABLED}>Disabled (0xFF)</option>
                            {ANALOG_INPUTS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label} ({opt.id})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 'var(--spacing-md)', opacity: 0.7, fontSize: 'var(--font-size-sm)' }}>
              Locked system buttons are not remappable. Analog inputs can only map to other analog inputs.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
