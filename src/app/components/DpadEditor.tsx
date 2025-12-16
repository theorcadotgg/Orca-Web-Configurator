import type { SettingsDraft } from '../../schema/settingsBlob';
import { DigitalSourceEditorCompact } from './DigitalSourceEditorCompact';

type Props = {
    draft: SettingsDraft;
    disabled?: boolean;
    onChange: (next: SettingsDraft) => void;
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

export function DpadEditor({ draft, disabled, onChange }: Props) {
    const layer = draft.dpadLayer;

    function updateLayer(patch: Partial<typeof layer>) {
        const updated = cloneDraft(draft);
        updated.dpadLayer = { ...updated.dpadLayer, ...patch };
        onChange(updated);
    }

    return (
        <div className="col" style={{ gap: 8 }}>
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
                label="Enable"
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
