import {
  ORCA_CONFIG_LOCKED_BUTTON_COURAGE,
  ORCA_CONFIG_LOCKED_BUTTON_POWER,
  ORCA_CONFIG_LOCKED_BUTTON_WISDOM,
  ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT,
  ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT,
} from '@shared/orca_config_idl_generated';

export type DigitalInputDef = {
  id: number;
  key: string;
  label: string;
  lockedSystem: boolean;
  isDummy: boolean;
};

export type AnalogInputDef = {
  id: number;
  key: string;
  label: string;
};

function isLockedSystemButton(id: number): boolean {
  return id === ORCA_CONFIG_LOCKED_BUTTON_COURAGE || id === ORCA_CONFIG_LOCKED_BUTTON_POWER;
}

export const ORCA_DUMMY_FIELD = ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT - 1;
export const ORCA_ANALOG_MAPPING_DISABLED = 0xff;

export const DIGITAL_INPUTS: DigitalInputDef[] = [
  { id: 0, key: 'ORCA_A_BUTTON', label: 'A', lockedSystem: false, isDummy: false },
  { id: 1, key: 'ORCA_B_BUTTON', label: 'B', lockedSystem: false, isDummy: false },
  { id: 2, key: 'ORCA_X_BUTTON', label: 'X', lockedSystem: false, isDummy: false },
  { id: 3, key: 'ORCA_Y_BUTTON', label: 'Y', lockedSystem: false, isDummy: false },
  { id: 4, key: 'ORCA_Z_BUTTON', label: 'Z', lockedSystem: false, isDummy: false },
  { id: 5, key: 'ORCA_L_BUTTON', label: 'L', lockedSystem: false, isDummy: false },
  { id: 6, key: 'ORCA_R_BUTTON', label: 'R', lockedSystem: false, isDummy: false },
  { id: 7, key: 'ORCA_C_LEFT', label: 'C Left', lockedSystem: false, isDummy: false },
  { id: 8, key: 'ORCA_C_RIGHT', label: 'C Right', lockedSystem: false, isDummy: false },
  { id: 9, key: 'ORCA_C_UP', label: 'C Up', lockedSystem: false, isDummy: false },
  { id: 10, key: 'ORCA_C_DOWN', label: 'C Down', lockedSystem: false, isDummy: false },
  { id: 11, key: 'ORCA_DPAD', label: 'DPAD Modifier', lockedSystem: false, isDummy: false },
  { id: 12, key: 'ORCA_LIGHTSHIELD', label: 'Lightshield', lockedSystem: false, isDummy: false },
  {
    id: ORCA_CONFIG_LOCKED_BUTTON_WISDOM,
    key: 'ORCA_WISDOM_BUTTON',
    label: 'Start',
    lockedSystem: false,
    isDummy: false,
  },
  {
    id: ORCA_CONFIG_LOCKED_BUTTON_COURAGE,
    key: 'ORCA_COURAGE_BUTTON',
    label: 'Courage (System)',
    lockedSystem: true,
    isDummy: false,
  },
  {
    id: ORCA_CONFIG_LOCKED_BUTTON_POWER,
    key: 'ORCA_POWER_BUTTON',
    label: 'Power (System)',
    lockedSystem: true,
    isDummy: false,
  },
  { id: ORCA_DUMMY_FIELD, key: 'ORCA_DUMMY_FIELD', label: 'Disabled (Dummy)', lockedSystem: false, isDummy: true },
].map((d) => ({ ...d, lockedSystem: d.lockedSystem || isLockedSystemButton(d.id) }));

// Virtual DPAD destination IDs (not real firmware destinations, handled specially in UI)
export const GP2040_L3_VIRTUAL_DEST = 247;
export const GP2040_R3_VIRTUAL_DEST = 248;
export const LT_LIGHT_VIRTUAL_DEST = 249;
export const RT_LIGHT_VIRTUAL_DEST = 250;
export const DPAD_MODIFIER_VIRTUAL_DEST = 251;
export const DPAD_UP_VIRTUAL_DEST = 252;
export const DPAD_DOWN_VIRTUAL_DEST = 253;
export const DPAD_LEFT_VIRTUAL_DEST = 254;
export const DPAD_RIGHT_VIRTUAL_DEST = 255;

export const GP2040_EXTRA_VIRTUAL_DESTINATIONS: DigitalInputDef[] = [
  { id: GP2040_L3_VIRTUAL_DEST, key: 'GP2040_L3', label: 'L3', lockedSystem: false, isDummy: false },
  { id: GP2040_R3_VIRTUAL_DEST, key: 'GP2040_R3', label: 'R3', lockedSystem: false, isDummy: false },
];

// Helper to check if a destination is a virtual DPAD button
export function isVirtualDpadDestination(id: number): boolean {
  return id === DPAD_UP_VIRTUAL_DEST || id === DPAD_DOWN_VIRTUAL_DEST ||
    id === DPAD_LEFT_VIRTUAL_DEST || id === DPAD_RIGHT_VIRTUAL_DEST;
}

export function isGp2040ExtraVirtualDestination(id: number): boolean {
  return id === GP2040_L3_VIRTUAL_DEST || id === GP2040_R3_VIRTUAL_DEST;
}

// Virtual DPAD destinations for binding dropdown
export const DPAD_VIRTUAL_DESTINATIONS: DigitalInputDef[] = [
  { id: DPAD_UP_VIRTUAL_DEST, key: 'DPAD_UP', label: 'DPAD Up', lockedSystem: false, isDummy: false },
  { id: DPAD_DOWN_VIRTUAL_DEST, key: 'DPAD_DOWN', label: 'DPAD Down', lockedSystem: false, isDummy: false },
  { id: DPAD_LEFT_VIRTUAL_DEST, key: 'DPAD_LEFT', label: 'DPAD Left', lockedSystem: false, isDummy: false },
  { id: DPAD_RIGHT_VIRTUAL_DEST, key: 'DPAD_RIGHT', label: 'DPAD Right', lockedSystem: false, isDummy: false },
];

export const ANALOG_INPUTS: AnalogInputDef[] = [
  { id: 0, key: 'ORCA_JOYSTICK_X_LEFT', label: 'Control Stick X Left' },
  { id: 1, key: 'ORCA_JOYSTICK_X_RIGHT', label: 'Control Stick X Right' },
  { id: 2, key: 'ORCA_JOYSTICK_Y_UP', label: 'Control Stick Y Up' },
  { id: 3, key: 'ORCA_JOYSTICK_Y_DOWN', label: 'Control Stick Y Down' },
  { id: 4, key: 'ORCA_TRIGGER_R', label: 'Trigger R (Analog)' },
];

if (DIGITAL_INPUTS.length !== ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT) {
  throw new Error(`DIGITAL_INPUTS mismatch: expected ${ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT}, got ${DIGITAL_INPUTS.length}`);
}
if (ANALOG_INPUTS.length !== ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT) {
  throw new Error(`ANALOG_INPUTS mismatch: expected ${ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT}, got ${ANALOG_INPUTS.length}`);
}

export function digitalInputLabel(id: number): string {
  return DIGITAL_INPUTS.find((d) => d.id === id)?.label ??
    GP2040_EXTRA_VIRTUAL_DESTINATIONS.find((d) => d.id === id)?.label ??
    DPAD_VIRTUAL_DESTINATIONS.find((d) => d.id === id)?.label ??
    `Digital ${id}`;
}

export function analogInputLabel(id: number): string {
  return ANALOG_INPUTS.find((d) => d.id === id)?.label ?? `Analog ${id}`;
}

export function isLockedDigitalSource(id: number): boolean {
  return isLockedSystemButton(id);
}

export function isLockedDigitalDestination(id: number): boolean {
  return isLockedSystemButton(id) || id === ORCA_DUMMY_FIELD;
}

/*===========================================================================
 * Intermediate Digital Output Definitions
 *
 * The WASM processor outputs digital state using UnifiedIntermediateDigital
 * indices, which differ from the Orca input indices. Use these for displaying
 * the output digital mask from WASM processing.
 *===========================================================================*/

/** Intermediate digital output indices (matches UnifiedIntermediateDigital in C) */
export enum IntermediateDigitalOutput {
  A = 0,
  B = 1,
  X = 2,
  Y = 3,
  Z = 4,
  L1 = 5,
  L2 = 6,
  L3 = 7,
  R1 = 8,
  R2 = 9,
  R3 = 10,
  START = 11,
  SELECT = 12,
  HOME = 13,
  DPAD_UP = 14,
  DPAD_DOWN = 15,
  DPAD_LEFT = 16,
  DPAD_RIGHT = 17,
}

/** Output button definitions for display */
export type IntermediateOutputDef = {
  id: IntermediateDigitalOutput;
  label: string;
  isMeleeRelevant: boolean; // Show in Melee/Orca mode
};

/** All intermediate digital outputs for display */
export const INTERMEDIATE_OUTPUTS: IntermediateOutputDef[] = [
  { id: IntermediateDigitalOutput.A, label: 'A', isMeleeRelevant: true },
  { id: IntermediateDigitalOutput.B, label: 'B', isMeleeRelevant: true },
  { id: IntermediateDigitalOutput.X, label: 'X', isMeleeRelevant: true },
  { id: IntermediateDigitalOutput.Y, label: 'Y', isMeleeRelevant: true },
  { id: IntermediateDigitalOutput.Z, label: 'Z', isMeleeRelevant: true },
  { id: IntermediateDigitalOutput.L1, label: 'L', isMeleeRelevant: true },
  { id: IntermediateDigitalOutput.L2, label: 'L2', isMeleeRelevant: false },
  { id: IntermediateDigitalOutput.L3, label: 'L3', isMeleeRelevant: false },
  { id: IntermediateDigitalOutput.R1, label: 'R1', isMeleeRelevant: false },
  { id: IntermediateDigitalOutput.R2, label: 'R', isMeleeRelevant: true },
  { id: IntermediateDigitalOutput.R3, label: 'R3', isMeleeRelevant: false },
  { id: IntermediateDigitalOutput.START, label: 'Start', isMeleeRelevant: true },
  { id: IntermediateDigitalOutput.SELECT, label: 'Select', isMeleeRelevant: false },
  { id: IntermediateDigitalOutput.HOME, label: 'Home', isMeleeRelevant: false },
  { id: IntermediateDigitalOutput.DPAD_UP, label: 'D-Up', isMeleeRelevant: true },
  { id: IntermediateDigitalOutput.DPAD_DOWN, label: 'D-Down', isMeleeRelevant: true },
  { id: IntermediateDigitalOutput.DPAD_LEFT, label: 'D-Left', isMeleeRelevant: true },
  { id: IntermediateDigitalOutput.DPAD_RIGHT, label: 'D-Right', isMeleeRelevant: true },
];

/** Get label for an intermediate digital output */
export function intermediateOutputLabel(id: IntermediateDigitalOutput): string {
  return INTERMEDIATE_OUTPUTS.find((d) => d.id === id)?.label ?? `Out ${id}`;
}
