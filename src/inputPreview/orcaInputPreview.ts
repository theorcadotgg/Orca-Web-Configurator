import { ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT, ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT, OrcaSettingsTlv } from '@shared/orca_config_idl_generated';
import { readF32Le, readU16Le, readU32Le } from '../schema/bytes';
import type { SettingsDraft, StickCurveParamsV1, TriggerPolicyV1 } from '../schema/settingsBlob';
import { TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT, TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP } from '../schema/triggerPolicyFlags';
import type { OrcaInputState } from '../usb/OrcaTransport';

const ORCA_ANALOG_MAPPING_DISABLED = 0xff;

const ORCA_JOYSTICK_X_LEFT = 0;
const ORCA_JOYSTICK_X_RIGHT = 1;
const ORCA_JOYSTICK_Y_UP = 2;
const ORCA_JOYSTICK_Y_DOWN = 3;
const ORCA_TRIGGER_R_ANALOG = 4;

const ORCA_L_BUTTON = 5;
const ORCA_R_BUTTON = 6;
const ORCA_LIGHTSHIELD = 12;

type TlvInfo = {
  type: number;
  length: number;
  stride: number;
  offset0: number;
};

export type RangeCalibration = {
  lower: number[]; // [5]
  upper: number[]; // [5]
};

export type InputPreviewResult = {
  raw: OrcaInputState;
  rangeCalibratedAnalog: number[]; // [5], 0..1
  curvedAnalog: number[]; // [5], typically 0..~1.2
  mappedAnalog: number[]; // [5]
  mappedDigitalMask: number;
  joystick: {
    x: number;   // right-left
    y: number;   // up-down
    x01: number; // scaled to 0..1 (firmware semantics)
    y01: number;
    magnitude: number;
  };
  triggers: {
    l: number; // 0..1
    r: number; // 0..1
  };
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function scale(i: number, min: number, max: number, newMin: number, newMax: number): number {
  if (min === max) return (newMin + newMax) / 2;
  return ((i - min) * (newMax - newMin)) / (max - min) + newMin;
}

function readTlvData(blob: Uint8Array, tlv: TlvInfo): Uint8Array | null {
  const off = tlv.offset0;
  if (off + 4 + tlv.length > blob.length) return null;
  const gotType = readU16Le(blob, off);
  const gotLen = readU16Le(blob, off + 2);
  if (gotType !== tlv.type || gotLen !== tlv.length) return null;
  return blob.slice(off + 4, off + 4 + tlv.length);
}

export function tryParseRangeCalibration(blob: Uint8Array): RangeCalibration | null {
  const data = readTlvData(blob, OrcaSettingsTlv.RangeCalibration satisfies TlvInfo);
  if (!data) return null;
  if (data.length !== OrcaSettingsTlv.RangeCalibration.length) return null;

  const size = readU32Le(data, 0);
  if (size !== ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT) return null;

  const lower: number[] = [];
  const upper: number[] = [];
  for (let i = 0; i < ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT; i++) {
    lower.push(readF32Le(data, 4 + i * 8));
    upper.push(readF32Le(data, 4 + i * 8 + 4));
  }
  return { lower, upper };
}

function applyRangeCalibration(analog: number[], rc: RangeCalibration | null): number[] {
  const out: number[] = [];
  for (let i = 0; i < ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT; i++) {
    const v = analog[i] ?? 0;
    const lower = rc?.lower[i] ?? 0;
    const upper = rc?.upper[i] ?? 1;
    out.push(clamp01(scale(v, lower, upper, 0, 1)));
  }
  return out;
}

function applyStickCurve(analog: number[], params: StickCurveParamsV1 | undefined): number[] {
  if (!params) return analog.slice(0, ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT);

  const out = analog.slice(0, ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT);
  const notchStartInput = params.notch_start_input;
  const notchEndInput = params.notch_end_input;

  // Matches Orca-NewOrca/src/Calibration/UnifiedCalibration/UnifiedCalibration.c
  for (let i = 0; i < ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT; i++) {
    let value = out[i] ?? 0;
    const range = params.range[i] ?? 0;
    const dzLower = params.dz_lower[i] ?? 0;
    const dzUpper = params.dz_upper[i] ?? 0;
    const notch = params.notch[i] ?? 0;

    const points = [
      { input: 0.0, output: 0.0 },                                // Start
      { input: 0.0 + (dzLower * range), output: 0.0 },            // StartDeadzone
      { input: notchStartInput, output: notch },                  // NotchStart
      { input: notchEndInput, output: notch + (3.0 / 128.0) },    // NotchEnd
      { input: 1.0 - (dzUpper * range), output: 100.0 / 128.0 },  // EndDeadzone (intentional: matches firmware)
      { input: 1.0, output: range },                              // End
    ];

    for (let j = 1; j < points.length; j++) {
      const start = points[j - 1]!;
      const end = points[j]!;
      if (value > end.input) continue;
      value = scale(value, start.input, end.input, start.output, end.output);
      break;
    }

    out[i] = value;
  }

  return out;
}

function applyAnalogMapping(analog: number[], mapping: number[] | undefined): number[] {
  const out: number[] = new Array(ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT).fill(0);
  for (let dest = 0; dest < ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT; dest++) {
    const src = mapping?.[dest] ?? dest;
    if (src === ORCA_ANALOG_MAPPING_DISABLED) {
      out[dest] = 0;
    } else if (src >= 0 && src < ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT) {
      out[dest] = analog[src] ?? 0;
    } else {
      out[dest] = analog[dest] ?? 0;
    }
  }
  return out;
}

function applyDigitalMapping(digitalMask: number, mapping: number[] | undefined): number {
  let out = 0;
  for (let dest = 0; dest < ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT; dest++) {
    const src = mapping?.[dest] ?? dest;
    if (src < 0 || src >= ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT) continue;
    if (((digitalMask >>> src) & 1) !== 0) {
      out |= 1 << dest;
    }
  }
  return out >>> 0;
}

function computeTriggers(mappedDigitalMask: number, mappedAnalog: number[], policy: TriggerPolicyV1 | undefined): { l: number; r: number } {
  const analogMax = policy?.analogRangeMax ?? (200 / 255);
  const digitalFull = policy?.digitalFullPress ?? (200 / 255);
  const digitalLight = policy?.digitalLightshield ?? (49 / 255);
  const flags = policy?.flags ?? 0;
  const analogToLt = (flags & TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT) !== 0;
  const clampAnalogToLightshield = (flags & TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP) !== 0;

  const lPressed = ((mappedDigitalMask >>> ORCA_L_BUTTON) & 1) !== 0;
  const lightshieldPressed = ((mappedDigitalMask >>> ORCA_LIGHTSHIELD) & 1) !== 0;
  const rPressed = ((mappedDigitalMask >>> ORCA_R_BUTTON) & 1) !== 0;

  const digitalL = lPressed ? digitalFull : lightshieldPressed ? digitalLight : 0;
  const digitalR = rPressed ? digitalFull : 0;
  let analogTrigger = clamp01(mappedAnalog[ORCA_TRIGGER_R_ANALOG] ?? 0) * clamp01(analogMax);
  if (clampAnalogToLightshield && analogTrigger > digitalLight) {
    analogTrigger = digitalLight;
  }

  let l = analogToLt ? analogTrigger : digitalL;
  let r = analogToLt ? digitalR : analogTrigger;
  if (analogToLt) {
    if (digitalL > 0) l = digitalL;
  } else if (digitalR > 0) {
    r = digitalR;
  }

  return { l: clamp01(l), r: clamp01(r) };
}

export function computeInputPreview(raw: OrcaInputState, draft: SettingsDraft, baseBlob: Uint8Array): InputPreviewResult {
  const profile = draft.activeProfile ?? 0;
  const rangeCal = tryParseRangeCalibration(baseBlob);

  const rangeCalibratedAnalog = applyRangeCalibration(raw.analog, rangeCal);
  const curveParams = draft.stickCurveParams[profile] ?? draft.stickCurveParams[0];
  const curvedAnalog = applyStickCurve(rangeCalibratedAnalog, curveParams);

  const analogMapping = draft.analogMappings[profile] ?? draft.analogMappings[0];
  const mappedAnalog = applyAnalogMapping(curvedAnalog, analogMapping);

  const digitalMapping = draft.digitalMappings[profile] ?? draft.digitalMappings[0];
  const mappedDigitalMask = applyDigitalMapping(raw.digitalMask, digitalMapping);

  const x = (mappedAnalog[ORCA_JOYSTICK_X_RIGHT] ?? 0) - (mappedAnalog[ORCA_JOYSTICK_X_LEFT] ?? 0);
  const y = (mappedAnalog[ORCA_JOYSTICK_Y_UP] ?? 0) - (mappedAnalog[ORCA_JOYSTICK_Y_DOWN] ?? 0);
  const x01 = scale(x, -1, 1, 0, 1);
  const y01 = scale(y, -1, 1, 0, 1);
  const magnitude = Math.sqrt(x * x + y * y);

  const policy = draft.triggerPolicy[profile] ?? draft.triggerPolicy[0];
  const triggers = computeTriggers(mappedDigitalMask, mappedAnalog, policy);

  return {
    raw,
    rangeCalibratedAnalog,
    curvedAnalog,
    mappedAnalog,
    mappedDigitalMask,
    joystick: { x, y, x01, y01, magnitude },
    triggers,
  };
}
