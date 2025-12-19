import OrcaLogo from '../../assets/Orca_Logo_B.png';
import { useOrcaApp } from '../contexts/OrcaAppContext';
import { ModeTabs } from '../components/ModeTabs';

export function HeaderBar() {
  const { state, handleModeChange } = useOrcaApp();

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
        <div className="connection-indicator">
          <div className={`connection-dot ${state.transport ? 'connected' : ''}`} />
          <span>{state.transport ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  );
}

