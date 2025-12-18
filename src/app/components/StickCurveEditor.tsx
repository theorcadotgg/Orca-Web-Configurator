import type { SettingsDraft, StickCurveParamsV1 } from '../../schema/settingsBlob';

type Props = {
    draft: SettingsDraft;
    disabled?: boolean;
    onChange: (next: SettingsDraft) => void;
    mode?: 'orca' | 'gp2040'; // Mode determines valid ranges
};

// Preset definitions - values in the 0-128 scale used by firmware
// Converted to normalized values when applied
// GP2040 uses different Rivals 2 values and supports higher ranges
const PRESETS = {
    melee: {
        magnitude: 99,  // 99/128 ≈ 0.7734
        notch: 33,      // 33/128 ≈ 0.2578
    },
    rivals2: {
        orca: {
            magnitude: 120, // 120/128 ≈ 0.9375
            notch: 40,      // 40/128 ≈ 0.3125
        },
        gp2040: {
            magnitude: 125, // 125/128 ≈ 0.9766
            notch: 65,      // 65/128 ≈ 0.5078
        },
    },
} as const;

type PresetMode = 'melee' | 'rivals2' | 'custom';

function toNormalized(value: number): number {
    return value / 128;
}

function fromNormalized(value: number): number {
    return Math.round(value * 128);
}

function detectPreset(params: StickCurveParamsV1, mode: 'orca' | 'gp2040'): PresetMode {
    // Check if all stick axes (0-3) match a preset
    // Axis 4 is trigger, we don't compare it
    const mag = fromNormalized(params.range[0] ?? 0);
    const notch = fromNormalized(params.notch[0] ?? 0);

    // Check melee
    if (Math.abs(mag - PRESETS.melee.magnitude) <= 1 && Math.abs(notch - PRESETS.melee.notch) <= 1) {
        // Verify all stick axes match
        for (let i = 0; i < 4; i++) {
            const axisMag = fromNormalized(params.range[i] ?? 0);
            const axisNotch = fromNormalized(params.notch[i] ?? 0);
            if (Math.abs(axisMag - PRESETS.melee.magnitude) > 1 || Math.abs(axisNotch - PRESETS.melee.notch) > 1) {
                return 'custom';
            }
        }
        return 'melee';
    }

    // Check rivals2 (different values for each mode)
    const rivals2Preset = PRESETS.rivals2[mode];
    if (Math.abs(mag - rivals2Preset.magnitude) <= 1 && Math.abs(notch - rivals2Preset.notch) <= 1) {
        for (let i = 0; i < 4; i++) {
            const axisMag = fromNormalized(params.range[i] ?? 0);
            const axisNotch = fromNormalized(params.notch[i] ?? 0);
            if (Math.abs(axisMag - rivals2Preset.magnitude) > 1 || Math.abs(axisNotch - rivals2Preset.notch) > 1) {
                return 'custom';
            }
        }
        return 'rivals2';
    }

    return 'custom';
}

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
        stickCurveParams: draft.stickCurveParams.map((p) => ({
            ...p,
            range: [...p.range],
            notch: [...p.notch],
            dz_lower: [...p.dz_lower],
            dz_upper: [...p.dz_upper],
        })),
    };
}

export function StickCurveEditor({ draft, disabled, onChange, mode = 'orca' }: Props) {
    const activeProfile = draft.activeProfile ?? 0;
    const params = draft.stickCurveParams[activeProfile] ?? draft.stickCurveParams[0]!;
    const currentPreset = detectPreset(params, mode);

    // GP2040 supports extended ranges: magnitude up to 154 (1.2 * 128), notch up to 100
    // Orca mode uses more conservative ranges
    const magnitudeMax = mode === 'gp2040' ? 154 : 125;
    const notchMax = mode === 'gp2040' ? 100 : 55;

    function updateParams(patch: Partial<StickCurveParamsV1>) {
        const updated = cloneDraft(draft);
        const current = updated.stickCurveParams[activeProfile] ?? updated.stickCurveParams[0];
        if (!current) return;
        updated.stickCurveParams[activeProfile] = { ...current, ...patch };
        onChange(updated);
    }

    function applyPreset(preset: 'melee' | 'rivals2') {
        const updated = cloneDraft(draft);
        let presetValues;
        if (preset === 'melee') {
            presetValues = PRESETS.melee;
        } else {
            // Use mode-specific Rivals 2 preset
            presetValues = PRESETS.rivals2[mode];
        }
        const magNorm = toNormalized(presetValues.magnitude);
        const notchNorm = toNormalized(presetValues.notch);

        // Apply to stick axes (0-3), preserve trigger (4)
        updated.stickCurveParams[activeProfile]!.range = [
            magNorm, magNorm, magNorm, magNorm,
            updated.stickCurveParams[activeProfile]!.range[4] ?? 1.0,
        ];
        updated.stickCurveParams[activeProfile]!.notch = [
            notchNorm, notchNorm, notchNorm, notchNorm,
            updated.stickCurveParams[activeProfile]!.notch[4] ?? 0.234,
        ];
        onChange(updated);
    }

    function setAxisValue(field: 'range' | 'notch', axisIndices: number[], value: number) {
        const updated = cloneDraft(draft);
        const arr = [...updated.stickCurveParams[activeProfile]![field]];
        for (const i of axisIndices) {
            arr[i] = toNormalized(value);
        }
        updated.stickCurveParams[activeProfile]![field] = arr;
        onChange(updated);
    }

    // Get display values (in 0-128 scale for UI)
    const xMag = fromNormalized(params.range[0] ?? 0);
    const upMag = fromNormalized(params.range[2] ?? 0);
    const downMag = fromNormalized(params.range[3] ?? 0);
    const xNotch = fromNormalized(params.notch[0] ?? 0);
    const upNotch = fromNormalized(params.notch[2] ?? 0);
    const downNotch = fromNormalized(params.notch[3] ?? 0);

    return (
        <div className="col" style={{ gap: 'var(--spacing-md)' }}>
            {/* Preset Radio Buttons */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xs)',
                marginBottom: 'var(--spacing-sm)'
            }}>
                <label className="text-sm" style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                    Game Preset
                </label>
                <div style={{
                    display: 'flex',
                    gap: 'var(--spacing-sm)',
                    flexWrap: 'wrap'
                }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: currentPreset === 'melee' ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        border: currentPreset === 'melee' ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border)',
                        opacity: disabled ? 0.5 : 1,
                    }}>
                        <input
                            type="radio"
                            name="stickPreset"
                            checked={currentPreset === 'melee'}
                            onChange={() => applyPreset('melee')}
                            disabled={disabled}
                            style={{ display: 'none' }}
                        />
                        <span style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 500,
                            color: currentPreset === 'melee' ? 'white' : 'var(--color-text-primary)',
                        }}>
                            Melee
                        </span>
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: currentPreset === 'rivals2' ? 'var(--color-accent-secondary)' : 'var(--color-bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        border: currentPreset === 'rivals2' ? '1px solid var(--color-accent-secondary)' : '1px solid var(--color-border)',
                        opacity: disabled ? 0.5 : 1,
                    }}>
                        <input
                            type="radio"
                            name="stickPreset"
                            checked={currentPreset === 'rivals2'}
                            onChange={() => applyPreset('rivals2')}
                            disabled={disabled}
                            style={{ display: 'none' }}
                        />
                        <span style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 500,
                            color: currentPreset === 'rivals2' ? 'white' : 'var(--color-text-primary)',
                        }}>
                            Rivals 2
                        </span>
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: currentPreset === 'custom' ? 'var(--color-bg-secondary)' : 'var(--color-bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'default',
                        transition: 'all 0.2s ease',
                        border: currentPreset === 'custom' ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border)',
                        opacity: disabled ? 0.5 : 1,
                    }}>
                        <input
                            type="radio"
                            name="stickPreset"
                            checked={currentPreset === 'custom'}
                            onChange={() => { }}
                            disabled={disabled}
                            style={{ display: 'none' }}
                        />
                        <span style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 500,
                            color: currentPreset === 'custom' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                        }}>
                            Custom
                        </span>
                    </label>
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {currentPreset === 'melee' && 'Optimized for Super Smash Bros. Melee'}
                    {currentPreset === 'rivals2' && 'Optimized for Rivals of Aether 2'}
                    {currentPreset === 'custom' && 'Custom values - adjust sliders below'}
                </span>
            </div>

            {/* Custom Controls - Always visible but highlighted when custom */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                transition: 'all 0.2s ease',
            }}>
                {/* Magnitude Section */}
                <div>
                    <div style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--spacing-sm)'
                    }}>
                        Full Press Magnitude
                    </div>

                    {/* X-Axis Magnitude */}
                    <SliderControl
                        label="X-Axis"
                        value={xMag}
                        min={70}
                        max={magnitudeMax}
                        disabled={disabled}
                        onChange={(v) => setAxisValue('range', [0, 1], v)}
                        accentColor="var(--color-accent-primary)"
                    />

                    {/* Up Magnitude */}
                    <SliderControl
                        label="Up"
                        value={upMag}
                        min={70}
                        max={magnitudeMax}
                        disabled={disabled}
                        onChange={(v) => setAxisValue('range', [2], v)}
                        accentColor="var(--color-accent-primary)"
                    />

                    {/* Down Magnitude */}
                    <SliderControl
                        label="Down"
                        value={downMag}
                        min={70}
                        max={magnitudeMax}
                        disabled={disabled}
                        onChange={(v) => setAxisValue('range', [3], v)}
                        accentColor="var(--color-accent-primary)"
                    />
                </div>

                {/* Notch Section */}
                <div>
                    <div style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--spacing-sm)'
                    }}>
                        Light Press Notch
                    </div>

                    {/* X-Axis Notch */}
                    <SliderControl
                        label="X-Axis"
                        value={xNotch}
                        min={20}
                        max={notchMax}
                        disabled={disabled}
                        onChange={(v) => setAxisValue('notch', [0, 1], v)}
                        accentColor="var(--color-accent-secondary)"
                    />

                    {/* Up Notch */}
                    <SliderControl
                        label="Up"
                        value={upNotch}
                        min={20}
                        max={notchMax}
                        disabled={disabled}
                        onChange={(v) => setAxisValue('notch', [2], v)}
                        accentColor="var(--color-accent-secondary)"
                    />

                    {/* Down Notch */}
                    <SliderControl
                        label="Down"
                        value={downNotch}
                        min={20}
                        max={notchMax}
                        disabled={disabled}
                        onChange={(v) => setAxisValue('notch', [3], v)}
                        accentColor="var(--color-accent-secondary)"
                    />
                </div>
            </div>
        </div>
    );
}

type SliderControlProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    disabled?: boolean;
    onChange: (value: number) => void;
    accentColor: string;
};

function SliderControl({ label, value, min, max, disabled, onChange, accentColor }: SliderControlProps) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
            <span style={{
                width: 50,
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-muted)',
                flexShrink: 0,
            }}>
                {label}
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step={1}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                disabled={disabled}
                style={{ flex: 1, minWidth: 0 }}
            />
            <input
                type="number"
                min={min}
                max={max}
                step={1}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                disabled={disabled}
                style={{
                    width: 50,
                    textAlign: 'center',
                    padding: 'var(--spacing-xs)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)',
                    color: accentColor,
                    fontWeight: 600,
                    fontSize: 'var(--font-size-xs)',
                }}
            />
        </div>
    );
}
