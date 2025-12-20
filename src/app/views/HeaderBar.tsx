import OrcaLogo from '../../assets/Orca_Logo_B.png';
import { useOrcaApp } from '../contexts/OrcaAppContext';
import { ModeTabs } from '../components/ModeTabs';

export function HeaderBar() {
  const { state, handleModeChange, compatibility } = useOrcaApp();

  const hasSchemaMismatch = compatibility === 'minor_mismatch' || compatibility === 'major_mismatch';

  return (
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
        <a
          href="/OrcaDol2.0.uf2"
          download="OrcaDol2.0.uf2"
          className={`btn-download${hasSchemaMismatch ? ' btn-download-alert' : ''}`}
          title={hasSchemaMismatch
            ? "Firmware update recommended! Your controller's firmware doesn't match this configurator version."
            : "Download the latest Orca firmware"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {hasSchemaMismatch ? 'Update Firmware!' : 'Download Firmware'}
        </a>
        <div className="connection-indicator">
          <div className={`connection-dot ${state.transport ? 'connected' : ''}`} />
          <span>{state.transport ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  );
}

