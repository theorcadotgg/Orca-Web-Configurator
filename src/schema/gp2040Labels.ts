export type Gp2040LabelPair = {
  label: string;
  shortLabel: string;
};

export const GP2040_LABEL_PRESETS = ['gp2040', 'xbox', 'switch', 'playstation'] as const;
export type Gp2040LabelPreset = (typeof GP2040_LABEL_PRESETS)[number];

export function isGp2040LabelPreset(value: string): value is Gp2040LabelPreset {
  return (GP2040_LABEL_PRESETS as readonly string[]).includes(value);
}

// Destination label overlay for GP2040-mode editing (secondary slot).
// Keys are Orca "intermediate" destination IDs (see `schema/orcaMappings.ts` / firmware `OrcaMappings.h`).
export const GP2040_DIGITAL_DEST_LABELS: Record<number, Gp2040LabelPair> = {
  0: { label: 'B1', shortLabel: 'B1' }, // ORCA_A_BUTTON
  1: { label: 'B2', shortLabel: 'B2' }, // ORCA_B_BUTTON
  2: { label: 'B3', shortLabel: 'B3' }, // ORCA_X_BUTTON
  3: { label: 'B4', shortLabel: 'B4' }, // ORCA_Y_BUTTON
  4: { label: 'R1', shortLabel: 'R1' }, // ORCA_Z_BUTTON
  5: { label: 'L2 (Full)', shortLabel: 'L2' }, // ORCA_L_BUTTON
  6: { label: 'R2 (Full)', shortLabel: 'R2' }, // ORCA_R_BUTTON
  7: { label: 'RS Left', shortLabel: 'RS⬅' }, // ORCA_C_LEFT
  8: { label: 'RS Right', shortLabel: 'RS➡' }, // ORCA_C_RIGHT
  9: { label: 'RS Up', shortLabel: 'RS⬆' }, // ORCA_C_UP
  10: { label: 'RS Down', shortLabel: 'RS⬇' }, // ORCA_C_DOWN
  11: { label: 'A1', shortLabel: 'A1' }, // ORCA_DPAD (bindable A1/Home; defaults OFF)
  12: { label: 'L1', shortLabel: 'L1' }, // ORCA_LIGHTSHIELD
  13: { label: 'S1', shortLabel: 'S1' }, // ORCA_WISDOM_BUTTON
  14: { label: 'System', shortLabel: 'SYS' }, // ORCA_COURAGE_BUTTON (reserved/locked)
  15: { label: 'S2', shortLabel: 'S2' }, // ORCA_POWER_BUTTON
};

export const GP2040_ANALOG_DEST_LABELS: Record<number, Gp2040LabelPair> = {
  0: { label: 'LS⬅', shortLabel: 'LS⬅' }, // ORCA_JOYSTICK_X_LEFT
  1: { label: 'LS➡', shortLabel: 'LS➡' }, // ORCA_JOYSTICK_X_RIGHT
  2: { label: 'LS⬆', shortLabel: 'LS⬆' }, // ORCA_JOYSTICK_Y_UP
  3: { label: 'LS⬇', shortLabel: 'LS⬇' }, // ORCA_JOYSTICK_Y_DOWN
  4: { label: 'RT', shortLabel: 'RT' }, // ORCA_TRIGGER_R
};

export const XBOX_DIGITAL_DEST_LABELS: Record<number, Gp2040LabelPair> = {
  0: { label: 'A', shortLabel: 'A' }, // ORCA_A_BUTTON
  1: { label: 'B', shortLabel: 'B' }, // ORCA_B_BUTTON
  2: { label: 'X', shortLabel: 'X' }, // ORCA_X_BUTTON
  3: { label: 'Y', shortLabel: 'Y' }, // ORCA_Y_BUTTON
  4: { label: 'RB', shortLabel: 'RB' }, // ORCA_Z_BUTTON
  5: { label: 'LT (Full)', shortLabel: 'LT' }, // ORCA_L_BUTTON
  6: { label: 'RT (Full)', shortLabel: 'RT' }, // ORCA_R_BUTTON
  7: { label: 'RS Left', shortLabel: 'RS⬅' }, // ORCA_C_LEFT
  8: { label: 'RS Right', shortLabel: 'RS➡' }, // ORCA_C_RIGHT
  9: { label: 'RS Up', shortLabel: 'RS⬆' }, // ORCA_C_UP
  10: { label: 'RS Down', shortLabel: 'RS⬇' }, // ORCA_C_DOWN
  11: { label: 'Guide', shortLabel: 'Guide' }, // ORCA_DPAD (bindable A1/Home; defaults OFF)
  12: { label: 'LB', shortLabel: 'LB' }, // ORCA_LIGHTSHIELD
  13: { label: 'View', shortLabel: 'View' }, // ORCA_WISDOM_BUTTON
  14: { label: 'System', shortLabel: 'SYS' }, // ORCA_COURAGE_BUTTON (reserved/locked)
  15: { label: 'Menu', shortLabel: 'Menu' }, // ORCA_POWER_BUTTON
};

export const XBOX_ANALOG_DEST_LABELS: Record<number, Gp2040LabelPair> = {
  0: { label: 'LS⬅', shortLabel: 'LS⬅' }, // ORCA_JOYSTICK_X_LEFT
  1: { label: 'LS➡', shortLabel: 'LS➡' }, // ORCA_JOYSTICK_X_RIGHT
  2: { label: 'LS⬆', shortLabel: 'LS⬆' }, // ORCA_JOYSTICK_Y_UP
  3: { label: 'LS⬇', shortLabel: 'LS⬇' }, // ORCA_JOYSTICK_Y_DOWN
  4: { label: 'RT (Analog)', shortLabel: 'RT' }, // ORCA_TRIGGER_R
};

export const SWITCH_DIGITAL_DEST_LABELS: Record<number, Gp2040LabelPair> = {
  0: { label: 'B', shortLabel: 'B' }, // ORCA_A_BUTTON
  1: { label: 'A', shortLabel: 'A' }, // ORCA_B_BUTTON
  2: { label: 'Y', shortLabel: 'Y' }, // ORCA_X_BUTTON
  3: { label: 'X', shortLabel: 'X' }, // ORCA_Y_BUTTON
  4: { label: 'R', shortLabel: 'R' }, // ORCA_Z_BUTTON
  5: { label: 'ZL (Full)', shortLabel: 'ZL' }, // ORCA_L_BUTTON
  6: { label: 'ZR (Full)', shortLabel: 'ZR' }, // ORCA_R_BUTTON
  7: { label: 'RS Left', shortLabel: 'RS⬅' }, // ORCA_C_LEFT
  8: { label: 'RS Right', shortLabel: 'RS➡' }, // ORCA_C_RIGHT
  9: { label: 'RS Up', shortLabel: 'RS⬆' }, // ORCA_C_UP
  10: { label: 'RS Down', shortLabel: 'RS⬇' }, // ORCA_C_DOWN
  11: { label: 'Home', shortLabel: 'Home' }, // ORCA_DPAD (bindable A1/Home; defaults OFF)
  12: { label: 'L', shortLabel: 'L' }, // ORCA_LIGHTSHIELD
  13: { label: '−', shortLabel: '−' }, // ORCA_WISDOM_BUTTON
  14: { label: 'System', shortLabel: 'SYS' }, // ORCA_COURAGE_BUTTON (reserved/locked)
  15: { label: '+', shortLabel: '+' }, // ORCA_POWER_BUTTON
};

export const SWITCH_ANALOG_DEST_LABELS: Record<number, Gp2040LabelPair> = {
  0: { label: 'LS⬅', shortLabel: 'LS⬅' }, // ORCA_JOYSTICK_X_LEFT
  1: { label: 'LS➡', shortLabel: 'LS➡' }, // ORCA_JOYSTICK_X_RIGHT
  2: { label: 'LS⬆', shortLabel: 'LS⬆' }, // ORCA_JOYSTICK_Y_UP
  3: { label: 'LS⬇', shortLabel: 'LS⬇' }, // ORCA_JOYSTICK_Y_DOWN
  4: { label: 'ZR (Analog)', shortLabel: 'ZR' }, // ORCA_TRIGGER_R
};

export const PLAYSTATION_DIGITAL_DEST_LABELS: Record<number, Gp2040LabelPair> = {
  0: { label: 'Cross', shortLabel: '✕' }, // ORCA_A_BUTTON
  1: { label: 'Circle', shortLabel: '○' }, // ORCA_B_BUTTON
  2: { label: 'Square', shortLabel: '□' }, // ORCA_X_BUTTON
  3: { label: 'Triangle', shortLabel: '△' }, // ORCA_Y_BUTTON
  4: { label: 'R1', shortLabel: 'R1' }, // ORCA_Z_BUTTON
  5: { label: 'L2 (Full)', shortLabel: 'L2' }, // ORCA_L_BUTTON
  6: { label: 'R2 (Full)', shortLabel: 'R2' }, // ORCA_R_BUTTON
  7: { label: 'RS Left', shortLabel: 'RS⬅' }, // ORCA_C_LEFT
  8: { label: 'RS Right', shortLabel: 'RS➡' }, // ORCA_C_RIGHT
  9: { label: 'RS Up', shortLabel: 'RS⬆' }, // ORCA_C_UP
  10: { label: 'RS Down', shortLabel: 'RS⬇' }, // ORCA_C_DOWN
  11: { label: 'PS', shortLabel: 'PS' }, // ORCA_DPAD (bindable A1/Home; defaults OFF)
  12: { label: 'L1', shortLabel: 'L1' }, // ORCA_LIGHTSHIELD
  13: { label: 'Share', shortLabel: 'Share' }, // ORCA_WISDOM_BUTTON
  14: { label: 'System', shortLabel: 'SYS' }, // ORCA_COURAGE_BUTTON (reserved/locked)
  15: { label: 'Options', shortLabel: 'Opt' }, // ORCA_POWER_BUTTON
};

export const PLAYSTATION_ANALOG_DEST_LABELS: Record<number, Gp2040LabelPair> = {
  0: { label: 'LS⬅', shortLabel: 'LS⬅' }, // ORCA_JOYSTICK_X_LEFT
  1: { label: 'LS➡', shortLabel: 'LS➡' }, // ORCA_JOYSTICK_X_RIGHT
  2: { label: 'LS⬆', shortLabel: 'LS⬆' }, // ORCA_JOYSTICK_Y_UP
  3: { label: 'LS⬇', shortLabel: 'LS⬇' }, // ORCA_JOYSTICK_Y_DOWN
  4: { label: 'R2 (Analog)', shortLabel: 'R2' }, // ORCA_TRIGGER_R
};

export type Gp2040DestinationLabelSet = {
  digital: Record<number, Gp2040LabelPair>;
  analog: Record<number, Gp2040LabelPair>;
};

export const GP2040_DEST_LABEL_SETS: Record<Gp2040LabelPreset, Gp2040DestinationLabelSet> = {
  gp2040: { digital: GP2040_DIGITAL_DEST_LABELS, analog: GP2040_ANALOG_DEST_LABELS },
  xbox: { digital: XBOX_DIGITAL_DEST_LABELS, analog: XBOX_ANALOG_DEST_LABELS },
  switch: { digital: SWITCH_DIGITAL_DEST_LABELS, analog: SWITCH_ANALOG_DEST_LABELS },
  playstation: { digital: PLAYSTATION_DIGITAL_DEST_LABELS, analog: PLAYSTATION_ANALOG_DEST_LABELS },
};

export function getGp2040DestinationLabelSet(preset: Gp2040LabelPreset | undefined): Gp2040DestinationLabelSet {
  if (!preset) return GP2040_DEST_LABEL_SETS.gp2040;
  return GP2040_DEST_LABEL_SETS[preset] ?? GP2040_DEST_LABEL_SETS.gp2040;
}
