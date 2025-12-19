import { describe, expect, it } from 'vitest';
import type { DpadLayerV1, DigitalSourceV1, SettingsDraft, StickCurveParamsV1, TriggerPolicyV1 } from '../../schema/settingsBlob';
import {
  ANALOG_INPUTS,
  DIGITAL_INPUTS,
  DPAD_UP_VIRTUAL_DEST,
  ORCA_ANALOG_MAPPING_DISABLED,
  ORCA_DUMMY_FIELD,
  isLockedDigitalDestination,
} from '../../schema/orcaMappings';
import { TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT } from '../../schema/triggerPolicyFlags';
import {
  applyImportedProfileToDraft,
  clearAllBindingsInDraft,
  getDefaultAnalogMapping,
  getDefaultDigitalMapping,
  getGp2040AnalogTriggerRouting,
  renameProfileInDraft,
  resetToDefaultBindingsInDraft,
  setAnalogMappingInDraft,
  setDigitalMappingInDraft,
} from './draftMutations';

function digital(index: number): DigitalSourceV1 {
  return { type: 1, index, threshold: 0, hysteresis: 0 };
}

function makeStickParams(): StickCurveParamsV1 {
  return {
    size: 1,
    range: [1, 1, 1, 1, 1],
    notch: [0.2, 0.2, 0.2, 0.2, 0.2],
    dz_lower: [0, 0, 0, 0, 0],
    dz_upper: [1, 1, 1, 1, 1],
    notch_start_input: 0,
    notch_end_input: 1,
  };
}

function makeTriggerPolicy(flags = 0): TriggerPolicyV1 {
  return { analogRangeMax: 1, digitalFullPress: 1, digitalLightshield: 0.5, flags };
}

function makeDpadLayer(): DpadLayerV1 {
  return {
    mode_up: 0,
    mode_down: 0,
    mode_left: 0,
    mode_right: 0,
    enable: digital(11),
    up: digital(9),
    down: digital(10),
    left: digital(7),
    right: digital(8),
  };
}

function makeDraft(profileCount = 1): SettingsDraft {
  return {
    activeProfile: 0,
    profileLabels: Array.from({ length: profileCount }, (_, i) => `Profile ${i + 1}`),
    digitalMappings: Array.from({ length: profileCount }, () =>
      Array.from({ length: DIGITAL_INPUTS.length }, (_, i) => i),
    ),
    analogMappings: Array.from({ length: profileCount }, () =>
      Array.from({ length: ANALOG_INPUTS.length }, (_, i) => i),
    ),
    dpadLayer: Array.from({ length: profileCount }, () => makeDpadLayer()),
    triggerPolicy: Array.from({ length: profileCount }, () => makeTriggerPolicy()),
    stickCurveParams: Array.from({ length: profileCount }, () => makeStickParams()),
  };
}

describe('getDefaultDigitalMapping', () => {
  it('returns identity mapping for orca', () => {
    expect(getDefaultDigitalMapping('orca')).toEqual(Array.from({ length: DIGITAL_INPUTS.length }, (_, i) => i));
  });

  it('applies gp2040 overrides', () => {
    const mapping = getDefaultDigitalMapping('gp2040');
    expect(mapping).toHaveLength(DIGITAL_INPUTS.length);
    expect(mapping[11]).toBe(12);
    expect(mapping[12]).toBe(ORCA_DUMMY_FIELD);
  });
});

describe('renameProfileInDraft', () => {
  it('trims non-empty names', () => {
    const draft = makeDraft();
    const updated = renameProfileInDraft(draft, 0, '  My Profile  ');
    expect(updated.profileLabels[0]).toBe('My Profile');
  });

  it('falls back to default name when empty', () => {
    const draft = makeDraft();
    const updated = renameProfileInDraft(draft, 0, '   ');
    expect(updated.profileLabels[0]).toBe('Profile 1');
  });
});

describe('setDigitalMappingInDraft', () => {
  it('swaps destinations to preserve uniqueness (normal mapping)', () => {
    const draft = makeDraft();
    const defaultDigitalMapping = getDefaultDigitalMapping('orca');
    const updated = setDigitalMappingInDraft(draft, { dest: 0, src: 1, defaultDigitalMapping });
    expect(updated.digitalMappings[0]?.[0]).toBe(1);
    expect(updated.digitalMappings[0]?.[1]).toBe(0);
  });

  it('binds virtual DPAD destination and repurposes source output', () => {
    const draft = makeDraft();
    const defaultDigitalMapping = getDefaultDigitalMapping('orca');
    const updated = setDigitalMappingInDraft(draft, { dest: DPAD_UP_VIRTUAL_DEST, src: 0, defaultDigitalMapping });
    expect(updated.dpadLayer[0]?.mode_up).toBe(2);
    expect(updated.dpadLayer[0]?.up.type).toBe(1);
    expect(updated.dpadLayer[0]?.up.index).toBe(0);
    expect(updated.digitalMappings[0]?.[0]).toBe(ORCA_DUMMY_FIELD);
  });

  it('restores DPAD directions to default C-stick bindings when remapping a used source', () => {
    const draft = makeDraft();
    draft.dpadLayer[0] = { ...draft.dpadLayer[0], mode_up: 2, up: digital(0) };
    const defaultDigitalMapping = getDefaultDigitalMapping('orca');
    const updated = setDigitalMappingInDraft(draft, { dest: 1, src: 0, defaultDigitalMapping });
    expect(updated.dpadLayer[0]?.mode_up).toBe(1);
    expect(updated.dpadLayer[0]?.up.index).toBe(9);
  });
});

describe('setAnalogMappingInDraft', () => {
  it('swaps destinations to preserve uniqueness', () => {
    const draft = makeDraft();
    const defaultAnalogMapping = getDefaultAnalogMapping();
    const updated = setAnalogMappingInDraft(draft, { dest: 0, src: 1, defaultAnalogMapping, mode: 'orca' });
    expect(updated.analogMappings[0]?.[0]).toBe(1);
    expect(updated.analogMappings[0]?.[1]).toBe(0);
  });

  it('updates GP2040 analog trigger routing flag based on virtual destination', () => {
    const draft = makeDraft();
    const defaultAnalogMapping = getDefaultAnalogMapping();

    const toLt = setAnalogMappingInDraft(draft, {
      dest: 4,
      src: 4,
      defaultAnalogMapping,
      mode: 'gp2040',
      virtualDest: 254,
    });
    expect(toLt.triggerPolicy[0]?.flags & TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT).toBe(TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT);

    const toRt = setAnalogMappingInDraft(toLt, {
      dest: 4,
      src: 4,
      defaultAnalogMapping,
      mode: 'gp2040',
      virtualDest: 4,
    });
    expect(toRt.triggerPolicy[0]?.flags & TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT).toBe(0);
  });
});

describe('clear/reset bindings', () => {
  it('clears bindings while preserving locked destinations', () => {
    const draft = makeDraft();
    const updated = clearAllBindingsInDraft(draft);
    const digital = updated.digitalMappings[0] ?? [];
    for (let dest = 0; dest < digital.length; dest++) {
      expect(digital[dest]).toBe(isLockedDigitalDestination(dest) ? dest : ORCA_DUMMY_FIELD);
    }
    expect(updated.analogMappings[0]).toEqual(Array.from({ length: ANALOG_INPUTS.length }, () => ORCA_ANALOG_MAPPING_DISABLED));
  });

  it('resets to provided defaults', () => {
    const draft = makeDraft();
    const cleared = clearAllBindingsInDraft(draft);
    const defaultDigitalMapping = getDefaultDigitalMapping('orca');
    const defaultAnalogMapping = getDefaultAnalogMapping();
    const reset = resetToDefaultBindingsInDraft(cleared, { defaultDigitalMapping, defaultAnalogMapping });
    expect(reset.digitalMappings[0]).toEqual(defaultDigitalMapping);
    expect(reset.analogMappings[0]).toEqual(defaultAnalogMapping);
  });
});

describe('applyImportedProfileToDraft', () => {
  it('applies imported profile to a specific index', () => {
    const draft = makeDraft(2);
    const imported = {
      type: 'orca-profile',
      version: 2,
      mode: 'orca',
      label: 'Imported',
      digitalMapping: Array.from({ length: DIGITAL_INPUTS.length }, () => 0),
      analogMapping: Array.from({ length: ANALOG_INPUTS.length }, () => 0),
      dpadLayer: makeDpadLayer(),
      triggerPolicy: makeTriggerPolicy(1),
      stickCurveParams: makeStickParams(),
    } as const;

    const updated = applyImportedProfileToDraft(draft, 1, imported);
    expect(updated.profileLabels[1]).toBe('Imported');
    expect(updated.digitalMappings[1]).toEqual(imported.digitalMapping);
    expect(updated.triggerPolicy[1]?.flags).toBe(1);
    expect(updated.profileLabels[0]).toBe('Profile 1');
  });
});

describe('getGp2040AnalogTriggerRouting', () => {
  it('derives routing from triggerPolicy flags', () => {
    const draft = makeDraft();
    draft.triggerPolicy[0] = makeTriggerPolicy(TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT);
    expect(getGp2040AnalogTriggerRouting(draft, 0)).toBe('lt');
    draft.triggerPolicy[0] = makeTriggerPolicy(0);
    expect(getGp2040AnalogTriggerRouting(draft, 0)).toBe('rt');
  });
});
