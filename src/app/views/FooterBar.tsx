import { useRef } from 'react';
import { useOrcaApp } from '../contexts/OrcaAppContext';
import { ActionToolbar } from '../components/ActionToolbar';
import { ConfirmModal } from '../components/ConfirmModal';
import { slotDisplayName } from '../utils/slot';

export function FooterBar() {
  const {
    state,
    activeSlot,
    draft,
    dirty,
    canWrite,
    localValidation,
    validateOnDevice,
    saveToDevice,
    resetDefaultsOnDevice,
    rebootNow,
    exportCurrentProfile,
    exportCurrentBlob,
    exportDraftBlob,
    importDeviceBlobFromFile,
    importProfileFromFile,
    setRebootAfterSave,
    setShowResetConfirm,
  } = useOrcaApp();

  const importDeviceRef = useRef<HTMLInputElement | null>(null);
  const importProfileRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      {draft && (
        <ActionToolbar
          dirty={dirty}
          canWrite={canWrite}
          busy={state.busy}
          hasLocalErrors={localValidation.errors.length > 0}
          onValidate={() => void validateOnDevice()}
          onSave={() => void saveToDevice()}
          onReset={() => setShowResetConfirm(true)}
          onReboot={() => void rebootNow()}
          onExportProfile={exportCurrentProfile}
          onImportProfile={() => importProfileRef.current?.click()}
          onExportDeviceCurrent={exportCurrentBlob}
          onExportDeviceDraft={exportDraftBlob}
          onImportDevice={() => importDeviceRef.current?.click()}
          rebootAfterSave={state.rebootAfterSave}
          onRebootAfterSaveChange={setRebootAfterSave}
        />
      )}

      <input
        ref={importDeviceRef}
        type="file"
        accept=".bin,application/octet-stream"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importDeviceBlobFromFile(file);
          e.target.value = '';
        }}
      />

      <input
        ref={importProfileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importProfileFromFile(file);
          e.target.value = '';
        }}
      />

      <ConfirmModal
        isOpen={state.showResetConfirm}
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
    </>
  );
}

