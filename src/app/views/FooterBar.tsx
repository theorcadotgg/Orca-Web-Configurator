import { useMemo, useRef, useState } from 'react';
import { useOrcaApp } from '../contexts/OrcaAppContext';
import { ActionToolbar } from '../components/ActionToolbar';
import { ConfirmModal } from '../components/ConfirmModal';
import { slotDisplayName } from '../utils/slot';
import { findMeleeRulesetInvalidProfiles } from '../../validators/settingsValidation';

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
    factoryResetOnDevice,
    rebootNow,
    exportCurrentProfile,
    exportCurrentBlob,
    exportDraftBlob,
    importDeviceBlobFromFile,
    importProfileFromFile,
    setRebootAfterSave,
    setShowResetConfirm,
    setShowFactoryResetConfirm,
  } = useOrcaApp();

  const importDeviceRef = useRef<HTMLInputElement | null>(null);
  const importProfileRef = useRef<HTMLInputElement | null>(null);
  const [showMeleeConfirm, setShowMeleeConfirm] = useState(false);

  const meleeInvalidProfiles = useMemo(() => {
    if (!draft || state.configMode !== 'orca') return [];
    return findMeleeRulesetInvalidProfiles(draft);
  }, [draft, state.configMode]);

  const shouldConfirmMelee = meleeInvalidProfiles.length > 0;

  const handleSave = () => {
    if (shouldConfirmMelee) {
      setShowMeleeConfirm(true);
      return;
    }
    void saveToDevice();
  };

  return (
    <>
      {draft && (
        <ActionToolbar
          dirty={dirty}
          canWrite={canWrite}
          busy={state.busy}
          hasLocalErrors={localValidation.errors.length > 0}
          onValidate={() => void validateOnDevice()}
          onSave={handleSave}
          onResetMode={() => setShowResetConfirm(true)}
          onFactoryReset={() => setShowFactoryResetConfirm(true)}
          onReboot={() => void rebootNow()}
          onExportProfile={exportCurrentProfile}
          onImportProfile={() => importProfileRef.current?.click()}
          onExportDeviceCurrent={() => void exportCurrentBlob()}
          onExportDeviceDraft={() => void exportDraftBlob()}
          onImportDevice={() => importDeviceRef.current?.click()}
          rebootAfterSave={state.rebootAfterSave}
          onRebootAfterSaveChange={setRebootAfterSave}
        />
      )}

      <input
        ref={importDeviceRef}
        type="file"
        accept=".json,.bin,application/json,application/octet-stream"
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
        title="Reset Mode Defaults"
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

      <ConfirmModal
        isOpen={state.showFactoryResetConfirm}
        title="Factory Reset Device"
        message="Factory reset the controller? This resets both Orca and GP2040 mode settings and clears GP2040-CE saved settings. You will need to recalibrate."
        confirmLabel="Factory Reset"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          setShowFactoryResetConfirm(false);
          void factoryResetOnDevice();
        }}
        onCancel={() => setShowFactoryResetConfirm(false)}
      />

      <ConfirmModal
        isOpen={showMeleeConfirm}
        title="Melee Ruleset Warning"
        message="One of your profiles is not melee legal. Are you sure you want to save?"
        confirmLabel="Save"
        cancelLabel="Cancel"
        onConfirm={() => {
          setShowMeleeConfirm(false);
          void saveToDevice();
        }}
        onCancel={() => setShowMeleeConfirm(false)}
      />
    </>
  );
}
