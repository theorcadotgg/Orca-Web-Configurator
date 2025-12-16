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

  const msg =
    compatibility === 'ok'
      ? `Schema OK (${schemaHex(deviceInfo.schemaId)})`
      : compatibility === 'minor_mismatch'
        ? `Schema mismatch (best-effort): device ${schemaHex(deviceInfo.schemaId)} vs app ${schemaHex(ORCA_CONFIG_SCHEMA_ID)}`
        : compatibility === 'major_mismatch'
          ? `Incompatible settings schema: device v${deviceInfo.settingsMajor}.${deviceInfo.settingsMinor} vs app v${ORCA_CONFIG_SETTINGS_VERSION_MAJOR}.${ORCA_CONFIG_SETTINGS_VERSION_MINOR}`
          : '';

  return (
    <div className="card">
      <div className="row">
        <strong>Device</strong>
        <span>{msg}</span>
      </div>

      {compatibility === 'minor_mismatch' ? (
        <div style={{ marginTop: 10 }}>
          <label>
            <input
              type="checkbox"
              checked={allowUnsafeWrites}
              onChange={(e) => onToggleAllowUnsafeWrites(e.target.checked)}
            />{' '}
            Allow writes with schema mismatch (best-effort)
          </label>
        </div>
      ) : null}

      <pre style={{ marginTop: 10 }}>{JSON.stringify(deviceInfo, null, 2)}</pre>
    </div>
  );
}

