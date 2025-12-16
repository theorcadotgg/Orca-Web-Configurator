import type { ReactNode } from 'react';

type Props = {
  useMock: boolean;
  onToggleMock: (next: boolean) => void;
  connected: boolean;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onReadSettings: () => void;
  readLabel?: ReactNode;
};

export function ConnectionCard({
  useMock,
  onToggleMock,
  connected,
  busy,
  onConnect,
  onDisconnect,
  onReadSettings,
  readLabel,
}: Props) {
  return (
    <div className="card animate-slide-up">
      <div className="card-header">
        <div className="row" style={{ gap: 'var(--spacing-md)' }}>
          <h2 className="card-title">Connection</h2>
          <div className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
          {connected && <span className="pill pill-ok">Connected</span>}
        </div>
      </div>

      <div className="row">
        <label>
          <input
            type="checkbox"
            checked={useMock}
            onChange={(e) => onToggleMock(e.target.checked)}
            disabled={connected || busy}
          />
          Use mock device
        </label>

        {!connected ? (
          <button onClick={onConnect} disabled={busy} className="primary">
            Connect
          </button>
        ) : (
          <button onClick={onDisconnect} disabled={busy} className="danger">
            Disconnect
          </button>
        )}

        <button onClick={onReadSettings} disabled={!connected || busy}>
          {readLabel ?? 'Read settings'}
        </button>
      </div>
    </div>
  );
}
