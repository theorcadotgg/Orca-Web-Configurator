import { useState } from 'react';
import type { SettingsDraft, StickCurveParamsV1 } from '../../schema/settingsBlob';
import { cloneDraft } from '../domain/cloneDraft';

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
            notch: 50,      // 50/128 ≈ 0.3906
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

export function StickCurveEditor({ draft, disabled, onChange, mode = 'orca' }: Props) {
    const activeProfile = draft.activeProfile ?? 0;
    const params = draft.stickCurveParams[activeProfile] ?? draft.stickCurveParams[0]!;
    const currentPreset = detectPreset(params, mode);

    // Track if user explicitly selected custom mode
    const [forceCustom, setForceCustom] = useState(false);

    // If user explicitly selected custom, override detected preset for UI purposes
    const effectivePreset = forceCustom ? 'custom' : currentPreset;

    // Show sliders if detected as custom OR user explicitly selected custom
    const showCustomSliders = effectivePreset === 'custom';

    // GP2040 supports extended ranges: magnitude up to 154 (1.2 * 128), notch up to 100
    // Orca mode uses specific ranges per ruleset
    const magnitudeMin = mode === 'gp2040' ? 70 : 80;
    const magnitudeMax = mode === 'gp2040' ? 154 : 120;
    const notchMin = mode === 'gp2040' ? 20 : 25;
    const notchMax = mode === 'gp2040' ? 100 : 50;

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

        // Reset force custom when applying a preset
        setForceCustom(false);
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
                        background: effectivePreset === 'melee' ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        border: effectivePreset === 'melee' ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border)',
                        opacity: disabled ? 0.5 : 1,
                    }}>
                        <input
                            type="radio"
                            name="stickPreset"
                            checked={effectivePreset === 'melee'}
                            onChange={() => applyPreset('melee')}
                            disabled={disabled}
                            style={{ display: 'none' }}
                        />
                        <span style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 500,
                            color: effectivePreset === 'melee' ? 'white' : 'var(--color-text-primary)',
                        }}>
                            Melee
                        </span>
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: effectivePreset === 'rivals2' ? 'var(--color-accent-secondary)' : 'var(--color-bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        border: effectivePreset === 'rivals2' ? '1px solid var(--color-accent-secondary)' : '1px solid var(--color-border)',
                        opacity: disabled ? 0.5 : 1,
                    }}>
                        <input
                            type="radio"
                            name="stickPreset"
                            checked={effectivePreset === 'rivals2'}
                            onChange={() => applyPreset('rivals2')}
                            disabled={disabled}
                            style={{ display: 'none' }}
                        />
                        <span style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 500,
                            color: effectivePreset === 'rivals2' ? 'white' : 'var(--color-text-primary)',
                        }}>
                            Rivals 2
                        </span>
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: showCustomSliders ? 'var(--color-bg-secondary)' : 'var(--color-bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        border: showCustomSliders ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border)',
                        opacity: disabled ? 0.5 : 1,
                    }}>
                        <input
                            type="radio"
                            name="stickPreset"
                            checked={showCustomSliders}
                            onChange={() => {
                                // Switching to custom mode - keep current values but allow editing
                                setForceCustom(true);
                            }}
                            disabled={disabled}
                            style={{ display: 'none' }}
                        />
                        <span style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 500,
                            color: showCustomSliders ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                        }}>
                            Custom
                        </span>
                    </label>
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {effectivePreset === 'melee' && 'Optimized for Super Smash Bros. Melee'}
                    {effectivePreset === 'rivals2' && 'Optimized for Rivals of Aether 2'}
                    {showCustomSliders && 'Custom values - adjust sliders below'}
                </span>
            </div>

            {/* Custom Controls - Only visible when custom mode is selected */}
            {showCustomSliders && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-md)',
                    padding: 'var(--spacing-md)',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-accent-primary)',
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
                            min={magnitudeMin}
                            max={magnitudeMax}
                            disabled={disabled}
                            onChange={(v) => setAxisValue('range', [0, 1], v)}
                            accentColor="var(--color-accent-primary)"
                        />

                        {/* Up Magnitude */}
                        <SliderControl
                            label="Up"
                            value={upMag}
                            min={magnitudeMin}
                            max={magnitudeMax}
                            disabled={disabled}
                            onChange={(v) => setAxisValue('range', [2], v)}
                            accentColor="var(--color-accent-primary)"
                        />

                        {/* Down Magnitude */}
                        <SliderControl
                            label="Down"
                            value={downMag}
                            min={magnitudeMin}
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
                            min={notchMin}
                            max={notchMax}
                            disabled={disabled}
                            onChange={(v) => setAxisValue('notch', [0, 1], v)}
                            accentColor="var(--color-accent-secondary)"
                        />

                        {/* Up Notch */}
                        <SliderControl
                            label="Up"
                            value={upNotch}
                            min={notchMin}
                            max={notchMax}
                            disabled={disabled}
                            onChange={(v) => setAxisValue('notch', [2], v)}
                            accentColor="var(--color-accent-secondary)"
                        />

                        {/* Down Notch */}
                        <SliderControl
                            label="Down"
                            value={downNotch}
                            min={notchMin}
                            max={notchMax}
                            disabled={disabled}
                            onChange={(v) => setAxisValue('notch', [3], v)}
                            accentColor="var(--color-accent-secondary)"
                        />
                    </div>
                </div>
            )}

            {/* Melee Calculator - Only in Orca mode and Custom mode */}
            {mode === 'orca' && showCustomSliders && (
                <MeleeCalculator
                    xMag={xMag}
                    upMag={upMag}
                    downMag={downMag}
                    xNotch={xNotch}
                    upNotch={upNotch}
                    downNotch={downNotch}
                />
            )}
        </div>
    );
}

type MeleeCalculatorProps = {
    xMag: number;
    upMag: number;
    downMag: number;
    xNotch: number;
    upNotch: number;
    downNotch: number;
};

function MeleeCalculator({ xMag, upMag, downMag, xNotch, upNotch, downNotch }: MeleeCalculatorProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    // Walk Speed Check
    const walkSpeed = xNotch > 33 ? 'WalkMid' : 'WalkSlow';

    // Helper function to calculate and format notch coordinates
    function calculateNotch(x: number, y: number): { clamp: number; xCoord: string; yCoord: string; display: string } {
        const clamp = 80 / Math.sqrt(x ** 2 + y ** 2);
        const xCoord = (Math.trunc(x * clamp) / 80).toFixed(4);
        const yCoord = (Math.trunc(y * clamp) / 80).toFixed(4);
        return { clamp, xCoord, yCoord, display: `(${xCoord}, ${yCoord})` };
    }

    // Max Wavedash Notch
    const maxWD = calculateNotch(xMag, downNotch);
    const maxWDDisplay = `(${maxWD.xCoord}x, -${maxWD.yCoord}y)`;

    // Min Wavedash Notch
    const minWD = calculateNotch(xNotch, downMag);
    const minWDDisplay = `(${minWD.xCoord}x, -${minWD.yCoord}y)`;

    // Slight Up (Over Slight Up)
    const slightUp = calculateNotch(xMag, upNotch);
    const slightUpDisplay = `(${slightUp.xCoord}x, ${slightUp.yCoord}y)`;

    // Slight Over (Up Slight Over)
    const slightOver = calculateNotch(xNotch, upMag);
    const slightOverDisplay = `(${slightOver.xCoord}x, ${slightOver.yCoord}y)`;

    // South Diagonal
    const southDiag = calculateNotch(xMag, downMag);
    const southDiagDisplay = `(${southDiag.xCoord}x, -${southDiag.yCoord}y)`;

    // North Diagonal
    const northDiag = calculateNotch(xMag, upMag);
    const northDiagDisplay = `(${northDiag.xCoord}x, ${northDiag.yCoord}y)`;

    // South Diagonal Behavior
    const southY = parseFloat(southDiag.yCoord);
    let southBehavior: string;
    if (southY <= 0.6000) {
        southBehavior = 'Pivot Down-Angled FTilt, Cannot Shield Drop';
    } else if (southY >= 0.6125 && southY <= 0.6500) {
        southBehavior = 'Pivot Down-Angled FTilt, UCF 0.84+ Shield Drop';
    } else if (southY >= 0.6625 && southY <= 0.6875) {
        southBehavior = 'Vanilla Shield Drop';
    } else if (southY >= 0.7000 && southY <= 0.7125) {
        southBehavior = 'Optimal Trajectory DI, Jab Cancel, UCF Shield Drop';
    } else if (southY >= 0.7250 && southY <= 0.7500) {
        southBehavior = 'Jab Cancel, UCF Shield Drop';
    } else {
        southBehavior = 'UCF Shield Drop';
    }

    // Wavedash Warning Helper
    function getWavedashWarning(absYCoord: number): { message: string; color: string; bgColor: string } | null {
        if (absYCoord < 0.2750) {
            return {
                message: "Warning! This value will not hit a wavedash / firefox angle and will recognize as a cardinal input.",
                color: '#ff4444',
                bgColor: 'rgba(255, 68, 68, 0.1)'
            };
        } else if (absYCoord <= 0.2875) {
            return {
                message: "Warning! This value is very likely to miss a wavedash / firefox angle.",
                color: '#ff6644',
                bgColor: 'rgba(255, 102, 68, 0.1)'
            };
        } else if (absYCoord <= 0.3000) {
            return {
                message: "Caution! This value is somewhat likely to miss a wavedash / firefox angle.",
                color: '#ffaa44',
                bgColor: 'rgba(255, 170, 68, 0.1)'
            };
        } else if (absYCoord <= 0.3125) {
            return {
                message: "Optimal Orca Wavedash / Firefox Angle",
                color: '#44ff88',
                bgColor: 'rgba(68, 255, 136, 0.1)'
            };
        } else if (absYCoord <= 0.3250) {
            return {
                message: "Optimal Sheik Wavedash Angle",
                color: '#44ddff',
                bgColor: 'rgba(68, 221, 255, 0.1)'
            };
        }
        return null;
    }

    // Helper to get emoji indicator based on severity
    function getWarningEmoji(absCoord: number): string {
        if (absCoord < 0.2750) {
            return '⛔️';
        } else if (absCoord <= 0.2875) {
            return '⛔️';
        } else if (absCoord <= 0.3000) {
            return '⚠️';
        }
        return '';
    }

    // Check warnings for all notches (both X and Y coordinates)
    const maxWDAbsX = Math.abs(parseFloat(maxWD.xCoord));
    const maxWDAbsY = Math.abs(parseFloat(maxWD.yCoord));
    const minWDAbsX = Math.abs(parseFloat(minWD.xCoord));
    const minWDAbsY = Math.abs(parseFloat(minWD.yCoord));
    const slightUpAbsX = Math.abs(parseFloat(slightUp.xCoord));
    const slightUpAbsY = Math.abs(parseFloat(slightUp.yCoord));
    const slightOverAbsX = Math.abs(parseFloat(slightOver.xCoord));
    const slightOverAbsY = Math.abs(parseFloat(slightOver.yCoord));

    const maxWDWarningX = getWavedashWarning(maxWDAbsX);
    const maxWDWarningY = getWavedashWarning(maxWDAbsY);
    const minWDWarningX = getWavedashWarning(minWDAbsX);
    const minWDWarningY = getWavedashWarning(minWDAbsY);
    const slightUpWarningX = getWavedashWarning(slightUpAbsX);
    const slightUpWarningY = getWavedashWarning(slightUpAbsY);
    const slightOverWarningX = getWavedashWarning(slightOverAbsX);
    const slightOverWarningY = getWavedashWarning(slightOverAbsY);

    // Get emoji indicators for display
    const maxWDEmojiX = getWarningEmoji(maxWDAbsX);
    const maxWDEmojiY = getWarningEmoji(maxWDAbsY);
    const minWDEmojiX = getWarningEmoji(minWDAbsX);
    const minWDEmojiY = getWarningEmoji(minWDAbsY);
    const slightUpEmojiX = getWarningEmoji(slightUpAbsX);
    const slightUpEmojiY = getWarningEmoji(slightUpAbsY);
    const slightOverEmojiX = getWarningEmoji(slightOverAbsX);
    const slightOverEmojiY = getWarningEmoji(slightOverAbsY);

    // Build display strings with emojis
    const maxWDPrefix = (maxWDEmojiX || maxWDEmojiY) ? (maxWDEmojiX || maxWDEmojiY) + ' ' : '';
    const minWDPrefix = (minWDEmojiX || minWDEmojiY) ? (minWDEmojiX || minWDEmojiY) + ' ' : '';
    const slightUpPrefix = (slightUpEmojiX || slightUpEmojiY) ? (slightUpEmojiX || slightUpEmojiY) + ' ' : '';
    const slightOverPrefix = (slightOverEmojiX || slightOverEmojiY) ? (slightOverEmojiX || slightOverEmojiY) + ' ' : '';

    return (
        <div style={{
            marginTop: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
        }}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                }}
            >
                <span>Melee Calculator</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {isExpanded ? '▼' : '▶'}
                </span>
            </button>

            {isExpanded && (
                <div style={{
                    marginTop: 'var(--spacing-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-xs)',
                }}>
                    <ResultRow label="Walk Speed on X Notch" value={walkSpeed} />
                    <ResultRow label="Max Wavedash Notch" value={maxWDPrefix + maxWDDisplay} />
                    <ResultRow label="Min Wavedash Notch" value={minWDPrefix + minWDDisplay} />
                    <ResultRow label="Slight Up Notch" value={slightUpPrefix + slightUpDisplay} />
                    <ResultRow label="Slight Over Notch" value={slightOverPrefix + slightOverDisplay} />
                    <ResultRow label="North Diagonal" value={northDiagDisplay} />
                    <ResultRow label="South Diagonal" value={southDiagDisplay} />

                    {/* South Diagonal Behavior Section */}
                    <div style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-muted)',
                        marginTop: 'var(--spacing-xs)',
                        paddingTop: 'var(--spacing-xs)',
                        borderTop: '1px solid var(--color-border)',
                    }}>
                        <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>South Diagonal Behavior:</div>
                        <div style={{
                            color: southBehavior === 'Optimal Trajectory DI, Jab Cancel, UCF Shield Drop'
                                ? 'white'
                                : 'inherit'
                        }}>
                            {southBehavior}
                        </div>
                    </div>

                    {/* Wavedash Warnings Section */}
                    {(maxWDWarningX || maxWDWarningY || minWDWarningX || minWDWarningY ||
                        slightUpWarningX || slightUpWarningY || slightOverWarningX || slightOverWarningY) && (
                            <div style={{
                                fontSize: 'var(--font-size-xs)',
                                marginTop: 'var(--spacing-sm)',
                                paddingTop: 'var(--spacing-xs)',
                                borderTop: '1px solid var(--color-border)',
                            }}>
                                <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)', color: 'var(--color-text-secondary)' }}>
                                    Notch Warnings:
                                </div>
                                {maxWDWarningX && (
                                    <div style={{
                                        padding: 'var(--spacing-xs)',
                                        marginBottom: 'var(--spacing-xs)',
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: maxWDWarningX.bgColor,
                                        border: `1px solid ${maxWDWarningX.color}`,
                                        color: maxWDWarningX.color,
                                        fontWeight: 500,
                                    }}>
                                        <strong>Max WD X:</strong> {maxWDWarningX.message}
                                    </div>
                                )}
                                {maxWDWarningY && (
                                    <div style={{
                                        padding: 'var(--spacing-xs)',
                                        marginBottom: 'var(--spacing-xs)',
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: maxWDWarningY.bgColor,
                                        border: `1px solid ${maxWDWarningY.color}`,
                                        color: maxWDWarningY.color,
                                        fontWeight: 500,
                                    }}>
                                        <strong>Max WD Y:</strong> {maxWDWarningY.message}
                                    </div>
                                )}
                                {minWDWarningX && (
                                    <div style={{
                                        padding: 'var(--spacing-xs)',
                                        marginBottom: 'var(--spacing-xs)',
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: minWDWarningX.bgColor,
                                        border: `1px solid ${minWDWarningX.color}`,
                                        color: minWDWarningX.color,
                                        fontWeight: 500,
                                    }}>
                                        <strong>Min WD X:</strong> {minWDWarningX.message}
                                    </div>
                                )}
                                {minWDWarningY && (
                                    <div style={{
                                        padding: 'var(--spacing-xs)',
                                        marginBottom: 'var(--spacing-xs)',
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: minWDWarningY.bgColor,
                                        border: `1px solid ${minWDWarningY.color}`,
                                        color: minWDWarningY.color,
                                        fontWeight: 500,
                                    }}>
                                        <strong>Min WD Y:</strong> {minWDWarningY.message}
                                    </div>
                                )}
                                {slightUpWarningX && (
                                    <div style={{
                                        padding: 'var(--spacing-xs)',
                                        marginBottom: 'var(--spacing-xs)',
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: slightUpWarningX.bgColor,
                                        border: `1px solid ${slightUpWarningX.color}`,
                                        color: slightUpWarningX.color,
                                        fontWeight: 500,
                                    }}>
                                        <strong>Slight Up X:</strong> {slightUpWarningX.message}
                                    </div>
                                )}
                                {slightUpWarningY && (
                                    <div style={{
                                        padding: 'var(--spacing-xs)',
                                        marginBottom: 'var(--spacing-xs)',
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: slightUpWarningY.bgColor,
                                        border: `1px solid ${slightUpWarningY.color}`,
                                        color: slightUpWarningY.color,
                                        fontWeight: 500,
                                    }}>
                                        <strong>Slight Up Y:</strong> {slightUpWarningY.message}
                                    </div>
                                )}
                                {slightOverWarningX && (
                                    <div style={{
                                        padding: 'var(--spacing-xs)',
                                        marginBottom: 'var(--spacing-xs)',
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: slightOverWarningX.bgColor,
                                        border: `1px solid ${slightOverWarningX.color}`,
                                        color: slightOverWarningX.color,
                                        fontWeight: 500,
                                    }}>
                                        <strong>Slight Over X:</strong> {slightOverWarningX.message}
                                    </div>
                                )}
                                {slightOverWarningY && (
                                    <div style={{
                                        padding: 'var(--spacing-xs)',
                                        marginBottom: 'var(--spacing-xs)',
                                        borderRadius: 'var(--radius-sm)',
                                        backgroundColor: slightOverWarningY.bgColor,
                                        border: `1px solid ${slightOverWarningY.color}`,
                                        color: slightOverWarningY.color,
                                        fontWeight: 500,
                                    }}>
                                        <strong>Slight Over Y:</strong> {slightOverWarningY.message}
                                    </div>
                                )}
                            </div>
                        )}
                </div>
            )
            }
        </div >
    );
}

type ResultRowProps = {
    label: string;
    value: string;
};

function ResultRow({ label, value }: ResultRowProps) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 'var(--font-size-xs)',
            padding: 'var(--spacing-xs) 0',
        }}>
            <span style={{ color: 'var(--color-text-muted)' }}>{label}:</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontFamily: 'monospace' }}>{value}</span>
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
