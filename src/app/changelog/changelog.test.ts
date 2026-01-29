import { describe, expect, it } from 'vitest';
import { parseChangelog, shouldAutoOpenChangelog } from './changelog';

describe('parseChangelog', () => {
  it('returns null for invalid inputs', () => {
    expect(parseChangelog(null)).toBeNull();
    expect(parseChangelog({})).toBeNull();
    expect(parseChangelog({ latest: { configurator: 'a', firmware: 'b' }, entries: [] })).toBeNull();
  });

  it('parses a minimal valid changelog', () => {
    const parsed = parseChangelog({
      latest: { configurator: 'c1', firmware: 'f1' },
      entries: [
        {
          id: 'c1',
          kind: 'configurator',
          version: '1.0.0',
          title: 'Hello',
          sections: [{ title: 'New', items: ['Thing'] }],
        },
        {
          id: 'f1',
          kind: 'firmware',
          version: '2.0',
          title: 'FW',
          sections: [{ title: 'Notes', items: ['A'] }],
        },
      ],
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.entries.length).toBe(2);
  });
});

describe('shouldAutoOpenChangelog', () => {
  it('opens on first visit', () => {
    expect(
      shouldAutoOpenChangelog({
        latestConfiguratorId: 'c1',
        lastSeenConfiguratorId: null,
        pendingUpdate: false,
      }),
    ).toBe(true);
  });

  it('opens when pendingUpdate is set', () => {
    expect(
      shouldAutoOpenChangelog({
        latestConfiguratorId: 'c1',
        lastSeenConfiguratorId: 'c1',
        pendingUpdate: true,
      }),
    ).toBe(true);
  });

  it('does not open when already seen and no pendingUpdate', () => {
    expect(
      shouldAutoOpenChangelog({
        latestConfiguratorId: 'c1',
        lastSeenConfiguratorId: 'c1',
        pendingUpdate: false,
      }),
    ).toBe(false);
  });

  it('opens when latest changes', () => {
    expect(
      shouldAutoOpenChangelog({
        latestConfiguratorId: 'c2',
        lastSeenConfiguratorId: 'c1',
        pendingUpdate: false,
      }),
    ).toBe(true);
  });
});

