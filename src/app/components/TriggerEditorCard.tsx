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
    <div className="card animate-slide-up">
      <div className="card-header">
        <div>
          <h2 className="card-title">Trigger Policy</h2>
          <p className="card-subtitle">Configure analog trigger thresholds (0-255)</p>
        </div>
      </div>

      {/* Visual Trigger Representation */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 'var(--spacing-xl)',
        marginBottom: 'var(--spacing-lg)',
        marginTop: 'var(--spacing-md)'
      }}>
        {/* Left Trigger */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>L Trigger</span>
          <div style={{
            width: 60,
            height: 120,
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Fill level */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: `${(digitalFullPress255 / 255) * 100}%`,
              background: 'var(--gradient-primary)',
              opacity: 0.7,
              transition: 'height 0.2s ease'
            }} />
            {/* Threshold line */}
            <div style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: `${(digitalLightshield255 / 255) * 100}%`,
              height: 2,
              background: 'var(--color-accent-secondary)',
              boxShadow: 'var(--shadow-glow-secondary)'
            }} />
          </div>
        </div>

        {/* Right Trigger */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>R Trigger</span>
          <div style={{
            width: 60,
            height: 120,
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Fill level */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: `${(analogRangeMax255 / 255) * 100}%`,
              background: 'var(--gradient-primary)',
              opacity: 0.7,
              transition: 'height 0.2s ease'
            }} />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="row" style={{ justifyContent: 'center', marginBottom: 'var(--spacing-lg)', gap: 'var(--spacing-lg)' }}>
        <div className="row" style={{ gap: 'var(--spacing-sm)' }}>
          <div style={{ width: 16, height: 16, background: 'var(--gradient-primary)', borderRadius: 4 }} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Full Press</span>
        </div>
        <div className="row" style={{ gap: 'var(--spacing-sm)' }}>
          <div style={{ width: 16, height: 4, background: 'var(--color-accent-secondary)', boxShadow: 'var(--shadow-glow-secondary)' }} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Lightshield</span>
        </div>
      </div>

      <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
        <div className="col" style={{ gap: 'var(--spacing-sm)' }}>
          <label style={{ color: 'var(--color-text-secondary)' }}>
            Analog range max
            <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--color-accent-primary)' }}>
              {analogRangeMax255}
            </span>
          </label>
          <div className="row">
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={analogRangeMax255}
              onChange={(e) => updatePolicy({ analogRangeMax: from255(Number(e.target.value)) })}
              disabled={disabled}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={0}
              max={255}
              step={1}
              value={analogRangeMax255}
              onChange={(e) => updatePolicy({ analogRangeMax: from255(Number(e.target.value)) })}
              disabled={disabled}
              style={{ width: 70 }}
            />
          </div>
        </div>

        <div className="col" style={{ gap: 'var(--spacing-sm)' }}>
          <label style={{ color: 'var(--color-text-secondary)' }}>
            Digital full press
            <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--color-accent-primary)' }}>
              {digitalFullPress255}
            </span>
          </label>
          <div className="row">
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={digitalFullPress255}
              onChange={(e) => updatePolicy({ digitalFullPress: from255(Number(e.target.value)) })}
              disabled={disabled}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={0}
              max={255}
              step={1}
              value={digitalFullPress255}
              onChange={(e) => updatePolicy({ digitalFullPress: from255(Number(e.target.value)) })}
              disabled={disabled}
              style={{ width: 70 }}
            />
          </div>
        </div>

        <div className="col" style={{ gap: 'var(--spacing-sm)' }}>
          <label style={{ color: 'var(--color-text-secondary)' }}>
            Digital lightshield
            <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--color-accent-secondary)' }}>
              {digitalLightshield255}
            </span>
          </label>
          <div className="row">
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={digitalLightshield255}
              onChange={(e) => updatePolicy({ digitalLightshield: from255(Number(e.target.value)) })}
              disabled={disabled}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min={0}
              max={255}
              step={1}
              value={digitalLightshield255}
              onChange={(e) => updatePolicy({ digitalLightshield: from255(Number(e.target.value)) })}
              disabled={disabled}
              style={{ width: 70 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
