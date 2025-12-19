import { useCallback, useMemo, useReducer, useRef } from 'react';
import {
  ORCA_CONFIG_SCHEMA_ID,
  ORCA_CONFIG_SETTINGS_VERSION_MAJOR,
} from '@shared/orca_config_idl_generated';
import { buildSettingsBlob, tryParseSettingsBlob, type SettingsDraft } from '../../schema/settingsBlob';
import {
  ORCA_PROFILE_FILE_TYPE,
  ORCA_PROFILE_FILE_VERSION,
  parseProfileFileV1,
  serializeProfileFileV1,
  type OrcaProfileFileV1,
} from '../../schema/profileFile';
import { isGp2040LabelPreset, type Gp2040LabelPreset } from '../../schema/gp2040Labels';
import { decodeStagedInvalidMask, validateSettingsDraft } from '../../validators/settingsValidation';
import { OrcaWebSerialTransport } from '../../usb/OrcaWebSerialTransport';
import { downloadBytes } from '../utils/download';
import { sanitizeFilenamePart } from '../utils/filename';
import { modeToSlotId, slotDisplayName, slotSuffix, type SlotId, type SlotMode } from '../utils/slot';
import { useLocalStorageState } from './useLocalStorageState';
import { type Compatibility, type MainView } from '../types';
import {
  applyImportedProfileToDraft,
  clearAllBindingsInDraft,
  getDefaultAnalogMapping,
  getDefaultDigitalMapping,
  getGp2040AnalogTriggerRouting,
  renameProfileInDraft,
  resetToDefaultBindingsInDraft,
  setActiveProfileInDraft,
  setAnalogMappingInDraft,
  setDigitalMappingInDraft,
} from '../domain/draftMutations';
import {
  createEmptySlotStates,
  createInitialOrcaAppState,
  orcaAppReducer,
  type DeviceValidationState,
  type OrcaAppState,
} from '../state/orcaAppReducer';

export type OrcaAppController = {
  // State
  state: OrcaAppState;
  // UI preferences
  mainView: MainView;
  setMainView: (next: MainView) => void;
  gp2040LabelPreset: Gp2040LabelPreset;
  setGp2040LabelPreset: (next: Gp2040LabelPreset) => void;
  // Derived
  activeSlot: SlotId;
  baseBlob: Uint8Array | null;
  draft: SettingsDraft | null;
  dirty: boolean;
  compatibility: Compatibility;
  canWrite: boolean;
  localValidation: { errors: string[]; warnings: string[] };
  activeProfile: number;
  digitalMapping: number[];
  analogMapping: number[];
  defaultDigitalMapping: number[];
  defaultAnalogMapping: number[];
  gp2040AnalogTriggerOutput: 'lt' | 'rt';
  deviceErrors: string[] | null;
  deviceRepaired: boolean | null;
  remappedCount: number;
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  handleModeChange: (nextMode: SlotMode) => Promise<void>;
  onDraftChange: (next: SettingsDraft) => void;
  setActiveProfile: (next: number) => void;
  renameProfile: (profileIndex: number, newName: string) => void;
  setDigitalMapping: (dest: number, src: number) => void;
  setAnalogMapping: (dest: number, src: number, virtualDest?: number) => void;
  clearAllBindings: () => void;
  resetToDefaultBindings: () => void;
  validateOnDevice: () => Promise<void>;
  saveToDevice: () => Promise<void>;
  resetDefaultsOnDevice: () => Promise<void>;
  rebootNow: () => Promise<void>;
  exportCurrentBlob: () => void;
  exportDraftBlob: () => void;
  exportCurrentProfile: () => void;
  importDeviceBlobFromFile: (file: File) => Promise<void>;
  importProfileFromFile: (file: File) => Promise<void>;
  setAllowUnsafeWrites: (next: boolean) => void;
  setRebootAfterSave: (next: boolean) => void;
  setShowResetConfirm: (next: boolean) => void;
  setEditingProfile: (next: number | null) => void;
};

export function useOrcaAppController(): OrcaAppController {
  const [state, dispatch] = useReducer(orcaAppReducer, undefined, createInitialOrcaAppState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [mainViewState, setMainViewState] = useLocalStorageState<MainView>('orca.mainView', 'layout', {
    serialize: (value) => value,
    deserialize: (raw) => (raw === 'layout' || raw === 'inputs' ? raw : undefined),
  });

  const [gp2040LabelPresetState, setGp2040LabelPresetState] = useLocalStorageState<Gp2040LabelPreset>(
    'orca.gp2040LabelPreset',
    'gp2040',
    {
      serialize: (value) => value,
      deserialize: (raw) => (isGp2040LabelPreset(raw) ? raw : undefined),
    },
  );

  const activeSlot = modeToSlotId(state.configMode);
  const currentSlotState = state.slotStates[activeSlot];
  const baseBlob = currentSlotState.baseBlob;
  const draft = currentSlotState.draft;
  const dirty = currentSlotState.dirty;

  const compatibility: Compatibility = useMemo(() => {
    if (!state.deviceInfo) return 'unknown';
    if (state.deviceInfo.settingsMajor !== ORCA_CONFIG_SETTINGS_VERSION_MAJOR) return 'major_mismatch';
    if (state.deviceInfo.schemaId !== ORCA_CONFIG_SCHEMA_ID) return 'minor_mismatch';
    return 'ok';
  }, [state.deviceInfo]);

  const canWrite = useMemo(() => {
    if (!state.transport) return false;
    if (!state.deviceInfo) return false;
    if (compatibility === 'major_mismatch') return false;
    if (compatibility === 'minor_mismatch') return state.allowUnsafeWrites;
    return true;
  }, [compatibility, state.allowUnsafeWrites, state.deviceInfo, state.transport]);

  const localValidation = useMemo(
    () => (draft ? validateSettingsDraft(draft) : { errors: [], warnings: [] }),
    [draft],
  );

  const activeProfile = draft?.activeProfile ?? 0;
  const digitalMapping: number[] = draft?.digitalMappings[activeProfile] ?? [];
  const analogMapping: number[] = draft?.analogMappings[activeProfile] ?? [];

  const defaultDigitalMapping = useMemo(() => getDefaultDigitalMapping(state.configMode), [state.configMode]);
  const defaultAnalogMapping = useMemo(() => getDefaultAnalogMapping(), []);

  const gp2040AnalogTriggerOutput = useMemo(() => {
    if (!draft) return 'rt';
    return getGp2040AnalogTriggerRouting(draft, activeProfile);
  }, [activeProfile, draft]);

  const deviceErrors = state.deviceValidation?.decoded ?? null;
  const deviceRepaired = state.deviceValidation?.repaired ?? null;

  const remappedCount = useMemo(() => {
    let count = 0;
    for (let dest = 0; dest < defaultDigitalMapping.length; dest++) {
      const def = defaultDigitalMapping[dest] ?? dest;
      const cur = digitalMapping[dest] ?? def;
      if (cur !== def) count++;
    }
    for (let dest = 0; dest < defaultAnalogMapping.length; dest++) {
      const def = defaultAnalogMapping[dest] ?? dest;
      const cur = analogMapping[dest] ?? def;
      if (cur !== def) count++;
    }
    return count;
  }, [analogMapping, defaultAnalogMapping, defaultDigitalMapping, digitalMapping]);

  const resetConnection = useCallback((patch?: Partial<OrcaAppState>) => {
    dispatch({
      type: 'patch',
      patch: {
        transport: null,
        deviceInfo: null,
        slotStates: createEmptySlotStates(),
        deviceValidation: null,
        progress: '',
        ...patch,
      },
    });
  }, []);

  const updateSlotState = useCallback((slot: SlotId, patch: Partial<OrcaAppState['slotStates'][SlotId]>) => {
    dispatch({ type: 'set_slot_state', slot, patch });
  }, []);

  const onDraftChange = useCallback((next: SettingsDraft) => {
    const { configMode } = stateRef.current;
    const slot = modeToSlotId(configMode);
    updateSlotState(slot, { draft: next, dirty: true });
    dispatch({ type: 'patch', patch: { deviceValidation: null } });
  }, [updateSlotState]);

  const connect = useCallback(async () => {
    dispatch({ type: 'patch', patch: { lastError: '', progress: '', deviceValidation: null } });
    dispatch({ type: 'patch', patch: { busy: true, slotStates: createEmptySlotStates() } });
    try {
      const nextTransport = await OrcaWebSerialTransport.requestAndOpen();

      // Set up disconnect detection
      nextTransport.setOnDisconnect(() => {
        resetConnection({ lastError: 'Device disconnected', busy: false });
      });

      const info = await nextTransport.getInfo();
      dispatch({ type: 'patch', patch: { transport: nextTransport, deviceInfo: info } });

      const gp2040Enabled = info.slotCount >= 2;
      const slotFromUI = modeToSlotId(stateRef.current.configMode);
      const slotToRead: SlotId = slotFromUI === 1 && !gp2040Enabled ? 0 : slotFromUI;
      if (slotFromUI === 1 && !gp2040Enabled) {
        dispatch({ type: 'patch', patch: { configMode: 'orca' } });
      }

      dispatch({ type: 'patch', patch: { progress: 'Reading settings...' } });
      const blob = await nextTransport.readBlob(slotToRead, {
        blobSize: info.blobSize,
        maxChunk: info.maxChunk,
        onProgress: (offset, total) => dispatch({ type: 'patch', patch: { progress: `Reading ${offset}/${total}...` } }),
      });
      const res = tryParseSettingsBlob(blob);
      if (!res.ok) throw new Error(res.error);
      updateSlotState(slotToRead, { baseBlob: blob, parsed: res.value, draft: res.value.draft, dirty: false });
      dispatch({ type: 'patch', patch: { progress: '' } });
    } catch (e) {
      dispatch({ type: 'patch', patch: { lastError: e instanceof Error ? e.message : String(e), progress: '' } });
    } finally {
      dispatch({ type: 'patch', patch: { busy: false } });
    }
  }, [resetConnection, updateSlotState]);

  const disconnect = useCallback(async () => {
    dispatch({ type: 'patch', patch: { lastError: '', progress: '', deviceValidation: null } });
    try {
      dispatch({ type: 'patch', patch: { busy: true } });
      await stateRef.current.transport?.close();
    } finally {
      resetConnection({ busy: false });
    }
  }, [resetConnection]);

  const handleModeChange = useCallback(async (nextMode: SlotMode) => {
    const { busy, configMode, transport, deviceInfo, slotStates } = stateRef.current;
    if (busy) return;
    if (nextMode === configMode) return;

    const activeSlot = modeToSlotId(configMode);
    const nextSlot = modeToSlotId(nextMode);
    if (transport && nextSlot === 1 && (deviceInfo?.slotCount ?? 0) < 2) return;

    const dirty = slotStates[activeSlot].dirty;
    if (dirty) {
      const ok = window.confirm(
        `Switch modes while ${slotDisplayName(activeSlot)} has unsaved changes? (Unsaved changes stay in this tab until you save or disconnect.)`,
      );
      if (!ok) return;
    }

    dispatch({ type: 'patch', patch: { lastError: '', progress: '', deviceValidation: null } });

    if (transport && deviceInfo) {
      const nextState = slotStates[nextSlot];
      if (!nextState.baseBlob || !nextState.draft) {
        try {
          dispatch({ type: 'patch', patch: { busy: true, progress: 'Reading settings...' } });
          const blob = await transport.readBlob(nextSlot, {
            blobSize: deviceInfo.blobSize,
            maxChunk: deviceInfo.maxChunk,
            onProgress: (offset, total) => dispatch({ type: 'patch', patch: { progress: `Reading ${offset}/${total}...` } }),
          });
          const res = tryParseSettingsBlob(blob);
          if (!res.ok) throw new Error(res.error);
          updateSlotState(nextSlot, { baseBlob: blob, parsed: res.value, draft: res.value.draft, dirty: false });
        } catch (e) {
          dispatch({ type: 'patch', patch: { lastError: e instanceof Error ? e.message : String(e) } });
          return;
        } finally {
          dispatch({ type: 'patch', patch: { busy: false, progress: '' } });
        }
      }
    }

    dispatch({ type: 'patch', patch: { configMode: nextMode } });
  }, [updateSlotState]);

  const setActiveProfile = useCallback((next: number) => {
    const { configMode, slotStates } = stateRef.current;
    const slot = modeToSlotId(configMode);
    const draft = slotStates[slot].draft;
    if (!draft) return;
    onDraftChange(setActiveProfileInDraft(draft, next));
  }, [onDraftChange]);

  const renameProfile = useCallback((profileIndex: number, newName: string) => {
    const { configMode, slotStates } = stateRef.current;
    const slot = modeToSlotId(configMode);
    const draft = slotStates[slot].draft;
    if (!draft) return;
    onDraftChange(renameProfileInDraft(draft, profileIndex, newName));
  }, [onDraftChange]);

  const setDigitalMapping = useCallback((dest: number, src: number) => {
    const { configMode, slotStates } = stateRef.current;
    const slot = modeToSlotId(configMode);
    const draft = slotStates[slot].draft;
    if (!draft) return;
    onDraftChange(setDigitalMappingInDraft(draft, { dest, src, defaultDigitalMapping: getDefaultDigitalMapping(configMode) }));
  }, [onDraftChange]);

  const setAnalogMapping = useCallback((dest: number, src: number, virtualDest?: number) => {
    const { configMode, slotStates } = stateRef.current;
    const slot = modeToSlotId(configMode);
    const draft = slotStates[slot].draft;
    if (!draft) return;
    onDraftChange(
      setAnalogMappingInDraft(draft, {
        dest,
        src,
        defaultAnalogMapping: getDefaultAnalogMapping(),
        mode: configMode,
        virtualDest,
      }),
    );
  }, [onDraftChange]);

  const clearAllBindings = useCallback(() => {
    const { configMode, slotStates } = stateRef.current;
    const slot = modeToSlotId(configMode);
    const draft = slotStates[slot].draft;
    if (!draft) return;
    onDraftChange(clearAllBindingsInDraft(draft));
  }, [onDraftChange]);

  const resetToDefaultBindings = useCallback(() => {
    const { configMode, slotStates } = stateRef.current;
    const slot = modeToSlotId(configMode);
    const draft = slotStates[slot].draft;
    if (!draft) return;
    onDraftChange(
      resetToDefaultBindingsInDraft(draft, {
        defaultDigitalMapping: getDefaultDigitalMapping(configMode),
        defaultAnalogMapping: getDefaultAnalogMapping(),
      }),
    );
  }, [onDraftChange]);

  const validateOnDevice = useCallback(async () => {
    const { transport, deviceInfo, configMode, slotStates } = stateRef.current;
    const slot = modeToSlotId(configMode);
    const { baseBlob, draft } = slotStates[slot];
    if (!transport || !baseBlob || !draft) return;

    dispatch({ type: 'patch', patch: { lastError: '', progress: 'Validating...' } });
    try {
      dispatch({ type: 'patch', patch: { busy: true } });
      await transport.beginSession();
      const staged = buildSettingsBlob(baseBlob, draft);
      await transport.writeBlob(slot, staged, {
        maxChunk: deviceInfo?.maxChunk ?? 256,
        onProgress: (offset, total) => dispatch({ type: 'patch', patch: { progress: `Staging ${offset}/${total}...` } }),
      });
      const res = await transport.validateStaged(slot);
      const validation: DeviceValidationState = { ...res, decoded: decodeStagedInvalidMask(res.invalidMask) };
      dispatch({ type: 'patch', patch: { deviceValidation: validation, progress: '' } });
    } catch (e) {
      dispatch({ type: 'patch', patch: { lastError: e instanceof Error ? e.message : String(e), progress: '' } });
    } finally {
      dispatch({ type: 'patch', patch: { busy: false } });
    }
  }, []);

  const saveToDevice = useCallback(async () => {
    const { transport, deviceInfo, configMode, slotStates, rebootAfterSave } = stateRef.current;
    const slot = modeToSlotId(configMode);
    const { baseBlob, draft } = slotStates[slot];
    if (!transport || !deviceInfo || !baseBlob || !draft) return;

    dispatch({ type: 'patch', patch: { lastError: '', progress: 'Saving...', deviceValidation: null } });
    try {
      dispatch({ type: 'patch', patch: { busy: true } });
      await transport.beginSession();
      const staged = buildSettingsBlob(baseBlob, draft);
      await transport.writeBlob(slot, staged, {
        maxChunk: deviceInfo.maxChunk,
        onProgress: (offset, total) => dispatch({ type: 'patch', patch: { progress: `Writing ${offset}/${total}...` } }),
      });
      const v = await transport.validateStaged(slot);
      const decoded = decodeStagedInvalidMask(v.invalidMask);
      dispatch({ type: 'patch', patch: { deviceValidation: { ...v, decoded } } });
      if (v.invalidMask !== 0) throw new Error(`Validation failed: ${decoded.join(', ')}`);

      await transport.unlockWrites();
      await transport.commitStaged(slot);

      const readBack = await transport.readBlob(slot, {
        blobSize: deviceInfo.blobSize,
        maxChunk: deviceInfo.maxChunk,
      });
      const res = tryParseSettingsBlob(readBack);
      if (!res.ok) throw new Error(`Read-back failed: ${res.error}`);
      updateSlotState(slot, { baseBlob: readBack, parsed: res.value, draft: res.value.draft, dirty: false });

      if (rebootAfterSave) {
        dispatch({ type: 'patch', patch: { progress: 'Rebooting...' } });
        await transport.reboot();
        resetConnection();
        return;
      }

      dispatch({ type: 'patch', patch: { progress: '' } });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      if (errorMsg.includes('disconnected') || errorMsg.includes('closed') || errorMsg.includes('not open')) {
        resetConnection({ lastError: 'Device disconnected. Please reconnect.' });
      } else {
        dispatch({ type: 'patch', patch: { lastError: errorMsg } });
      }
      dispatch({ type: 'patch', patch: { progress: '' } });
    } finally {
      dispatch({ type: 'patch', patch: { busy: false } });
    }
  }, [resetConnection, updateSlotState]);

  const resetDefaultsOnDevice = useCallback(async () => {
    const { transport, deviceInfo, configMode } = stateRef.current;
    const slot = modeToSlotId(configMode);
    if (!transport || !deviceInfo) return;

    dispatch({ type: 'patch', patch: { lastError: '', progress: 'Resetting...', deviceValidation: null } });
    try {
      dispatch({ type: 'patch', patch: { busy: true } });
      await transport.beginSession();
      await transport.unlockWrites();
      await transport.resetDefaults(slot);
      const readBack = await transport.readBlob(slot, { blobSize: deviceInfo.blobSize, maxChunk: deviceInfo.maxChunk });
      const res = tryParseSettingsBlob(readBack);
      if (!res.ok) throw new Error(res.error);
      updateSlotState(slot, { baseBlob: readBack, parsed: res.value, draft: res.value.draft, dirty: false });
      dispatch({ type: 'patch', patch: { progress: '' } });
    } catch (e) {
      dispatch({ type: 'patch', patch: { lastError: e instanceof Error ? e.message : String(e), progress: '' } });
    } finally {
      dispatch({ type: 'patch', patch: { busy: false } });
    }
  }, [updateSlotState]);

  const rebootNow = useCallback(async () => {
    const { transport } = stateRef.current;
    if (!transport) return;
    dispatch({ type: 'patch', patch: { lastError: '' } });
    try {
      dispatch({ type: 'patch', patch: { busy: true } });
      await transport.reboot();
    } catch (e) {
      dispatch({ type: 'patch', patch: { lastError: e instanceof Error ? e.message : String(e) } });
    } finally {
      dispatch({ type: 'patch', patch: { busy: false } });
    }
  }, []);

  const exportCurrentBlob = useCallback(() => {
    const { configMode, slotStates } = stateRef.current;
    const slot = modeToSlotId(configMode);
    const baseBlob = slotStates[slot].baseBlob;
    if (baseBlob) downloadBytes(`orca-settings-${slotSuffix(slot)}.bin`, baseBlob);
  }, []);

  const exportDraftBlob = useCallback(() => {
    const { configMode, slotStates } = stateRef.current;
    const slot = modeToSlotId(configMode);
    const baseBlob = slotStates[slot].baseBlob;
    const draft = slotStates[slot].draft;
    if (baseBlob && draft) {
      downloadBytes(`orca-settings-${slotSuffix(slot)}-draft.bin`, buildSettingsBlob(baseBlob, draft));
    }
  }, []);

  const exportCurrentProfile = useCallback(() => {
    const { configMode, slotStates } = stateRef.current;
    const slot = modeToSlotId(configMode);
    const draft = slotStates[slot].draft;
    if (!draft) return;

    dispatch({ type: 'patch', patch: { lastError: '', progress: '', deviceValidation: null } });

    const activeProfile = draft.activeProfile ?? 0;
    const label = draft.profileLabels[activeProfile]?.trim() || `Profile ${activeProfile + 1}`;
    const digitalMapping = draft.digitalMappings[activeProfile];
    const analogMapping = draft.analogMappings[activeProfile];
    const dpadLayer = draft.dpadLayer[activeProfile];
    const triggerPolicy = draft.triggerPolicy[activeProfile];
    const stickCurveParams = draft.stickCurveParams[activeProfile];

    if (!digitalMapping || !analogMapping || !dpadLayer || !triggerPolicy || !stickCurveParams) {
      dispatch({ type: 'patch', patch: { lastError: 'Cannot export profile: missing profile data.' } });
      return;
    }

    const fileData: OrcaProfileFileV1 = {
      type: ORCA_PROFILE_FILE_TYPE,
      version: ORCA_PROFILE_FILE_VERSION,
      mode: configMode,
      label,
      digitalMapping: [...digitalMapping],
      analogMapping: [...analogMapping],
      dpadLayer,
      triggerPolicy,
      stickCurveParams,
    };

    const json = serializeProfileFileV1(fileData);
    const bytes = new TextEncoder().encode(json);
    const filename = `orca-profile-${configMode}-p${activeProfile + 1}-${sanitizeFilenamePart(label)}.json`;
    downloadBytes(filename, bytes, 'application/json');
  }, []);

  const importDeviceBlobFromFile = useCallback(async (file: File) => {
    dispatch({ type: 'patch', patch: { lastError: '', progress: '', deviceValidation: null } });
    try {
      dispatch({ type: 'patch', patch: { busy: true } });
      const ab = await file.arrayBuffer();
      const blob = new Uint8Array(ab);
      const res = tryParseSettingsBlob(blob);
      if (!res.ok) throw new Error(res.error);
      const slot = modeToSlotId(stateRef.current.configMode);
      updateSlotState(slot, { baseBlob: blob, parsed: res.value, draft: res.value.draft, dirty: true });
    } catch (e) {
      dispatch({ type: 'patch', patch: { lastError: e instanceof Error ? e.message : String(e) } });
    } finally {
      dispatch({ type: 'patch', patch: { busy: false } });
    }
  }, [updateSlotState]);

  const importProfileFromFile = useCallback(async (file: File) => {
    dispatch({ type: 'patch', patch: { lastError: '', progress: '', deviceValidation: null } });
    try {
      dispatch({ type: 'patch', patch: { busy: true } });
      const { configMode, slotStates } = stateRef.current;
      const slot = modeToSlotId(configMode);
      const baseBlob = slotStates[slot].baseBlob;
      const draft = slotStates[slot].draft;
      if (!draft) return;

      const jsonText = await file.text();
      const imported = parseProfileFileV1(jsonText);

      if (imported.mode !== configMode) {
        const want = imported.mode === 'orca' ? 'Orca Mode (Primary)' : 'GP2040 Mode (Secondary)';
        const current = configMode === 'orca' ? 'Orca Mode (Primary)' : 'GP2040 Mode (Secondary)';
        throw new Error(
          `Incompatible profile: this file is for ${want}. You're currently editing ${current}. Switch modes to import.`,
        );
      }

      const updated = applyImportedProfileToDraft(draft, draft.activeProfile ?? 0, imported);
      if (baseBlob) {
        buildSettingsBlob(baseBlob, updated);
      }
      onDraftChange(updated);
    } catch (e) {
      dispatch({ type: 'patch', patch: { lastError: e instanceof Error ? e.message : String(e) } });
    } finally {
      dispatch({ type: 'patch', patch: { busy: false } });
    }
  }, [onDraftChange]);

  const setAllowUnsafeWrites = useCallback((next: boolean) => {
    dispatch({ type: 'patch', patch: { allowUnsafeWrites: next } });
  }, []);

  const setRebootAfterSave = useCallback((next: boolean) => {
    dispatch({ type: 'patch', patch: { rebootAfterSave: next } });
  }, []);

  const setShowResetConfirm = useCallback((next: boolean) => {
    dispatch({ type: 'patch', patch: { showResetConfirm: next } });
  }, []);

  const setEditingProfile = useCallback((next: number | null) => {
    dispatch({ type: 'patch', patch: { editingProfile: next } });
  }, []);

  const setMainView = useCallback((next: MainView) => {
    setMainViewState(next);
  }, [setMainViewState]);

  const setGp2040LabelPreset = useCallback((next: Gp2040LabelPreset) => {
    setGp2040LabelPresetState(next);
  }, [setGp2040LabelPresetState]);

  return {
    state,
    mainView: mainViewState,
    setMainView,
    gp2040LabelPreset: gp2040LabelPresetState,
    setGp2040LabelPreset,
    activeSlot,
    baseBlob,
    draft,
    dirty,
    compatibility,
    canWrite,
    localValidation,
    activeProfile,
    digitalMapping,
    analogMapping,
    defaultDigitalMapping,
    defaultAnalogMapping,
    gp2040AnalogTriggerOutput,
    deviceErrors,
    deviceRepaired,
    remappedCount,
    connect,
    disconnect,
    handleModeChange,
    onDraftChange,
    setActiveProfile,
    renameProfile,
    setDigitalMapping,
    setAnalogMapping,
    clearAllBindings,
    resetToDefaultBindings,
    validateOnDevice,
    saveToDevice,
    resetDefaultsOnDevice,
    rebootNow,
    exportCurrentBlob,
    exportDraftBlob,
    exportCurrentProfile,
    importDeviceBlobFromFile,
    importProfileFromFile,
    setAllowUnsafeWrites,
    setRebootAfterSave,
    setShowResetConfirm,
    setEditingProfile,
  };
}

