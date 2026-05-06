import { ORCA_CONFIG_SETTINGS_BLOB_SIZE } from '@shared/orca_config_idl_generated';
import { describe, expect, it } from 'vitest';
import { computeInputPreview } from './orcaInputPreview';
import { STICK_CURVE_FLAG_DISABLE_NOTCHES, type DpadLayerV1, type SettingsDraft, type StickCurveParamsV1, type TriggerPolicyV1 } from '../schema/settingsBlob';

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

function makeStickCurveParams(flags = 0): StickCurveParamsV1 {
  return {
    size: 5,
    range: [100 / 128, 100 / 128, 100 / 128, 100 / 128, 1],
    notch: [35 / 128, 35 / 128, 35 / 128, 35 / 128, 49 / 200],
    dz_lower: [0, 0, 0, 0, 0],
    dz_upper: [0, 0, 0, 0, 0],
    notch_start_input: 16 / 128,
    notch_end_input: 40 / 128,
    flags,
  };
}

function makeDraft(curve: StickCurveParamsV1): SettingsDraft {
  return {
    activeProfile: 0,
    profileLabels: ['Default'],
    digitalMappings: [Array.from({ length: 17 }, (_, i) => i)],
    analogMappings: [Array.from({ length: 5 }, (_, i) => i)],
    gp2040ExtraMappings: [{ l3Src: 16, r3Src: 16 }],
    dpadLayer: [makeDpadLayer()],
    triggerPolicy: [makeTriggerPolicy()],
    stickCurveParams: [curve],
  };
}

describe('computeInputPreview stick curve', () => {
  it('keeps the notched curve by default', () => {
    const raw = { digitalMask: 0, analog: [12 / 128, 0, 0, 0, 0] };
    const result = computeInputPreview(raw, makeDraft(makeStickCurveParams()), new Uint8Array(ORCA_CONFIG_SETTINGS_BLOB_SIZE));

    expect(result.curvedAnalog[0]).toBeCloseTo(35 / 128, 6);
  });

  it('uses linear stick scaling when disabled notches is set', () => {
    const raw = { digitalMask: 0, analog: [12 / 128, 0, 0, 0, 0] };
    const result = computeInputPreview(
      raw,
      makeDraft(makeStickCurveParams(STICK_CURVE_FLAG_DISABLE_NOTCHES)),
      new Uint8Array(ORCA_CONFIG_SETTINGS_BLOB_SIZE),
    );

    expect(result.curvedAnalog[0]).toBeCloseTo((12 / 128) * (100 / 128), 6);
  });

  it('leaves trigger calibration unchanged when disabled notches is set', () => {
    const raw = { digitalMask: 0, analog: [0, 0, 0, 0, 20 / 128] };
    const defaultResult = computeInputPreview(raw, makeDraft(makeStickCurveParams()), new Uint8Array(ORCA_CONFIG_SETTINGS_BLOB_SIZE));
    const disabledResult = computeInputPreview(
      raw,
      makeDraft(makeStickCurveParams(STICK_CURVE_FLAG_DISABLE_NOTCHES)),
      new Uint8Array(ORCA_CONFIG_SETTINGS_BLOB_SIZE),
    );

    expect(disabledResult.curvedAnalog[4]).toBeCloseTo(defaultResult.curvedAnalog[4] ?? 0, 6);
    expect(disabledResult.curvedAnalog[4]).toBeCloseTo(49 / 200, 6);
  });
});
