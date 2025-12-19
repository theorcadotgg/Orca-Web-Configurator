import type { SettingsDraft } from '../../schema/settingsBlob';
import type { OrcaProfileFileV1, ProfileMode } from '../../schema/profileFile';
import {
  ANALOG_INPUTS,
  DIGITAL_INPUTS,
  DPAD_DOWN_VIRTUAL_DEST,
  DPAD_LEFT_VIRTUAL_DEST,
  DPAD_RIGHT_VIRTUAL_DEST,
  DPAD_UP_VIRTUAL_DEST,
  ORCA_ANALOG_MAPPING_DISABLED,
  ORCA_DUMMY_FIELD,
  isLockedDigitalDestination,
  isVirtualDpadDestination,
} from '../../schema/orcaMappings';
import { cloneDraft } from './cloneDraft';

const TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT = 1 << 0;
const ORCA_DPAD_DEST = 11;
const ORCA_LIGHTSHIELD_SRC = 12;
const ORCA_C_LEFT_SRC = 7;
const ORCA_C_RIGHT_SRC = 8;
const ORCA_C_UP_SRC = 9;
const ORCA_C_DOWN_SRC = 10;
const GP2040_ANALOG_LT_VIRTUAL_ID = 254;

export function getDefaultDigitalMapping(mode: ProfileMode): number[] {
  const base = Array.from({ length: DIGITAL_INPUTS.length }, (_, i) => i);
  if (mode === 'gp2040') {
    base[ORCA_DPAD_DEST] = ORCA_LIGHTSHIELD_SRC;
    base[ORCA_LIGHTSHIELD_SRC] = ORCA_DUMMY_FIELD;
  }
  return base;
}

export function getDefaultAnalogMapping(): number[] {
  return Array.from({ length: ANALOG_INPUTS.length }, (_, i) => i);
}

export function getGp2040AnalogTriggerRouting(draft: SettingsDraft, profileIndex: number): 'lt' | 'rt' {
  const policy = draft.triggerPolicy[profileIndex] ?? draft.triggerPolicy[0];
  const analogToLt = ((policy?.flags ?? 0) & TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT) !== 0;
  return analogToLt ? 'lt' : 'rt';
}

export function setActiveProfileInDraft(draft: SettingsDraft, nextProfile: number): SettingsDraft {
  const updated = cloneDraft(draft);
  updated.activeProfile = nextProfile;
  return updated;
}

export function renameProfileInDraft(draft: SettingsDraft, profileIndex: number, newName: string): SettingsDraft {
  const trimmed = newName.trim();
  const updated = cloneDraft(draft);
  updated.profileLabels[profileIndex] = trimmed || `Profile ${profileIndex + 1}`;
  return updated;
}

export function applyImportedProfileToDraft(
  draft: SettingsDraft,
  profileIndex: number,
  imported: OrcaProfileFileV1,
): SettingsDraft {
  const updated = cloneDraft(draft);
  updated.profileLabels[profileIndex] = imported.label.trim() || `Profile ${profileIndex + 1}`;
  updated.digitalMappings[profileIndex] = imported.digitalMapping;
  updated.analogMappings[profileIndex] = imported.analogMapping;
  updated.dpadLayer[profileIndex] = imported.dpadLayer;
  updated.triggerPolicy[profileIndex] = imported.triggerPolicy;
  updated.stickCurveParams[profileIndex] = imported.stickCurveParams;
  return updated;
}

export function setDigitalMappingInDraft(
  draft: SettingsDraft,
  params: { dest: number; src: number; defaultDigitalMapping: number[] },
): SettingsDraft {
  const { dest, src, defaultDigitalMapping } = params;
  const activeProfile = draft.activeProfile ?? 0;
  const updated = cloneDraft(draft);

  const digital = (index: number) => ({ type: 1, index, threshold: 0, hysteresis: 0 });
  const defaultCStickMode = 1;

  // Check if this is a DPAD virtual destination - handle it specially
  if (isVirtualDpadDestination(dest)) {
    const layer = updated.dpadLayer[activeProfile] ?? updated.dpadLayer[0];
    if (!layer) return updated;

    // Selecting a DPAD virtual destination from the per-button dropdown implies a repurpose binding:
    // set the direction to "Always on" and disable the source button's normal output mapping.
    const boundMode = 2;

    if (dest === DPAD_UP_VIRTUAL_DEST) {
      if (src === ORCA_DUMMY_FIELD) {
        layer.mode_up = defaultCStickMode;
        layer.up = digital(ORCA_C_UP_SRC);
      } else {
        layer.mode_up = boundMode;
        layer.up = digital(src);
      }
    } else if (dest === DPAD_DOWN_VIRTUAL_DEST) {
      if (src === ORCA_DUMMY_FIELD) {
        layer.mode_down = defaultCStickMode;
        layer.down = digital(ORCA_C_DOWN_SRC);
      } else {
        layer.mode_down = boundMode;
        layer.down = digital(src);
      }
    } else if (dest === DPAD_LEFT_VIRTUAL_DEST) {
      if (src === ORCA_DUMMY_FIELD) {
        layer.mode_left = defaultCStickMode;
        layer.left = digital(ORCA_C_LEFT_SRC);
      } else {
        layer.mode_left = boundMode;
        layer.left = digital(src);
      }
    } else if (dest === DPAD_RIGHT_VIRTUAL_DEST) {
      if (src === ORCA_DUMMY_FIELD) {
        layer.mode_right = defaultCStickMode;
        layer.right = digital(ORCA_C_RIGHT_SRC);
      } else {
        layer.mode_right = boundMode;
        layer.right = digital(src);
      }
    }

    updated.dpadLayer[activeProfile] = layer;

    // Repurpose behavior: disable the source button's normal output mapping.
    if (src !== ORCA_DUMMY_FIELD) {
      updated.digitalMappings[activeProfile] = [...(updated.digitalMappings[activeProfile] ?? [])];
      const currentMapping = updated.digitalMappings[activeProfile]!;
      for (let i = 0; i < currentMapping.length; i++) {
        const mappedSrc = currentMapping[i] ?? defaultDigitalMapping[i] ?? i;
        if (mappedSrc === src && !isLockedDigitalDestination(i)) {
          currentMapping[i] = ORCA_DUMMY_FIELD;
          break;
        }
      }
    }

    return updated;
  }

  // Normal digital mapping logic

  // If this source was being used for any DPAD direction, restore those directions to the default C-stick bindings.
  {
    const layer = updated.dpadLayer[activeProfile] ?? updated.dpadLayer[0];
    if (layer && src !== ORCA_DUMMY_FIELD) {
      const isSrc = (s: { type: number; index: number } | undefined) => s?.type === 1 && s.index === src;
      if (isSrc(layer.up)) {
        layer.mode_up = defaultCStickMode;
        layer.up = digital(ORCA_C_UP_SRC);
      }
      if (isSrc(layer.down)) {
        layer.mode_down = defaultCStickMode;
        layer.down = digital(ORCA_C_DOWN_SRC);
      }
      if (isSrc(layer.left)) {
        layer.mode_left = defaultCStickMode;
        layer.left = digital(ORCA_C_LEFT_SRC);
      }
      if (isSrc(layer.right)) {
        layer.mode_right = defaultCStickMode;
        layer.right = digital(ORCA_C_RIGHT_SRC);
      }
      updated.dpadLayer[activeProfile] = layer;
    }
  }

  updated.digitalMappings[activeProfile] = [...(updated.digitalMappings[activeProfile] ?? [])];
  const currentMapping = updated.digitalMappings[activeProfile]!;
  const currentSrc = currentMapping[dest] ?? defaultDigitalMapping[dest] ?? dest;

  if (src === ORCA_DUMMY_FIELD) {
    currentMapping[dest] = src;
    return updated;
  }

  const numSlots = Math.max(currentMapping.length, defaultDigitalMapping.length, DIGITAL_INPUTS.length);
  for (let otherDest = 0; otherDest < numSlots; otherDest++) {
    if (otherDest === dest) continue;
    if (isLockedDigitalDestination(otherDest)) continue;
    const otherSrc = currentMapping[otherDest] ?? defaultDigitalMapping[otherDest] ?? otherDest;
    if (otherSrc === src) {
      currentMapping[otherDest] = currentSrc;
      break;
    }
  }
  currentMapping[dest] = src;
  return updated;
}

export function setAnalogMappingInDraft(
  draft: SettingsDraft,
  params: {
    dest: number;
    src: number;
    defaultAnalogMapping: number[];
    mode: ProfileMode;
    virtualDest?: number;
  },
): SettingsDraft {
  const { dest, src, defaultAnalogMapping, mode, virtualDest } = params;
  const activeProfile = draft.activeProfile ?? 0;
  const updated = cloneDraft(draft);

  updated.analogMappings[activeProfile] = [...(updated.analogMappings[activeProfile] ?? [])];
  const currentMapping = updated.analogMappings[activeProfile]!;
  const currentSrc = currentMapping[dest] ?? defaultAnalogMapping[dest] ?? dest;

  if (src === ORCA_ANALOG_MAPPING_DISABLED) {
    currentMapping[dest] = src;
    return updated;
  }

  const numSlots = Math.max(currentMapping.length, defaultAnalogMapping.length, ANALOG_INPUTS.length);
  for (let otherDest = 0; otherDest < numSlots; otherDest++) {
    if (otherDest === dest) continue;
    const otherSrc = currentMapping[otherDest] ?? defaultAnalogMapping[otherDest] ?? otherDest;
    if (otherSrc === src) {
      currentMapping[otherDest] = currentSrc;
      break;
    }
  }
  currentMapping[dest] = src;

  // In GP2040 mode, automatically update trigger policy flag based on virtual destination
  if (mode === 'gp2040' && dest === 4 && virtualDest !== undefined) {
    const routeToLt = virtualDest === GP2040_ANALOG_LT_VIRTUAL_ID;
    const policy = updated.triggerPolicy[activeProfile] ?? updated.triggerPolicy[0];
    if (policy) {
      updated.triggerPolicy[activeProfile] = {
        ...policy,
        flags: routeToLt
          ? (policy.flags | TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT)
          : (policy.flags & ~TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT),
      };
    }
  }

  return updated;
}

export function clearAllBindingsInDraft(draft: SettingsDraft): SettingsDraft {
  const activeProfile = draft.activeProfile ?? 0;
  const updated = cloneDraft(draft);
  const digitalMapping = updated.digitalMappings[activeProfile] ?? [];
  const analogMapping = updated.analogMappings[activeProfile] ?? [];
  updated.digitalMappings[activeProfile] = digitalMapping.map((_, dest) =>
    isLockedDigitalDestination(dest) ? dest : ORCA_DUMMY_FIELD
  );
  updated.analogMappings[activeProfile] = analogMapping.map(() => ORCA_ANALOG_MAPPING_DISABLED);

  // Clear DPAD layer values to Dummy (disabled) for all directions
  const dpadLayer = updated.dpadLayer[activeProfile];
  if (dpadLayer) {
    const dummySource = { type: 1, index: ORCA_DUMMY_FIELD, threshold: 0, hysteresis: 0 };
    dpadLayer.up = dummySource;
    dpadLayer.down = dummySource;
    dpadLayer.left = dummySource;
    dpadLayer.right = dummySource;
  }

  return updated;
}

export function resetToDefaultBindingsInDraft(
  draft: SettingsDraft,
  params: { defaultDigitalMapping: number[]; defaultAnalogMapping: number[] },
): SettingsDraft {
  const { defaultDigitalMapping, defaultAnalogMapping } = params;
  const activeProfile = draft.activeProfile ?? 0;
  const updated = cloneDraft(draft);
  updated.digitalMappings[activeProfile] = [...defaultDigitalMapping];
  updated.analogMappings[activeProfile] = [...defaultAnalogMapping];
  return updated;
}
