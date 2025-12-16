import { ORCA_CONFIG_SCHEMA_ID, ORCA_CONFIG_SETTINGS_VERSION_MAJOR, ORCA_CONFIG_SETTINGS_VERSION_MINOR } from '@shared/orca_config_idl_generated';
import type { DeviceInfo } from '../../usb/OrcaTransport';

export type Compatibility = 'ok' | 'minor_mismatch' | 'major_mismatch' | 'unknown';

function schemaHex(id: number): string {
  return `0x${(id >>> 0).toString(16)}`;
}

type Props = {
  deviceInfo: DeviceInfo | null;
  compatibility: Compatibility;
  allowUnsafeWrites: boolean;
  onToggleAllowUnsafeWrites: (next: boolean) => void;
};

export function DeviceInfoCard({ deviceInfo, compatibility, allowUnsafeWrites, onToggleAllowUnsafeWrites }: Props) {
  if (!deviceInfo) return null;

  const compatPill =
    compatibility === 'ok' ? (
      <span className="pill pill-ok">Schema OK</span>
    ) : compatibility === 'minor_mismatch' ? (
      <span className="pill pill-warn">Schema Mismatch</span>
    ) : compatibility === 'major_mismatch' ? (
      <span className="pill pill-bad">Incompatible</span>
    ) : null;

  return (
    <div className="card animate-slide-up">
      <div className="card-header">
        <div className="row" style={{ gap: 'var(--spacing-md)' }}>
          <h2 className="card-title">Device Information</h2>
          {compatPill}
        </div>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          {schemaHex(deviceInfo.schemaId)}
        </span>
      </div>

      <div className="grid grid-3" style={{ gap: 'var(--spacing-lg)' }}>
        <div className="col">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Version
          </span>
          <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
            v{deviceInfo.settingsMajor}.{deviceInfo.settingsMinor}
          </span>
        </div>
        <div className="col">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Blob Size
          </span>
          <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
            {deviceInfo.blobSize} bytes
          </span>
        </div>
        <div className="col">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Max Chunk
          </span>
          <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
            {deviceInfo.maxChunk} bytes
          </span>
        </div>
      </div>

      {compatibility === 'minor_mismatch' && (
        <div className="message message-info" style={{ marginTop: 'var(--spacing-md)' }}>
          <label>
            <input
              type="checkbox"
              checked={allowUnsafeWrites}
              onChange={(e) => onToggleAllowUnsafeWrites(e.target.checked)}
            />
            Allow writes with schema mismatch (best-effort)
          </label>
          <p style={{ margin: '8px 0 0', opacity: 0.8, fontSize: 'var(--font-size-sm)' }}>
            Device schema: {schemaHex(deviceInfo.schemaId)} | App schema: {schemaHex(ORCA_CONFIG_SCHEMA_ID)}
          </p>
        </div>
      )}

      {compatibility === 'major_mismatch' && (
        <div className="message message-error" style={{ marginTop: 'var(--spacing-md)' }}>
          Incompatible settings version: device v{deviceInfo.settingsMajor}.{deviceInfo.settingsMinor} vs app v{ORCA_CONFIG_SETTINGS_VERSION_MAJOR}.{ORCA_CONFIG_SETTINGS_VERSION_MINOR}
        </div>
      )}
    </div>
  );
}
