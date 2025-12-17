import { useMemo, useRef, useState } from 'react';
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

type DeviceValidationState = ValidateStagedResult & { decoded: string[] };
type Compatibility = 'ok' | 'major_mismatch' | 'minor_mismatch' | 'unknown';

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
    dpadLayer: { ...draft.dpadLayer, enable: { ...draft.dpadLayer.enable }, up: { ...draft.dpadLayer.up }, down: { ...draft.dpadLayer.down }, left: { ...draft.dpadLayer.left }, right: { ...draft.dpadLayer.right } },
    triggerPolicy: { ...draft.triggerPolicy },
    stickCurveParams: {
      ...draft.stickCurveParams,
      range: [...draft.stickCurveParams.range],
      notch: [...draft.stickCurveParams.notch],
      dz_lower: [...draft.stickCurveParams.dz_lower],
      dz_upper: [...draft.stickCurveParams.dz_upper],
    },
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
  const [configMode, setConfigMode] = useState<'orca' | 'gp2040'>('orca');

  // Data state
  const [baseBlob, setBaseBlob] = useState<Uint8Array | null>(null);
  const [parsed, setParsed] = useState<ParsedSettings | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [dirty, setDirty] = useState(false);

  const [deviceValidation, setDeviceValidation] = useState<DeviceValidationState | null>(null);
  const [rebootAfterSave, setRebootAfterSave] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const importRef = useRef<HTMLInputElement | null>(null);

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
  const digitalMapping = draft?.digitalMappings[activeProfile] ?? [];
  const analogMapping = draft?.analogMappings[activeProfile] ?? [];

  // Handlers
  async function connect() {
    setLastError('');
    setProgress('');
    setDeviceValidation(null);
    try {
      setBusy(true);
      const nextTransport = await OrcaWebSerialTransport.requestAndOpen();
      const info = await nextTransport.getInfo();
      setTransport(nextTransport);
      setDeviceInfo(info);

      setProgress('Reading settings...');
      const blob = await nextTransport.readBlob({
        blobSize: info.blobSize,
        maxChunk: info.maxChunk,
        onProgress: (offset, total) => setProgress(`Reading ${offset}/${total}...`),
      });
      setBaseBlob(blob);
      const res = tryParseSettingsBlob(blob);
      if (!res.ok) throw new Error(res.error);
      setParsed(res.value);
      setDraft(res.value.draft);
      setDirty(false);
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
      setBaseBlob(null);
      setParsed(null);
      setDraft(null);
      setDirty(false);
      setBusy(false);
    }
  }

  // Reset connection state without trying to close (for when device reboots/disconnects)
  function resetConnection() {
    setTransport(null);
    setDeviceInfo(null);
    setBaseBlob(null);
    setParsed(null);
    setDraft(null);
    setDirty(false);
    setDeviceValidation(null);
    setProgress('');
  }

  function onDraftChange(next: SettingsDraft) {
    setDraft(next);
    setDirty(true);
    setDeviceValidation(null);
  }

  function setActiveProfile(next: number) {
    if (!draft) return;
    const updated = cloneDraft(draft);
    updated.activeProfile = next;
    onDraftChange(updated);
  }

  function setDigitalMapping(dest: number, src: number) {
    if (!draft) return;
    const updated = cloneDraft(draft);
    updated.digitalMappings[activeProfile] = [...(updated.digitalMappings[activeProfile] ?? [])];
    const currentMapping = updated.digitalMappings[activeProfile]!;
    const currentSrc = currentMapping[dest] ?? dest;

    if (src === ORCA_DUMMY_FIELD) {
      currentMapping[dest] = src;
    } else {
      const numSlots = Math.max(currentMapping.length, DIGITAL_INPUTS.length);
      for (let otherDest = 0; otherDest < numSlots; otherDest++) {
        if (otherDest === dest) continue;
        if (isLockedDigitalDestination(otherDest)) continue;
        const otherSrc = currentMapping[otherDest] ?? otherDest;
        if (otherSrc === src) {
          currentMapping[otherDest] = currentSrc;
          break;
        }
      }
      currentMapping[dest] = src;
    }
    onDraftChange(updated);
  }

  function setAnalogMapping(dest: number, src: number) {
    if (!draft) return;
    const updated = cloneDraft(draft);
    updated.analogMappings[activeProfile] = [...(updated.analogMappings[activeProfile] ?? [])];
    const currentMapping = updated.analogMappings[activeProfile]!;
    const currentSrc = currentMapping[dest] ?? dest;

    if (src === ORCA_ANALOG_MAPPING_DISABLED) {
      currentMapping[dest] = src;
    } else {
      const numSlots = Math.max(currentMapping.length, ANALOG_INPUTS.length);
      for (let otherDest = 0; otherDest < numSlots; otherDest++) {
        if (otherDest === dest) continue;
        const otherSrc = currentMapping[otherDest] ?? otherDest;
        if (otherSrc === src) {
          currentMapping[otherDest] = currentSrc;
          break;
        }
      }
      currentMapping[dest] = src;
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
    // Reset each digital button to map to itself (identity mapping)
    updated.digitalMappings[activeProfile] = digitalMapping.map((_, dest) => dest);
    // Reset each analog input to map to itself (identity mapping)
    updated.analogMappings[activeProfile] = analogMapping.map((_, dest) => dest);
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
      await transport.writeBlob(staged, {
        maxChunk: deviceInfo?.maxChunk ?? 256,
        onProgress: (offset, total) => setProgress(`Staging ${offset}/${total}...`),
      });
      const res = await transport.validateStaged();
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
      await transport.writeBlob(staged, {
        maxChunk: deviceInfo.maxChunk,
        onProgress: (offset, total) => setProgress(`Writing ${offset}/${total}...`),
      });
      const v = await transport.validateStaged();
      const decoded = decodeStagedInvalidMask(v.invalidMask);
      setDeviceValidation({ ...v, decoded });
      if (v.invalidMask !== 0) throw new Error(`Validation failed: ${decoded.join(', ')}`);

      await transport.unlockWrites();
      const { generation } = await transport.commitStaged();

      const readBack = await transport.readBlob({
        blobSize: deviceInfo.blobSize,
        maxChunk: deviceInfo.maxChunk,
      });
      setBaseBlob(readBack);
      const res = tryParseSettingsBlob(readBack);
      if (!res.ok) throw new Error(`Read-back failed: ${res.error}`);
      setParsed(res.value);
      setDraft(res.value.draft);
      setDirty(false);

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
      await transport.resetDefaults();
      const readBack = await transport.readBlob({ blobSize: deviceInfo.blobSize, maxChunk: deviceInfo.maxChunk });
      setBaseBlob(readBack);
      const res = tryParseSettingsBlob(readBack);
      if (!res.ok) throw new Error(res.error);
      setParsed(res.value);
      setDraft(res.value.draft);
      setDirty(false);
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
    if (baseBlob) downloadBytes('orca-settings.bin', baseBlob);
  }

  function exportDraftBlob() {
    if (baseBlob && draft) downloadBytes('orca-settings-draft.bin', buildSettingsBlob(baseBlob, draft));
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
      setBaseBlob(blob);
      setParsed(res.value);
      setDraft(res.value.draft);
      setDirty(true);
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const deviceErrors = deviceValidation?.decoded ?? null;
  const deviceRepaired = deviceValidation?.repaired ?? null;
  const remappedCount = digitalMapping.filter((s, d) => s !== d).length + analogMapping.filter((s, d) => s !== d).length;

  return (
    <div className="layout-container">
      {/* Header */}
      <header className="layout-header">
        <div className="header-logo">
          <span className="header-title">Orca Configurator</span>
        </div>

        <ModeTabs
          currentMode={configMode}
          onModeChange={setConfigMode}
          gp2040Enabled={false}
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
                  {Array.from({ length: ORCA_CONFIG_SETTINGS_PROFILE_COUNT }, (_, i) => (
                    <button
                      key={i}
                      className={`profile-tab ${activeProfile === i ? 'active' : ''}`}
                      onClick={() => setActiveProfile(i)}
                      disabled={busy}
                    >
                      {draft.profileLabels[i]?.trim() || `Profile ${i + 1}`}
                    </button>
                  ))}
                </div>

                {/* Controller Visualizer */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, padding: 'var(--spacing-md) 0' }}>
                  <ControllerVisualizer
                    digitalMapping={digitalMapping}
                    analogMapping={analogMapping}
                    disabled={busy}
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
          <CollapsiblePanel title="DPAD Layer" badge={draft?.dpadLayer.mode !== 0 ? <span className="pill pill-brand" style={{ marginLeft: 8 }}>Active</span> : null}>
            {draft ? (
              <DpadEditor draft={draft} disabled={busy} onChange={onDraftChange} />
            ) : (
              <div className="text-sm text-muted">Connect to configure</div>
            )}
          </CollapsiblePanel>

          {/* Stick Curve Panel */}
          <CollapsiblePanel title="Stick Configuration">
            {draft ? (
              <StickCurveEditor draft={draft} disabled={busy} onChange={onDraftChange} />
            ) : (
              <div className="text-sm text-muted">Connect to configure</div>
            )}
          </CollapsiblePanel>

          {/* Trigger Panel */}
          <CollapsiblePanel title="Trigger Policy">
            {draft ? (
              <TriggerEditor draft={draft} disabled={busy} onChange={onDraftChange} />
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
        message="Are you sure you want to reset all settings to factory defaults? This will wipe out all your custom configurations."
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
