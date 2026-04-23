import { describe, expect, it } from 'vitest';
import {
  getGp2040InputModeLabel,
  GP2040_INPUT_MODE_OPTIONS,
  isGp2040PersistableInputMode,
} from './gp2040InputModes';

describe('gp2040 input mode options', () => {
  it('exposes all persistable GP2040 input modes except config mode', () => {
    expect(GP2040_INPUT_MODE_OPTIONS).toHaveLength(17);
    expect(isGp2040PersistableInputMode(0)).toBe(true);
    expect(isGp2040PersistableInputMode(16)).toBe(true);
    expect(isGp2040PersistableInputMode(255)).toBe(false);
  });

  it('returns stable labels for supported and unknown values', () => {
    expect(getGp2040InputModeLabel(15)).toBe('Nintendo Switch Pro');
    expect(getGp2040InputModeLabel(255)).toBe('Unknown (255)');
  });
});
