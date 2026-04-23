export type Gp2040InputModeOption = {
  value: number;
  label: string;
};

export const DEFAULT_GP2040_INPUT_MODE = 0;

export const GP2040_INPUT_MODE_OPTIONS: Gp2040InputModeOption[] = [
  { value: 0, label: 'XInput' },
  { value: 1, label: 'Nintendo Switch' },
  { value: 2, label: 'PS3' },
  { value: 3, label: 'Keyboard' },
  { value: 4, label: 'PS4' },
  { value: 5, label: 'Xbox One' },
  { value: 6, label: 'Sega Genesis/MegaDrive Mini' },
  { value: 7, label: 'NEOGEO mini' },
  { value: 8, label: 'PC Engine/Turbografx 16 Mini' },
  { value: 9, label: 'EGRET II mini' },
  { value: 10, label: 'ASTROCITY Mini' },
  { value: 11, label: 'PlayStation Classic' },
  { value: 12, label: 'Original Xbox' },
  { value: 13, label: 'PS5' },
  { value: 14, label: 'Generic HID' },
  { value: 15, label: 'Nintendo Switch Pro' },
  { value: 16, label: 'P5General' },
];

const GP2040_INPUT_MODE_LABELS = new Map(GP2040_INPUT_MODE_OPTIONS.map((option) => [option.value, option.label]));

export function isGp2040PersistableInputMode(value: number): boolean {
  return GP2040_INPUT_MODE_LABELS.has(value);
}

export function getGp2040InputModeLabel(value: number): string {
  return GP2040_INPUT_MODE_LABELS.get(value) ?? `Unknown (${value})`;
}
