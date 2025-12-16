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
    <div className="card">
      <div className="row">
        <strong>Connection</strong>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label>
          <input
            type="checkbox"
            checked={useMock}
            onChange={(e) => onToggleMock(e.target.checked)}
            disabled={connected || busy}
          />{' '}
          Mock device
        </label>
        {!connected ? (
          <button onClick={onConnect} disabled={busy}>
            Connect
          </button>
        ) : (
          <button onClick={onDisconnect} disabled={busy}>
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

