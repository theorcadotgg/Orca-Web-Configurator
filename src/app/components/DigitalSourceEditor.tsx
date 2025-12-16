import type { DigitalSourceV1 } from '../../schema/settingsBlob';
import { ANALOG_INPUTS, DIGITAL_INPUTS, analogInputLabel, digitalInputLabel, isLockedDigitalSource } from '../../schema/orcaMappings';

type Props = {
  label: string;
  value: DigitalSourceV1;
  disabled?: boolean;
  onChange: (next: DigitalSourceV1) => void;
};

const SOURCE_TYPE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Digital button' },
  { value: 2, label: 'Analog ≥ threshold' },
  { value: 3, label: 'Analog ≤ threshold' },
];

export function DigitalSourceEditor({ label, value, disabled, onChange }: Props) {
  const type = value.type ?? 0;

  const digitalOptions = DIGITAL_INPUTS.filter((d) => !isLockedDigitalSource(d.id));

  function update(patch: Partial<DigitalSourceV1>) {
    onChange({
      type: patch.type ?? value.type ?? 0,
      index: patch.index ?? value.index ?? 0,
      threshold: patch.threshold ?? value.threshold ?? 0,
      hysteresis: patch.hysteresis ?? value.hysteresis ?? 0,
    });
  }

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="row">
        <strong>{label}</strong>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label>
          Type:{' '}
          <select value={type} onChange={(e) => update({ type: Number(e.target.value) })} disabled={disabled}>
            {SOURCE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {type === 1 ? (
          <label>
            Source:{' '}
            <select value={value.index} onChange={(e) => update({ index: Number(e.target.value) })} disabled={disabled}>
              {digitalOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.id})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {type === 2 || type === 3 ? (
          <>
            <label>
              Source:{' '}
              <select value={value.index} onChange={(e) => update({ index: Number(e.target.value) })} disabled={disabled}>
                {ANALOG_INPUTS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} ({opt.id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Threshold:{' '}
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={Number.isFinite(value.threshold) ? value.threshold : 0}
                onChange={(e) => update({ threshold: Number(e.target.value) })}
                disabled={disabled}
              />
            </label>
            <label>
              Hysteresis:{' '}
              <input
                type="number"
                min={0}
                max={0.5}
                step={0.01}
                value={Number.isFinite(value.hysteresis) ? value.hysteresis : 0}
                onChange={(e) => update({ hysteresis: Number(e.target.value) })}
                disabled={disabled}
              />
            </label>
          </>
        ) : null}
      </div>

      <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>
        Current: {type === 1 ? digitalInputLabel(value.index) : type === 2 || type === 3 ? analogInputLabel(value.index) : 'None'}
      </div>
    </div>
  );
}

