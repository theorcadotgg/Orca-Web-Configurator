import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ORCA_CONFIG_SCHEMA_ID,
  ORCA_CONFIG_SETTINGS_VERSION_MAJOR,
  ORCA_CONFIG_SETTINGS_PROFILE_COUNT,
} from '@shared/orca_config_idl_generated';
import { buildSettingsBlob, tryParseSettingsBlob, type ParsedSettings, type SettingsDraft } from '../schema/settingsBlob';
import { decodeStagedInvalidMask, validateSettingsDraft } from '../validators/settingsValidation';
import type { DeviceInfo, OrcaTransport, ValidateStagedResult } from '../usb/OrcaTransport';
import { OrcaWebSerialTransport } from '../usb/OrcaWebSerialTransport';
import { ModeTabs } from './components/ModeTabs';
import { CollapsiblePanel } from './components/CollapsiblePanel';
import { ActionToolbar } from './components/ActionToolbar';
import { ControllerVisualizer } from './components/ControllerVisualizer';
import { DpadEditor } from './components/DpadEditor';
import { TriggerEditor } from './components/TriggerEditor';
import { StickCurveEditor } from './components/StickCurveEditor';
import { ValidationStatus } from './components/ValidationStatus';
import { ConfirmModal } from './components/ConfirmModal';
import {
  DIGITAL_INPUTS,
  ANALOG_INPUTS,
  ORCA_DUMMY_FIELD,
  ORCA_ANALOG_MAPPING_DISABLED,
  isLockedDigitalDestination,
  isLockedDigitalSource,
} from '../schema/orcaMappings';
import { isGp2040LabelPreset, type Gp2040LabelPreset } from '../schema/gp2040Labels';
import OrcaLogo from '../assets/Orca_Logo_B.png';

type DeviceValidationState = ValidateStagedResult & { decoded: string[] };
type Compatibility = 'ok' | 'major_mismatch' | 'minor_mismatch' | 'unknown';
type SlotMode = 'orca' | 'gp2040';
type SlotId = 0 | 1;

const TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT = 1 << 0;
const ORCA_DPAD_DEST = 11;
const ORCA_LIGHTSHIELD_SRC = 12;
const GP2040_ANALOG_LT_VIRTUAL_ID = 254; // Must match ControllerVisualizer

type SlotState = {
  baseBlob: Uint8Array | null;
  parsed: ParsedSettings | null;
  draft: SettingsDraft | null;
  dirty: boolean;
};

const EMPTY_SLOT_STATE: SlotState = {
  baseBlob: null,
  parsed: null,
  draft: null,
  dirty: false,
};

function modeToSlotId(mode: SlotMode): SlotId {
  return mode === 'gp2040' ? 1 : 0;
}

function slotSuffix(slot: SlotId): string {
  return slot === 0 ? 'primary' : 'secondary';
}

function slotDisplayName(slot: SlotId): string {
  return slot === 0 ? 'Orca Mode (Primary)' : 'GP2040 Mode (Secondary)';
}

function downloadBytes(filename: string, bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function cloneDraft(draft: SettingsDraft): SettingsDraft {
  return {
    ...draft,
    profileLabels: [...draft.profileLabels],
    digitalMappings: draft.digitalMappings.map((m) => [...m]),
    analogMappings: draft.analogMappings.map((m) => [...m]),
    dpadLayer: draft.dpadLayer.map((layer) => ({
      ...layer,
      enable: { ...layer.enable },
      up: { ...layer.up },
      down: { ...layer.down },
      left: { ...layer.left },
      right: { ...layer.right },
    })),
    triggerPolicy: draft.triggerPolicy.map((policy) => ({ ...policy })),
    stickCurveParams: draft.stickCurveParams.map((p) => ({
      ...p,
      range: [...p.range],
      notch: [...p.notch],
      dz_lower: [...p.dz_lower],
      dz_upper: [...p.dz_upper],
    })),
  };
}

export default function App() {
  // Connection state
  const [transport, setTransport] = useState<OrcaTransport | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [allowUnsafeWrites, setAllowUnsafeWrites] = useState(false);

  // UI state
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [lastError, setLastError] = useState('');
  const [configMode, setConfigMode] = useState<SlotMode>('orca');
  const [editingProfile, setEditingProfile] = useState<number | null>(null);
  const [gp2040LabelPreset, setGp2040LabelPreset] = useState<Gp2040LabelPreset>(() => {
    try {
      const stored = window.localStorage.getItem('orca.gp2040LabelPreset');
      if (stored && isGp2040LabelPreset(stored)) return stored;
    } catch {
      // ignore
    }
    return 'gp2040';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('orca.gp2040LabelPreset', gp2040LabelPreset);
    } catch {
      // ignore
    }
  }, [gp2040LabelPreset]);

  // Data state
  const [slotStates, setSlotStates] = useState<Record<SlotId, SlotState>>({
    0: { ...EMPTY_SLOT_STATE },
    1: { ...EMPTY_SLOT_STATE },
  });

  const [deviceValidation, setDeviceValidation] = useState<DeviceValidationState | null>(null);
  const [rebootAfterSave, setRebootAfterSave] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const importRef = useRef<HTMLInputElement | null>(null);

  const activeSlot = modeToSlotId(configMode);
  const currentState = slotStates[activeSlot];
  const baseBlob = currentState.baseBlob;
  const parsed = currentState.parsed;
  const draft = currentState.draft;
  const dirty = currentState.dirty;

  function updateSlotState(slot: SlotId, patch: Partial<SlotState>) {
    setSlotStates((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));
  }

  // Computed state
  const compatibility: Compatibility = useMemo(() => {
    if (!deviceInfo) return 'unknown';
    if (deviceInfo.settingsMajor !== ORCA_CONFIG_SETTINGS_VERSION_MAJOR) return 'major_mismatch';
    if (deviceInfo.schemaId !== ORCA_CONFIG_SCHEMA_ID) return 'minor_mismatch';
    return 'ok';
  }, [deviceInfo]);

  const canWrite = useMemo(() => {
    if (!transport) return false;
    if (!deviceInfo) return false;
    if (compatibility === 'major_mismatch') return false;
    if (compatibility === 'minor_mismatch') return allowUnsafeWrites;
    return true;
  }, [allowUnsafeWrites, compatibility, deviceInfo, transport]);

  const localValidation = useMemo(
    () => (draft ? validateSettingsDraft(draft) : { errors: [], warnings: [] }),
    [draft]
  );

  const activeProfile = draft?.activeProfile ?? 0;
  const digitalMapping: number[] = draft?.digitalMappings[activeProfile] ?? [];
  const analogMapping: number[] = draft?.analogMappings[activeProfile] ?? [];

  const defaultDigitalMapping = useMemo(() => {
    const base = Array.from({ length: DIGITAL_INPUTS.length }, (_, i) => i);
    if (configMode === 'gp2040') {
      base[ORCA_DPAD_DEST] = ORCA_LIGHTSHIELD_SRC;
      base[ORCA_LIGHTSHIELD_SRC] = ORCA_DUMMY_FIELD;
    }
    return base;
  }, [configMode]);

  const defaultAnalogMapping = useMemo(() => Array.from({ length: ANALOG_INPUTS.length }, (_, i) => i), []);

  const gp2040AnalogTriggerOutput = useMemo(() => {
    if (!draft) return 'rt' as const;
    const policy = draft.triggerPolicy[activeProfile] ?? draft.triggerPolicy[0];
    const analogToLt = ((policy?.flags ?? 0) & TRIGGER_POLICY_FLAG_ANALOG_TRIGGER_TO_LT) !== 0;
    return analogToLt ? ('lt' as const) : ('rt' as const);
  }, [activeProfile, draft]);

  // Handlers
  async function connect() {
    setLastError('');
    setProgress('');
    setDeviceValidation(null);
    try {
      setBusy(true);
      setSlotStates({ 0: { ...EMPTY_SLOT_STATE }, 1: { ...EMPTY_SLOT_STATE } });
      const nextTransport = await OrcaWebSerialTransport.requestAndOpen();

      // Set up disconnect detection
      nextTransport.setOnDisconnect(() => {
        // Device was unplugged - reset UI to disconnected state
        resetConnection();
        setLastError('Device disconnected');
        setBusy(false);
      });

      const info = await nextTransport.getInfo();
      setTransport(nextTransport);
      setDeviceInfo(info);

      const gp2040Enabled = info.slotCount >= 2;
      const slotToRead: SlotId = (activeSlot === 1 && !gp2040Enabled) ? 0 : activeSlot;
      if (activeSlot === 1 && !gp2040Enabled) {
        setConfigMode('orca');
      }

      setProgress('Reading settings...');
      const blob = await nextTransport.readBlob(slotToRead, {
        blobSize: info.blobSize,
        maxChunk: info.maxChunk,
        onProgress: (offset, total) => setProgress(`Reading ${offset}/${total}...`),
      });
      const res = tryParseSettingsBlob(blob);
      if (!res.ok) throw new Error(res.error);
      updateSlotState(slotToRead, { baseBlob: blob, parsed: res.value, draft: res.value.draft, dirty: false });
      setProgress('');
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
      setProgress('');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setLastError('');
    setProgress('');
    setDeviceValidation(null);
    try {
      setBusy(true);
      await transport?.close();
    } finally {
      setTransport(null);
      setDeviceInfo(null);
      setSlotStates({ 0: { ...EMPTY_SLOT_STATE }, 1: { ...EMPTY_SLOT_STATE } });
      setBusy(false);
    }
  }

  // Reset connection state without trying to close (for when device reboots/disconnects)
  function resetConnection() {
    setTransport(null);
    setDeviceInfo(null);
    setSlotStates({ 0: { ...EMPTY_SLOT_STATE }, 1: { ...EMPTY_SLOT_STATE } });
    setDeviceValidation(null);
    setProgress('');
  }

  async function handleModeChange(nextMode: SlotMode) {
    if (busy) return;
    if (nextMode === configMode) return;

    const nextSlot = modeToSlotId(nextMode);
    if (transport && nextSlot === 1 && (deviceInfo?.slotCount ?? 0) < 2) return;

    if (dirty) {
      const ok = window.confirm(
        `Switch modes while ${slotDisplayName(activeSlot)} has unsaved changes? (Unsaved changes stay in this tab until you save or disconnect.)`,
      );
      if (!ok) return;
    }

    setLastError('');
    setProgress('');
    setDeviceValidation(null);

    if (transport && deviceInfo) {
      const nextState = slotStates[nextSlot];
      if (!nextState.baseBlob || !nextState.draft) {
        try {
          setBusy(true);
          setProgress('Reading settings...');
          const blob = await transport.readBlob(nextSlot, {
            blobSize: deviceInfo.blobSize,
            maxChunk: deviceInfo.maxChunk,
            onProgress: (offset, total) => setProgress(`Reading ${offset}/${total}...`),
          });
          const res = tryParseSettingsBlob(blob);
          if (!res.ok) throw new Error(res.error);
          updateSlotState(nextSlot, { baseBlob: blob, parsed: res.value, draft: res.value.draft, dirty: false });
        } catch (e) {
          setLastError(e instanceof Error ? e.message : String(e));
          return;
        } finally {
          setBusy(false);
          setProgress('');
        }
      }
    }

    setConfigMode(nextMode);
  }

  function onDraftChange(next: SettingsDraft) {
    updateSlotState(activeSlot, { draft: next, dirty: true });
    setDeviceValidation(null);
  }

  function setActiveProfile(next: number) {
    if (!draft) return;
    const updated = cloneDraft(draft);
    updated.activeProfile = next;
    onDraftChange(updated);
  }

  function renameProfile(profileIndex: number, newName: string) {
    if (!draft) return;
    const trimmed = newName.trim();
    // Allow empty to fall back to default "Profile N"
    const updated = cloneDraft(draft);
    updated.profileLabels[profileIndex] = trimmed || `Profile ${profileIndex + 1}`;
    onDraftChange(updated);
  }

  function setDigitalMapping(dest: number, src: number) {
    if (!draft) return;
    const updated = cloneDraft(draft);
    updated.digitalMappings[activeProfile] = [...(updated.digitalMappings[activeProfile] ?? [])];
    const currentMapping = updated.digitalMappings[activeProfile]!;
    const currentSrc = currentMapping[dest] ?? defaultDigitalMapping[dest] ?? dest;

    if (src === ORCA_DUMMY_FIELD) {
      currentMapping[dest] = src;
    } else {
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
    }
    onDraftChange(updated);
  }

  function setAnalogMapping(dest: number, src: number, virtualDest?: number) {
    if (!draft) return;
    const updated = cloneDraft(draft);
    updated.analogMappings[activeProfile] = [...(updated.analogMappings[activeProfile] ?? [])];
    const currentMapping = updated.analogMappings[activeProfile]!;
    const currentSrc = currentMapping[dest] ?? defaultAnalogMapping[dest] ?? dest;

    if (src === ORCA_ANALOG_MAPPING_DISABLED) {
      currentMapping[dest] = src;
    } else {
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
      if (configMode === 'gp2040' && dest === 4 && virtualDest !== undefined) {
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
    }
    onDraftChange(updated);
  }

  function clearAllBindings() {
    if (!draft) return;
    const updated = cloneDraft(draft);
    updated.digitalMappings[activeProfile] = digitalMapping.map((_, dest) =>
      isLockedDigitalDestination(dest) ? dest : ORCA_DUMMY_FIELD
    );
    updated.analogMappings[activeProfile] = analogMapping.map(() => ORCA_ANALOG_MAPPING_DISABLED);
    onDraftChange(updated);
  }

  function resetToDefaultBindings() {
    if (!draft) return;
    const updated = cloneDraft(draft);
    updated.digitalMappings[activeProfile] = [...defaultDigitalMapping];
    updated.analogMappings[activeProfile] = [...defaultAnalogMapping];
    onDraftChange(updated);
  }



  async function validateOnDevice() {
    if (!transport || !baseBlob || !draft) return;
    setLastError('');
    setProgress('Validating...');
    try {
      setBusy(true);
      await transport.beginSession();
      const staged = buildSettingsBlob(baseBlob, draft);
      await transport.writeBlob(activeSlot, staged, {
        maxChunk: deviceInfo?.maxChunk ?? 256,
        onProgress: (offset, total) => setProgress(`Staging ${offset}/${total}...`),
      });
      const res = await transport.validateStaged(activeSlot);
      setDeviceValidation({ ...res, decoded: decodeStagedInvalidMask(res.invalidMask) });
      setProgress('');
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
      setProgress('');
    } finally {
      setBusy(false);
    }
  }

  async function saveToDevice() {
    if (!transport || !deviceInfo || !baseBlob || !draft) return;
    setLastError('');
    setProgress('Saving...');
    setDeviceValidation(null);
    try {
      setBusy(true);
      await transport.beginSession();
      const staged = buildSettingsBlob(baseBlob, draft);
      await transport.writeBlob(activeSlot, staged, {
        maxChunk: deviceInfo.maxChunk,
        onProgress: (offset, total) => setProgress(`Writing ${offset}/${total}...`),
      });
      const v = await transport.validateStaged(activeSlot);
      const decoded = decodeStagedInvalidMask(v.invalidMask);
      setDeviceValidation({ ...v, decoded });
      if (v.invalidMask !== 0) throw new Error(`Validation failed: ${decoded.join(', ')}`);

      await transport.unlockWrites();
      const { generation } = await transport.commitStaged(activeSlot);

      const readBack = await transport.readBlob(activeSlot, {
        blobSize: deviceInfo.blobSize,
        maxChunk: deviceInfo.maxChunk,
      });
      const res = tryParseSettingsBlob(readBack);
      if (!res.ok) throw new Error(`Read-back failed: ${res.error}`);
      updateSlotState(activeSlot, { baseBlob: readBack, parsed: res.value, draft: res.value.draft, dirty: false });

      if (rebootAfterSave) {
        setProgress('Rebooting...');
        await transport.reboot();
        // Device will disconnect after reboot - reset UI
        await resetConnection();
        return;
      }
      setProgress('');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      // Check if error indicates disconnection
      if (errorMsg.includes('disconnected') || errorMsg.includes('closed') || errorMsg.includes('not open')) {
        await resetConnection();
        setLastError('Device disconnected. Please reconnect.');
      } else {
        setLastError(errorMsg);
      }
      setProgress('');
    } finally {
      setBusy(false);
    }
  }

  async function resetDefaultsOnDevice() {
    if (!transport || !deviceInfo) return;
    setLastError('');
    setProgress('Resetting...');
    setDeviceValidation(null);
    try {
      setBusy(true);
      await transport.beginSession();
      await transport.unlockWrites();
      await transport.resetDefaults(activeSlot);
      const readBack = await transport.readBlob(activeSlot, { blobSize: deviceInfo.blobSize, maxChunk: deviceInfo.maxChunk });
      const res = tryParseSettingsBlob(readBack);
      if (!res.ok) throw new Error(res.error);
      updateSlotState(activeSlot, { baseBlob: readBack, parsed: res.value, draft: res.value.draft, dirty: false });
      setProgress('');
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
      setProgress('');
    } finally {
      setBusy(false);
    }
  }

  async function rebootNow() {
    if (!transport) return;
    setLastError('');
    try {
      setBusy(true);
      await transport.reboot();
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function exportCurrentBlob() {
    if (baseBlob) downloadBytes(`orca-settings-${slotSuffix(activeSlot)}.bin`, baseBlob);
  }

  function exportDraftBlob() {
    if (baseBlob && draft) downloadBytes(`orca-settings-${slotSuffix(activeSlot)}-draft.bin`, buildSettingsBlob(baseBlob, draft));
  }

  async function importBlobFromFile(file: File) {
    setLastError('');
    setProgress('');
    setDeviceValidation(null);
    try {
      setBusy(true);
      const ab = await file.arrayBuffer();
      const blob = new Uint8Array(ab);
      const res = tryParseSettingsBlob(blob);
      if (!res.ok) throw new Error(res.error);
      updateSlotState(activeSlot, { baseBlob: blob, parsed: res.value, draft: res.value.draft, dirty: true });
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const deviceErrors = deviceValidation?.decoded ?? null;
  const deviceRepaired = deviceValidation?.repaired ?? null;
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

  return (
    <div className="layout-container">
      {/* Header */}
      <header className="layout-header">
        <div className="header-logo">
          <img src={OrcaLogo} alt="Orca Logo" style={{ height: '32px', marginRight: '12px' }} />
          <span className="header-title">Orca Control Panel</span>
        </div>

        <ModeTabs
          currentMode={configMode}
          onModeChange={handleModeChange}
          gp2040Enabled={!transport || (deviceInfo?.slotCount ?? 0) >= 2}
        />

        <div className="header-status">
          {progress && <span className="text-sm text-secondary">{progress}</span>}
          <div className="connection-indicator">
            <div className={`connection-dot ${transport ? 'connected' : ''}`} />
            <span>{transport ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="layout-body">
        {/* Main Content */}
        <main className="layout-main">
          <div className="main-content">
            {/* Error/Status Messages */}
            {lastError && (
              <div className="message message-error mb-md">
                {lastError}
              </div>
            )}

            {!transport ? (
              /* Not Connected State */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 'var(--spacing-lg)' }}>
                <h2 style={{ margin: 0, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                  Connect your Orca controller
                </h2>
                <button className="primary" onClick={connect} disabled={busy}>
                  {busy ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            ) : draft ? (
              /* Connected State */
              <div className="main-hero">
                {/* Profile Tabs */}
                <div className="profile-tabs">
                  {Array.from({ length: ORCA_CONFIG_SETTINGS_PROFILE_COUNT }, (_, i) => {
                    const isEditing = editingProfile === i;
                    const label = draft.profileLabels[i]?.trim() || `Profile ${i + 1}`;

                    return (
                      <button
                        key={i}
                        className={`profile-tab ${activeProfile === i ? 'active' : ''}`}
                        onClick={() => !isEditing && setActiveProfile(i)}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          if (!busy) {
                            setEditingProfile(i);
                            // Focus input after state update
                            setTimeout(() => {
                              const input = document.getElementById(`profile-input-${i}`) as HTMLInputElement;
                              if (input) {
                                input.select();
                              }
                            }, 0);
                          }
                        }}
                        disabled={busy}
                      >
                        {isEditing ? (
                          <input
                            id={`profile-input-${i}`}
                            type="text"
                            className="profile-tab-input"
                            defaultValue={label}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                renameProfile(i, e.currentTarget.value);
                                setEditingProfile(null);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingProfile(null);
                              }
                            }}
                            onBlur={(e) => {
                              renameProfile(i, e.currentTarget.value);
                              setEditingProfile(null);
                            }}
                          />
                        ) : (
                          label
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* GP2040 Label Presets */}
                {configMode === 'gp2040' && (
                  <div className="row mb-md" style={{ justifyContent: 'flex-end' }}>
                    <span className="text-sm text-secondary">Button labels</span>
                    <select
                      value={gp2040LabelPreset}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (isGp2040LabelPreset(value)) setGp2040LabelPreset(value);
                      }}
                      disabled={busy}
                      style={{ minWidth: 220 }}
                    >
                      <option value="gp2040">GP2040 (B1/B2/B3/B4)</option>
                      <option value="xbox">Xbox (A/B/X/Y)</option>
                      <option value="switch">Switch (B/A/Y/X)</option>
                      <option value="playstation">PlayStation (✕/○/□/△)</option>
                    </select>
                  </div>
                )}

                {/* Controller Visualizer */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, padding: 'var(--spacing-md) 0' }}>
                  <ControllerVisualizer
                    digitalMapping={digitalMapping}
                    analogMapping={analogMapping}
                    defaultDigitalMapping={defaultDigitalMapping}
                    defaultAnalogMapping={defaultAnalogMapping}
                    disabled={busy}
                    destinationLabelMode={configMode}
                    gp2040LabelPreset={gp2040LabelPreset}
                    gp2040AnalogTriggerRouting={gp2040AnalogTriggerOutput}
                    onDigitalMappingChange={setDigitalMapping}
                    onAnalogMappingChange={setAnalogMapping}
                    onClearAllBindings={clearAllBindings}
                    onResetToDefault={resetToDefaultBindings}
                  />
                </div>

                {/* Remapped indicator */}
                {remappedCount > 0 && (
                  <div className="text-center text-sm text-secondary">
                    {remappedCount} button{remappedCount > 1 ? 's' : ''} remapped
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </main>

        {/* Sidebar */}
        <aside className="layout-sidebar">
          {/* Connection Section */}
          <div className="sidebar-section">
            <div className="sidebar-header">
              <span className="sidebar-title">Connection</span>
              {transport && <span className="pill pill-ok">Connected</span>}
            </div>
            {transport ? (
              <div className="col">
                <div className="form-row">
                  <span className="form-label">Device</span>
                  <span className="text-sm">Orca</span>
                </div>
                <div className="form-row">
                  <span className="form-label">Schema</span>
                  <span className="text-sm">v{deviceInfo?.settingsMajor ?? '?'}.{deviceInfo?.settingsMinor ?? '?'}</span>
                </div>
                <button className="danger" onClick={disconnect} disabled={busy} style={{ marginTop: 'var(--spacing-sm)' }}>
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="text-sm text-muted">
                Not connected
              </div>
            )}
          </div>

          {/* DPAD Panel */}
          <CollapsiblePanel
            title="DPAD Layer"
            badge={draft?.dpadLayer?.[activeProfile]?.mode !== 0 ? <span className="pill pill-brand" style={{ marginLeft: 8 }}>Active</span> : null}
          >
            {draft ? (
              <DpadEditor draft={draft} disabled={busy} onChange={onDraftChange} contextMode={configMode} gp2040LabelPreset={gp2040LabelPreset} />
            ) : (
              <div className="text-sm text-muted">Connect to configure</div>
            )}
          </CollapsiblePanel>

          {/* Stick Curve Panel */}
          <CollapsiblePanel title="Stick Configuration">
            {draft ? (
              <>
                <StickCurveEditor draft={draft} disabled={busy} onChange={onDraftChange} mode={configMode} />
              </>
            ) : (
              <div className="text-sm text-muted">Connect to configure</div>
            )}
          </CollapsiblePanel>

          {/* Trigger Panel */}
          <CollapsiblePanel title="Trigger Policy">
            {draft ? (
              <>
                {activeSlot === 1 && (
                  <div className="text-xs text-muted" style={{ marginBottom: 'var(--spacing-sm)' }}>
                    Stored per mode and profile. GP2040 analog trigger routing is configured in the main mapping.
                  </div>
                )}
                <TriggerEditor draft={draft} disabled={busy} onChange={onDraftChange} />
              </>
            ) : (
              <div className="text-sm text-muted">Connect to configure</div>
            )}
          </CollapsiblePanel>

          {/* Validation Panel */}
          <CollapsiblePanel
            title="Validation"
            badge={
              localValidation.errors.length > 0 ? (
                <span className="pill pill-error" style={{ marginLeft: 8 }}>{localValidation.errors.length}</span>
              ) : localValidation.warnings.length > 0 ? (
                <span className="pill pill-warn" style={{ marginLeft: 8 }}>{localValidation.warnings.length}</span>
              ) : null
            }
          >
            <ValidationStatus
              errors={localValidation.errors}
              warnings={localValidation.warnings}
              deviceErrors={deviceErrors}
              deviceRepaired={deviceRepaired}
            />
          </CollapsiblePanel>

          {/* Settings Panel */}
          <CollapsiblePanel title="Settings">
            <div className="col">
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={allowUnsafeWrites}
                  onChange={(e) => setAllowUnsafeWrites(e.target.checked)}
                  disabled={busy}
                />
                Allow schema mismatch writes
              </label>
              {compatibility === 'minor_mismatch' && (
                <div className="text-xs text-muted">
                  Schema differs from device. Enable to write anyway.
                </div>
              )}
              {compatibility === 'major_mismatch' && (
                <div className="message message-error">
                  Major version mismatch. Update firmware.
                </div>
              )}
            </div>
          </CollapsiblePanel>
        </aside>
      </div>

      {/* Footer */}
      {draft && (
        <ActionToolbar
          dirty={dirty}
          canWrite={canWrite}
          busy={busy}
          hasLocalErrors={localValidation.errors.length > 0}
          onValidate={validateOnDevice}
          onSave={saveToDevice}
          onReset={() => setShowResetConfirm(true)}
          onReboot={rebootNow}
          onExportCurrent={exportCurrentBlob}
          onExportDraft={exportDraftBlob}
          onImport={() => importRef.current?.click()}
          rebootAfterSave={rebootAfterSave}
          onRebootAfterSaveChange={setRebootAfterSave}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={importRef}
        type="file"
        accept=".bin,application/octet-stream"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importBlobFromFile(file);
          e.target.value = '';
        }}
      />

      {/* Factory Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Factory Reset"
        message={`Reset ${slotDisplayName(activeSlot)} settings to factory defaults? This will wipe out all custom configurations for this mode.`}
        confirmLabel="Reset"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          setShowResetConfirm(false);
          void resetDefaultsOnDevice();
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
