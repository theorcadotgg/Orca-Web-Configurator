import type { SettingsDraft } from '../../schema/settingsBlob';
import type { OrcaProfileFileV1, ProfileMode } from '../../schema/profileFile';
import {
  ANALOG_INPUTS,
  DIGITAL_INPUTS,
  GP2040_L3_VIRTUAL_DEST,
  GP2040_R3_VIRTUAL_DEST,
  DPAD_MODIFIER_VIRTUAL_DEST,
  DPAD_DOWN_VIRTUAL_DEST,
  DPAD_LEFT_VIRTUAL_DEST,
  DPAD_RIGHT_VIRTUAL_DEST,
  DPAD_UP_VIRTUAL_DEST,
  ORCA_ANALOG_MAPPING_DISABLED,
  ORCA_DUMMY_FIELD,
  isLockedDigitalDestination,
  isVirtualDpadDestination,
} from '../../schema/orcaMappings';
import { TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT, TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP } from '../../schema/triggerPolicyFlags';
import { cloneDraft } from './cloneDraft';

const ORCA_A1_HOME_DEST = 11;
const ORCA_C_LEFT_SRC = 7;
const ORCA_C_RIGHT_SRC = 8;
const ORCA_C_UP_SRC = 9;
const ORCA_C_DOWN_SRC = 10;
const ANALOG_TRIGGER_L_VIRTUAL_ID = 254;
const TRIGGER_POLICY_LIGHT_SRC_VERSION = 1;

function getDefaultGp2040ExtraMappings() {
  return { l3Src: ORCA_DUMMY_FIELD, r3Src: ORCA_DUMMY_FIELD };
}

function getCurrentPrimarySource(
  dest: number,
  currentMapping: number[],
  defaultDigitalMapping: number[],
  extra: { l3Src: number; r3Src: number },
): number {
  if (dest === GP2040_L3_VIRTUAL_DEST) return extra.l3Src;
  if (dest === GP2040_R3_VIRTUAL_DEST) return extra.r3Src;
  return currentMapping[dest] ?? defaultDigitalMapping[dest] ?? dest;
}

function setPrimarySource(
  dest: number,
  src: number,
  currentMapping: number[],
  extra: { l3Src: number; r3Src: number },
) {
  if (dest === GP2040_L3_VIRTUAL_DEST) {
    extra.l3Src = src;
    return;
  }
  if (dest === GP2040_R3_VIRTUAL_DEST) {
    extra.r3Src = src;
    return;
  }
  currentMapping[dest] = src;
}

export function normalizeGp2040TriggerPolicy<T extends { flags: number; digitalLightLtSrc: number; digitalLightRtSrc: number; digitalLightSrcVersion: number }>(
  policy: T,
): T {
  const nextFlags = policy.flags & ~TRIGGER_POLICY_FLAG_LIGHTSHIELD_CLAMP;
  if (
    nextFlags === policy.flags &&
    policy.digitalLightLtSrc === ORCA_DUMMY_FIELD &&
    policy.digitalLightRtSrc === ORCA_DUMMY_FIELD &&
    policy.digitalLightSrcVersion === TRIGGER_POLICY_LIGHT_SRC_VERSION
  ) {
    return policy;
  }
  return {
    ...policy,
    flags: nextFlags,
    digitalLightLtSrc: ORCA_DUMMY_FIELD,
    digitalLightRtSrc: ORCA_DUMMY_FIELD,
    digitalLightSrcVersion: TRIGGER_POLICY_LIGHT_SRC_VERSION,
  };
}

export function normalizeGp2040DraftTriggerPolicy(draft: SettingsDraft): SettingsDraft {
  let changed = false;
  const triggerPolicy = draft.triggerPolicy.map((policy) => {
    const normalized = normalizeGp2040TriggerPolicy(policy);
    if (normalized !== policy) changed = true;
    return normalized;
  });
  if (!changed) return draft;
  const updated = cloneDraft(draft);
  updated.triggerPolicy = triggerPolicy;
  return updated;
}

export function getDefaultDigitalMapping(mode: ProfileMode): number[] {
  const base = Array.from({ length: DIGITAL_INPUTS.length }, (_, i) => i);
  if (mode === 'gp2040') {
    // GP2040 mode: A1/Home is bindable but defaults OFF.
    base[ORCA_A1_HOME_DEST] = ORCA_DUMMY_FIELD;
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

export function moveProfileToFirstSlot(draft: SettingsDraft, profileIndex: number): SettingsDraft {
  // If already at first slot, no-op
  if (profileIndex === 0) return draft;

  const updated = cloneDraft(draft);

  // Helper to swap elements at two indices in an array
  const swap = <T>(arr: T[], i: number, j: number): void => {
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  };

  // Swap all profile-related data between profileIndex and 0
  swap(updated.profileLabels, 0, profileIndex);
  swap(updated.digitalMappings, 0, profileIndex);
  swap(updated.analogMappings, 0, profileIndex);
  swap(updated.gp2040ExtraMappings, 0, profileIndex);
  swap(updated.dpadLayer, 0, profileIndex);
  swap(updated.triggerPolicy, 0, profileIndex);
  swap(updated.stickCurveParams, 0, profileIndex);

  // Update activeProfile to track the moved profile
  if (updated.activeProfile === profileIndex) {
    // If we're promoting the currently active profile, it's now at index 0
    updated.activeProfile = 0;
  } else if (updated.activeProfile === 0) {
    // If profile 0 was active, it's now at profileIndex
    updated.activeProfile = profileIndex;
  }
  // Otherwise, activeProfile is unaffected

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
  updated.gp2040ExtraMappings[profileIndex] = imported.gp2040ExtraMappings;
  updated.dpadLayer[profileIndex] = imported.dpadLayer;
  updated.triggerPolicy[profileIndex] = imported.mode === 'gp2040'
    ? normalizeGp2040TriggerPolicy(imported.triggerPolicy)
    : imported.triggerPolicy;
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
  updated.digitalMappings[activeProfile] = [...(updated.digitalMappings[activeProfile] ?? [])];
  const currentMapping = updated.digitalMappings[activeProfile]!;
  updated.gp2040ExtraMappings[activeProfile] = {
    ...(updated.gp2040ExtraMappings[activeProfile] ?? getDefaultGp2040ExtraMappings()),
  };
  const extraMappings = updated.gp2040ExtraMappings[activeProfile]!;

  const restoreDpadDirection = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!updated.dpadLayer[activeProfile]) return;
    if (direction === 'up') {
      updated.dpadLayer[activeProfile]!.mode_up = defaultCStickMode;
      updated.dpadLayer[activeProfile]!.up = digital(ORCA_C_UP_SRC);
    } else if (direction === 'down') {
      updated.dpadLayer[activeProfile]!.mode_down = defaultCStickMode;
      updated.dpadLayer[activeProfile]!.down = digital(ORCA_C_DOWN_SRC);
    } else if (direction === 'left') {
      updated.dpadLayer[activeProfile]!.mode_left = defaultCStickMode;
      updated.dpadLayer[activeProfile]!.left = digital(ORCA_C_LEFT_SRC);
    } else if (direction === 'right') {
      updated.dpadLayer[activeProfile]!.mode_right = defaultCStickMode;
      updated.dpadLayer[activeProfile]!.right = digital(ORCA_C_RIGHT_SRC);
    }
  };

  const clearDpadSourceConflicts = (source: number) => {
    if (source === ORCA_DUMMY_FIELD) return;
    const layer = updated.dpadLayer[activeProfile] ?? updated.dpadLayer[0];
    if (!layer) return;
    if (layer.up.type === 1 && layer.up.index === source) restoreDpadDirection('up');
    if (layer.down.type === 1 && layer.down.index === source) restoreDpadDirection('down');
    if (layer.left.type === 1 && layer.left.index === source) restoreDpadDirection('left');
    if (layer.right.type === 1 && layer.right.index === source) restoreDpadDirection('right');
    updated.dpadLayer[activeProfile] = layer;
  };

  const resolvePrimaryConflicts = (targetDest: number, replacementSrc: number, source: number) => {
    if (source === ORCA_DUMMY_FIELD) return;
    let replacementAvailable = replacementSrc !== ORCA_DUMMY_FIELD;
    const primaryDests = [
      ...Array.from({ length: DIGITAL_INPUTS.length }, (_, i) => i).filter((i) => !isLockedDigitalDestination(i)),
      GP2040_L3_VIRTUAL_DEST,
      GP2040_R3_VIRTUAL_DEST,
    ];
    for (const otherDest of primaryDests) {
      if (otherDest === targetDest) continue;
      const otherSrc = getCurrentPrimarySource(otherDest, currentMapping, defaultDigitalMapping, extraMappings);
      if (otherSrc !== source) continue;
      if (replacementAvailable) {
        setPrimarySource(otherDest, replacementSrc, currentMapping, extraMappings);
        replacementAvailable = false;
      } else {
        setPrimarySource(otherDest, ORCA_DUMMY_FIELD, currentMapping, extraMappings);
      }
    }
  };

  // Virtual DPAD modifier destination (handled via DPAD Layer enable).
  if (dest === DPAD_MODIFIER_VIRTUAL_DEST) {
    const layer = updated.dpadLayer[activeProfile] ?? updated.dpadLayer[0];
    if (!layer) return updated;
    layer.enable = digital(src);
    updated.dpadLayer[activeProfile] = layer;
    return updated;
  }

  // Check if this is a DPAD virtual destination - handle it specially
  if (isVirtualDpadDestination(dest)) {
    const layer = updated.dpadLayer[activeProfile] ?? updated.dpadLayer[0];
    if (!layer) return updated;

    // Selecting a DPAD virtual destination from the per-button dropdown implies a repurpose binding:
    // set the direction to "Always on" and disable the source button's normal output mapping.
    const boundMode = 2;
    clearDpadSourceConflicts(src);
    resolvePrimaryConflicts(dest, ORCA_DUMMY_FIELD, src);

    if (dest === DPAD_UP_VIRTUAL_DEST) {
      if (src === ORCA_DUMMY_FIELD) {
        restoreDpadDirection('up');
      } else {
        layer.mode_up = boundMode;
        layer.up = digital(src);
      }
    } else if (dest === DPAD_DOWN_VIRTUAL_DEST) {
      if (src === ORCA_DUMMY_FIELD) {
        restoreDpadDirection('down');
      } else {
        layer.mode_down = boundMode;
        layer.down = digital(src);
      }
    } else if (dest === DPAD_LEFT_VIRTUAL_DEST) {
      if (src === ORCA_DUMMY_FIELD) {
        restoreDpadDirection('left');
      } else {
        layer.mode_left = boundMode;
        layer.left = digital(src);
      }
    } else if (dest === DPAD_RIGHT_VIRTUAL_DEST) {
      if (src === ORCA_DUMMY_FIELD) {
        restoreDpadDirection('right');
      } else {
        layer.mode_right = boundMode;
        layer.right = digital(src);
      }
    }

    updated.dpadLayer[activeProfile] = layer;
    return updated;
  }

  const currentSrc = getCurrentPrimarySource(dest, currentMapping, defaultDigitalMapping, extraMappings);

  if (src === ORCA_DUMMY_FIELD) {
    setPrimarySource(dest, src, currentMapping, extraMappings);
    return updated;
  }

  clearDpadSourceConflicts(src);
  resolvePrimaryConflicts(dest, currentSrc, src);
  setPrimarySource(dest, src, currentMapping, extraMappings);
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
  const { dest, src, defaultAnalogMapping, virtualDest } = params;
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

  // Update trigger policy flag based on virtual trigger destination.
  if (dest === 4 && virtualDest !== undefined) {
    const routeToLt = virtualDest === ANALOG_TRIGGER_L_VIRTUAL_ID;
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
  updated.gp2040ExtraMappings[activeProfile] = getDefaultGp2040ExtraMappings();

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
  updated.gp2040ExtraMappings[activeProfile] = getDefaultGp2040ExtraMappings();
  return updated;
}
