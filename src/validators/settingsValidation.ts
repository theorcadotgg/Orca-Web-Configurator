import {
  ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT,
  ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT,
  ORCA_CONFIG_SETTINGS_PROFILE_COUNT,
  OrcaSettingsTlv,
} from '@shared/orca_config_idl_generated';
import type { DigitalSourceV1, SettingsDraft, TriggerPolicyV1 } from '../schema/settingsBlob';
import { isLockedDigitalDestination, isLockedDigitalSource, ORCA_ANALOG_MAPPING_DISABLED, ORCA_DUMMY_FIELD } from '../schema/orcaMappings';

export type ValidationResult = {
  errors: string[];
  warnings: string[];
};

function isFiniteNumber(v: number): boolean {
  return Number.isFinite(v) && !Number.isNaN(v);
}

function validateDigitalSource(src: DigitalSourceV1, label: string): string[] {
  const errors: string[] = [];
  switch (src.type) {
    case 0:
      return errors;
    case 1: {
      if (src.index < 0 || src.index >= ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT) {
        errors.push(`${label}: digital index out of range`);
      } else if (isLockedDigitalSource(src.index)) {
        errors.push(`${label}: locked system button cannot be used as a source`);
      }
      return errors;
    }
    case 2:
    case 3: {
      if (src.index < 0 || src.index >= ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT) {
        errors.push(`${label}: analog index out of range`);
      }
      if (!isFiniteNumber(src.threshold) || src.threshold < 0 || src.threshold > 1) {
        errors.push(`${label}: threshold must be within [0, 1]`);
      }
      if (!isFiniteNumber(src.hysteresis) || src.hysteresis < 0 || src.hysteresis > 0.5) {
        errors.push(`${label}: hysteresis must be within [0, 0.5]`);
      }
      return errors;
    }
    default:
      errors.push(`${label}: unknown source type ${src.type}`);
      return errors;
  }
}

function validateTriggerPolicy(policy: TriggerPolicyV1, label: string): string[] {
  const errors: string[] = [];
  if (!isFiniteNumber(policy.analogRangeMax) || policy.analogRangeMax < 0 || policy.analogRangeMax > 1) {
    errors.push(`${label}: analog range max must be within [0, 1]`);
  }
  if (!isFiniteNumber(policy.digitalFullPress) || policy.digitalFullPress < 0 || policy.digitalFullPress > 1) {
    errors.push(`${label}: digital full press must be within [0, 1]`);
  }
  if (!isFiniteNumber(policy.digitalLightshield) || policy.digitalLightshield < 0 || policy.digitalLightshield > 1) {
    errors.push(`${label}: digital lightshield must be within [0, 1]`);
  }
  if (isFiniteNumber(policy.digitalFullPress) && isFiniteNumber(policy.digitalLightshield) && policy.digitalLightshield > policy.digitalFullPress) {
    errors.push(`${label}: lightshield threshold must be <= full press threshold`);
  }
  return errors;
}

export function validateSettingsDraft(draft: SettingsDraft): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (draft.activeProfile < 0 || draft.activeProfile >= ORCA_CONFIG_SETTINGS_PROFILE_COUNT) {
    errors.push(`Active profile must be within [0, ${ORCA_CONFIG_SETTINGS_PROFILE_COUNT - 1}]`);
  }

  if (draft.profileLabels.length !== ORCA_CONFIG_SETTINGS_PROFILE_COUNT) {
    errors.push(`Expected ${ORCA_CONFIG_SETTINGS_PROFILE_COUNT} profile labels`);
  } else {
    for (let i = 0; i < draft.profileLabels.length; i++) {
      const label = draft.profileLabels[i]?.trim() ?? '';
      if (!label) {
        errors.push(`Profile ${i + 1}: label cannot be empty`);
      }
    }
  }

  if (draft.digitalMappings.length !== ORCA_CONFIG_SETTINGS_PROFILE_COUNT) {
    errors.push(`Expected ${ORCA_CONFIG_SETTINGS_PROFILE_COUNT} digital mapping profiles`);
  } else {
    for (let profile = 0; profile < draft.digitalMappings.length; profile++) {
      const mapping = draft.digitalMappings[profile] ?? [];
      if (mapping.length !== ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT) {
        errors.push(`Profile ${profile + 1}: digital mapping length must be ${ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT}`);
        continue;
      }
      for (let dest = 0; dest < mapping.length; dest++) {
        const src = mapping[dest] ?? 0;
        if (src < 0 || src >= ORCA_CONFIG_ORCA_DIGITAL_INPUT_COUNT) {
          errors.push(`Profile ${profile + 1}: mapping dest ${dest} has out-of-range source ${src}`);
          continue;
        }
        if (isLockedDigitalDestination(dest)) {
          if (src !== dest) {
            errors.push(`Profile ${profile + 1}: locked destination ${dest} must remain identity-mapped`);
          }
          continue;
        }
        if (isLockedDigitalSource(src)) {
          errors.push(`Profile ${profile + 1}: destination ${dest} cannot use locked system button as source`);
        }
      }

      if (profile === draft.activeProfile) {
        const counts = new Map<number, number>();
        for (let dest = 0; dest < mapping.length; dest++) {
          const src = mapping[dest] ?? 0;
          if (src === ORCA_DUMMY_FIELD) continue;
          counts.set(src, (counts.get(src) ?? 0) + 1);
        }
        const dupes = [...counts.entries()].filter(([, count]) => count > 1).map(([src, count]) => ({ src, count }));
        if (dupes.length) {
          warnings.push(
            `Active profile: duplicate sources used (${dupes.map((d) => `${d.src}×${d.count}`).join(', ')})`,
          );
        }
      }
    }
  }

  if (draft.analogMappings.length !== ORCA_CONFIG_SETTINGS_PROFILE_COUNT) {
    errors.push(`Expected ${ORCA_CONFIG_SETTINGS_PROFILE_COUNT} analog mapping profiles`);
  } else {
    for (let profile = 0; profile < draft.analogMappings.length; profile++) {
      const mapping = draft.analogMappings[profile] ?? [];
      if (mapping.length !== ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT) {
        errors.push(`Profile ${profile + 1}: analog mapping length must be ${ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT}`);
        continue;
      }
      for (let dest = 0; dest < mapping.length; dest++) {
        const src = mapping[dest] ?? 0;
        if (src === ORCA_ANALOG_MAPPING_DISABLED) {
          continue;
        }
        if (src < 0 || src >= ORCA_CONFIG_ORCA_ANALOG_INPUT_COUNT) {
          errors.push(`Profile ${profile + 1}: analog mapping dest ${dest} has out-of-range source ${src}`);
        }
      }
    }
  }

  if (draft.dpadLayer.length !== ORCA_CONFIG_SETTINGS_PROFILE_COUNT) {
    errors.push(`Expected ${ORCA_CONFIG_SETTINGS_PROFILE_COUNT} DPAD Layer profiles`);
  } else {
    for (let profile = 0; profile < draft.dpadLayer.length; profile++) {
      const layer = draft.dpadLayer[profile]!;
      if (layer.mode < 0 || layer.mode > 2) {
        errors.push(`Profile ${profile + 1}: DPAD mode must be 0..2`);
      }
      errors.push(...validateDigitalSource(layer.enable, `Profile ${profile + 1}: DPAD enable`));
      errors.push(...validateDigitalSource(layer.up, `Profile ${profile + 1}: DPAD up`));
      errors.push(...validateDigitalSource(layer.down, `Profile ${profile + 1}: DPAD down`));
      errors.push(...validateDigitalSource(layer.left, `Profile ${profile + 1}: DPAD left`));
      errors.push(...validateDigitalSource(layer.right, `Profile ${profile + 1}: DPAD right`));
    }
  }

  if (draft.triggerPolicy.length !== ORCA_CONFIG_SETTINGS_PROFILE_COUNT) {
    errors.push(`Expected ${ORCA_CONFIG_SETTINGS_PROFILE_COUNT} Trigger Policy profiles`);
  } else {
    for (let profile = 0; profile < draft.triggerPolicy.length; profile++) {
      errors.push(...validateTriggerPolicy(draft.triggerPolicy[profile]!, `Profile ${profile + 1}: Trigger`));
    }
  }

  return { errors, warnings };
}

const TLV_TYPE_TO_NAME: Map<number, string> = new Map(
  (Object.entries(OrcaSettingsTlv) as Array<[string, { type: number }]>).map(([name, info]) => [info.type, name]),
);

export function decodeStagedInvalidMask(mask: number): string[] {
  const results: string[] = [];
  if ((mask & 1) !== 0) results.push('Header invalid');
  for (const [type, name] of TLV_TYPE_TO_NAME.entries()) {
    const bit = 1 << (1 + type);
    if ((mask & bit) !== 0) results.push(`${name} invalid`);
  }
  return results;
}
