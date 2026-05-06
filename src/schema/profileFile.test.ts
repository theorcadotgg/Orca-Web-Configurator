import { OrcaSettingsTlv } from '@shared/orca_config_idl_generated';
import { describe, expect, it } from 'vitest';
import { STICK_CURVE_FLAG_DISABLE_NOTCHES, type DpadLayerV1, type StickCurveParamsV1, type TriggerPolicyV1 } from './settingsBlob';
import { ORCA_DUMMY_FIELD } from './orcaMappings';
import { ORCA_PROFILE_FILE_TYPE, ORCA_PROFILE_FILE_VERSION, parseProfileFileV1, serializeProfileFileV1, type OrcaProfileFileV1 } from './profileFile';

function makeDpadLayer(): DpadLayerV1 {
  const none = { type: 0, index: 0, threshold: 0, hysteresis: 0 };
  return {
    mode_up: 0,
    mode_down: 0,
    mode_left: 0,
    mode_right: 0,
    enable: none,
    up: none,
    down: none,
    left: none,
    right: none,
  };
}

function makeTriggerPolicy(): TriggerPolicyV1 {
  return {
    analogRangeMax: 1,
    digitalFullPress: 1,
    digitalLightshield: 0.5,
    flags: 0,
    digitalLightLtSrc: 0,
    digitalLightRtSrc: 0,
    digitalLightSrcVersion: 0,
  };
}

function makeStickCurveParams(): StickCurveParamsV1 {
  return {
    size: 5,
    range: [100 / 128, 100 / 128, 100 / 128, 100 / 128, 1],
    notch: [35 / 128, 35 / 128, 35 / 128, 35 / 128, 49 / 200],
    dz_lower: [0, 0, 0, 0, 0],
    dz_upper: [0, 0, 0, 0, 0],
    notch_start_input: 16 / 128,
    notch_end_input: 40 / 128,
    flags: STICK_CURVE_FLAG_DISABLE_NOTCHES,
  };
}

describe('profile files', () => {
  it('round-trips the disabled notches stick curve flag', () => {
    const file: OrcaProfileFileV1 = {
      type: ORCA_PROFILE_FILE_TYPE,
      version: ORCA_PROFILE_FILE_VERSION,
      mode: 'orca',
      label: 'Linear profile',
      digitalMapping: Array.from({ length: OrcaSettingsTlv.DigitalMappings.length }, (_, i) => i),
      analogMapping: Array.from({ length: OrcaSettingsTlv.AnalogMappings.length }, (_, i) => i),
      gp2040ExtraMappings: { l3Src: ORCA_DUMMY_FIELD, r3Src: ORCA_DUMMY_FIELD },
      dpadLayer: makeDpadLayer(),
      triggerPolicy: makeTriggerPolicy(),
      stickCurveParams: makeStickCurveParams(),
    };

    const parsed = parseProfileFileV1(serializeProfileFileV1(file));

    expect(parsed.stickCurveParams.flags & STICK_CURVE_FLAG_DISABLE_NOTCHES).toBe(STICK_CURVE_FLAG_DISABLE_NOTCHES);
  });
});
