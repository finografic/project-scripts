import { describe, expect, it, vi } from 'vitest';

vi.mock('utils/picocolors', () => ({
  pc: {
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    red: (str: string) => str,
  },
}));

import { findCompliantVersion, parseReleaseAgeViolations } from './heal-lockfile';

describe('parseReleaseAgeViolations', () => {
  it('parses the standard pnpm ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION output', () => {
    const output = `
✗ Lockfile failed supply-chain policy check (1048 entries in 4.3s)
[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 2 lockfile entries failed verification:
  electron-to-chromium@1.5.407 was published at 2026-08-15T10:02:43.000Z, within the minimumReleaseAge cutoff (2026-08-15T01:22:00.435Z)
  jose@6.2.9 was published at 2026-08-15T08:42:25.000Z, within the minimumReleaseAge cutoff (2026-08-15T01:22:00.435Z)

The lockfile contains entries that the active policies reject.`;

    expect(parseReleaseAgeViolations(output)).toEqual([
      {
        name: 'electron-to-chromium',
        version: '1.5.407',
        publishedAt: '2026-08-15T10:02:43.000Z',
        cutoff: '2026-08-15T01:22:00.435Z',
      },
      {
        name: 'jose',
        version: '6.2.9',
        publishedAt: '2026-08-15T08:42:25.000Z',
        cutoff: '2026-08-15T01:22:00.435Z',
      },
    ]);
  });

  it('parses scoped package names correctly (name contains its own "@")', () => {
    const output = `  @scope/pkg@2.0.0 was published at 2026-08-15T10:00:00.000Z, within the minimumReleaseAge cutoff (2026-08-15T01:00:00.000Z)`;

    expect(parseReleaseAgeViolations(output)).toEqual([
      {
        name: '@scope/pkg',
        version: '2.0.0',
        publishedAt: '2026-08-15T10:00:00.000Z',
        cutoff: '2026-08-15T01:00:00.000Z',
      },
    ]);
  });

  it('returns an empty array for unrelated output', () => {
    expect(parseReleaseAgeViolations('some unrelated pnpm error\nwith multiple lines')).toEqual([]);
  });
});

describe('findCompliantVersion', () => {
  it('picks the newest version published strictly before the cutoff', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          time: {
            'created': '2020-01-01T00:00:00.000Z',
            'modified': '2026-08-15T10:00:00.000Z',
            '1.0.0': '2026-08-01T00:00:00.000Z',
            '1.0.1': '2026-08-10T00:00:00.000Z',
            '1.0.2': '2026-08-15T10:00:00.000Z', // too new — excluded
          },
        }),
      }),
    );

    await expect(findCompliantVersion('some-pkg', '2026-08-15T01:00:00.000Z')).resolves.toBe('1.0.1');

    vi.unstubAllGlobals();
  });

  it('returns null when the registry request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(findCompliantVersion('some-pkg', '2026-08-15T01:00:00.000Z')).resolves.toBeNull();

    vi.unstubAllGlobals();
  });

  it('returns null when no version predates the cutoff', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          time: {
            'created': '2020-01-01T00:00:00.000Z',
            'modified': '2026-08-15T10:00:00.000Z',
            '1.0.0': '2026-08-15T10:00:00.000Z',
          },
        }),
      }),
    );

    await expect(findCompliantVersion('some-pkg', '2026-08-15T01:00:00.000Z')).resolves.toBeNull();

    vi.unstubAllGlobals();
  });
});
