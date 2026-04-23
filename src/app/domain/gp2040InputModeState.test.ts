import { describe, expect, it } from 'vitest';
import {
  createEmptyGp2040InputModeState,
  setAppliedGp2040InputMode,
  setGp2040InputModeBusy,
  setGp2040InputModeDraft,
  setGp2040InputModeError,
  setLoadedGp2040InputMode,
} from './gp2040InputModeState';

describe('gp2040 input mode state helpers', () => {
  it('loads the device mode into current and draft state', () => {
    const state = setLoadedGp2040InputMode(createEmptyGp2040InputModeState(), {
      inputMode: 4,
      usingDefaults: false,
    });

    expect(state).toEqual({
      current: 4,
      draft: 4,
      usingDefaults: false,
      dirty: false,
      busy: false,
      error: '',
    });
  });

  it('marks the draft dirty when it diverges from the saved mode', () => {
    const loaded = setLoadedGp2040InputMode(createEmptyGp2040InputModeState(), {
      inputMode: 0,
      usingDefaults: true,
    });
    const updated = setGp2040InputModeDraft(loaded, 2);

    expect(updated.draft).toBe(2);
    expect(updated.dirty).toBe(true);
    expect(updated.usingDefaults).toBe(true);
  });

  it('clears busy and error state after a successful apply', () => {
    const loaded = setLoadedGp2040InputMode(createEmptyGp2040InputModeState(), {
      inputMode: 0,
      usingDefaults: true,
    });
    const busy = setGp2040InputModeBusy(setGp2040InputModeDraft(loaded, 13), true);
    const applied = setAppliedGp2040InputMode(busy, 13);

    expect(applied).toEqual({
      current: 13,
      draft: 13,
      usingDefaults: false,
      dirty: false,
      busy: false,
      error: '',
    });
  });

  it('stores panel-local errors without changing the selected draft', () => {
    const loaded = setLoadedGp2040InputMode(createEmptyGp2040InputModeState(), {
      inputMode: 1,
      usingDefaults: false,
    });
    const busy = setGp2040InputModeBusy(setGp2040InputModeDraft(loaded, 4), true);
    const errored = setGp2040InputModeError(busy, 'Connected firmware does not expose GP2040 input mode.');

    expect(errored.busy).toBe(false);
    expect(errored.error).toContain('does not expose');
    expect(errored.draft).toBe(4);
  });
});
