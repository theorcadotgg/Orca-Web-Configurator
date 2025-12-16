import type { SettingsDraft } from '../../schema/settingsBlob';
import { DigitalSourceEditor } from './DigitalSourceEditor';

type Props = {
  draft: SettingsDraft;
  disabled?: boolean;
  onChange: (next: SettingsDraft) => void;
};

const MODE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Disabled' },
  { value: 1, label: 'While held' },
  { value: 2, label: 'Always on' },
];

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

export function DpadEditorCard({ draft, disabled, onChange }: Props) {
  const layer = draft.dpadLayer;

  function updateLayer(patch: Partial<typeof layer>) {
    const updated = cloneDraft(draft);
    updated.dpadLayer = { ...updated.dpadLayer, ...patch };
    onChange(updated);
  }

  return (
    <div className="card">
      <div className="row">
        <strong>DPAD Layer</strong>
        <span style={{ opacity: 0.8 }}>Independent DPAD mapping (digital + analog thresholds)</span>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <label>
          Mode:{' '}
          <select
            value={layer.mode}
            onChange={(e) => updateLayer({ mode: Number(e.target.value) })}
            disabled={disabled}
          >
            {MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <DigitalSourceEditor
        label="Enable"
        value={layer.enable}
        disabled={disabled}
        onChange={(next) => updateLayer({ enable: next })}
      />
      <DigitalSourceEditor label="Up" value={layer.up} disabled={disabled} onChange={(next) => updateLayer({ up: next })} />
      <DigitalSourceEditor
        label="Down"
        value={layer.down}
        disabled={disabled}
        onChange={(next) => updateLayer({ down: next })}
      />
      <DigitalSourceEditor
        label="Left"
        value={layer.left}
        disabled={disabled}
        onChange={(next) => updateLayer({ left: next })}
      />
      <DigitalSourceEditor
        label="Right"
        value={layer.right}
        disabled={disabled}
        onChange={(next) => updateLayer({ right: next })}
      />
    </div>
  );
}

