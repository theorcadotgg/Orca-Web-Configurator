export type Gp2040InputModeOption = {
  value: number;
  label: string;
  group: Gp2040InputModeGroupId;
};

export type Gp2040InputModeGroupId = 'common' | 'legacy' | 'specialized';

export type Gp2040InputModeGroup = {
  id: Gp2040InputModeGroupId;
  label: string;
  options: Gp2040InputModeOption[];
};

export const DEFAULT_GP2040_INPUT_MODE = 0;
export const GP2040_KEYBOARD_INPUT_MODE = 3;

export const ALL_GP2040_INPUT_MODE_OPTIONS: Gp2040InputModeOption[] = [
  { value: 0, label: 'XInput', group: 'common' },
  { value: 1, label: 'Nintendo Switch', group: 'common' },
  { value: 2, label: 'PS3', group: 'common' },
  { value: 3, label: 'Keyboard', group: 'common' },
  { value: 14, label: 'Generic HID', group: 'common' },
  { value: 4, label: 'PS4', group: 'specialized' },
  { value: 13, label: 'PS5', group: 'specialized' },
  { value: 5, label: 'Xbox One', group: 'specialized' },
  { value: 15, label: 'Nintendo Switch Pro', group: 'specialized' },
  { value: 16, label: 'P5General', group: 'specialized' },
  { value: 6, label: 'Sega Genesis/MegaDrive Mini', group: 'legacy' },
  { value: 7, label: 'NEOGEO mini', group: 'legacy' },
  { value: 8, label: 'PC Engine/Turbografx 16 Mini', group: 'legacy' },
  { value: 9, label: 'EGRET II mini', group: 'legacy' },
  { value: 10, label: 'ASTROCITY Mini', group: 'legacy' },
  { value: 11, label: 'PlayStation Classic', group: 'legacy' },
  { value: 12, label: 'Original Xbox', group: 'legacy' },
];

export const GP2040_INPUT_MODE_OPTIONS = ALL_GP2040_INPUT_MODE_OPTIONS.filter(
  (option) => option.value !== GP2040_KEYBOARD_INPUT_MODE,
);

const GP2040_INPUT_MODE_LABELS = new Map(ALL_GP2040_INPUT_MODE_OPTIONS.map((option) => [option.value, option.label]));
const GP2040_SELECTABLE_INPUT_MODE_VALUES = new Set(GP2040_INPUT_MODE_OPTIONS.map((option) => option.value));
const GP2040_INPUT_MODE_GROUP_LABELS: Record<Gp2040InputModeGroupId, string> = {
  common: 'Common',
  specialized: 'Specialized / Auth-Dependent',
  legacy: 'Legacy / Mini Consoles',
};

export const GP2040_INPUT_MODE_GROUPS: Gp2040InputModeGroup[] = (Object.keys(GP2040_INPUT_MODE_GROUP_LABELS) as Gp2040InputModeGroupId[])
  .map((groupId) => ({
    id: groupId,
    label: GP2040_INPUT_MODE_GROUP_LABELS[groupId],
    options: GP2040_INPUT_MODE_OPTIONS.filter((option) => option.group === groupId),
  }))
  .filter((group) => group.options.length > 0);

export function isGp2040PersistableInputMode(value: number): boolean {
  return GP2040_INPUT_MODE_LABELS.has(value);
}

export function isGp2040SelectableInputMode(value: number): boolean {
  return GP2040_SELECTABLE_INPUT_MODE_VALUES.has(value);
}

export function getGp2040InputModeLabel(value: number): string {
  return GP2040_INPUT_MODE_LABELS.get(value) ?? `Unknown (${value})`;
}
