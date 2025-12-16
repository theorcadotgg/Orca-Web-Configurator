import { ORCA_CONFIG_SETTINGS_PROFILE_COUNT } from '@shared/orca_config_idl_generated';
import type { SettingsDraft } from '../../schema/settingsBlob';
import { DIGITAL_INPUTS, ORCA_DUMMY_FIELD, digitalInputLabel, isLockedDigitalDestination, isLockedDigitalSource } from '../../schema/orcaMappings';

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
  const activeProfile = draft.activeProfile;
  const mapping = draft.digitalMappings[activeProfile] ?? [];
  const label = draft.profileLabels[activeProfile] ?? '';

  const sourceOptions = DIGITAL_INPUTS.filter((d) => !isLockedDigitalSource(d.id)).sort((a, b) => {
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

  function setMapping(dest: number, src: number) {
    const updated = cloneDraft(draft);
    updated.digitalMappings[activeProfile] = [...(updated.digitalMappings[activeProfile] ?? [])];
    updated.digitalMappings[activeProfile]![dest] = src;
    onChange(updated);
  }

  function resetProfileToDefaults() {
    const updated = cloneDraft(draft);
    updated.digitalMappings[activeProfile] = Array.from({ length: mapping.length }, (_, i) => i);
    onChange(updated);
  }

  return (
    <div className="card">
      <div className="row">
        <strong>Button Mapping</strong>
        <span style={{ opacity: 0.8 }}>Gather table: output = input[mapping[output]]</span>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <label>
          Active profile:{' '}
          <select value={activeProfile} onChange={(e) => setActiveProfile(Number(e.target.value))} disabled={disabled}>
            {Array.from({ length: ORCA_CONFIG_SETTINGS_PROFILE_COUNT }, (_, i) => (
              <option key={i} value={i}>
                {i}: {draft.profileLabels[i] ?? `Profile ${i + 1}`}
              </option>
            ))}
          </select>
        </label>

        <label>
          Label:{' '}
          <input
            type="text"
            value={label}
            onChange={(e) => setProfileLabel(e.target.value)}
            disabled={disabled}
            style={{ width: 220 }}
          />
        </label>

        <button onClick={resetProfileToDefaults} disabled={disabled}>
          Reset profile mapping
        </button>
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Output</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {mapping.map((src, dest) => {
              const locked = isLockedDigitalDestination(dest);
              const label = digitalInputLabel(dest);
              return (
                <tr key={dest}>
                  <td>
                    {label} <span style={{ opacity: 0.6 }}>({dest})</span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <select
                        value={locked ? dest : src}
                        disabled={disabled || locked}
                        onChange={(e) => setMapping(dest, Number(e.target.value))}
                      >
                      {sourceOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} ({opt.id})
                        </option>
                      ))}
                      </select>
                      {!locked && src === ORCA_DUMMY_FIELD ? <span className="pill pill-neutral">Disabled</span> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
        Locked system buttons are not remappable and cannot be used as sources.
      </div>
    </div>
  );
}
