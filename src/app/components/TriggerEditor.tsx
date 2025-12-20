import type { SettingsDraft } from '../../schema/settingsBlob';
import { TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP } from '../../schema/triggerPolicyFlags';
import { cloneDraft } from '../domain/cloneDraft';

type Props = {
    draft: SettingsDraft;
    disabled?: boolean;
    onChange: (next: SettingsDraft) => void;
    mode?: 'orca' | 'gp2040';
};

// Index for ORCA_TRIGGER_R in the notch array
const TRIGGER_NOTCH_INDEX = 4;

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function to128(v: number): number {
    return clamp(Math.round(v * 128), 0, 128);
}

function from128(v: number): number {
    return clamp(v, 0, 128) / 128;
}

function to255(v: number): number {
    return clamp(Math.round(v * 255), 0, 255);
}

function from255(v: number): number {
    return clamp(v, 0, 255) / 255;
}

export function TriggerEditor({ draft, disabled, onChange, mode = 'orca' }: Props) {
    const activeProfile = draft.activeProfile ?? 0;
    const policy = draft.triggerPolicy[activeProfile] ?? draft.triggerPolicy[0];
    const curveParams = draft.stickCurveParams[activeProfile] ?? draft.stickCurveParams[0];
    if (!policy || !curveParams) return null;

    const lightshieldOnly = (policy.flags & TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP) !== 0;

    // Orca mode uses specific ranges per ruleset
    const triggerMin = mode === 'orca' ? 140 : 0;
    const triggerMax = mode === 'orca' ? 220 : 255;

    const analogRangeMax255 = to255(policy.analogRangeMax);
    const digitalFullPress255 = to255(policy.digitalFullPress);
    const analogMaxNormalized = policy.analogRangeMax; // 0-1 normalized

    // Trigger notch: stored value gets multiplied by analogMax in firmware
    // So we display: notch_stored * analogMax * 255 (to show final Dolphin output)
    // And store: display_value / analogMax / 255 * 128

    // Min: 49 (matching lightshield), Max: half of analog max output
    const triggerNotchMin255 = mode === 'orca' ? 49 : 0;
    const triggerNotchMax255 = mode === 'orca' ? Math.floor(analogRangeMax255 / 2) : 255;

    // Current trigger notch value: stored normalized, displayed as final Dolphin output
    // notch_stored (0-1) * analogMax (0-1) * 255 = Dolphin output
    const triggerNotchStored = curveParams.notch[TRIGGER_NOTCH_INDEX] ?? 0;
    const triggerNotchDisplay255 = Math.round(triggerNotchStored * analogMaxNormalized * 255);

    function updatePolicy(patch: Partial<typeof policy>) {
        const updated = cloneDraft(draft);
        const current = updated.triggerPolicy[activeProfile] ?? updated.triggerPolicy[0];
        if (!current) return;
        updated.triggerPolicy[activeProfile] = { ...current, ...patch };
        onChange(updated);
    }

    // Handler: convert Dolphin output value back to stored notch value
    // display = stored * analogMax * 255  =>  stored = display / 255 / analogMax
    function updateTriggerNotch(displayValue255: number) {
        const clamped255 = clamp(displayValue255, triggerNotchMin255, triggerNotchMax255);
        // Reverse the analogMax scaling to get the stored value
        const storedNormalized = analogMaxNormalized > 0
            ? clamped255 / 255 / analogMaxNormalized
            : 0;
        const updated = cloneDraft(draft);
        const params = updated.stickCurveParams[activeProfile] ?? updated.stickCurveParams[0];
        if (!params) return;
        const notch = [...params.notch];
        notch[TRIGGER_NOTCH_INDEX] = clamp(storedNormalized, 0, 1);
        updated.stickCurveParams[activeProfile] = { ...params, notch };
        onChange(updated);
    }

    // Handler for lightshield-only checkbox
    function handleLightshieldOnlyToggle(checked: boolean) {
        const nextFlags = checked
            ? (policy.flags | TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP)
            : (policy.flags & ~TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP);
        updatePolicy({ flags: nextFlags });
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
                        {/* Trigger notch threshold line */}
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: `${(triggerNotchDisplay255 / 255) * 100}%`,
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
                        {/* Trigger notch threshold line */}
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: `${(triggerNotchDisplay255 / 255) * 100}%`,
                            height: 2,
                            background: '#FF9800',
                            zIndex: 1
                        }} />
                    </div>
                </div>
            </div>

            {/* Legend - single line */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 10, color: 'var(--color-text-muted)' }}>
                <span>■ Digital Full Press</span>
                <span style={{ color: '#FF9800' }}>━ Trigger Notch</span>
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
                            onChange={(e) => handleLightshieldOnlyToggle(e.target.checked)}
                            disabled={disabled}
                            style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                        />
                        <span style={{ color: '#FF9800' }}>Lightshield Only</span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
                            (clamps analog at trigger notch)
                        </span>
                    </label>
                </div>
            )}

            {/* Sliders - compact single-line format */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Trigger Notch */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, width: 90, flexShrink: 0, color: '#FF9800' }}>Light Press</span>
                    <input
                        type="range"
                        min={triggerNotchMin255}
                        max={triggerNotchMax255}
                        value={clamp(triggerNotchDisplay255, triggerNotchMin255, triggerNotchMax255)}
                        onChange={(e) => updateTriggerNotch(Number(e.target.value))}
                        disabled={disabled}
                        style={{ flex: 1, minWidth: 0 }}
                    />
                    <input
                        type="number"
                        min={triggerNotchMin255}
                        max={triggerNotchMax255}
                        value={clamp(triggerNotchDisplay255, triggerNotchMin255, triggerNotchMax255)}
                        onChange={(e) => updateTriggerNotch(Number(e.target.value))}
                        disabled={disabled}
                        style={{ width: 48, fontSize: 11, padding: '2px 4px', textAlign: 'center', flexShrink: 0 }}
                    />
                </div>

                {/* Analog Max */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, width: 90, flexShrink: 0 }}>Analog Full Press</span>
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
                    <span style={{ fontSize: 11, width: 90, flexShrink: 0 }}>Digital Press</span>
                    <input
                        type="range"
                        min={triggerMin}
                        max={triggerMax}
                        value={clamp(digitalFullPress255, triggerMin, triggerMax)}
                        onChange={(e) => updatePolicy({ digitalFullPress: from255(Number(e.target.value)) })}
                        disabled={disabled}
                        style={{ flex: 1, minWidth: 0 }}
                    />
                    <input
                        type="number"
                        min={triggerMin}
                        max={triggerMax}
                        value={clamp(digitalFullPress255, triggerMin, triggerMax)}
                        onChange={(e) => updatePolicy({ digitalFullPress: from255(Number(e.target.value)) })}
                        disabled={disabled}
                        style={{ width: 48, fontSize: 11, padding: '2px 4px', textAlign: 'center', flexShrink: 0 }}
                    />
                </div>
            </div>
        </div>
    );
}
