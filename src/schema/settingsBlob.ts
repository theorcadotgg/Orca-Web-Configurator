import {
  ORCA_CONFIG_SETTINGS_BLOB_SIZE,
  ORCA_CONFIG_SETTINGS_HEADER_ACTIVE_PROFILE_OFFSET,
  ORCA_CONFIG_SETTINGS_HEADER_FLAGS_OFFSET,
  ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET,
  ORCA_CONFIG_SETTINGS_HEADER_HEADER_SIZE_OFFSET,
  ORCA_CONFIG_SETTINGS_HEADER_MAGIC_OFFSET,
  ORCA_CONFIG_SETTINGS_HEADER_VERSION_MAJOR_OFFSET,
  ORCA_CONFIG_SETTINGS_HEADER_VERSION_MINOR_OFFSET,
  OrcaSettingsTlv,
} from '@shared/orca_config_idl_generated';
import {
  decodeNullTerminatedAscii,
  encodeNullTerminatedAscii,
  readF32Le,
  readU16Le,
  readU32Le,
  writeF32Le,
  writeU16Le,
  writeU32Le,
} from './bytes';
import { crc32 } from './crc32';

type TlvInfo = {
  type: number;
  length: number;
  count: number;
  stride: number;
  offset0: number;
};

export type SettingsHeaderInfo = {
  magic: string;
  versionMajor: number;
  versionMinor: number;
  headerSize: number;
  generation: number;
  activeProfile: number;
  flags: number;
  storedCrc32: number;
  computedCrc32: number;
  crcValid: boolean;
};

export type DigitalSourceV1 = {
  type: number;
  index: number;
  threshold: number;
  hysteresis: number;
};

export type DpadLayerV1 = {
  mode_up: number;
  mode_down: number;
  mode_left: number;
  mode_right: number;
  enable: DigitalSourceV1;
  up: DigitalSourceV1;
  down: DigitalSourceV1;
  left: DigitalSourceV1;
  right: DigitalSourceV1;
};

export type TriggerPolicyV1 = {
  analogRangeMax: number;
  digitalFullPress: number;
  digitalLightshield: number;
  flags: number;
  digitalLightLtSrc: number;
  digitalLightRtSrc: number;
  digitalLightSrcVersion: number;
};

export type StickCurveParamsV1 = {
  size: number;
  range: number[];      // [5] - full press magnitude per axis (normalized 0-1.2)
  notch: number[];      // [5] - light press notch per axis (normalized 0-1)
  dz_lower: number[];   // [5] - deadzone lower
  dz_upper: number[];   // [5] - deadzone upper
  notch_start_input: number;
  notch_end_input: number;
};

export type SettingsDraft = {
  activeProfile: number;
  profileLabels: string[];
  digitalMappings: number[][];
  analogMappings: number[][];
  dpadLayer: DpadLayerV1[];
  triggerPolicy: TriggerPolicyV1[];
  stickCurveParams: StickCurveParamsV1[];
};

export type ParsedSettings = {
  header: SettingsHeaderInfo;
  draft: SettingsDraft;
};

type ParseOk = { ok: true; value: ParsedSettings };
type ParseErr = { ok: false; error: string };
export type ParseResult = ParseOk | ParseErr;

function tlvOffset(tlv: TlvInfo, index: number): number {
  return tlv.offset0 + index * tlv.stride;
}

function readTlvData(blob: Uint8Array, tlv: TlvInfo, index: number): Uint8Array {
  const off = tlvOffset(tlv, index);
  if (off + 4 + tlv.length > blob.length) {
    throw new Error(`TLV out of range (type=${tlv.type}, index=${index})`);
  }
  const gotType = readU16Le(blob, off);
  const gotLen = readU16Le(blob, off + 2);
  if (gotType !== tlv.type || gotLen !== tlv.length) {
    throw new Error(`Bad TLV header (type=${tlv.type}, index=${index}, gotType=${gotType}, gotLen=${gotLen})`);
  }
  return blob.slice(off + 4, off + 4 + tlv.length);
}

function writeTlvData(blob: Uint8Array, tlv: TlvInfo, index: number, data: Uint8Array) {
  if (data.length !== tlv.length) {
    throw new Error(`Bad TLV write length (type=${tlv.type}, want=${tlv.length}, got=${data.length})`);
  }
  const off = tlvOffset(tlv, index);
  if (off + 4 + tlv.length > blob.length) {
    throw new Error(`TLV write out of range (type=${tlv.type}, index=${index})`);
  }
  writeU16Le(blob, off, tlv.type);
  writeU16Le(blob, off + 2, tlv.length);
  blob.set(data, off + 4);
}

function readDigitalSourceV1(bytes: Uint8Array, offset: number): DigitalSourceV1 {
  const type = bytes[offset] ?? 0;
  const index = bytes[offset + 1] ?? 0;
  const threshold = readF32Le(bytes, offset + 4);
  const hysteresis = readF32Le(bytes, offset + 8);
  return { type, index, threshold, hysteresis };
}

function writeDigitalSourceV1(bytes: Uint8Array, offset: number, src: DigitalSourceV1) {
  bytes[offset] = src.type & 0xff;
  bytes[offset + 1] = src.index & 0xff;
  bytes[offset + 2] = 0;
  bytes[offset + 3] = 0;
  writeF32Le(bytes, offset + 4, src.threshold);
  writeF32Le(bytes, offset + 8, src.hysteresis);
}

function parseDpadLayerV1(data: Uint8Array): DpadLayerV1 {
  if (data.length !== OrcaSettingsTlv.DpadLayer.length) {
    throw new Error('Bad DpadLayer length');
  }
  const mode_up = data[0] ?? 0;
  const mode_down = data[1] ?? 0;
  const mode_left = data[2] ?? 0;
  const mode_right = data[3] ?? 0;
  const enable = readDigitalSourceV1(data, 4);
  const up = readDigitalSourceV1(data, 16);
  const down = readDigitalSourceV1(data, 28);
  const left = readDigitalSourceV1(data, 40);
  const right = readDigitalSourceV1(data, 52);
  return { mode_up, mode_down, mode_left, mode_right, enable, up, down, left, right };
}

function encodeDpadLayerV1(layer: DpadLayerV1): Uint8Array {
  const out = new Uint8Array(OrcaSettingsTlv.DpadLayer.length);
  out[0] = layer.mode_up & 0xff;
  out[1] = layer.mode_down & 0xff;
  out[2] = layer.mode_left & 0xff;
  out[3] = layer.mode_right & 0xff;
  writeDigitalSourceV1(out, 4, layer.enable);
  writeDigitalSourceV1(out, 16, layer.up);
  writeDigitalSourceV1(out, 28, layer.down);
  writeDigitalSourceV1(out, 40, layer.left);
  writeDigitalSourceV1(out, 52, layer.right);
  return out;
}

function parseTriggerPolicyV1(data: Uint8Array): TriggerPolicyV1 {
  if (data.length !== OrcaSettingsTlv.TriggerPolicy.length) {
    throw new Error('Bad TriggerPolicy length');
  }
  const analogRangeMax = readF32Le(data, 0);
  const digitalFullPress = readF32Le(data, 4);
  const digitalLightshield = readF32Le(data, 8);
  const flags = data[12] ?? 0;
  const digitalLightLtSrc = data[13] ?? 0;
  const digitalLightRtSrc = data[14] ?? 0;
  const digitalLightSrcVersion = data[15] ?? 0;
  return { analogRangeMax, digitalFullPress, digitalLightshield, flags, digitalLightLtSrc, digitalLightRtSrc, digitalLightSrcVersion };
}

function encodeTriggerPolicyV1(policy: TriggerPolicyV1): Uint8Array {
  const out = new Uint8Array(OrcaSettingsTlv.TriggerPolicy.length);
  writeF32Le(out, 0, policy.analogRangeMax);
  writeF32Le(out, 4, policy.digitalFullPress);
  writeF32Le(out, 8, policy.digitalLightshield);
  out[12] = policy.flags & 0xff;
  out[13] = policy.digitalLightLtSrc & 0xff;
  out[14] = policy.digitalLightRtSrc & 0xff;
  out[15] = policy.digitalLightSrcVersion & 0xff;
  return out;
}

const STICK_CURVE_AXIS_COUNT = 5;

function parseStickCurveParamsV1(data: Uint8Array): StickCurveParamsV1 {
  if (data.length !== OrcaSettingsTlv.StickCurveParams.length) {
    throw new Error('Bad StickCurveParams length');
  }
  const size = readU32Le(data, 0);
  const range: number[] = [];
  const notch: number[] = [];
  const dz_lower: number[] = [];
  const dz_upper: number[] = [];

  // Layout: uint32 size, float[5] range, float[5] notch, float[5] dz_lower, float[5] dz_upper, float notch_start_input, float notch_end_input
  for (let i = 0; i < STICK_CURVE_AXIS_COUNT; i++) {
    range.push(readF32Le(data, 4 + i * 4));
  }
  for (let i = 0; i < STICK_CURVE_AXIS_COUNT; i++) {
    notch.push(readF32Le(data, 4 + 20 + i * 4));
  }
  for (let i = 0; i < STICK_CURVE_AXIS_COUNT; i++) {
    dz_lower.push(readF32Le(data, 4 + 40 + i * 4));
  }
  for (let i = 0; i < STICK_CURVE_AXIS_COUNT; i++) {
    dz_upper.push(readF32Le(data, 4 + 60 + i * 4));
  }
  const notch_start_input = readF32Le(data, 4 + 80);
  const notch_end_input = readF32Le(data, 4 + 84);

  return { size, range, notch, dz_lower, dz_upper, notch_start_input, notch_end_input };
}

function encodeStickCurveParamsV1(params: StickCurveParamsV1): Uint8Array {
  const out = new Uint8Array(OrcaSettingsTlv.StickCurveParams.length);
  writeU32Le(out, 0, params.size);

  for (let i = 0; i < STICK_CURVE_AXIS_COUNT; i++) {
    writeF32Le(out, 4 + i * 4, params.range[i] ?? 0);
  }
  for (let i = 0; i < STICK_CURVE_AXIS_COUNT; i++) {
    writeF32Le(out, 4 + 20 + i * 4, params.notch[i] ?? 0);
  }
  for (let i = 0; i < STICK_CURVE_AXIS_COUNT; i++) {
    writeF32Le(out, 4 + 40 + i * 4, params.dz_lower[i] ?? 0);
  }
  for (let i = 0; i < STICK_CURVE_AXIS_COUNT; i++) {
    writeF32Le(out, 4 + 60 + i * 4, params.dz_upper[i] ?? 0);
  }
  writeF32Le(out, 4 + 80, params.notch_start_input);
  writeF32Le(out, 4 + 84, params.notch_end_input);

  return out;
}

export function tryParseSettingsBlob(blob: Uint8Array): ParseResult {
  try {
    return { ok: true, value: parseSettingsBlob(blob) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function parseSettingsBlob(blob: Uint8Array): ParsedSettings {
  if (blob.length !== ORCA_CONFIG_SETTINGS_BLOB_SIZE) {
    throw new Error(`Unexpected blob size (${blob.length})`);
  }

  const magic = decodeNullTerminatedAscii(blob.slice(ORCA_CONFIG_SETTINGS_HEADER_MAGIC_OFFSET, ORCA_CONFIG_SETTINGS_HEADER_MAGIC_OFFSET + 16));
  const versionMajor = blob[ORCA_CONFIG_SETTINGS_HEADER_VERSION_MAJOR_OFFSET] ?? 0;
  const versionMinor = blob[ORCA_CONFIG_SETTINGS_HEADER_VERSION_MINOR_OFFSET] ?? 0;
  const headerSize = readU16Le(blob, ORCA_CONFIG_SETTINGS_HEADER_HEADER_SIZE_OFFSET);
  const generation = readU32Le(blob, ORCA_CONFIG_SETTINGS_HEADER_GENERATION_OFFSET);
  const activeProfile = blob[ORCA_CONFIG_SETTINGS_HEADER_ACTIVE_PROFILE_OFFSET] ?? 0;
  const flags = blob[ORCA_CONFIG_SETTINGS_HEADER_FLAGS_OFFSET] ?? 0;

  const storedCrc32 = readU32Le(blob, blob.length - 4);
  const computedCrc32 = crc32([blob.slice(0, blob.length - 4)]);
  const crcValid = storedCrc32 === computedCrc32;

  const header: SettingsHeaderInfo = {
    magic,
    versionMajor,
    versionMinor,
    headerSize,
    generation,
    activeProfile,
    flags,
    storedCrc32,
    computedCrc32,
    crcValid,
  };

  const profileLabels: string[] = [];
  for (let i = 0; i < OrcaSettingsTlv.ProfileLabels.count; i++) {
    const data = readTlvData(blob, OrcaSettingsTlv.ProfileLabels satisfies TlvInfo, i);
    profileLabels.push(decodeNullTerminatedAscii(data));
  }

  const digitalMappings: number[][] = [];
  for (let i = 0; i < OrcaSettingsTlv.DigitalMappings.count; i++) {
    const data = readTlvData(blob, OrcaSettingsTlv.DigitalMappings satisfies TlvInfo, i);
    digitalMappings.push(Array.from(data));
  }

  const analogMappings: number[][] = [];
  for (let i = 0; i < OrcaSettingsTlv.AnalogMappings.count; i++) {
    const data = readTlvData(blob, OrcaSettingsTlv.AnalogMappings satisfies TlvInfo, i);
    analogMappings.push(Array.from(data));
  }

  const dpadLayer: DpadLayerV1[] = [];
  for (let i = 0; i < OrcaSettingsTlv.DpadLayer.count; i++) {
    const layer = parseDpadLayerV1(readTlvData(blob, OrcaSettingsTlv.DpadLayer satisfies TlvInfo, i));
    // v1.4 -> v1.5 compatibility: v1.4 stored a single DPAD mode at byte 0 (bytes 1..3 reserved).
    // If reading a v1.4 blob, mirror the legacy mode across directions for display/editing.
    if (versionMinor < 5 && layer.mode_down === 0 && layer.mode_left === 0 && layer.mode_right === 0) {
      layer.mode_down = layer.mode_up;
      layer.mode_left = layer.mode_up;
      layer.mode_right = layer.mode_up;
    }
    dpadLayer.push(layer);
  }

  const triggerPolicy: TriggerPolicyV1[] = [];
  for (let i = 0; i < OrcaSettingsTlv.TriggerPolicy.count; i++) {
    triggerPolicy.push(parseTriggerPolicyV1(readTlvData(blob, OrcaSettingsTlv.TriggerPolicy satisfies TlvInfo, i)));
  }
  const stickCurveParams: StickCurveParamsV1[] = [];
  for (let i = 0; i < OrcaSettingsTlv.StickCurveParams.count; i++) {
    stickCurveParams.push(parseStickCurveParamsV1(readTlvData(blob, OrcaSettingsTlv.StickCurveParams satisfies TlvInfo, i)));
  }

  const draft: SettingsDraft = {
    activeProfile,
    profileLabels,
    digitalMappings,
    analogMappings,
    dpadLayer,
    triggerPolicy,
    stickCurveParams,
  };

  return { header, draft };
}

export function buildSettingsBlob(baseBlob: Uint8Array, draft: SettingsDraft): Uint8Array {
  if (baseBlob.length !== ORCA_CONFIG_SETTINGS_BLOB_SIZE) {
    throw new Error(`Unexpected base blob size (${baseBlob.length})`);
  }
  const out = baseBlob.slice();

  out[ORCA_CONFIG_SETTINGS_HEADER_ACTIVE_PROFILE_OFFSET] = draft.activeProfile & 0xff;

  for (let i = 0; i < OrcaSettingsTlv.ProfileLabels.count; i++) {
    const label = draft.profileLabels[i] ?? '';
    const normalized = label.trim() || `Profile ${i + 1}`;
    writeTlvData(out, OrcaSettingsTlv.ProfileLabels satisfies TlvInfo, i, encodeNullTerminatedAscii(normalized, OrcaSettingsTlv.ProfileLabels.length));
  }

  for (let i = 0; i < OrcaSettingsTlv.DigitalMappings.count; i++) {
    const mapping = draft.digitalMappings[i];
    if (!mapping || mapping.length !== OrcaSettingsTlv.DigitalMappings.length) {
      throw new Error(`Bad digital mapping length for profile ${i}`);
    }
    writeTlvData(out, OrcaSettingsTlv.DigitalMappings satisfies TlvInfo, i, Uint8Array.from(mapping.map((v) => v & 0xff)));
  }

  for (let i = 0; i < OrcaSettingsTlv.AnalogMappings.count; i++) {
    const mapping = draft.analogMappings[i];
    if (!mapping || mapping.length !== OrcaSettingsTlv.AnalogMappings.length) {
      throw new Error(`Bad analog mapping length for profile ${i}`);
    }
    writeTlvData(out, OrcaSettingsTlv.AnalogMappings satisfies TlvInfo, i, Uint8Array.from(mapping.map((v) => v & 0xff)));
  }

  if (draft.dpadLayer.length !== OrcaSettingsTlv.DpadLayer.count) {
    throw new Error(`Bad DPAD layer length (want ${OrcaSettingsTlv.DpadLayer.count}, got ${draft.dpadLayer.length})`);
  }
  for (let i = 0; i < OrcaSettingsTlv.DpadLayer.count; i++) {
    const layer = draft.dpadLayer[i];
    if (!layer) {
      throw new Error(`Missing DPAD layer for profile ${i}`);
    }
    writeTlvData(out, OrcaSettingsTlv.DpadLayer satisfies TlvInfo, i, encodeDpadLayerV1(layer));
  }

  if (draft.triggerPolicy.length !== OrcaSettingsTlv.TriggerPolicy.count) {
    throw new Error(`Bad trigger policy length (want ${OrcaSettingsTlv.TriggerPolicy.count}, got ${draft.triggerPolicy.length})`);
  }
  for (let i = 0; i < OrcaSettingsTlv.TriggerPolicy.count; i++) {
    const policy = draft.triggerPolicy[i];
    if (!policy) {
      throw new Error(`Missing trigger policy for profile ${i}`);
    }
    writeTlvData(out, OrcaSettingsTlv.TriggerPolicy satisfies TlvInfo, i, encodeTriggerPolicyV1(policy));
  }

  if (draft.stickCurveParams.length !== OrcaSettingsTlv.StickCurveParams.count) {
    throw new Error(`Bad stick curve params length (want ${OrcaSettingsTlv.StickCurveParams.count}, got ${draft.stickCurveParams.length})`);
  }
  for (let i = 0; i < OrcaSettingsTlv.StickCurveParams.count; i++) {
    const params = draft.stickCurveParams[i];
    if (!params) {
      throw new Error(`Missing stick curve params for profile ${i}`);
    }
    writeTlvData(out, OrcaSettingsTlv.StickCurveParams satisfies TlvInfo, i, encodeStickCurveParamsV1(params));
  }

  const nextCrc = crc32([out.slice(0, out.length - 4)]);
  writeU32Le(out, out.length - 4, nextCrc);
  return out;
}
