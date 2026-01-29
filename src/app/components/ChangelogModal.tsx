import { useEffect, useMemo } from 'react';
import { findChangelogEntry, getLatestChangelogEntryId, type Changelog } from '../changelog/changelog';
import { FirmwareDownloadLink } from './FirmwareDownloadLink';

type Props = {
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  changelog: Changelog | null;
  selectedEntryId: string | null;
  onSelectEntryId: (next: string) => void;
  onClose: () => void;
};

export function ChangelogModal({
  isOpen,
  loading,
  error,
  changelog,
  selectedEntryId,
  onSelectEntryId,
  onClose,
}: Props) {
  const entries = changelog?.entries ?? [];

  const latestConfiguratorId = useMemo(
    () => (changelog ? getLatestChangelogEntryId(changelog, 'configurator') : null),
    [changelog],
  );

  const effectiveSelectedId = selectedEntryId ?? latestConfiguratorId ?? entries[0]?.id ?? null;
  const entry = useMemo(
    () => (changelog && effectiveSelectedId ? findChangelogEntry(changelog, effectiveSelectedId) : undefined),
    [changelog, effectiveSelectedId],
  );
  const relatedFirmwareId = entry?.kind === 'configurator' ? entry.related?.firmwareId : undefined;
  const relatedFirmwareEntry = useMemo(() => {
    if (!changelog || !relatedFirmwareId) return undefined;
    const candidate = findChangelogEntry(changelog, relatedFirmwareId);
    if (!candidate || candidate.kind !== 'firmware') return undefined;
    return candidate;
  }, [changelog, relatedFirmwareId]);

  useEffect(() => {
    if (!isOpen) return;
    if (!effectiveSelectedId) return;
    if (selectedEntryId == null) onSelectEntryId(effectiveSelectedId);
  }, [effectiveSelectedId, isOpen, onSelectEntryId, selectedEntryId]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const configuratorEntries = entries.filter((e) => e.kind === 'configurator');
  const firmwareEntries = entries.filter((e) => e.kind === 'firmware');

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Changelog">
      <div className="modal-content changelog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--spacing-md)' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Changelog</h3>
            <div className="text-xs text-muted">What’s new in Orca</div>
          </div>
          <button className="ghost sm" onClick={onClose} aria-label="Close changelog">
            ✕
          </button>
        </div>

        <div className="row" style={{ marginTop: 'var(--spacing-md)', gap: 'var(--spacing-sm)' }}>
          <span className="text-xs text-secondary">Entry</span>
          <select
            value={effectiveSelectedId ?? ''}
            onChange={(e) => onSelectEntryId(e.target.value)}
            disabled={loading || !!error || entries.length === 0}
            style={{ flex: 1 }}
          >
            {configuratorEntries.length > 0 && (
              <optgroup label="Configurator">
                {configuratorEntries.map((e) => (
                  <option key={e.id} value={e.id}>
                    v{e.version} — {e.title}
                  </option>
                ))}
              </optgroup>
            )}
            {firmwareEntries.length > 0 && (
              <optgroup label="Firmware">
                {firmwareEntries.map((e) => (
                  <option key={e.id} value={e.id}>
                    v{e.version} — {e.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="changelog-body" style={{ marginTop: 'var(--spacing-md)' }}>
          {loading ? (
            <div className="text-sm text-muted">Loading changelog…</div>
          ) : error ? (
            <div className="text-sm text-muted">Couldn’t load changelog: {error}</div>
          ) : !entry ? (
            <div className="text-sm text-muted">Changelog unavailable.</div>
          ) : (
            <>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="text-xs text-secondary">
                    {entry.kind === 'configurator' ? 'Configurator' : 'Firmware'} • v{entry.version}
                    {entry.date ? ` • ${entry.date}` : ''}
                  </div>
                  <h4 style={{ margin: '4px 0 0', color: 'var(--color-text-primary)' }}>{entry.title}</h4>
                </div>

                {entry.kind === 'firmware' && entry.download && (
                  <FirmwareDownloadLink
                    className="btn-download"
                    href={`${import.meta.env.BASE_URL}${entry.download.filename}`}
                    download={entry.download.filename}
                    style={{ padding: 'var(--spacing-xs) var(--spacing-md)', fontSize: 'var(--font-size-xs)' }}
                  >
                    {entry.download.label ?? 'Download'}
                  </FirmwareDownloadLink>
                )}
              </div>

              {entry.links && entry.links.length > 0 && (
                <div className="row" style={{ marginTop: 'var(--spacing-sm)', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                  {entry.links.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 'var(--spacing-md)' }}>
                {entry.sections.map((section) => (
                  <div key={section.title} style={{ marginBottom: 'var(--spacing-md)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{section.title}</div>
                    {section.items.length > 0 ? (
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {section.items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-muted">No details.</div>
                    )}
                  </div>
                ))}
              </div>

              {entry.kind === 'configurator' && relatedFirmwareEntry && (
                <div style={{ marginTop: 'var(--spacing-lg)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--color-border)' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="text-xs text-secondary">
                        Firmware • v{relatedFirmwareEntry.version}
                        {relatedFirmwareEntry.date ? ` • ${relatedFirmwareEntry.date}` : ''}
                      </div>
                      <h4 style={{ margin: '4px 0 0', color: 'var(--color-text-primary)' }}>
                        {relatedFirmwareEntry.title}
                      </h4>
                    </div>

                    {relatedFirmwareEntry.download && (
                      <FirmwareDownloadLink
                        className="btn-download"
                        href={`${import.meta.env.BASE_URL}${relatedFirmwareEntry.download.filename}`}
                        download={relatedFirmwareEntry.download.filename}
                        style={{ padding: 'var(--spacing-xs) var(--spacing-md)', fontSize: 'var(--font-size-xs)' }}
                      >
                        {relatedFirmwareEntry.download.label ?? 'Download'}
                      </FirmwareDownloadLink>
                    )}
                  </div>

                  {relatedFirmwareEntry.links && relatedFirmwareEntry.links.length > 0 && (
                    <div className="row" style={{ marginTop: 'var(--spacing-sm)', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                      {relatedFirmwareEntry.links.map((link) => (
                        <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                          {link.label}
                        </a>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 'var(--spacing-md)' }}>
                    {relatedFirmwareEntry.sections.map((section) => (
                      <div key={section.title} style={{ marginBottom: 'var(--spacing-md)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{section.title}</div>
                        {section.items.length > 0 ? (
                          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                            {section.items.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-xs text-muted">No details.</div>
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              )}
            </>
          )}
        </div>

        <div className="row" style={{ marginTop: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
