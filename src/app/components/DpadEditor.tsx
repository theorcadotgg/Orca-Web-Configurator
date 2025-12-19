import { useEffect, useRef } from 'react';
import type { SettingsDraft } from '../../schema/settingsBlob';
import { ORCA_DUMMY_FIELD, digitalInputLabel } from '../../schema/orcaMappings';
import { getGp2040DestinationLabelSet, type Gp2040LabelPreset } from '../../schema/gp2040Labels';
import { cloneDraft } from '../domain/cloneDraft';
import { DigitalSourceEditorCompact } from './DigitalSourceEditorCompact';

type Props = {
    draft: SettingsDraft;
    disabled?: boolean;
    onChange: (next: SettingsDraft) => void;
    contextMode?: 'orca' | 'gp2040';
    gp2040LabelPreset?: Gp2040LabelPreset;
};

const MODE_OPTIONS: { value: number; label: string }[] = [
    { value: 0, label: 'Disabled' },
    { value: 1, label: 'With Modifier' },
    { value: 2, label: 'Always on' },
];

export function DpadEditor({ draft, disabled, onChange, contextMode = 'orca', gp2040LabelPreset }: Props) {
    const activeProfile = draft.activeProfile ?? 0;
    const layer = draft.dpadLayer[activeProfile] ?? draft.dpadLayer[0];
    if (!layer) return null;

    // In GP2040 mode, Orca destination 11 ("ORCA_DPAD") is labeled as the GP2040 shoulder button (L1/LB/L).
    const ORCA_DPAD_DEST = 11;
    const ORCA_C_LEFT = 7;
    const ORCA_C_RIGHT = 8;
    const ORCA_C_UP = 9;
    const ORCA_C_DOWN = 10;
    const ORCA_ANALOG_X_LEFT = 0;
    const ORCA_ANALOG_X_RIGHT = 1;
    const ORCA_ANALOG_Y_UP = 2;
    const ORCA_ANALOG_Y_DOWN = 3;

    const l1OutputSource = draft.digitalMappings?.[activeProfile]?.[ORCA_DPAD_DEST] ?? ORCA_DPAD_DEST;
    const l1OutputSourceLabel = l1OutputSource === ORCA_DUMMY_FIELD ? 'OFF' : digitalInputLabel(l1OutputSource);

    function areSourcesEqual(
        a: { type: number; index: number; threshold?: number; hysteresis?: number } | undefined,
        b: { type: number; index: number; threshold?: number; hysteresis?: number } | undefined
    ): boolean {
        if (!a || !b) return false;
        return a.type === b.type && a.index === b.index;
    }

    function checkAndFixDuplicates(layerToCheck: typeof layer, keepDirection?: 'up' | 'down' | 'left' | 'right'): typeof layer {
        const result = { ...layerToCheck };
        const directions = ['up', 'down', 'left', 'right'] as const;
        const sources = directions.map(dir => ({ dir, source: layerToCheck[dir] }));

        // Check each direction against all others
        for (let i = 0; i < sources.length; i++) {
            for (let j = i + 1; j < sources.length; j++) {
                if (areSourcesEqual(sources[i].source, sources[j].source)) {
                    // Found a duplicate - disable the original one, unless it's the one we want to keep
                    let indexToDisable = i; // Default: disable the first (original)

                    // If the first one is the direction we want to keep, disable the second instead
                    if (keepDirection && sources[i].dir === keepDirection) {
                        indexToDisable = j;
                    }
                    // If the second one is the direction we want to keep, disable the first (already set)

                    const dirKey = sources[indexToDisable].dir as keyof typeof result;
                    result[dirKey] = {
                        type: 1,
                        index: ORCA_DUMMY_FIELD,
                        threshold: 0,
                        hysteresis: 0,
                    } as any;
                }
            }
        }

        return result;
    }

    function updateLayer(patch: Partial<typeof layer>) {
        const updated = cloneDraft(draft);
        const current = updated.dpadLayer[activeProfile] ?? updated.dpadLayer[0];
        if (!current) return;
        const merged = { ...current, ...patch };

        // Determine which direction was just changed (if any)
        const changedDir = (['up', 'down', 'left', 'right'] as const).find(dir => dir in patch);
        const fixed = checkAndFixDuplicates(merged, changedDir);
        updated.dpadLayer[activeProfile] = fixed;
        onChange(updated);
    }

    const isGp2040 = contextMode === 'gp2040';
    const allowAnalogDpadSources = isGp2040;
    const gp2040LabelSet = isGp2040 ? getGp2040DestinationLabelSet(gp2040LabelPreset) : null;
    const l1OutputLabel = isGp2040 ? (gp2040LabelSet?.digital?.[ORCA_DPAD_DEST]?.label ?? 'L1') : 'L1';
    const enableIsLinkedToL1 =
        layer.enable?.type === 1 && layer.enable?.index === l1OutputSource && l1OutputSource !== ORCA_DUMMY_FIELD;

    function setLayer(nextLayer: typeof layer) {
        const updated = cloneDraft(draft);
        const fixed = checkAndFixDuplicates(nextLayer);
        updated.dpadLayer[activeProfile] = fixed;
        onChange(updated);
    }

    // Check for and fix duplicates when component loads or layer changes
    const lastCheckedLayerRef = useRef<string>('');
    useEffect(() => {
        const layerStr = JSON.stringify(layer);
        if (layerStr === lastCheckedLayerRef.current) return;
        lastCheckedLayerRef.current = layerStr;

        const fixed = checkAndFixDuplicates(layer);
        const fixedStr = JSON.stringify(fixed);

        // Only trigger update if the fix actually changed something
        if (fixedStr !== layerStr) {
            const updated = cloneDraft(draft);
            updated.dpadLayer[activeProfile] = fixed;
            onChange(updated);
        }
    }, [layer, activeProfile, draft, onChange]);

    function linkEnableToL1Source() {
        if (disabled) return;
        if (l1OutputSource === ORCA_DUMMY_FIELD) return;
        updateLayer({
            enable: {
                type: 1,
                index: l1OutputSource,
                threshold: 0,
                hysteresis: 0,
            },
        });
    }

    function applyPreset(preset: 'cstick_held' | 'ls_held' | 'ls_always') {
        if (disabled) return;
        if (!allowAnalogDpadSources && preset !== 'cstick_held') return;

        const digital = (index: number) => ({ type: 1, index, threshold: 0, hysteresis: 0 });
        const analogGe = (index: number, threshold = 0.6, hysteresis = 0.05) => ({ type: 2, index, threshold, hysteresis });

        if (preset === 'cstick_held') {
            setLayer({
                mode_up: 1,
                mode_down: 1,
                mode_left: 1,
                mode_right: 1,
                enable: digital(ORCA_DPAD_DEST),
                up: digital(ORCA_C_UP),
                down: digital(ORCA_C_DOWN),
                left: digital(ORCA_C_LEFT),
                right: digital(ORCA_C_RIGHT),
            });
            return;
        }

        if (preset === 'ls_held') {
            setLayer({
                mode_up: 1,
                mode_down: 1,
                mode_left: 1,
                mode_right: 1,
                enable: digital(ORCA_DPAD_DEST),
                up: analogGe(ORCA_ANALOG_Y_UP),
                down: analogGe(ORCA_ANALOG_Y_DOWN),
                left: analogGe(ORCA_ANALOG_X_LEFT),
                right: analogGe(ORCA_ANALOG_X_RIGHT),
            });
            return;
        }

        setLayer({
            mode_up: 2,
            mode_down: 2,
            mode_left: 2,
            mode_right: 2,
            enable: digital(ORCA_DPAD_DEST),
            up: analogGe(ORCA_ANALOG_Y_UP),
            down: analogGe(ORCA_ANALOG_Y_DOWN),
            left: analogGe(ORCA_ANALOG_X_LEFT),
            right: analogGe(ORCA_ANALOG_X_RIGHT),
        });
    }

    return (
        <div className="col" style={{ gap: 8 }}>
            {isGp2040 && (
                <div style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)',
                }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                        GP2040 note
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.35 }}>
                        The output <span style={{ fontWeight: 600 }}>{l1OutputLabel}</span> (configured in the main mapping) is separate from the modifier input below.
                        The modifier uses the raw physical input, even if that button is Disabled (OFF) in the main mapping.
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                            <span style={{ fontWeight: 600 }}>{l1OutputLabel}</span> output source: <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{l1OutputSourceLabel}</span>
                        </div>
                        <button
                            onClick={linkEnableToL1Source}
                            disabled={disabled || l1OutputSource === ORCA_DUMMY_FIELD || enableIsLinkedToL1}
                            title={l1OutputSource === ORCA_DUMMY_FIELD ? `${l1OutputLabel} output is Disabled (OFF)` : undefined}
                            style={{ fontSize: 11, padding: '4px 8px' }}
                        >
                            {enableIsLinkedToL1 ? 'Linked' : 'Use as modifier'}
                        </button>
                    </div>
                </div>
            )}

            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginTop: isGp2040 ? 0 : 2,
            }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Presets</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => applyPreset('cstick_held')}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        title="Use C-stick digital directions as D-pad while held"
                    >
                        C-stick + modifier
                    </button>
                    <button
                        type="button"
                        disabled={disabled || !allowAnalogDpadSources}
                        onClick={() => applyPreset('ls_held')}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        title={allowAnalogDpadSources ? 'Use the left stick analog channels as D-pad while held' : 'Only available in GP2040 mode'}
                    >
                        Stick + modifier
                    </button>
                    <button
                        type="button"
                        disabled={disabled || !allowAnalogDpadSources}
                        onClick={() => applyPreset('ls_always')}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        title={allowAnalogDpadSources ? 'Always use the left stick analog channels as D-pad' : 'Only available in GP2040 mode'}
                    >
                        Stick always
                    </button>
                </div>
            </div>


            {/* Per-direction mode selectors */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {/* Up */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 40 }}>↑ Up</span>
                    <select
                        value={layer.mode_up ?? 0}
                        onChange={(e) => updateLayer({ mode_up: Number(e.target.value) })}
                        disabled={disabled}
                        style={{ fontSize: 11, padding: '2px 6px', flex: 1 }}
                        title="Mode for DPAD Up"
                    >
                        {MODE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                {/* Down */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 40 }}>↓ Down</span>
                    <select
                        value={layer.mode_down ?? 0}
                        onChange={(e) => updateLayer({ mode_down: Number(e.target.value) })}
                        disabled={disabled}
                        style={{ fontSize: 11, padding: '2px 6px', flex: 1 }}
                        title="Mode for DPAD Down"
                    >
                        {MODE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                {/* Left */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 40 }}>← Left</span>
                    <select
                        value={layer.mode_left ?? 0}
                        onChange={(e) => updateLayer({ mode_left: Number(e.target.value) })}
                        disabled={disabled}
                        style={{ fontSize: 11, padding: '2px 6px', flex: 1 }}
                        title="Mode for DPAD Left"
                    >
                        {MODE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                {/* Right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', width: 40 }}>→ Right</span>
                    <select
                        value={layer.mode_right ?? 0}
                        onChange={(e) => updateLayer({ mode_right: Number(e.target.value) })}
                        disabled={disabled}
                        style={{ fontSize: 11, padding: '2px 6px', flex: 1 }}
                        title="Mode for DPAD Right"
                    >
                        {MODE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Source Editors - vertical stack, full width */}
            <DigitalSourceEditorCompact
                label={contextMode === 'gp2040' ? 'Modifier' : 'Enable'}
                value={layer.enable}
                disabled={disabled}
                onChange={(next) => updateLayer({ enable: next })}
            />
            <DigitalSourceEditorCompact
                label="Up"
                value={layer.up}
                disabled={disabled}
                allowAnalog={allowAnalogDpadSources}
                onChange={(next) => updateLayer({ up: next })}
            />
            <DigitalSourceEditorCompact
                label="Down"
                value={layer.down}
                disabled={disabled}
                allowAnalog={allowAnalogDpadSources}
                onChange={(next) => updateLayer({ down: next })}
            />
            <DigitalSourceEditorCompact
                label="Left"
                value={layer.left}
                disabled={disabled}
                allowAnalog={allowAnalogDpadSources}
                onChange={(next) => updateLayer({ left: next })}
            />
            <DigitalSourceEditorCompact
                label="Right"
                value={layer.right}
                disabled={disabled}
                allowAnalog={allowAnalogDpadSources}
                onChange={(next) => updateLayer({ right: next })}
            />
        </div >
    );
}
