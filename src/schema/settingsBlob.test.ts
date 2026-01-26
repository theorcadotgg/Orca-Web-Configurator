import { describe, expect, it } from 'vitest';
import { ORCA_CONFIG_SETTINGS_BLOB_SIZE, ORCA_CONFIG_SETTINGS_HEADER_ACTIVE_PROFILE_OFFSET, ORCA_CONFIG_SETTINGS_PROFILE_COUNT } from '@shared/orca_config_idl_generated';
import type { DigitalSourceV1, DpadLayerV1, SettingsDraft, StickCurveParamsV1, TriggerPolicyV1 } from './settingsBlob';
import { buildSettingsBlob } from './settingsBlob';
import { ANALOG_INPUTS, DIGITAL_INPUTS } from './orcaMappings';

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
    flags: 0,
  };
}

function makeTriggerPolicy(flags = 0): TriggerPolicyV1 {
  return {
    analogRangeMax: 1,
    digitalFullPress: 1,
    digitalLightshield: 0.5,
    flags,
    digitalLightLtSrc: 0,
    digitalLightRtSrc: 0,
    digitalLightSrcVersion: 0,
  };
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

function makeDraft(profileCount = ORCA_CONFIG_SETTINGS_PROFILE_COUNT): SettingsDraft {
  return {
    activeProfile: 5,
    profileLabels: Array.from({ length: profileCount }, (_, i) => `Profile ${i + 1}`),
    digitalMappings: Array.from({ length: profileCount }, () => Array.from({ length: DIGITAL_INPUTS.length }, (_, i) => i)),
    analogMappings: Array.from({ length: profileCount }, () => Array.from({ length: ANALOG_INPUTS.length }, (_, i) => i)),
    dpadLayer: Array.from({ length: profileCount }, () => makeDpadLayer()),
    triggerPolicy: Array.from({ length: profileCount }, () => makeTriggerPolicy()),
    stickCurveParams: Array.from({ length: profileCount }, () => makeStickParams()),
  };
}

describe('buildSettingsBlob', () => {
  it('forces header ActiveProfile to 0 (UI selection is not persisted)', () => {
    const base = new Uint8Array(ORCA_CONFIG_SETTINGS_BLOB_SIZE);
    base[ORCA_CONFIG_SETTINGS_HEADER_ACTIVE_PROFILE_OFFSET] = 7;

    const staged = buildSettingsBlob(base, makeDraft());
    expect(staged[ORCA_CONFIG_SETTINGS_HEADER_ACTIVE_PROFILE_OFFSET]).toBe(0);
    expect(base[ORCA_CONFIG_SETTINGS_HEADER_ACTIVE_PROFILE_OFFSET]).toBe(7);
  });
});

