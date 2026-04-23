import { useEffect, useState } from 'react';
import OrcaLogo from '../../assets/Orca_Logo_B.png';
import { useOrcaApp } from '../contexts/OrcaAppContext';
import { ModeTabs } from '../components/ModeTabs';
import { useChangelog } from '../changelog/ChangelogProvider';
import { FirmwareDownloadLink } from '../components/FirmwareDownloadLink';
import { Gp2040HelpModal } from '../components/Gp2040HelpModal';
import { Gp2040InputModeModal } from '../components/Gp2040InputModeModal';

export function HeaderBar() {
  const {
    state,
    handleModeChange,
    compatibility,
    gp2040InputMode,
    setGp2040InputModeDraft,
    applyGp2040InputMode,
  } = useOrcaApp();
  const { openLatestConfigurator, hasUnseenConfigurator, latestFirmwareDownload } = useChangelog();
  const [isGp2040HelpOpen, setIsGp2040HelpOpen] = useState(false);
  const [isGp2040InputModeOpen, setIsGp2040InputModeOpen] = useState(false);

  const hasSchemaMismatch = compatibility === 'minor_mismatch' || compatibility === 'major_mismatch';
  const firmwareFilename = latestFirmwareDownload?.filename ?? 'Orca+GP2040.uf2';
  const showGp2040HeaderActions = state.configMode === 'gp2040' && !!state.transport;

  useEffect(() => {
    if (showGp2040HeaderActions) return;
    setIsGp2040InputModeOpen(false);
    setIsGp2040HelpOpen(false);
  }, [showGp2040HeaderActions]);

  return (
    <>
      <header className="layout-header">
        <div className="header-logo">
          <img src={OrcaLogo} alt="Orca Logo" style={{ height: '32px', marginRight: '12px' }} />
          <span className="header-title">Orca Control Panel</span>
        </div>

        <ModeTabs
          currentMode={state.configMode}
          onModeChange={handleModeChange}
          gp2040Enabled={!state.transport || (state.deviceInfo?.slotCount ?? 0) >= 2}
        />

        <div className="header-status">
          {state.progress && <span className="text-sm text-secondary">{state.progress}</span>}
          {showGp2040HeaderActions && (
            <div className="header-gp2040-actions">
              <button
                className="ghost sm gp2040-header-trigger"
                onClick={() => setIsGp2040InputModeOpen(true)}
                title="Open GP2040 input mode settings"
              >
                Input Mode
              </button>
              <button
                className="ghost sm gp2040-header-trigger"
                onClick={() => setIsGp2040HelpOpen(true)}
                title="Open GP2040 instructions"
              >
                GP2040 Help
              </button>
            </div>
          )}
          <FirmwareDownloadLink
            href={`${import.meta.env.BASE_URL}${firmwareFilename}`}
            download={firmwareFilename}
            className={`btn-download${hasSchemaMismatch ? ' btn-download-alert' : ''}`}
            title={hasSchemaMismatch
              ? "Firmware update recommended! Your controller's firmware doesn't match this configurator version."
              : "Download the latest combined Orca + GP2040 firmware"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {hasSchemaMismatch ? 'Update Firmware!' : 'Download Firmware'}
          </FirmwareDownloadLink>
          <button
            className="ghost sm"
            onClick={openLatestConfigurator}
            title="View changelog"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
            <span>Changelog</span>
            {hasUnseenConfigurator && (
              <span className="pill pill-brand" style={{ marginLeft: 4 }}>
                New
              </span>
            )}
          </button>
          <div className="connection-indicator">
            <div className={`connection-dot ${state.transport ? 'connected' : ''}`} />
            <span>{state.transport ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      <Gp2040InputModeModal
        isOpen={isGp2040InputModeOpen}
        inputModeState={gp2040InputMode}
        disabled={state.busy}
        onDraftChange={setGp2040InputModeDraft}
        onApply={applyGp2040InputMode}
        onClose={() => setIsGp2040InputModeOpen(false)}
      />
      <Gp2040HelpModal isOpen={isGp2040HelpOpen} onClose={() => setIsGp2040HelpOpen(false)} />
    </>
  );
}
