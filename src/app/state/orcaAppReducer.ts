import type { ParsedSettings, SettingsDraft } from '../../schema/settingsBlob';
import type { DeviceInfo, OrcaTransport, ValidateStagedResult } from '../../usb/OrcaTransport';
import type { SlotId, SlotMode } from '../utils/slot';

export type DeviceValidationState = ValidateStagedResult & { decoded: string[] };

export type SlotState = {
  baseBlob: Uint8Array | null;
  parsed: ParsedSettings | null;
  draft: SettingsDraft | null;
  dirty: boolean;
};

export function createEmptySlotState(): SlotState {
  return {
    baseBlob: null,
    parsed: null,
    draft: null,
    dirty: false,
  };
}

export function createEmptySlotStates(): Record<SlotId, SlotState> {
  return {
    0: createEmptySlotState(),
    1: createEmptySlotState(),
  };
}

export type OrcaAppState = {
  transport: OrcaTransport | null;
  deviceInfo: DeviceInfo | null;
  allowUnsafeWrites: boolean;

  busy: boolean;
  progress: string;
  lastError: string;

  configMode: SlotMode;
  slotStates: Record<SlotId, SlotState>;

  deviceValidation: DeviceValidationState | null;
  rebootAfterSave: boolean;
  showResetConfirm: boolean;

  editingProfile: number | null;
};

export type OrcaAppAction =
  | { type: 'patch'; patch: Partial<OrcaAppState> }
  | { type: 'set_slot_state'; slot: SlotId; patch: Partial<SlotState> }
  | { type: 'set_slot_states'; slotStates: Record<SlotId, SlotState> };

export function createInitialOrcaAppState(): OrcaAppState {
  return {
    transport: null,
    deviceInfo: null,
    allowUnsafeWrites: false,

    busy: false,
    progress: '',
    lastError: '',

    configMode: 'orca',
    slotStates: createEmptySlotStates(),

    deviceValidation: null,
    rebootAfterSave: true,
    showResetConfirm: false,

    editingProfile: null,
  };
}

export function orcaAppReducer(state: OrcaAppState, action: OrcaAppAction): OrcaAppState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'set_slot_state':
      return {
        ...state,
        slotStates: {
          ...state.slotStates,
          [action.slot]: { ...state.slotStates[action.slot], ...action.patch },
        },
      };
    case 'set_slot_states':
      return {
        ...state,
        slotStates: action.slotStates,
      };
    default: {
      const _exhaustive: never = action;
      return state;
    }
  }
}

