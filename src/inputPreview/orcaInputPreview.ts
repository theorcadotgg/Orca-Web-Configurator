import { ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT, ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT, OrcaSettingsTlv } from '@shared/orca_config_idl_generated';
import { readF32Le, readU16Le, readU32Le } from '../schema/bytes';
import type { SettingsDraft, StickCurveParamsV1, TriggerPolicyV1 } from '../schema/settingsBlob';
import { STICK_CURVE_FLAG_CIRCLE_COORDS } from '../schema/settingsBlob';
import { TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT, TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP } from '../schema/triggerPolicyFlags';
import type { OrcaInputState } from '../usb/OrcaTransport';
import {
  getWasmProcessor,
  initWasmProcessor,
  UNIFIED_ANALOG_INPUT_COUNT,
  UNIFIED_DIGITAL_INPUT_COUNT,
  TRIGGER_POLICY_FLAG_ANALOG_TO_LT,
  TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP as WASM_TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP,
  STICK_CURVE_FLAG_CIRCLE_COORDS as WASM_STICK_CURVE_FLAG_CIRCLE_COORDS,
  UnifiedDigitalIndex,
  type WasmInputProcessor,
  type UnifiedOutputState,
  type MeleeOutputState,
} from '../wasm/WasmInputProcessor';

const ORCA_ANALOG_MAPPING_DISABLED = 0xff;

// WASM processor state
let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

/**
 * Initialize the WASM input processor.
 * Call this once at application startup.
 */
export async function initInputPreviewWasm(): Promise<boolean> {
  if (wasmInitialized) return true;

  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      try {
        await initWasmProcessor();
        wasmInitialized = true;
        console.log('[orcaInputPreview] WASM processor initialized');
      } catch (err) {
        console.error('[orcaInputPreview] WASM init failed:', err);
        wasmInitialized = false;
      }
    })();
  }

  await wasmInitPromise;
  return wasmInitialized;
}

/**
 * Check if WASM processor is ready.
 */
export function isWasmReady(): boolean {
  return wasmInitialized && getWasmProcessor().isReady();
}

const ORCA_JOYSTICK_X_LEFT = 0;
const ORCA_JOYSTICK_X_RIGHT = 1;
const ORCA_JOYSTICK_Y_UP = 2;
const ORCA_JOYSTICK_Y_DOWN = 3;
const ORCA_TRIGGER_R_ANALOG = 4;

const ORCA_L_BUTTON = 5;
const ORCA_R_BUTTON = 6;
const ORCA_LIGHTSHIELD = 12;
const ORCA_DUMMY_FIELD = ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT - 1;

const TRIGGER_POLICY_LIGHT_SRC_VERSION = 1;

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

/**
 * Apply polar/arc-based coordinate transformation.
 * Magnitude = max(|x|, |y|), angle preserved from atan2(y, x).
 * This creates an arc when blending between axes.
 * Expects input in [0, 1] range with 0.5 as center.
 */
function applyCircleCoordinates(x: number, y: number): { x: number; y: number } {
  // Convert from [0, 1] to [-1, 1] (center at 0)
  const xCentered = (x - 0.5) * 2.0;
  const yCentered = (y - 0.5) * 2.0;

  // Get magnitude as max of absolute values (how far the furthest axis is pressed)
  const absX = Math.abs(xCentered);
  const absY = Math.abs(yCentered);
  const magnitude = Math.max(absX, absY);

  // Get the angle from the ratio of x and y
  const angle = Math.atan2(yCentered, xCentered);

  // Convert back to cartesian using the magnitude and angle
  const xTransformed = magnitude * Math.cos(angle);
  const yTransformed = magnitude * Math.sin(angle);

  // Convert back to [0, 1]
  return {
    x: (xTransformed / 2.0) + 0.5,
    y: (yTransformed / 2.0) + 0.5,
  };
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

// Trigger-specific calibration constants (matches firmware)
const TRIGGER_DEADZONE_END_INPUT = 8.0 / 128.0;
const TRIGGER_NOTCH_INPUT = 12.0 / 128.0;
const TRIGGER_LIGHTSHIELD_END_INPUT = 40.0 / 128.0;
const TRIGGER_INDEX = 4;

/**
 * Apply trigger-specific calibration.
 * Matches Orca-NewOrca/src/Calibration/UnifiedCalibration/UnifiedCalibration.c applyTriggerCalibration
 *
 * Zones:
 * 1. Deadzone: 0 → 8/128 input, output 0 (flat)
 * 2. Ramp to notch: 8/128 → 12/128 input, ramp from 0 to notch
 * 3. Lightshield zone: 12/128 → 40/128 input, output notch (flat)
 * 4. Full press ramp: 40/128 → 1.0 input, ramp from notch to magnitude
 */
function applyTriggerCalibration(input: number, magnitude: number, notchValue: number): number {
  const value = clamp01(input);

  if (value < TRIGGER_DEADZONE_END_INPUT) {
    // Zone 1: Deadzone - output 0
    return 0;
  }

  if (value < TRIGGER_NOTCH_INPUT) {
    // Zone 2: Ramp from 0 to notch value (reaches notch at physical notch position)
    return scale(value, TRIGGER_DEADZONE_END_INPUT, TRIGGER_NOTCH_INPUT, 0, notchValue);
  }

  if (value < TRIGGER_LIGHTSHIELD_END_INPUT) {
    // Zone 3: Flat at notch value (lightshield zone)
    return notchValue;
  }

  // Zone 4: Ramp from notch to magnitude
  return scale(value, TRIGGER_LIGHTSHIELD_END_INPUT, 1.0, notchValue, magnitude);
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

    // Use trigger-specific calibration for index 4 (trigger)
    if (i === TRIGGER_INDEX) {
      out[i] = applyTriggerCalibration(value, range, notch);
      continue;
    }

    // Sticks use 6-point curve with prenotch/postnotch zones
    const points = [
      { input: 0.0, output: 0.0 },                                // Start
      { input: 0.0 + (dzLower * range), output: 0.0 },            // StartDeadzone
      { input: notchStartInput, output: notch },                  // NotchStart
      { input: notchEndInput, output: Math.min(range, notch + (4.0 / 128.0)) }, // NotchEnd
      { input: 1.0 - (dzUpper * range), output: range },          // EndDeadzone
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

function computeTriggers(
  rawDigitalMask: number,
  mappedDigitalMask: number,
  mappedAnalog: number[],
  policy: TriggerPolicyV1 | undefined,
): { l: number; r: number } {
  const analogMax = policy?.analogRangeMax ?? (200 / 255);
  const digitalFull = policy?.digitalFullPress ?? (200 / 255);
  const digitalLight = policy?.digitalLightshield ?? (49 / 255);
  const flags = policy?.flags ?? 0;
  const analogToLt = (flags & TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT) !== 0;
  const clampAnalogToLightshield = (flags & TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP) !== 0;

  const lPressed = ((mappedDigitalMask >>> ORCA_L_BUTTON) & 1) !== 0;
  const rPressed = ((mappedDigitalMask >>> ORCA_R_BUTTON) & 1) !== 0;

  // GP2040-only: light trigger sources are evaluated on raw physical inputs (independent of the main mapping).
  const lightSrcVersion = policy?.digitalLightSrcVersion ?? 0;
  let ltLightSrc = ORCA_LIGHTSHIELD;
  let rtLightSrc = ORCA_DUMMY_FIELD;
  if (lightSrcVersion === TRIGGER_POLICY_LIGHT_SRC_VERSION) {
    ltLightSrc = policy?.digitalLightLtSrc ?? ORCA_DUMMY_FIELD;
    rtLightSrc = policy?.digitalLightRtSrc ?? ORCA_DUMMY_FIELD;
  }
  if (ltLightSrc < 0 || ltLightSrc >= ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT) ltLightSrc = ORCA_DUMMY_FIELD;
  if (rtLightSrc < 0 || rtLightSrc >= ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT) rtLightSrc = ORCA_DUMMY_FIELD;

  const ltLightPressed = ((rawDigitalMask >>> ltLightSrc) & 1) !== 0;
  const rtLightPressed = ((rawDigitalMask >>> rtLightSrc) & 1) !== 0;

  const digitalL = lPressed ? digitalFull : ltLightPressed ? digitalLight : 0;
  const digitalR = rPressed ? digitalFull : rtLightPressed ? digitalLight : 0;
  let analogTrigger = clamp01(mappedAnalog[ORCA_TRIGGER_R_ANALOG] ?? 0) * clamp01(analogMax);
  if (clampAnalogToLightshield && analogTrigger > digitalLight) {
    analogTrigger = digitalLight;
  }

  let l = digitalL;
  let r = digitalR;
  if (analogToLt) {
    if (!lPressed) l = Math.max(l, analogTrigger);
  } else {
    if (!rPressed) r = Math.max(r, analogTrigger);
  }

  return { l: clamp01(l), r: clamp01(r) };
}

export function computeInputPreview(raw: OrcaInputState, draft: SettingsDraft, baseBlob: Uint8Array): InputPreviewResult {
  const profile = draft.activeProfile ?? 0;
  const rangeCal = tryParseRangeCalibration(baseBlob);

  const rangeCalibratedAnalog = applyRangeCalibration(raw.analog, rangeCal);

  // Apply analog mapping BEFORE stick curve so that calibration parameters
  // (range, notch, deadzone) are applied based on destination role, not physical source.
  // This matches firmware behavior for remapped inputs (e.g., trigger used as directional).
  const analogMapping = draft.analogMappings[profile] ?? draft.analogMappings[0];
  const mappedAnalog = applyAnalogMapping(rangeCalibratedAnalog, analogMapping);

  const curveParams = draft.stickCurveParams[profile] ?? draft.stickCurveParams[0];
  const curvedAnalog = applyStickCurve(mappedAnalog, curveParams);

  const digitalMapping = draft.digitalMappings[profile] ?? draft.digitalMappings[0];
  const mappedDigitalMask = applyDigitalMapping(raw.digitalMask, digitalMapping);

  let x = (curvedAnalog[ORCA_JOYSTICK_X_RIGHT] ?? 0) - (curvedAnalog[ORCA_JOYSTICK_X_LEFT] ?? 0);
  let y = (curvedAnalog[ORCA_JOYSTICK_Y_UP] ?? 0) - (curvedAnalog[ORCA_JOYSTICK_Y_DOWN] ?? 0);

  // Scale to [0, 1] first (matches firmware order)
  let x01 = scale(x, -1, 1, 0, 1);
  let y01 = scale(y, -1, 1, 0, 1);

  // Apply circle coordinates transformation if enabled (after scaling to [0, 1])
  const curveFlags = curveParams?.flags ?? 0;
  if (curveFlags & STICK_CURVE_FLAG_CIRCLE_COORDS) {
    const transformed = applyCircleCoordinates(x01, y01);
    x01 = transformed.x;
    y01 = transformed.y;
    // Update x, y to reflect transformed values for magnitude calculation
    x = (x01 - 0.5) * 2.0;
    y = (y01 - 0.5) * 2.0;
  }

  const magnitude = Math.sqrt(x * x + y * y);

  const policy = draft.triggerPolicy[profile] ?? draft.triggerPolicy[0];
  const triggers = computeTriggers(raw.digitalMask, mappedDigitalMask, curvedAnalog, policy);

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

/**
 * Extended result type that includes WASM-computed Melee output.
 */
export type InputPreviewResultWithMelee = InputPreviewResult & {
  wasmOutput?: UnifiedOutputState;
  meleeOutput?: MeleeOutputState;
};

/**
 * Compute input preview using WASM processor.
 * WASM is required - returns null if not ready.
 *
 * Returns extended result with WASM-computed Melee coordinates.
 */
export function computeInputPreviewWithWasm(
  raw: OrcaInputState,
  draft: SettingsDraft,
  baseBlob: Uint8Array
): InputPreviewResultWithMelee | null {
  // WASM is required
  if (!isWasmReady()) {
    return null;
  }

  // Compute JS result for intermediate values (analog bars display)
  const jsResult = computeInputPreview(raw, draft, baseBlob);

  const processor = getWasmProcessor();
  const profile = draft.activeProfile ?? 0;

  // Set raw inputs
  processor.setRawInputs({
    digitalMask: raw.digitalMask,
    analog: raw.analog,
  });

  // Set range calibration
  const rangeCal = tryParseRangeCalibration(baseBlob);
  processor.setRangeCalibration(rangeCal);

  // Set analog mapping
  const analogMapping = draft.analogMappings[profile] ?? draft.analogMappings[0];
  processor.setAnalogMapping(analogMapping ?? null);

  // Set digital mapping
  const digitalMapping = draft.digitalMappings[profile] ?? draft.digitalMappings[0];
  processor.setDigitalMapping(digitalMapping ?? null);

  // Set stick curve parameters
  const curveParams = draft.stickCurveParams[profile] ?? draft.stickCurveParams[0];
  if (curveParams) {
    processor.setStickCurveParams({
      range: curveParams.range,
      notch: curveParams.notch,
      dz_lower: curveParams.dz_lower,
      dz_upper: curveParams.dz_upper,
      notch_start_input: curveParams.notch_start_input,
      notch_end_input: curveParams.notch_end_input,
      flags: curveParams.flags,
    });
  } else {
    processor.setStickCurveParams(null);
  }

  // Set trigger policy
  const triggerPolicy = draft.triggerPolicy[profile] ?? draft.triggerPolicy[0];
  if (triggerPolicy) {
    // Only use light sources if version is 1 (configured), otherwise use defaults
    // When version is 0, the blob values are garbage (often 0 = A button)
    const useLightSources = triggerPolicy.digitalLightSrcVersion === TRIGGER_POLICY_LIGHT_SRC_VERSION;
    processor.setTriggerPolicy({
      analogRangeMax: triggerPolicy.analogRangeMax,
      digitalFullPress: triggerPolicy.digitalFullPress,
      digitalLightshield: triggerPolicy.digitalLightshield,
      flags: triggerPolicy.flags,
      digitalLightLtSrc: useLightSources ? triggerPolicy.digitalLightLtSrc : undefined,
      digitalLightRtSrc: useLightSources ? triggerPolicy.digitalLightRtSrc : undefined,
    });
  } else {
    processor.setTriggerPolicy(null);
  }

  // DPAD layer not yet supported in draft schema - skip for now
  processor.setDpadLayer(null);

  // Process in Orca mode
  const wasmOutput = processor.processOrca();
  const meleeOutput = processor.toMeleeOutput();

  // Return combined result
  // NOTE: We keep jsResult.mappedDigitalMask (Orca input indices) for display purposes.
  // wasmOutput.digitalMask uses intermediate output indices (GP2040-style L1/L2/R1/R2)
  // which is not suitable for Orca mode button label display.
  return {
    ...jsResult,
    wasmOutput,
    meleeOutput,
    // Override joystick with WASM values for accuracy
    joystick: {
      x: wasmOutput.leftStickX,
      y: wasmOutput.leftStickY,
      x01: (wasmOutput.leftStickX + 1) / 2,
      y01: (wasmOutput.leftStickY + 1) / 2,
      magnitude: Math.sqrt(wasmOutput.leftStickX ** 2 + wasmOutput.leftStickY ** 2),
    },
    triggers: {
      l: wasmOutput.triggerL,
      r: wasmOutput.triggerR,
    },
    // Keep jsResult.mappedDigitalMask for Orca button display (uses Orca input indices)
    // mappedDigitalMask is NOT overridden here - it comes from jsResult spread above
  };
}
