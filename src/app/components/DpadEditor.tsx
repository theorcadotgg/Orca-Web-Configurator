import type { SettingsDraft } from '../../schema/settingsBlob';
import { ORCA_DUMMY_FIELD, digitalInputLabel } from '../../schema/orcaMappings';
import { getGp2040DestinationLabelSet, type Gp2040LabelPreset } from '../../schema/gp2040Labels';
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
    { value: 1, label: 'While held' },
    { value: 2, label: 'Always on' },
];

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

export function DpadEditor({ draft, disabled, onChange, contextMode = 'orca', gp2040LabelPreset }: Props) {
    const layer = draft.dpadLayer;
    const activeProfile = draft.activeProfile ?? 0;

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

    function updateLayer(patch: Partial<typeof layer>) {
        const updated = cloneDraft(draft);
        updated.dpadLayer = { ...updated.dpadLayer, ...patch };
        onChange(updated);
    }

    const isGp2040 = contextMode === 'gp2040';
    const gp2040LabelSet = isGp2040 ? getGp2040DestinationLabelSet(gp2040LabelPreset) : null;
    const l1OutputLabel = isGp2040 ? (gp2040LabelSet?.digital?.[ORCA_DPAD_DEST]?.label ?? 'L1') : 'L1';
    const enableIsLinkedToL1 =
        layer.enable?.type === 1 && layer.enable?.index === l1OutputSource && l1OutputSource !== ORCA_DUMMY_FIELD;

    function setLayer(nextLayer: typeof layer) {
        const updated = cloneDraft(draft);
        updated.dpadLayer = nextLayer;
        onChange(updated);
    }

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

        const digital = (index: number) => ({ type: 1, index, threshold: 0, hysteresis: 0 });
        const analogGe = (index: number, threshold = 0.6, hysteresis = 0.05) => ({ type: 2, index, threshold, hysteresis });

        if (preset === 'cstick_held') {
            setLayer({
                mode: 1,
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
                mode: 1,
                enable: digital(ORCA_DPAD_DEST),
                up: analogGe(ORCA_ANALOG_Y_UP),
                down: analogGe(ORCA_ANALOG_Y_DOWN),
                left: analogGe(ORCA_ANALOG_X_LEFT),
                right: analogGe(ORCA_ANALOG_X_RIGHT),
            });
            return;
        }

        setLayer({
            mode: 2,
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
                        disabled={disabled}
                        onClick={() => applyPreset('ls_held')}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        title="Use the left stick analog channels as D-pad while held"
                    >
                        Stick + modifier
                    </button>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => applyPreset('ls_always')}
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        title="Always use the left stick analog channels as D-pad"
                    >
                        Stick always
                    </button>
                </div>
            </div>

            {/* Header: DPAD visual + Mode in single row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                {/* Compact DPAD visual */}
                <div style={{
                    display: 'grid',
                    gridTemplateAreas: `". up ." "left center right" ". down ."`,
                    gridTemplateColumns: '18px 18px 18px',
                    gridTemplateRows: '18px 18px 18px',
                    gap: 2,
                }}>
                    <div style={{ gridArea: 'up', background: 'var(--color-brand)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 10, color: 'white' }}>↑</span>
                    </div>
                    <div style={{ gridArea: 'left', background: 'var(--color-brand)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 10, color: 'white' }}>←</span>
                    </div>
                    <div style={{ gridArea: 'center', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 2 }} />
                    <div style={{ gridArea: 'right', background: 'var(--color-brand)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 10, color: 'white' }}>→</span>
                    </div>
                    <div style={{ gridArea: 'down', background: 'var(--color-brand)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 10, color: 'white' }}>↓</span>
                    </div>
                </div>

                {/* Mode selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Mode</span>
                    <select
                        value={layer.mode}
                        onChange={(e) => updateLayer({ mode: Number(e.target.value) })}
                        disabled={disabled}
                        style={{
                            fontSize: 12,
                            padding: '3px 8px',
                            background: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border-hover)',
                            borderRadius: 'var(--radius-sm)',
                        }}
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
                onChange={(next) => updateLayer({ up: next })}
            />
            <DigitalSourceEditorCompact
                label="Down"
                value={layer.down}
                disabled={disabled}
                onChange={(next) => updateLayer({ down: next })}
            />
            <DigitalSourceEditorCompact
                label="Left"
                value={layer.left}
                disabled={disabled}
                onChange={(next) => updateLayer({ left: next })}
            />
            <DigitalSourceEditorCompact
                label="Right"
                value={layer.right}
                disabled={disabled}
                onChange={(next) => updateLayer({ right: next })}
            />
        </div>
    );
}
