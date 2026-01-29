export type ChangelogKind = 'configurator' | 'firmware';

export type ChangelogDownload = {
  filename: string;
  label?: string;
};

export type ChangelogLink = {
  label: string;
  href: string;
};

export type ChangelogSection = {
  title: string;
  items: string[];
};

export type ChangelogEntry = {
  id: string;
  kind: ChangelogKind;
  version: string;
  date?: string;
  title: string;
  sections: ChangelogSection[];
  download?: ChangelogDownload;
  links?: ChangelogLink[];
  related?: { firmwareId?: string };
};

export type Changelog = {
  latest: {
    configurator: string;
    firmware: string;
  };
  entries: ChangelogEntry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseChangelogKind(value: unknown): ChangelogKind | null {
  if (value === 'configurator' || value === 'firmware') return value;
  return null;
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map((item) => (typeof item === 'string' ? item : '')).filter((item) => item.length > 0);
  return items;
}

function parseSections(value: unknown): ChangelogSection[] | null {
  if (!Array.isArray(value)) return null;
  const sections: ChangelogSection[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const title = parseNonEmptyString(item.title);
    const items = parseStringArray(item.items);
    if (!title || !items) continue;
    sections.push({ title, items });
  }
  return sections;
}

function parseLinks(value: unknown): ChangelogLink[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const links: ChangelogLink[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const label = parseNonEmptyString(item.label);
    const href = parseNonEmptyString(item.href);
    if (!label || !href) continue;
    links.push({ label, href });
  }
  return links.length > 0 ? links : undefined;
}

function parseDownload(value: unknown): ChangelogDownload | undefined {
  if (!isRecord(value)) return undefined;
  const filename = parseNonEmptyString(value.filename);
  if (!filename) return undefined;
  const label = typeof value.label === 'string' ? value.label : undefined;
  return { filename, label };
}

function parseRelated(value: unknown): { firmwareId?: string } | undefined {
  if (!isRecord(value)) return undefined;
  const firmwareId = parseNonEmptyString(value.firmwareId) ?? undefined;
  return firmwareId ? { firmwareId } : undefined;
}

function parseEntry(raw: unknown): ChangelogEntry | null {
  if (!isRecord(raw)) return null;
  const id = parseNonEmptyString(raw.id);
  const kind = parseChangelogKind(raw.kind);
  const version = parseNonEmptyString(raw.version);
  const title = parseNonEmptyString(raw.title);
  if (!id || !kind || !version || !title) return null;

  const date = parseNonEmptyString(raw.date) ?? undefined;
  const sections = parseSections(raw.sections);
  if (!sections) return null;

  const download = parseDownload(raw.download);
  const links = parseLinks(raw.links);
  const related = parseRelated(raw.related);

  return {
    id,
    kind,
    version,
    date,
    title,
    sections,
    download,
    links,
    related,
  };
}

export function parseChangelog(raw: unknown): Changelog | null {
  if (!isRecord(raw)) return null;

  const latest = raw.latest;
  if (!isRecord(latest)) return null;
  const latestConfigurator = parseNonEmptyString(latest.configurator);
  const latestFirmware = parseNonEmptyString(latest.firmware);
  if (!latestConfigurator || !latestFirmware) return null;

  const rawEntries = raw.entries;
  if (!Array.isArray(rawEntries)) return null;
  const entries = rawEntries.map(parseEntry).filter((entry): entry is ChangelogEntry => entry !== null);
  if (entries.length === 0) return null;

  return {
    latest: {
      configurator: latestConfigurator,
      firmware: latestFirmware,
    },
    entries,
  };
}

export function findChangelogEntry(changelog: Changelog, id: string): ChangelogEntry | undefined {
  return changelog.entries.find((entry) => entry.id === id);
}

export function getLatestChangelogEntryId(changelog: Changelog, kind: ChangelogKind): string | null {
  const preferredId = kind === 'configurator' ? changelog.latest.configurator : changelog.latest.firmware;
  const preferred = changelog.entries.find((entry) => entry.id === preferredId && entry.kind === kind);
  if (preferred) return preferred.id;

  const kindFallback = changelog.entries.find((entry) => entry.kind === kind);
  if (kindFallback) return kindFallback.id;

  return changelog.entries[0]?.id ?? null;
}

export function shouldAutoOpenChangelog(opts: {
  latestConfiguratorId: string | null;
  lastSeenConfiguratorId: string | null;
  pendingUpdate: boolean;
}): boolean {
  if (!opts.latestConfiguratorId) return false;
  if (opts.pendingUpdate) return true;
  if (opts.lastSeenConfiguratorId == null || opts.lastSeenConfiguratorId === '') return true;
  return opts.lastSeenConfiguratorId !== opts.latestConfiguratorId;
}

