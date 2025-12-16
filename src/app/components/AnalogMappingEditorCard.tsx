import { ORCA_CONFIG_SETTINGS_PROFILE_COUNT } from '@shared/orca_config_idl_generated';
import type { SettingsDraft } from '../../schema/settingsBlob';
import { ANALOG_INPUTS, ORCA_ANALOG_MAPPING_DISABLED, analogInputLabel } from '../../schema/orcaMappings';

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
    dpadLayer: {
      ...draft.dpadLayer,
      enable: { ...draft.dpadLayer.enable },
      up: { ...draft.dpadLayer.up },
      down: { ...draft.dpadLayer.down },
      left: { ...draft.dpadLayer.left },
      right: { ...draft.dpadLayer.right },
    },
    triggerPolicy: { ...draft.triggerPolicy },
  };
}

export function AnalogMappingEditorCard({ draft, disabled, onChange }: Props) {
  const activeProfile = draft.activeProfile;
  const mapping = draft.analogMappings[activeProfile] ?? [];

  function setActiveProfile(next: number) {
    const updated = cloneDraft(draft);
    updated.activeProfile = next;
    onChange(updated);
  }

  function setMapping(dest: number, src: number) {
    const updated = cloneDraft(draft);
    updated.analogMappings[activeProfile] = [...(updated.analogMappings[activeProfile] ?? [])];
    updated.analogMappings[activeProfile]![dest] = src;
    onChange(updated);
  }

  function resetProfileToDefaults() {
    const updated = cloneDraft(draft);
    updated.analogMappings[activeProfile] = Array.from({ length: mapping.length }, (_, i) => i);
    onChange(updated);
  }

  return (
    <div className="card">
      <div className="row">
        <strong>Analog Mapping</strong>
        <span style={{ opacity: 0.8 }}>Joystick directions + analog trigger</span>
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

        <button onClick={resetProfileToDefaults} disabled={disabled}>
          Reset profile analog mapping
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
            {mapping.map((src, dest) => (
              <tr key={dest}>
                <td>
                  {analogInputLabel(dest)} <span style={{ opacity: 0.6 }}>({dest})</span>
                </td>
                <td>
                  <select value={src} onChange={(e) => setMapping(dest, Number(e.target.value))} disabled={disabled}>
                    <option value={ORCA_ANALOG_MAPPING_DISABLED}>Disabled (0.0) (0xFF)</option>
                    {ANALOG_INPUTS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label} ({opt.id})
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
        Analog “Disabled” uses sentinel <code>0xFF</code> and is applied after calibration/curve.
      </div>
    </div>
  );
}

