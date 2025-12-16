import type { SettingsHeaderInfo } from '../../schema/settingsBlob';

type Props = {
  header: SettingsHeaderInfo | null;
};

export function SettingsSummaryCard({ header }: Props) {
  if (!header) return null;
  return (
    <div className="card">
      <div className="row">
        <strong>Settings</strong>
        <span>
          CRC {header.crcValid ? 'OK' : 'Mismatch'} (stored 0x{header.storedCrc32.toString(16)}, computed 0x
          {header.computedCrc32.toString(16)})
        </span>
      </div>
      <pre style={{ marginTop: 10 }}>{JSON.stringify(header, null, 2)}</pre>
    </div>
  );
}

