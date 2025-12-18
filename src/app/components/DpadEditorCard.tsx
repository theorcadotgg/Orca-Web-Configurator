import type { SettingsDraft } from '../../schema/settingsBlob';
import { DigitalSourceEditor } from './DigitalSourceEditor';

type Props = {
  draft: SettingsDraft;
  disabled?: boolean;
  onChange: (next: SettingsDraft) => void;
};

const MODE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Disabled' },
  { value: 1, label: 'With Modifier' },
  { value: 2, label: 'Always on' },
];

function cloneDraft(draft: SettingsDraft): SettingsDraft {
  return {
    ...draft,
    profileLabels: [...draft.profileLabels],
    digitalMappings: draft.digitalMappings.map((m) => [...m]),
    analogMappings: draft.analogMappings.map((m) => [...m]),
    dpadLayer: draft.dpadLayer.map((layer) => ({
      ...layer,
      enable: { ...layer.enable },
      up: { ...layer.up },
      down: { ...layer.down },
      left: { ...layer.left },
      right: { ...layer.right },
    })),
    triggerPolicy: draft.triggerPolicy.map((policy) => ({ ...policy })),
  };
}

export function DpadEditorCard({ draft, disabled, onChange }: Props) {
  const activeProfile = draft.activeProfile ?? 0;
  const layer = draft.dpadLayer[activeProfile] ?? draft.dpadLayer[0];
  if (!layer) return null;

  function updateLayer(patch: Partial<typeof layer>) {
    const updated = cloneDraft(draft);
    const current = updated.dpadLayer[activeProfile] ?? updated.dpadLayer[0];
    if (!current) return;
    updated.dpadLayer[activeProfile] = { ...current, ...patch };
    onChange(updated);
  }

  const modes = [layer.mode_up ?? 0, layer.mode_down ?? 0, layer.mode_left ?? 0, layer.mode_right ?? 0];
  const allSameMode = modes.every((m) => m === modes[0]);
  const isActive = modes.some((m) => m !== 0);
  const modeLabel = allSameMode ? (MODE_OPTIONS.find(o => o.value === (modes[0] ?? 0))?.label ?? 'Unknown') : 'Mixed';

  return (
    <div className="card animate-slide-up">
      <div className="card-header">
        <div>
          <h2 className="card-title">DPAD Layer</h2>
          <p className="card-subtitle">Independent DPAD mapping (digital + analog thresholds)</p>
        </div>
        <span className={`pill ${isActive ? 'pill-accent' : 'pill-neutral'}`}>
          {modeLabel}
        </span>
      </div>

      {/* Visual DPAD representation */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 'var(--spacing-lg)',
        marginTop: 'var(--spacing-md)'
      }}>
        <div style={{
          position: 'relative',
          width: 160,
          height: 160,
          background: 'var(--color-bg-tertiary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)'
        }}>
          {/* Up */}
          <div style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 40,
            height: 50,
            background: 'var(--gradient-primary)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-primary)'
          }}>
            <span style={{ fontWeight: 600, color: '#0a0e1a' }}>↑</span>
          </div>
          {/* Down */}
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 40,
            height: 50,
            background: 'var(--gradient-primary)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-primary)'
          }}>
            <span style={{ fontWeight: 600, color: '#0a0e1a' }}>↓</span>
          </div>
          {/* Left */}
          <div style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 50,
            height: 40,
            background: 'var(--gradient-primary)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-primary)'
          }}>
            <span style={{ fontWeight: 600, color: '#0a0e1a' }}>←</span>
          </div>
          {/* Right */}
          <div style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 50,
            height: 40,
            background: 'var(--gradient-primary)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-primary)'
          }}>
            <span style={{ fontWeight: 600, color: '#0a0e1a' }}>→</span>
          </div>
          {/* Center */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 40,
            height: 40,
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)'
          }} />
        </div>
      </div>

      <div className="row" style={{ marginBottom: 'var(--spacing-md)' }}>
        <label style={{ color: 'var(--color-text-secondary)' }}>
          Mode:
        </label>
        <select
          value={layer.mode_up ?? 0}
          onChange={(e) => {
            const mode = Number(e.target.value);
            updateLayer({
              mode_up: mode,
              mode_down: mode,
              mode_left: mode,
              mode_right: mode,
            });
          }}
          disabled={disabled}
        >
          {MODE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <DigitalSourceEditor
        label="Enable Source"
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
