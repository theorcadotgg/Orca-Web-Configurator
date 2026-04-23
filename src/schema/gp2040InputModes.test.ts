import { describe, expect, it } from 'vitest';
import {
  ALL_GP2040_INPUT_MODE_OPTIONS,
  getGp2040InputModeLabel,
  GP2040_INPUT_MODE_GROUPS,
  GP2040_INPUT_MODE_OPTIONS,
  isGp2040SelectableInputMode,
  isGp2040PersistableInputMode,
} from './gp2040InputModes';

describe('gp2040 input mode options', () => {
  it('keeps all persistable GP2040 input modes, but hides keyboard from Orca selection UI', () => {
    expect(ALL_GP2040_INPUT_MODE_OPTIONS).toHaveLength(17);
    expect(GP2040_INPUT_MODE_OPTIONS).toHaveLength(16);
    expect(isGp2040PersistableInputMode(0)).toBe(true);
    expect(isGp2040PersistableInputMode(3)).toBe(true);
    expect(isGp2040PersistableInputMode(16)).toBe(true);
    expect(isGp2040SelectableInputMode(3)).toBe(false);
    expect(isGp2040SelectableInputMode(16)).toBe(true);
    expect(isGp2040PersistableInputMode(255)).toBe(false);
  });

  it('returns stable labels for supported and unknown values', () => {
    expect(getGp2040InputModeLabel(3)).toBe('Keyboard');
    expect(getGp2040InputModeLabel(15)).toBe('Nintendo Switch Pro');
    expect(getGp2040InputModeLabel(255)).toBe('Unknown (255)');
  });

  it('groups modes for a more readable configurator UI', () => {
    expect(GP2040_INPUT_MODE_GROUPS.map((group) => group.label)).toEqual([
      'Common',
      'Specialized / Auth-Dependent',
      'Legacy / Mini Consoles',
    ]);
    expect(GP2040_INPUT_MODE_GROUPS[0]?.options.map((option) => option.label)).toContain('XInput');
    expect(GP2040_INPUT_MODE_GROUPS[1]?.options.map((option) => option.label)).toContain('P5General');
    expect(GP2040_INPUT_MODE_GROUPS[2]?.options.map((option) => option.label)).toContain('NEOGEO mini');
  });
});
