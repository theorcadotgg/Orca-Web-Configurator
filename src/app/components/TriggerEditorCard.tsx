import type { SettingsDraft } from '../../schema/settingsBlob';

type Props = {
  draft: SettingsDraft;
  disabled?: boolean;
  onChange: (next: SettingsDraft) => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function to255(v: number): number {
  return clamp(Math.round(v * 255), 0, 255);
}

function from255(v: number): number {
  return clamp(v, 0, 255) / 255;
}

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

export function TriggerEditorCard({ draft, disabled, onChange }: Props) {
  const policy = draft.triggerPolicy;

  function updatePolicy(patch: Partial<typeof policy>) {
    const updated = cloneDraft(draft);
    updated.triggerPolicy = { ...updated.triggerPolicy, ...patch };
    onChange(updated);
  }

  const analogRangeMax255 = to255(policy.analogRangeMax);
  const digitalFullPress255 = to255(policy.digitalFullPress);
  const digitalLightshield255 = to255(policy.digitalLightshield);

  return (
    <div className="card">
      <div className="row">
        <strong>Trigger Policy</strong>
        <span style={{ opacity: 0.8 }}>Values are stored normalized (0..1) and shown as 0..255</span>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Analog range max</label>
          <div className="row">
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={analogRangeMax255}
              onChange={(e) => updatePolicy({ analogRangeMax: from255(Number(e.target.value)) })}
              disabled={disabled}
            />
            <input
              type="number"
              min={0}
              max={255}
              step={1}
              value={analogRangeMax255}
              onChange={(e) => updatePolicy({ analogRangeMax: from255(Number(e.target.value)) })}
              disabled={disabled}
              style={{ width: 80 }}
            />
          </div>
        </div>

        <div className="field">
          <label>Digital full press</label>
          <div className="row">
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={digitalFullPress255}
              onChange={(e) => updatePolicy({ digitalFullPress: from255(Number(e.target.value)) })}
              disabled={disabled}
            />
            <input
              type="number"
              min={0}
              max={255}
              step={1}
              value={digitalFullPress255}
              onChange={(e) => updatePolicy({ digitalFullPress: from255(Number(e.target.value)) })}
              disabled={disabled}
              style={{ width: 80 }}
            />
          </div>
        </div>

        <div className="field">
          <label>Digital lightshield</label>
          <div className="row">
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={digitalLightshield255}
              onChange={(e) => updatePolicy({ digitalLightshield: from255(Number(e.target.value)) })}
              disabled={disabled}
            />
            <input
              type="number"
              min={0}
              max={255}
              step={1}
              value={digitalLightshield255}
              onChange={(e) => updatePolicy({ digitalLightshield: from255(Number(e.target.value)) })}
              disabled={disabled}
              style={{ width: 80 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

