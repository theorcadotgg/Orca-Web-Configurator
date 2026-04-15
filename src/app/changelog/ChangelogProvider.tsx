import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChangelogModal } from '../components/ChangelogModal';
import {
  findChangelogEntry,
  getLatestChangelogEntryId,
  parseChangelog,
  shouldAutoOpenChangelog,
  type Changelog,
  type ChangelogDownload,
} from './changelog';

const LAST_SEEN_CONFIGURATOR_ID_KEY = 'orca.changelog.lastSeenConfiguratorId';
const PENDING_UPDATE_KEY = 'orca.changelog.pendingUpdate';

function safeGetLocalStorageItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorageItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemoveLocalStorageItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

type ChangelogController = {
  openLatestConfigurator: () => void;
  openLatestFirmware: () => void;
  hasUnseenConfigurator: boolean;
  latestFirmwareDownload: ChangelogDownload | null;
};

const ChangelogContext = createContext<ChangelogController | null>(null);

export function ChangelogProvider({ children }: { children: ReactNode }) {
  const [changelog, setChangelog] = useState<Changelog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const [lastSeenConfiguratorId, setLastSeenConfiguratorId] = useState<string | null>(() =>
    safeGetLocalStorageItem(LAST_SEEN_CONFIGURATOR_ID_KEY),
  );
  const [pendingUpdate, setPendingUpdate] = useState(() => safeGetLocalStorageItem(PENDING_UPDATE_KEY) === '1');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}changelog.json`);
        if (!res.ok) throw new Error(`Failed to load changelog.json (${res.status})`);
        const raw = (await res.json()) as unknown;
        const parsed = parseChangelog(raw);
        if (!parsed) throw new Error('Invalid changelog.json');
        if (cancelled) return;
        setChangelog(parsed);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load changelog';
        setError(message);
        setChangelog(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const latestConfiguratorId = useMemo(() => {
    if (!changelog) return null;
    return getLatestChangelogEntryId(changelog, 'configurator');
  }, [changelog]);

  const latestFirmwareId = useMemo(() => {
    if (!changelog) return null;
    return getLatestChangelogEntryId(changelog, 'firmware');
  }, [changelog]);
  const latestFirmwareDownload = useMemo(() => {
    if (!changelog || !latestFirmwareId) return null;
    const entry = findChangelogEntry(changelog, latestFirmwareId);
    if (!entry || entry.kind !== 'firmware') return null;
    return entry.download ?? null;
  }, [changelog, latestFirmwareId]);

  const hasUnseenConfigurator = useMemo(() => {
    if (!latestConfiguratorId) return false;
    if (lastSeenConfiguratorId == null || lastSeenConfiguratorId === '') return true;
    return lastSeenConfiguratorId !== latestConfiguratorId;
  }, [lastSeenConfiguratorId, latestConfiguratorId]);

  const didAutoOpenRef = useRef(false);
  useEffect(() => {
    if (didAutoOpenRef.current) return;
    if (loading) return;
    if (!changelog) return;

    const shouldOpen = shouldAutoOpenChangelog({
      latestConfiguratorId,
      lastSeenConfiguratorId,
      pendingUpdate,
    });
    if (!shouldOpen) {
      didAutoOpenRef.current = true;
      return;
    }

    didAutoOpenRef.current = true;
    setSelectedEntryId(latestConfiguratorId);
    setIsOpen(true);
  }, [changelog, lastSeenConfiguratorId, latestConfiguratorId, loading, pendingUpdate]);

  const openLatestConfigurator = useCallback(() => {
    if (latestConfiguratorId) setSelectedEntryId(latestConfiguratorId);
    setIsOpen(true);
  }, [latestConfiguratorId]);

  const openLatestFirmware = useCallback(() => {
    if (latestFirmwareId) setSelectedEntryId(latestFirmwareId);
    setIsOpen(true);
  }, [latestFirmwareId]);

  const close = useCallback(() => {
    setIsOpen(false);

    if (latestConfiguratorId) {
      safeSetLocalStorageItem(LAST_SEEN_CONFIGURATOR_ID_KEY, latestConfiguratorId);
      setLastSeenConfiguratorId(latestConfiguratorId);
    }

    if (pendingUpdate) {
      safeRemoveLocalStorageItem(PENDING_UPDATE_KEY);
      setPendingUpdate(false);
    }
  }, [latestConfiguratorId, pendingUpdate]);

  const controller = useMemo(
    () => ({
      openLatestConfigurator,
      openLatestFirmware,
      hasUnseenConfigurator,
      latestFirmwareDownload,
    }),
    [hasUnseenConfigurator, latestFirmwareDownload, openLatestConfigurator, openLatestFirmware],
  );

  return (
    <ChangelogContext.Provider value={controller}>
      {children}
      <ChangelogModal
        isOpen={isOpen}
        loading={loading}
        error={error}
        changelog={changelog}
        selectedEntryId={selectedEntryId}
        onSelectEntryId={setSelectedEntryId}
        onClose={close}
      />
    </ChangelogContext.Provider>
  );
}

export function useChangelog(): ChangelogController {
  const ctx = useContext(ChangelogContext);
  if (!ctx) throw new Error('useChangelog must be used within <ChangelogProvider>');
  return ctx;
}
