import type { DigitalSourceV1 } from '../../schema/settingsBlob';
import { ANALOG_INPUTS, DIGITAL_INPUTS, isLockedDigitalSource } from '../../schema/orcaMappings';

type Props = {
    label: string;
    value: DigitalSourceV1;
    disabled?: boolean;
    onChange: (next: DigitalSourceV1) => void;
    allowAnalog?: boolean;
};

const SOURCE_TYPE_OPTIONS: { value: number; short: string; disabled?: boolean }[] = [
    { value: 0, short: '—' },
    { value: 1, short: 'Digital' },
    { value: 2, short: 'Analog ≥' },
    { value: 3, short: 'Analog ≤' },
];

/**
 * Compact digital/analog source editor for sidebar use.
 * Uses two rows for analog mode to show threshold and hysteresis.
 */
export function DigitalSourceEditorCompact({ label, value, disabled, onChange, allowAnalog = true }: Props) {
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

    const isAnalog = type === 2 || type === 3;
    const typeOptions = (() => {
        const base = allowAnalog ? SOURCE_TYPE_OPTIONS : SOURCE_TYPE_OPTIONS.filter((opt) => opt.value === 0 || opt.value === 1);
        if (!allowAnalog && isAnalog) {
            return [
                {
                    value: type,
                    short: type === 2 ? 'Analog ≥ (GP2040 only)' : 'Analog ≤ (GP2040 only)',
                    disabled: true,
                },
                ...base,
            ];
        }
        return base;
    })();

    return (
        <div style={{
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 8px',
        }}>
            {/* Row 1: Label | Type | Source */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: type === 0 ? 'auto 1fr' : 'auto auto 1fr',
                gap: '8px',
                alignItems: 'center',
            }}>
                {/* Label */}
                <span style={{
                    fontWeight: 600,
                    fontSize: 12,
                    color: 'var(--color-text-primary)',
                    minWidth: 40,
                }}>
                    {label}
                </span>

                {/* Type selector */}
                <select
                    value={type}
                    onChange={(e) => update({ type: Number(e.target.value) })}
                    disabled={disabled}
                    style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        background: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-hover)',
                        borderRadius: 'var(--radius-sm)',
                        color: type === 0 ? 'var(--color-text-muted)' : 'var(--color-brand-light)',
                        minWidth: 70,
                        cursor: 'pointer',
                    }}
	                >
	                    {typeOptions.map((opt) => (
	                        <option key={`${opt.value}-${opt.short}`} value={opt.value} disabled={opt.disabled}>
	                            {opt.short}
	                        </option>
	                    ))}
	                </select>

                {/* Digital source selector */}
                {type === 1 && (
                    <select
                        value={value.index}
                        onChange={(e) => update({ index: Number(e.target.value) })}
                        disabled={disabled}
                        style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            background: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border-hover)',
                            borderRadius: 'var(--radius-sm)',
                            minWidth: 0,
                            cursor: 'pointer',
                        }}
                    >
                        {digitalOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                )}

                {/* Analog source selector (just the source on row 1) */}
                {isAnalog && (
                    <select
                        value={value.index}
                        onChange={(e) => update({ index: Number(e.target.value) })}
                        disabled={disabled || !allowAnalog}
                        style={{
                            fontSize: 11,
                            padding: '2px 4px',
                            background: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border-hover)',
                            borderRadius: 'var(--radius-sm)',
                            minWidth: 0,
                            cursor: 'pointer',
                        }}
                    >
                        {ANALOG_INPUTS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Row 2: Threshold and Hysteresis (only for analog) */}
            {isAnalog && (
                <div style={{
                    display: 'flex',
                    gap: 12,
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: '1px solid var(--color-border)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 50 }}>Threshold</span>
                        <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            value={Number.isFinite(value.threshold) ? value.threshold : 0}
                            onChange={(e) => update({ threshold: Number(e.target.value) })}
                            disabled={disabled || !allowAnalog}
                            style={{
                                flex: 1,
                                fontSize: 11,
                                padding: '3px 6px',
                                background: 'var(--color-bg-surface)',
                                border: '1px solid var(--color-border-hover)',
                                borderRadius: 'var(--radius-sm)',
                                textAlign: 'center',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 50 }}>Hysteresis</span>
                        <input
                            type="number"
                            min={0}
                            max={0.5}
                            step={0.01}
                            value={Number.isFinite(value.hysteresis) ? value.hysteresis : 0}
                            onChange={(e) => update({ hysteresis: Number(e.target.value) })}
                            disabled={disabled || !allowAnalog}
                            style={{
                                flex: 1,
                                fontSize: 11,
                                padding: '3px 6px',
                                background: 'var(--color-bg-surface)',
                                border: '1px solid var(--color-border-hover)',
                                borderRadius: 'var(--radius-sm)',
                                textAlign: 'center',
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
