import { useState, useEffect } from 'react';
import type { SettingsDraft } from '../../schema/settingsBlob';

type Props = {
    draft: SettingsDraft;
    disabled?: boolean;
    onChange: (next: SettingsDraft) => void;
    mode?: 'orca' | 'gp2040';
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

export function TriggerEditor({ draft, disabled, onChange, mode = 'orca' }: Props) {
    const activeProfile = draft.activeProfile ?? 0;
    const policy = draft.triggerPolicy[activeProfile] ?? draft.triggerPolicy[0];
    if (!policy) return null;

    // Lightshield-only mode state
    const [lightshieldOnly, setLightshieldOnly] = useState(false);

    // Orca mode uses specific ranges per ruleset
    const triggerMin = mode === 'orca' ? 140 : 0;
    const triggerMax = mode === 'orca' ? 220 : 255;
    const lightshieldMin = mode === 'orca' ? 49 : 0;

    function updatePolicy(patch: Partial<typeof policy>) {
        const updated = cloneDraft(draft);
        const current = updated.triggerPolicy[activeProfile] ?? updated.triggerPolicy[0];
        if (!current) return;
        updated.triggerPolicy[activeProfile] = { ...current, ...patch };
        onChange(updated);
    }

    const analogRangeMax255 = to255(policy.analogRangeMax);
    const digitalFullPress255 = to255(policy.digitalFullPress);
    const digitalLightshield255 = to255(policy.digitalLightshield);

    // Calculate lightshield max based on current trigger value (for Orca mode)
    const lightshieldMax = mode === 'orca' ? Math.floor(analogRangeMax255 / 2) : 255;

    // Effect to sync max output with lightshield when lightshield-only is enabled
    useEffect(() => {
        if (lightshieldOnly && mode === 'orca') {
            // Set analogRangeMax to match digitalLightshield (or +1 if needed)
            const targetValue = digitalLightshield255;
            if (analogRangeMax255 !== targetValue) {
                updatePolicy({ analogRangeMax: from255(targetValue) });
            }
        }
    }, [lightshieldOnly, digitalLightshield255]);

    // Handler for lightshield slider when lightshield-only is enabled
    function handleLightshieldChange(value: number) {
        const clampedValue = clamp(value, lightshieldMin, lightshieldMax);
        updatePolicy({ digitalLightshield: from255(clampedValue) });
        if (lightshieldOnly) {
            // Also update analog max to match
            updatePolicy({
                digitalLightshield: from255(clampedValue),
                analogRangeMax: from255(clampedValue)
            });
        }
    }

    return (
        <div className="col" style={{ gap: 12 }}>
            {/* Compact trigger visualization with lightshield indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
                {/* Left Trigger - shows full press + lightshield */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>L Trigger</span>
                    <div style={{
                        width: 32,
                        height: 60,
                        background: 'var(--color-bg-tertiary)',
                        borderRadius: 4,
                        border: '1px solid var(--color-border)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {/* Full press fill */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: `${(digitalFullPress255 / 255) * 100}%`,
                            background: 'var(--color-brand)',
                            opacity: 0.6,
                            transition: 'height 0.15s ease'
                        }} />
                        {/* Lightshield threshold line */}
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: `${(digitalLightshield255 / 255) * 100}%`,
                            height: 2,
                            background: '#FF9800',
                            zIndex: 1
                        }} />
                    </div>
                </div>

                {/* Right Trigger - shows analog max */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>R Trigger</span>
                    <div style={{
                        width: 32,
                        height: 60,
                        background: 'var(--color-bg-tertiary)',
                        borderRadius: 4,
                        border: '1px solid var(--color-border)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {/* Analog max fill */}
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: `${(analogRangeMax255 / 255) * 100}%`,
                            background: 'var(--color-brand)',
                            opacity: 0.6,
                            transition: 'height 0.15s ease'
                        }} />
                        {/* Lightshield threshold line */}
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: `${(digitalLightshield255 / 255) * 100}%`,
                            height: 2,
                            background: '#FF9800',
                            zIndex: 1
                        }} />
                    </div>
                </div>
            </div>

            {/* Legend - single line */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 10, color: 'var(--color-text-muted)' }}>
                <span>■ Full Press</span>
                <span style={{ color: '#FF9800' }}>━ Lightshield</span>
            </div>

            {/* Lightshield Only Checkbox - Orca mode only */}
            {mode === 'orca' && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.5 : 1
                    }}>
                        <input
                            type="checkbox"
                            checked={lightshieldOnly}
                            onChange={(e) => setLightshieldOnly(e.target.checked)}
                            disabled={disabled}
                            style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                        />
                        <span style={{ color: '#FF9800' }}>Lightshield Only</span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
                            (binds max output to lightshield)
                        </span>
                    </label>
                </div>
            )}

            {/* Sliders - compact single-line format */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Analog Max */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, width: 90, flexShrink: 0 }}>Analog Max</span>
                    <input
                        type="range"
                        min={triggerMin}
                        max={triggerMax}
                        value={clamp(analogRangeMax255, triggerMin, triggerMax)}
                        onChange={(e) => updatePolicy({ analogRangeMax: from255(Number(e.target.value)) })}
                        disabled={disabled || (lightshieldOnly && mode === 'orca')}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            opacity: (lightshieldOnly && mode === 'orca') ? 0.5 : 1
                        }}
                    />
                    <input
                        type="number"
                        min={triggerMin}
                        max={triggerMax}
                        value={clamp(analogRangeMax255, triggerMin, triggerMax)}
                        onChange={(e) => updatePolicy({ analogRangeMax: from255(Number(e.target.value)) })}
                        disabled={disabled || (lightshieldOnly && mode === 'orca')}
                        style={{
                            width: 48,
                            fontSize: 11,
                            padding: '2px 4px',
                            textAlign: 'center',
                            flexShrink: 0,
                            opacity: (lightshieldOnly && mode === 'orca') ? 0.5 : 1
                        }}
                    />
                </div>

                {/* Digital Full Press */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, width: 90, flexShrink: 0 }}>Full Press</span>
                    <input
                        type="range"
                        min={0}
                        max={255}
                        value={digitalFullPress255}
                        onChange={(e) => updatePolicy({ digitalFullPress: from255(Number(e.target.value)) })}
                        disabled={disabled}
                        style={{ flex: 1, minWidth: 0 }}
                    />
                    <input
                        type="number"
                        min={0}
                        max={255}
                        value={digitalFullPress255}
                        onChange={(e) => updatePolicy({ digitalFullPress: from255(Number(e.target.value)) })}
                        disabled={disabled}
                        style={{ width: 48, fontSize: 11, padding: '2px 4px', textAlign: 'center', flexShrink: 0 }}
                    />
                </div>

                {/* Digital Lightshield */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, width: 90, flexShrink: 0, color: '#FF9800' }}>Lightshield</span>
                    <input
                        type="range"
                        min={lightshieldMin}
                        max={lightshieldMax}
                        value={clamp(digitalLightshield255, lightshieldMin, lightshieldMax)}
                        onChange={(e) => handleLightshieldChange(Number(e.target.value))}
                        disabled={disabled}
                        style={{ flex: 1, minWidth: 0 }}
                    />
                    <input
                        type="number"
                        min={lightshieldMin}
                        max={lightshieldMax}
                        value={clamp(digitalLightshield255, lightshieldMin, lightshieldMax)}
                        onChange={(e) => handleLightshieldChange(Number(e.target.value))}
                        disabled={disabled}
                        style={{ width: 48, fontSize: 11, padding: '2px 4px', textAlign: 'center', flexShrink: 0 }}
                    />
                </div>
            </div>
        </div>
    );
}
