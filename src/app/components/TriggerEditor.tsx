import type { SettingsDraft } from '../../schema/settingsBlob';

type Props = {
    draft: SettingsDraft;
    disabled?: boolean;
    onChange: (next: SettingsDraft) => void;
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

export function TriggerEditor({ draft, disabled, onChange }: Props) {
    const policy = draft.triggerPolicy;

    function updatePolicy(patch: Partial<typeof policy>) {
        const updated = cloneDraft(draft);
        updated.triggerPolicy = { ...updated.triggerPolicy, ...patch };
        onChange(updated);
    }

    const analogRangeMax255 = to255(policy.analogRangeMax);
    const digitalFullPress255 = to255(policy.digitalFullPress);
    const digitalLightshield255 = to255(policy.digitalLightshield);

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
                    </div>
                </div>
            </div>

            {/* Legend - single line */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 10, color: 'var(--color-text-muted)' }}>
                <span>■ Full Press</span>
                <span style={{ color: '#FF9800' }}>━ Lightshield</span>
            </div>

            {/* Sliders - compact single-line format */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Analog Max */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, width: 90, flexShrink: 0 }}>Analog Max</span>
                    <input
                        type="range"
                        min={0}
                        max={255}
                        value={analogRangeMax255}
                        onChange={(e) => updatePolicy({ analogRangeMax: from255(Number(e.target.value)) })}
                        disabled={disabled}
                        style={{ flex: 1, minWidth: 0 }}
                    />
                    <input
                        type="number"
                        min={0}
                        max={255}
                        value={analogRangeMax255}
                        onChange={(e) => updatePolicy({ analogRangeMax: from255(Number(e.target.value)) })}
                        disabled={disabled}
                        style={{ width: 48, fontSize: 11, padding: '2px 4px', textAlign: 'center', flexShrink: 0 }}
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
                        min={0}
                        max={255}
                        value={digitalLightshield255}
                        onChange={(e) => updatePolicy({ digitalLightshield: from255(Number(e.target.value)) })}
                        disabled={disabled}
                        style={{ flex: 1, minWidth: 0 }}
                    />
                    <input
                        type="number"
                        min={0}
                        max={255}
                        value={digitalLightshield255}
                        onChange={(e) => updatePolicy({ digitalLightshield: from255(Number(e.target.value)) })}
                        disabled={disabled}
                        style={{ width: 48, fontSize: 11, padding: '2px 4px', textAlign: 'center', flexShrink: 0 }}
                    />
                </div>
            </div>
        </div>
    );
}
