import { useMemo, useState, useRef, useEffect } from 'react';
import {
    DIGITAL_INPUTS,
    ANALOG_INPUTS,
    digitalInputLabel,
    analogInputLabel,
    isLockedDigitalDestination,
    ORCA_DUMMY_FIELD,
    ORCA_ANALOG_MAPPING_DISABLED
} from '../../schema/orcaMappings';

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
    { id: 7, label: 'C-Stick Left', shortLabel: 'C←', type: 'digital', elementIndex: 6 },
    { id: 8, label: 'C-Stick Right', shortLabel: 'C→', type: 'digital', elementIndex: 1 },
    { id: 9, label: 'C-Stick Up', shortLabel: 'C↑', type: 'digital', elementIndex: 7 },
    { id: 10, label: 'C-Stick Down', shortLabel: 'C↓', type: 'digital', elementIndex: 5 },
    { id: 11, label: 'DPAD Modifier', shortLabel: 'D', type: 'digital', elementIndex: 3 },
    { id: 12, label: 'Lightshield', shortLabel: 'LS', type: 'digital', elementIndex: 4 },
];

// ============================================================
// ANALOG BUTTONS -> Oblong Path Groups (5 oblongs)
// ============================================================
const ANALOG_BUTTONS: ButtonConfig[] = [
    { id: 0, label: 'Joystick X Left', shortLabel: 'J←', type: 'analog', elementIndex: 2 },
    { id: 1, label: 'Joystick X Right', shortLabel: 'J→', type: 'analog', elementIndex: 0 },
    { id: 2, label: 'Joystick Y Up', shortLabel: 'J↑', type: 'analog', elementIndex: 1 },
    { id: 3, label: 'Joystick Y Down', shortLabel: 'J↓', type: 'analog', elementIndex: 3 },
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

interface Props {
    digitalMapping: number[];
    analogMapping: number[];
    disabled?: boolean;
    onDigitalMappingChange: (dest: number, src: number) => void;
    onAnalogMappingChange: (dest: number, src: number) => void;
    onClearAllBindings?: () => void;
    onResetToDefault?: () => void;
}

export function ControllerVisualizer({
    digitalMapping,
    analogMapping,
    disabled,
    onDigitalMappingChange,
    onAnalogMappingChange,
    onClearAllBindings,
    onResetToDefault,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedButton, setSelectedButton] = useState<ButtonConfig | null>(null);
    const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);

    const digitalSourceOptions = useMemo(() =>
        DIGITAL_INPUTS.filter((d) => !d.lockedSystem && !d.isDummy).sort((a, b) => a.id - b.id), []);
    const analogSourceOptions = useMemo(() =>
        ANALOG_INPUTS.sort((a, b) => a.id - b.id), []);

    // Get button config by type and element index
    function getButtonForElement(type: 'digital' | 'analog', elementIndex: number): ButtonConfig | undefined {
        const list = type === 'digital' ? DIGITAL_BUTTONS : ANALOG_BUTTONS;
        return list.find(b => b.elementIndex === elementIndex);
    }

    function handleElementClick(type: 'digital' | 'analog', elementIndex: number, e: React.MouseEvent) {
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
        function handleClickOutside(e: MouseEvent) {
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

    function getMappingLabel(button: ButtonConfig): string {
        if (button.type === 'digital') {
            const srcId = digitalMapping[button.id];
            if (srcId === undefined || srcId === button.id) return '';
            if (srcId === ORCA_DUMMY_FIELD) return 'OFF';
            return digitalInputLabel(srcId);
        } else {
            const srcId = analogMapping[button.id];
            if (srcId === undefined || srcId === button.id) return '';
            if (srcId === ORCA_ANALOG_MAPPING_DISABLED) return 'OFF';
            return analogInputLabel(srcId);
        }
    }

    // Get SHORT label for what a button is mapped to
    function getShortMappingLabel(button: ButtonConfig): string {
        if (button.type === 'digital') {
            const srcId = digitalMapping[button.id];
            if (srcId === undefined || srcId === button.id) return button.shortLabel;
            if (srcId === ORCA_DUMMY_FIELD) return 'OFF';
            // Find the source button and return its shortLabel
            const srcButton = DIGITAL_BUTTONS.find(b => b.id === srcId);
            return srcButton?.shortLabel ?? digitalInputLabel(srcId);
        } else {
            const srcId = analogMapping[button.id];
            if (srcId === undefined || srcId === button.id) return button.shortLabel;
            if (srcId === ORCA_ANALOG_MAPPING_DISABLED) return 'OFF';
            // Find the source button and return its shortLabel
            const srcButton = ANALOG_BUTTONS.find(b => b.id === srcId);
            return srcButton?.shortLabel ?? analogInputLabel(srcId);
        }
    }

    function isModified(button: ButtonConfig): boolean {
        if (button.type === 'digital') {
            return digitalMapping[button.id] !== undefined && digitalMapping[button.id] !== button.id;
        } else {
            return analogMapping[button.id] !== undefined && analogMapping[button.id] !== button.id;
        }
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
            onDigitalMappingChange(selectedButton.id, value);
        } else {
            onAnalogMappingChange(selectedButton.id, value);
        }
    }

    function getCurrentMappingValue(): number {
        if (!selectedButton) return 0;
        if (selectedButton.type === 'digital') {
            return digitalMapping[selectedButton.id] ?? selectedButton.id;
        } else {
            return analogMapping[selectedButton.id] ?? selectedButton.id;
        }
    }

    const circleStyle = (index: number): React.CSSProperties => {
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

    const oblongStyle = (index: number): React.CSSProperties => {
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

                    return (
                        <g key={index} className="interactive-element" onClick={(e) => handleElementClick('digital', index, e)}>
                            <circle
                                cx={circle.cx}
                                cy={circle.cy}
                                r={circle.r}
                                style={circleStyle(index)}
                            />
                            <text
                                x={circle.cx}
                                y={circle.cy + 3}
                                textAnchor="middle"
                                style={{
                                    fontSize: isModified(button) ? 7 : 9,
                                    fontWeight: 700,
                                    fill: 'var(--color-text-primary)',
                                    pointerEvents: 'none',
                                    userSelect: 'none',
                                }}
                            >
                                {isModified(button) ? getMappingLabel(button) : button.shortLabel}
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
                        <span style={{
                            fontSize: 'var(--font-size-md)',
                            fontWeight: 600,
                            color: selectedButton.type === 'analog' ? '#64A0C8' : '#1E8FC9',
                            flex: 1,
                        }}>
                            {selectedButton.label}
                        </span>
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
                            Maps to:
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
                                    {digitalSourceOptions.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </>
                            ) : (
                                <>
                                    <option value={ORCA_ANALOG_MAPPING_DISABLED}>Disabled</option>
                                    {ANALOG_INPUTS.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </>
                            )}
                        </select>

                        {isModified(selectedButton) && (
                            <button onClick={() => handleMappingChange(selectedButton.id)} style={{ marginTop: 'var(--spacing-xs)' }}>
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
