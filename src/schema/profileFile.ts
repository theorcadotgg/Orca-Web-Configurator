import { OrcaSettingsTlv } from '@shared/orca_config_idl_generated';
import type { DpadLayerV1, StickCurveParamsV1, TriggerPolicyV1 } from './settingsBlob';

export type ProfileMode = 'orca' | 'gp2040';

export const ORCA_PROFILE_FILE_TYPE = 'orca-profile';
export const ORCA_PROFILE_FILE_VERSION = 2 as const;

export type OrcaProfileFileV1 = {
  type: typeof ORCA_PROFILE_FILE_TYPE;
  version: typeof ORCA_PROFILE_FILE_VERSION;
  mode: ProfileMode;
  label: string;
  digitalMapping: number[];
  analogMapping: number[];
  dpadLayer: DpadLayerV1;
  triggerPolicy: TriggerPolicyV1;
  stickCurveParams: StickCurveParamsV1;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function expectRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid ${name}: expected an object`);
  return value;
}

function expectString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid ${name}: expected a string`);
  return value;
}

function expectFiniteNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid ${name}: expected a finite number`);
  return value;
}

function expectU8(value: unknown, name: string): number {
  const n = expectFiniteNumber(value, name);
  if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error(`Invalid ${name}: expected an integer in [0, 255]`);
  return n;
}

function expectProfileMode(value: unknown, name: string): ProfileMode {
  const mode = expectString(value, name);
  if (mode !== 'orca' && mode !== 'gp2040') throw new Error(`Invalid ${name}: expected "orca" or "gp2040"`);
  return mode;
}

function expectNumberArray(value: unknown, name: string, expectedLength: number): number[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${name}: expected an array`);
  if (value.length !== expectedLength) {
    throw new Error(`Invalid ${name}: expected length ${expectedLength}, got ${value.length}`);
  }
  return value.map((v, i) => expectU8(v, `${name}[${i}]`));
}

function parseDigitalSourceV1(value: unknown, name: string) {
  const rec = expectRecord(value, name);
  return {
    type: expectU8(rec.type, `${name}.type`),
    index: expectU8(rec.index, `${name}.index`),
    threshold: expectFiniteNumber(rec.threshold, `${name}.threshold`),
    hysteresis: expectFiniteNumber(rec.hysteresis, `${name}.hysteresis`),
  };
}

function parseDpadLayerV1(value: unknown, name: string): DpadLayerV1 {
  const rec = expectRecord(value, name);
  const hasPerDirectionModes =
    Object.prototype.hasOwnProperty.call(rec, 'mode_up') ||
    Object.prototype.hasOwnProperty.call(rec, 'mode_down') ||
    Object.prototype.hasOwnProperty.call(rec, 'mode_left') ||
    Object.prototype.hasOwnProperty.call(rec, 'mode_right');

  let mode_up = 0;
  let mode_down = 0;
  let mode_left = 0;
  let mode_right = 0;

  if (hasPerDirectionModes) {
    mode_up = expectU8(rec.mode_up, `${name}.mode_up`);
    mode_down = expectU8(rec.mode_down, `${name}.mode_down`);
    mode_left = expectU8(rec.mode_left, `${name}.mode_left`);
    mode_right = expectU8(rec.mode_right, `${name}.mode_right`);
  } else {
    // v1 legacy format stored a single `mode` for all directions
    const mode = expectU8(rec.mode, `${name}.mode`);
    mode_up = mode;
    mode_down = mode;
    mode_left = mode;
    mode_right = mode;
  }

  return {
    mode_up,
    mode_down,
    mode_left,
    mode_right,
    enable: parseDigitalSourceV1(rec.enable, `${name}.enable`),
    up: parseDigitalSourceV1(rec.up, `${name}.up`),
    down: parseDigitalSourceV1(rec.down, `${name}.down`),
    left: parseDigitalSourceV1(rec.left, `${name}.left`),
    right: parseDigitalSourceV1(rec.right, `${name}.right`),
  };
}

function parseTriggerPolicyV1(value: unknown, name: string): TriggerPolicyV1 {
  const rec = expectRecord(value, name);
  const digitalLightLtSrc = Object.prototype.hasOwnProperty.call(rec, 'digitalLightLtSrc')
    ? expectU8(rec.digitalLightLtSrc, `${name}.digitalLightLtSrc`)
    : 0;
  const digitalLightRtSrc = Object.prototype.hasOwnProperty.call(rec, 'digitalLightRtSrc')
    ? expectU8(rec.digitalLightRtSrc, `${name}.digitalLightRtSrc`)
    : 0;
  const digitalLightSrcVersion = Object.prototype.hasOwnProperty.call(rec, 'digitalLightSrcVersion')
    ? expectU8(rec.digitalLightSrcVersion, `${name}.digitalLightSrcVersion`)
    : 0;
  return {
    analogRangeMax: expectFiniteNumber(rec.analogRangeMax, `${name}.analogRangeMax`),
    digitalFullPress: expectFiniteNumber(rec.digitalFullPress, `${name}.digitalFullPress`),
    digitalLightshield: expectFiniteNumber(rec.digitalLightshield, `${name}.digitalLightshield`),
    flags: expectU8(rec.flags, `${name}.flags`),
    digitalLightLtSrc,
    digitalLightRtSrc,
    digitalLightSrcVersion,
  };
}

function expectNumberArrayLen(value: unknown, name: string, expectedLength: number): number[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${name}: expected an array`);
  if (value.length !== expectedLength) {
    throw new Error(`Invalid ${name}: expected length ${expectedLength}, got ${value.length}`);
  }
  return value.map((v, i) => expectFiniteNumber(v, `${name}[${i}]`));
}

function parseStickCurveParamsV1(value: unknown, name: string): StickCurveParamsV1 {
  const rec = expectRecord(value, name);
  return {
    size: expectFiniteNumber(rec.size, `${name}.size`),
    range: expectNumberArrayLen(rec.range, `${name}.range`, 5),
    notch: expectNumberArrayLen(rec.notch, `${name}.notch`, 5),
    dz_lower: expectNumberArrayLen(rec.dz_lower, `${name}.dz_lower`, 5),
    dz_upper: expectNumberArrayLen(rec.dz_upper, `${name}.dz_upper`, 5),
    notch_start_input: expectFiniteNumber(rec.notch_start_input, `${name}.notch_start_input`),
    notch_end_input: expectFiniteNumber(rec.notch_end_input, `${name}.notch_end_input`),
  };
}

export function serializeProfileFileV1(file: OrcaProfileFileV1): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parseProfileFileV1(jsonText: string): OrcaProfileFileV1 {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid JSON');
  }

  const rec = expectRecord(raw, 'profile file');
  const type = expectString(rec.type, 'profile file.type');
  if (type !== ORCA_PROFILE_FILE_TYPE) {
    throw new Error(`Unsupported profile file type: ${type}`);
  }
  const version = expectFiniteNumber(rec.version, 'profile file.version');
  if (version !== 1 && version !== ORCA_PROFILE_FILE_VERSION) {
    throw new Error(`Unsupported profile file version: ${version}`);
  }

  const mode = expectProfileMode(rec.mode, 'profile file.mode');
  const label = expectString(rec.label, 'profile file.label');
  const digitalMapping = expectNumberArray(rec.digitalMapping, 'profile file.digitalMapping', OrcaSettingsTlv.DigitalMappings.length);
  const analogMapping = expectNumberArray(rec.analogMapping, 'profile file.analogMapping', OrcaSettingsTlv.AnalogMappings.length);

  const dpadLayer = parseDpadLayerV1(rec.dpadLayer, 'profile file.dpadLayer');
  const triggerPolicy = parseTriggerPolicyV1(rec.triggerPolicy, 'profile file.triggerPolicy');
  const stickCurveParams = parseStickCurveParamsV1(rec.stickCurveParams, 'profile file.stickCurveParams');

	  return {
	    type: ORCA_PROFILE_FILE_TYPE,
	    version: ORCA_PROFILE_FILE_VERSION,
	    mode,
    label,
    digitalMapping,
    analogMapping,
    dpadLayer,
    triggerPolicy,
    stickCurveParams,
  };
}
