import { useMemo, useState, useRef, useEffect, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import {
    DIGITAL_INPUTS,
    ANALOG_INPUTS,
    digitalInputLabel,
    analogInputLabel,
    isLockedDigitalDestination,
    ORCA_DUMMY_FIELD,
    ORCA_ANALOG_MAPPING_DISABLED,
    DPAD_UP_VIRTUAL_DEST,
    DPAD_DOWN_VIRTUAL_DEST,
    DPAD_LEFT_VIRTUAL_DEST,
    DPAD_RIGHT_VIRTUAL_DEST,
    DPAD_VIRTUAL_DESTINATIONS,
} from '../../schema/orcaMappings';
import { getGp2040DestinationLabelSet, type Gp2040LabelPreset } from '../../schema/gp2040Labels';

/**
 * =====================================================
 * BUTTON MAPPING CONFIGURATION
 * =====================================================
 * 
 * DIGITAL BUTTONS map to circle elements (circleIndex 0-14)
 * ANALOG BUTTONS map to oblong path groups (analogIndex 0-4)
 * 
 * To change which button maps to which SVG element, modify
 * the circleIndex or analogIndex values below.
 */

interface ButtonConfig {
    id: number;
    label: string;
    shortLabel: string;
    type: 'digital' | 'analog';
    elementIndex: number; // circleIndex for digital, pathGroupIndex for analog
}

// ============================================================
// DIGITAL BUTTONS -> Circle Elements (15 circles available)
// ============================================================
const DIGITAL_BUTTONS: ButtonConfig[] = [
    { id: 0, label: 'A Button', shortLabel: 'A', type: 'digital', elementIndex: 8 },
    { id: 1, label: 'B Button', shortLabel: 'B', type: 'digital', elementIndex: 11 },
    { id: 2, label: 'X Button', shortLabel: 'X', type: 'digital', elementIndex: 9 },
    { id: 3, label: 'Y Button', shortLabel: 'Y', type: 'digital', elementIndex: 13 },
    { id: 4, label: 'Z Button', shortLabel: 'Z', type: 'digital', elementIndex: 10 },
    { id: 5, label: 'L Trigger', shortLabel: 'L', type: 'digital', elementIndex: 2 },
    { id: 6, label: 'R Trigger', shortLabel: 'R', type: 'digital', elementIndex: 0 },
    { id: 7, label: 'C-Stick Left', shortLabel: 'C⬅', type: 'digital', elementIndex: 6 },
    { id: 8, label: 'C-Stick Right', shortLabel: 'C➡', type: 'digital', elementIndex: 1 },
    { id: 9, label: 'C-Stick Up', shortLabel: 'C⬆', type: 'digital', elementIndex: 7 },
    { id: 10, label: 'C-Stick Down', shortLabel: 'C⬇', type: 'digital', elementIndex: 5 },
    { id: 11, label: 'DPAD Modifier', shortLabel: 'D', type: 'digital', elementIndex: 3 },
    { id: 12, label: 'Lightshield', shortLabel: 'LS', type: 'digital', elementIndex: 4 },
];

// ============================================================
// ANALOG BUTTONS -> Oblong Path Groups (5 oblongs)
// ============================================================
const ANALOG_BUTTONS: ButtonConfig[] = [
    { id: 0, label: 'Control Stick X Left', shortLabel: '⬅', type: 'analog', elementIndex: 2 },
    { id: 1, label: 'Control Stick X Right', shortLabel: '➡', type: 'analog', elementIndex: 0 },
    { id: 2, label: 'Control Stick Y Up', shortLabel: '⬆', type: 'analog', elementIndex: 1 },
    { id: 3, label: 'Control Stick Y Down', shortLabel: '⬇', type: 'analog', elementIndex: 3 },
    { id: 4, label: 'Trigger R Analog', shortLabel: 'TR', type: 'analog', elementIndex: 4 },
];

// Circle coordinates from SVG (for labels)
const CIRCLES = [
    { cx: 219.6450, cy: 229.0637, r: 11.5 },  // 0
    { cx: 224.9800, cy: 294.6787, r: 11.5 },  // 1
    { cx: 21.7350, cy: 256.7337, r: 11.5 },  // 2
    { cx: 178.5000, cy: 251.4037, r: 11.5 },  // 3
    { cx: 265.1800, cy: 214.2387, r: 11.5 },  // 4
    { cx: 199.0000, cy: 339.7187, r: 11.5 },  // 5
    { cx: 185.9950, cy: 317.1937, r: 11.5 },  // 6
    { cx: 198.9800, cy: 294.6787, r: 11.5 },  // 7
    { cx: 212.0000, cy: 317.1987, r: 11.5 },  // 8
    { cx: 244.5700, cy: 237.1287, r: 11.5 },  // 9
    { cx: 270.6300, cy: 239.8687, r: 11.5 },  // 10
    { cx: 224.9800, cy: 254.6787, r: 11.5 },  // 11
    { cx: 165.6650, cy: 229.0637, r: 11.5 },  // 12
    { cx: 239.1200, cy: 211.4987, r: 11.5 },  // 13
    { cx: 152.5000, cy: 251.4787, r: 11.5 },  // 14
];

// Oblong shapes (path groups) - center positions for labels (in SVG coordinates)
const OBLONGS = [
    { cx: 110, cy: 242 },   // 0 - JX Left (rightmost upper oblong)
    { cx: 82, cy: 226 },   // 1 - JX Right (middle upper oblong)
    { cx: 53, cy: 230 },   // 2 - JY Up (leftmost upper oblong)
    { cx: 125, cy: 317 },   // 3 - JY Down (lower left oblong)
    { cx: 300, cy: 246 },   // 4 - TR (right side oblong)
];

// Virtual destination ID for LT in GP2040 mode (to distinguish from RT which uses ID 4)
const GP2040_ANALOG_LT_VIRTUAL_ID = 254;

interface Props {
    digitalMapping: number[];
    analogMapping: number[];
    defaultDigitalMapping?: number[];
    defaultAnalogMapping?: number[];
    disabled?: boolean;
    destinationLabelMode?: 'orca' | 'gp2040';
    gp2040LabelPreset?: Gp2040LabelPreset;
    gp2040AnalogTriggerRouting?: 'lt' | 'rt'; // Read-only, derived from trigger policy
    dpadLayer?: {
        mode_up: number;
        mode_down: number;
        mode_left: number;
        mode_right: number;
        up: { type: number; index: number; threshold: number; hysteresis: number };
        down: { type: number; index: number; threshold: number; hysteresis: number };
        left: { type: number; index: number; threshold: number; hysteresis: number };
        right: { type: number; index: number; threshold: number; hysteresis: number };
    };
    onDigitalMappingChange: (dest: number, src: number) => void;
    onAnalogMappingChange: (dest: number, src: number, virtualDest?: number) => void;
    onClearAllBindings?: () => void;
    onResetToDefault?: () => void;
}

export function ControllerVisualizer({
    digitalMapping,
    analogMapping,
    defaultDigitalMapping,
    defaultAnalogMapping,
    disabled,
    destinationLabelMode = 'orca',
    gp2040LabelPreset,
    gp2040AnalogTriggerRouting = 'rt',
    dpadLayer,
    onDigitalMappingChange,
    onAnalogMappingChange,
    onClearAllBindings,
    onResetToDefault,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedButton, setSelectedButton] = useState<ButtonConfig | null>(null);
    const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);

    const digitalButtons = DIGITAL_BUTTONS;
    const analogButtons = ANALOG_BUTTONS;
    const gp2040LabelSet = useMemo(() => getGp2040DestinationLabelSet(gp2040LabelPreset), [gp2040LabelPreset]);

    // Helper to get trigger labels based on preset
    const getGp2040TriggerLabels = useMemo(() => {
        const presetLabels = {
            switch: { lt: { label: 'ZL (Analog)', shortLabel: 'ZL' }, rt: { label: 'ZR (Analog)', shortLabel: 'ZR' } },
            playstation: { lt: { label: 'L2 (Analog)', shortLabel: 'L2' }, rt: { label: 'R2 (Analog)', shortLabel: 'R2' } },
            xbox: { lt: { label: 'LT (Analog)', shortLabel: 'LT' }, rt: { label: 'RT (Analog)', shortLabel: 'RT' } },
            gp2040: { lt: { label: 'LT', shortLabel: 'LT' }, rt: { label: 'RT', shortLabel: 'RT' } },
        };
        return presetLabels[gp2040LabelPreset || 'gp2040'];
    }, [gp2040LabelPreset]);

    const effectiveDigitalMapping = useMemo(() => {
        return Array.from({ length: DIGITAL_INPUTS.length }, (_, dest) => {
            const defId = defaultDigitalMapping?.[dest] ?? dest;
            return digitalMapping[dest] ?? defId;
        });
    }, [defaultDigitalMapping, digitalMapping]);

    const effectiveAnalogMapping = useMemo(() => {
        return Array.from({ length: ANALOG_INPUTS.length }, (_, dest) => {
            const defId = defaultAnalogMapping?.[dest] ?? dest;
            return analogMapping[dest] ?? defId;
        });
    }, [analogMapping, defaultAnalogMapping]);

    const digitalDestBySrc = useMemo(() => {
        const out: Array<number | undefined> = Array.from({ length: DIGITAL_INPUTS.length }, () => undefined);
        for (let dest = 0; dest < effectiveDigitalMapping.length; dest++) {
            const src = effectiveDigitalMapping[dest];
            if (src === ORCA_DUMMY_FIELD) continue;
            if (src >= 0 && src < out.length) out[src] = dest;
        }
        return out;
    }, [effectiveDigitalMapping]);

    const analogDestBySrc = useMemo(() => {
        const out: Array<number | undefined> = Array.from({ length: ANALOG_INPUTS.length }, () => undefined);
        for (let dest = 0; dest < effectiveAnalogMapping.length; dest++) {
            const src = effectiveAnalogMapping[dest];
            if (src === ORCA_ANALOG_MAPPING_DISABLED) continue;
            if (src >= 0 && src < out.length) out[src] = dest;
        }
        return out;
    }, [effectiveAnalogMapping]);

    const defaultDigitalDestBySrc = useMemo(() => {
        const out: Array<number | undefined> = Array.from({ length: DIGITAL_INPUTS.length }, () => undefined);
        for (let dest = 0; dest < DIGITAL_INPUTS.length; dest++) {
            const src = defaultDigitalMapping?.[dest] ?? dest;
            if (src === ORCA_DUMMY_FIELD) continue;
            if (src >= 0 && src < out.length) out[src] = dest;
        }
        return out;
    }, [defaultDigitalMapping]);

    const defaultAnalogDestBySrc = useMemo(() => {
        const out: Array<number | undefined> = Array.from({ length: ANALOG_INPUTS.length }, () => undefined);
        for (let dest = 0; dest < ANALOG_INPUTS.length; dest++) {
            const src = defaultAnalogMapping?.[dest] ?? dest;
            if (src === ORCA_ANALOG_MAPPING_DISABLED) continue;
            if (src >= 0 && src < out.length) out[src] = dest;
        }
        return out;
    }, [defaultAnalogMapping]);

    const digitalDestinationOptions = useMemo(() => {
        const base = DIGITAL_INPUTS.filter((d) => !isLockedDigitalDestination(d.id) && !d.isDummy).sort((a, b) => a.id - b.id);
        // Add DPAD virtual destinations
        const withDpad = [...base, ...DPAD_VIRTUAL_DESTINATIONS];
        if (destinationLabelMode !== 'gp2040') return withDpad;
        return withDpad.map((opt) => {
            const overlay = gp2040LabelSet.digital[opt.id];
            return overlay ? { ...opt, label: overlay.label } : opt;
        });
    }, [destinationLabelMode, gp2040LabelSet]);

    const analogDestinationOptions = useMemo(() => {
        const base = [...ANALOG_INPUTS].sort((a, b) => a.id - b.id);
        if (destinationLabelMode !== 'gp2040') return base;

        // In GP2040 mode, replace the trigger option (id=4) with BOTH LT and RT options
        const result = base.flatMap((opt) => {
            if (opt.id === 4) {
                // Replace with both LT and RT options
                return [
                    { id: GP2040_ANALOG_LT_VIRTUAL_ID, key: 'GP2040_LT', label: getGp2040TriggerLabels.lt.label },
                    { id: 4, key: 'GP2040_RT', label: getGp2040TriggerLabels.rt.label },
                ];
            }
            const overlay = gp2040LabelSet.analog[opt.id];
            return [overlay ? { ...opt, label: overlay.label } : opt];
        });
        return result;
    }, [destinationLabelMode, getGp2040TriggerLabels, gp2040LabelSet]);

    // Get button config by type and element index
    function getButtonForElement(type: 'digital' | 'analog', elementIndex: number): ButtonConfig | undefined {
        const list = type === 'digital' ? digitalButtons : analogButtons;
        return list.find(b => b.elementIndex === elementIndex);
    }

    useEffect(() => {
        setSelectedButton(null);
        setPanelPosition(null);
    }, [destinationLabelMode]);

    function handleElementClick(type: 'digital' | 'analog', elementIndex: number, e: ReactMouseEvent) {
        if (disabled) return;
        const button = getButtonForElement(type, elementIndex);
        if (!button) return;
        if (type === 'digital' && isLockedDigitalDestination(button.id)) return;

        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            setPanelPosition({
                x: Math.min(e.clientX - rect.left, rect.width - 280),
                y: Math.min(e.clientY - rect.top + 10, rect.height - 200),
            });
        }
        setSelectedButton(button);
    }

    useEffect(() => {
        function handleClickOutside(e: globalThis.MouseEvent) {
            const target = e.target as HTMLElement;
            if (!target.closest('.interactive-element') && !target.closest('.mapping-panel')) {
                setSelectedButton(null);
                setPanelPosition(null);
            }
        }
        if (selectedButton) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [selectedButton]);

    // Helper to check if a source is bound to DPAD directions
    function getDpadBindingsForSource(srcId: number): { direction: string; mode: number; virtualDest: number }[] {
        if (!dpadLayer) return [];
        const bindings: { direction: string; mode: number; virtualDest: number }[] = [];

        if (dpadLayer.mode_up !== 0 && dpadLayer.up.type === 1 && dpadLayer.up.index === srcId) {
            bindings.push({ direction: '⬆', mode: dpadLayer.mode_up, virtualDest: DPAD_UP_VIRTUAL_DEST });
        }
        if (dpadLayer.mode_down !== 0 && dpadLayer.down.type === 1 && dpadLayer.down.index === srcId) {
            bindings.push({ direction: '⬇', mode: dpadLayer.mode_down, virtualDest: DPAD_DOWN_VIRTUAL_DEST });
        }
        if (dpadLayer.mode_left !== 0 && dpadLayer.left.type === 1 && dpadLayer.left.index === srcId) {
            bindings.push({ direction: '⬅', mode: dpadLayer.mode_left, virtualDest: DPAD_LEFT_VIRTUAL_DEST });
        }
        if (dpadLayer.mode_right !== 0 && dpadLayer.right.type === 1 && dpadLayer.right.index === srcId) {
            bindings.push({ direction: '➡', mode: dpadLayer.mode_right, virtualDest: DPAD_RIGHT_VIRTUAL_DEST });
        }

        return bindings;
    }

    function getShortMappingLabel(button: ButtonConfig): string {
        if (button.type === 'digital') {
            const destId = digitalDestBySrc[button.id] ?? ORCA_DUMMY_FIELD;

            // Check if this button has DPAD bindings
            const dpadBindings = getDpadBindingsForSource(button.id);

            // If button is disabled (OFF) but has DPAD bindings, show DPAD label
            if (destId === ORCA_DUMMY_FIELD && dpadBindings.length > 0) {
                // Show first DPAD direction with D prefix (e.g., "D↑")
                return `D${dpadBindings[0].direction}`;
            }

            if (destId === ORCA_DUMMY_FIELD) return 'OFF';
            if (destinationLabelMode === 'gp2040') {
                const overlay = gp2040LabelSet.digital[destId];
                if (overlay) return overlay.shortLabel;
            }
            return digitalButtons.find((b) => b.id === destId)?.shortLabel ?? digitalInputLabel(destId);
        } else {
            const destId = analogDestBySrc[button.id] ?? ORCA_ANALOG_MAPPING_DISABLED;
            if (destId === ORCA_ANALOG_MAPPING_DISABLED) return 'OFF';
            if (destinationLabelMode === 'gp2040') {
                if (destId === 4) {
                    // Determine if routed to LT or RT based on the routing parameter
                    return gp2040AnalogTriggerRouting === 'lt'
                        ? getGp2040TriggerLabels.lt.shortLabel
                        : getGp2040TriggerLabels.rt.shortLabel;
                }
                const overlay = gp2040LabelSet.analog[destId];
                if (overlay) return overlay.shortLabel;
            }
            return analogButtons.find((b) => b.id === destId)?.shortLabel ?? analogInputLabel(destId);
        }
    }

    function isModified(button: ButtonConfig): boolean {
        if (button.type === 'digital') {
            const currentDest = digitalDestBySrc[button.id] ?? ORCA_DUMMY_FIELD;
            const defaultDest = defaultDigitalDestBySrc[button.id] ?? ORCA_DUMMY_FIELD;
            return currentDest !== defaultDest;
        }
        const currentDest = analogDestBySrc[button.id] ?? ORCA_ANALOG_MAPPING_DISABLED;
        const defaultDest = defaultAnalogDestBySrc[button.id] ?? ORCA_ANALOG_MAPPING_DISABLED;
        return currentDest !== defaultDest;
    }

    function isCircleModified(circleIndex: number): boolean {
        const button = getButtonForElement('digital', circleIndex);
        return button ? isModified(button) : false;
    }

    function isOblongModified(oblongIndex: number): boolean {
        const button = getButtonForElement('analog', oblongIndex);
        return button ? isModified(button) : false;
    }

    function handleMappingChange(value: number) {
        if (!selectedButton) return;
        if (selectedButton.type === 'digital') {
            const src = selectedButton.id;
            const currentDest = digitalDestBySrc[src];
            if (value === ORCA_DUMMY_FIELD) {
                if (currentDest !== undefined) {
                    onDigitalMappingChange(currentDest, ORCA_DUMMY_FIELD);
                } else {
                    // If this button is only bound through the DPAD layer (virtual destination), allow clearing it here.
                    const dpadBindings = getDpadBindingsForSource(src);
                    if (dpadBindings.length > 0) {
                        onDigitalMappingChange(dpadBindings[0].virtualDest, ORCA_DUMMY_FIELD);
                    }
                }
                return;
            }
            onDigitalMappingChange(value, src);
        } else {
            const src = selectedButton.id;
            const currentDest = analogDestBySrc[src];
            if (value === ORCA_ANALOG_MAPPING_DISABLED) {
                if (currentDest !== undefined) onAnalogMappingChange(currentDest, ORCA_ANALOG_MAPPING_DISABLED);
                return;
            }
            // Pass the virtual dest ID if it's the LT option, so App.tsx can handle routing
            onAnalogMappingChange(value === GP2040_ANALOG_LT_VIRTUAL_ID ? 4 : value, src, value);
        }
    }

    function getCurrentMappingValue(): number {
        if (!selectedButton) return 0;
        if (selectedButton.type === 'digital') {
            const src = selectedButton.id;
            const currentDest = digitalDestBySrc[src];
            if (currentDest !== undefined) return currentDest;
            const dpadBindings = getDpadBindingsForSource(src);
            if (dpadBindings.length > 0) return dpadBindings[0].virtualDest;
            return ORCA_DUMMY_FIELD;
        }
        const destId = analogDestBySrc[selectedButton.id] ?? ORCA_ANALOG_MAPPING_DISABLED;
        // In GP2040 mode, if mapped to trigger (4) and routed to LT, show the virtual LT ID
        if (destinationLabelMode === 'gp2040' && destId === 4 && gp2040AnalogTriggerRouting === 'lt') {
            return GP2040_ANALOG_LT_VIRTUAL_ID;
        }
        return destId;
    }

    function getDefaultMappingValue(): number {
        if (!selectedButton) return 0;
        if (selectedButton.type === 'digital') {
            return defaultDigitalDestBySrc[selectedButton.id] ?? ORCA_DUMMY_FIELD;
        }
        return defaultAnalogDestBySrc[selectedButton.id] ?? ORCA_ANALOG_MAPPING_DISABLED;
    }

    const circleStyle = (index: number): CSSProperties => {
        const isActive = selectedButton?.type === 'digital' && selectedButton?.elementIndex === index;
        const modified = isCircleModified(index);
        const button = getButtonForElement('digital', index);
        const isLocked = button && isLockedDigitalDestination(button.id);

        return {
            fill: modified ? 'rgba(30, 143, 201, 0.4)' : 'rgba(30, 143, 201, 0.15)',
            stroke: isActive ? '#1E8FC9' : 'rgba(30, 143, 201, 0.6)',
            strokeWidth: isActive ? 2 : 1,
            cursor: isLocked ? 'not-allowed' : 'pointer',
            opacity: isLocked ? 0.4 : 1,
            transition: 'all 0.15s ease',
        };
    };

    const oblongStyle = (index: number): CSSProperties => {
        const isActive = selectedButton?.type === 'analog' && selectedButton?.elementIndex === index;
        const modified = isOblongModified(index);

        return {
            fill: modified ? 'rgba(100, 160, 200, 0.4)' : 'rgba(100, 160, 200, 0.15)',
            stroke: isActive ? '#64A0C8' : 'rgba(100, 160, 200, 0.6)',
            strokeWidth: isActive ? 2 : 1,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
        };
    };

    return (
        <div className="controller-container" ref={containerRef} style={{ width: '100%', position: 'relative' }}>
            {/* Full-width SVG - Cropped to show only controller area */}
            <svg
                viewBox="0 175 331.2 200"
                style={{
                    width: '100%',
                    padding: '20px',
                    height: 'auto',
                    display: 'block',
                    background: 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                }}
            >
                {/* Background outline paths (non-interactive) */}
                <g style={{ fill: 'none', stroke: 'rgba(30, 143, 201, 0.3)', strokeWidth: 0.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                    <path d="M64.0370 184.9952 L267.1630 184.9952" />
                    <path d="M64.0370 369.9952 L267.1630 369.9952" />
                    <path d="M0.1000 329.8407 L0.1000 225.1497" />
                    <path d="M331.1000 329.8407 L331.1000 225.1497" />
                    <path d="M56.0488 187.1320 L5.1074 216.4852" />
                    <path d="M326.0926 216.4852 L275.1512 187.1320" />
                    <path d="M56.0488 367.8584 L5.1074 338.5052" />
                    <path d="M275.1512 367.8584 L326.0926 338.5052" />
                    <path d="M64.0370 184.9952 A15.9998 15.9998 0.0 0 0 56.0488 187.1320" />
                    <path d="M275.1512 187.1320 A15.9999 15.9999 0.0 0 0 267.1630 184.9952" />
                    <path d="M56.0488 367.8584 A15.9999 15.9999 0.0 0 0 64.0370 369.9952" />
                    <path d="M267.1630 369.9952 A15.9998 15.9998 0.0 0 0 275.1512 367.8584" />
                    <path d="M5.1074 216.4852 A10.0001 10.0001 0.0 0 0 0.1000 225.1497" />
                    <path d="M331.1000 225.1497 A10.0000 10.0000 0.0 0 0 326.0926 216.4852" />
                    <path d="M0.1000 329.8407 A10.0002 10.0002 0.0 0 0 5.1074 338.5052" />
                    <path d="M326.0926 338.5052 A10.0000 10.0000 0.0 0 0 331.1000 329.8407" />
                </g>

                {/* Analog Oblong 0 - JX Left (rightmost upper oblong) */}
                <g
                    className="interactive-element"
                    style={oblongStyle(0)}
                    onClick={(e) => handleElementClick('analog', 0, e)}
                >
                    <path d="M124.6254 228.8973 A12 12 0 1 0 101.1499 223.9075 L94.7046 254.23 A12 12 0 1 0 118.1802 259.2199 Z" />
                    <text x="110" y="244" textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: 'var(--color-text-primary)', stroke: 'none', pointerEvents: 'none' }}>
                        {getShortMappingLabel(getButtonForElement('analog', 0)!)}
                    </text>
                </g>

                {/* Analog Oblong 1 - JX Right (middle upper oblong) */}
                <g
                    className="interactive-element"
                    style={oblongStyle(1)}
                    onClick={(e) => handleElementClick('analog', 1, e)}
                >
                    <path d="M98.7154 213.6873 A12 12 0 1 0 75.2399 208.6975 L68.7946 239.02 A12 12 0 1 0 92.2702 244.0099 Z" />
                    <text x="84" y="228" textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: 'var(--color-text-primary)', stroke: 'none', pointerEvents: 'none' }}>
                        {getShortMappingLabel(getButtonForElement('analog', 1)!)}
                    </text>
                </g>

                {/* Analog Oblong 2 - JY Up (leftmost upper oblong) */}
                <g
                    className="interactive-element"
                    style={oblongStyle(2)}
                    onClick={(e) => handleElementClick('analog', 2, e)}
                >
                    <path d="M68.8654 217.0673 A12 12 0 1 0 45.3899 212.0775 L38.9446 242.4 A12 12 0 1 0 62.4202 247.3899 Z" />
                    <text x="54" y="230" textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: 'var(--color-text-primary)', stroke: 'none', pointerEvents: 'none' }}>
                        {getShortMappingLabel(getButtonForElement('analog', 2)!)}
                    </text>
                </g>

                {/* Analog Oblong 3 - JY Down (lower left oblong - different orientation) */}
                <g
                    className="interactive-element"
                    style={oblongStyle(3)}
                    onClick={(e) => handleElementClick('analog', 3, e)}
                >
                    <path d="M141.611 311.0539 A12 12 0 0 0 121.7141 297.6333 L104.3791 323.3334 A12 12 0 0 0 124.276 336.7541 Z" />
                    <text x="123" y="318" textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: 'var(--color-text-primary)', stroke: 'none', pointerEvents: 'none' }}>
                        {getShortMappingLabel(getButtonForElement('analog', 3)!)}
                    </text>
                </g>

                {/* Analog Oblong 4 - TR (right side oblong) */}
                <g
                    className="interactive-element"
                    style={oblongStyle(4)}
                    onClick={(e) => handleElementClick('analog', 4, e)}
                >
                    <path d="M309.868 229.2229 A12 12 0 1 0 286.2326 233.3905 L291.6156 263.9195 A12 12 0 1 0 315.251 259.752 Z" />
                    <text x="300" y="248" textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: 'var(--color-text-primary)', stroke: 'none', pointerEvents: 'none' }}>
                        {getShortMappingLabel(getButtonForElement('analog', 4)!)}
                    </text>
                </g>

                {/* Digital Button Circles */}
                {CIRCLES.map((circle, index) => {
                    const button = getButtonForElement('digital', index);
                    if (!button) return (
                        <circle
                            key={index}
                            cx={circle.cx}
                            cy={circle.cy}
                            r={circle.r}
                            style={{ fill: 'none', stroke: 'rgba(0, 212, 255, 0.2)', strokeWidth: 0.5 }}
                        />
                    );

                    const modifierDpadBinding = getDpadBindingsForSource(button.id).find((b) => b.mode === 1);
                    const modifierBadgeText = modifierDpadBinding?.direction ?? '';
                    const badgeR = 4.2;
                    const badgeRadialOffset = circle.r - badgeR * 0.2; // closer to edge; slight overhang like a badge
                    const badgeCx = circle.cx + badgeRadialOffset * Math.SQRT1_2;
                    const badgeCy = circle.cy - badgeRadialOffset * Math.SQRT1_2;

                    return (
                        <g key={index} className="interactive-element" onClick={(e) => handleElementClick('digital', index, e)}>
                            <circle
                                cx={circle.cx}
                                cy={circle.cy}
                                r={circle.r}
                                style={circleStyle(index)}
                            />
                            {modifierBadgeText && (
                                <g style={{ pointerEvents: 'none' }}>
                                    <circle
                                        cx={badgeCx}
                                        cy={badgeCy}
                                        r={badgeR}
                                        style={{
                                            fill: 'var(--color-brand)',
                                            stroke: 'rgba(255, 255, 255, 0.25)',
                                            strokeWidth: 0.8,
                                            filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.35))',
                                        }}
                                    />
                                    <text
                                        x={badgeCx}
                                        y={badgeCy}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{
                                            fontSize: 7.5,
                                            fontWeight: 900,
                                            fill: 'var(--color-text-primary)',
                                            userSelect: 'none',
                                        }}
                                    >
                                        {modifierBadgeText}
                                    </text>
                                </g>
                            )}
                            <text
                                x={circle.cx}
                                y={circle.cy + 3}
                                textAnchor="middle"
                                style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    fill: 'var(--color-text-primary)',
                                    pointerEvents: 'none',
                                    userSelect: 'none',
                                }}
                            >
                                {getShortMappingLabel(button)}
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* Mapping Panel */}
            {selectedButton && panelPosition && (
                <div
                    className="mapping-panel animate-fade-in"
                    style={{
                        position: 'absolute',
                        left: panelPosition.x,
                        top: panelPosition.y,
                        minWidth: 280,
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border-active)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--spacing-md)',
                        backdropFilter: 'blur(16px)',
                        boxShadow: 'var(--shadow-card)',
                        zIndex: 100,
                    }}
                >
                    {/* Header with close button */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 'var(--spacing-md)',
                        paddingBottom: 'var(--spacing-sm)',
                        borderBottom: '1px solid var(--color-border)',
                        gap: 'var(--spacing-sm)',
                    }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: 'var(--font-size-md)',
                                fontWeight: 600,
                                color: selectedButton.type === 'analog' ? '#64A0C8' : '#1E8FC9',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}>
                                {selectedButton.label}
                            </div>
                            {destinationLabelMode === 'gp2040' && (
                                <div style={{ marginTop: 2, fontSize: 11, color: 'var(--color-text-muted)' }}>
                                    Orca role: {selectedButton.type === 'digital' ? digitalInputLabel(selectedButton.id) : analogInputLabel(selectedButton.id)}
                                </div>
                            )}
                            {destinationLabelMode === 'gp2040' && selectedButton.type === 'digital' && selectedButton.id === 11 && (
                                <div style={{ marginTop: 2, fontSize: 11, color: 'var(--color-text-muted)' }}>
                                    DPAD Layer enable is configured separately (sidebar).
                                </div>
                            )}
                        </div>
                        <span className="pill pill-neutral" style={{
                            background: selectedButton.type === 'analog' ? 'rgba(100, 160, 200, 0.2)' : undefined,
                            borderColor: selectedButton.type === 'analog' ? 'rgba(100, 160, 200, 0.4)' : undefined,
                            color: selectedButton.type === 'analog' ? '#64A0C8' : undefined,
                            fontSize: 11,
                            padding: '2px 8px',
                        }}>
                            {selectedButton.type === 'analog' ? 'Analog' : 'Digital'}
                        </span>
                        <button
                            onClick={() => { setSelectedButton(null); setPanelPosition(null); }}
                            style={{
                                width: 24,
                                height: 24,
                                padding: 0,
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--color-bg-tertiary)',
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 14,
                                flexShrink: 0,
                            }}
                            title="Close"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="col" style={{ gap: 'var(--spacing-sm)' }}>
                        <label style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                            Output:
                        </label>
                        <select
                            value={getCurrentMappingValue()}
                            onChange={(e) => handleMappingChange(Number(e.target.value))}
                            disabled={disabled}
                            style={{
                                width: '100%',
                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                fontSize: 'var(--font-size-sm)',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                            }}
                        >
                            {selectedButton.type === 'digital' ? (
                                <>
                                    <option value={ORCA_DUMMY_FIELD}>Disabled (OFF)</option>
                                    {digitalDestinationOptions.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </>
                            ) : (
                                <>
                                    <option value={ORCA_ANALOG_MAPPING_DISABLED}>Disabled (OFF)</option>
                                    {analogDestinationOptions.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </>
                            )}
                        </select>



                        {isModified(selectedButton) && (
                            <button onClick={() => handleMappingChange(getDefaultMappingValue())} style={{ marginTop: 'var(--spacing-xs)' }}>
                                Reset to default
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Legend and Clear Button */}
            <div className="row" style={{ marginTop: 'var(--spacing-md)', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="row" style={{ gap: 'var(--spacing-lg)' }}>
                    <div className="row" style={{ gap: 'var(--spacing-sm)' }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #1E8FC9', background: 'rgba(30, 143, 201, 0.15)' }} />
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Digital ({DIGITAL_BUTTONS.length})</span>
                    </div>
                    <div className="row" style={{ gap: 'var(--spacing-sm)' }}>
                        <div style={{ width: 14, height: 14, borderRadius: '4px', border: '2px solid #64A0C8', background: 'rgba(100, 160, 200, 0.15)' }} />
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Analog ({ANALOG_BUTTONS.length})</span>
                    </div>
                </div>
                <div className="row" style={{ gap: 'var(--spacing-sm)' }}>
                    {onResetToDefault && (
                        <button
                            onClick={onResetToDefault}
                            disabled={disabled}
                            style={{
                                fontSize: 'var(--font-size-sm)',
                                padding: 'var(--spacing-xs) var(--spacing-sm)',
                            }}
                        >
                            Reset to Default
                        </button>
                    )}
                    {onClearAllBindings && (
                        <button
                            onClick={onClearAllBindings}
                            disabled={disabled}
                            style={{
                                fontSize: 'var(--font-size-sm)',
                                padding: 'var(--spacing-xs) var(--spacing-sm)',
                            }}
                        >
                            Clear All Bindings
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
