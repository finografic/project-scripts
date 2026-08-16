import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { pc } from 'utils/picocolors';

const VIOLATION_MARKER = 'ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION';

// "  electron-to-chromium@1.5.407 was published at 2026-08-15T10:02:43.000Z, within the minimumReleaseAge cutoff (2026-08-15T01:22:00.435Z)"
// Package names can contain '@' (scoped packages), so split on the LAST '@' before the version.
const VIOLATION_LINE =
  /^\s+(.+)@([^@\s]+) was published at (\S+), within the minimumReleaseAge cutoff \(([^)]+)\)/;

export interface ReleaseAgeViolation {
  name: string;
  version: string;
  publishedAt: string;
  cutoff: string;
}

/** Parses pnpm's ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION output into structured violations. */
export function parseReleaseAgeViolations(output: string): ReleaseAgeViolation[] {
  const violations: ReleaseAgeViolation[] = [];

  for (const line of output.split('\n')) {
    const match = VIOLATION_LINE.exec(line);
    if (match) {
      const [, name, version, publishedAt, cutoff] = match;
      violations.push({ name, version, publishedAt, cutoff });
    }
  }

  return violations;
}

/**
 * Finds the newest version of `pkgName` published strictly before `cutoffIso`,
 * by reading the registry's per-version publish-time map. Returns null if the
 * package can't be resolved (private/scoped package on a registry this
 * doesn't know how to reach, network failure, etc.) — callers should treat
 * that as "can't heal automatically".
 */
export async function findCompliantVersion(pkgName: string, cutoffIso: string): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkgName}`);
    if (!res.ok) return null;

    const data = (await res.json()) as { time?: Record<string, string> };
    const cutoff = new Date(cutoffIso).getTime();

    let best: { version: string; time: number } | null = null;
    for (const [version, iso] of Object.entries(data.time ?? {})) {
      if (version === 'created' || version === 'modified') continue;
      const time = new Date(iso).getTime();
      if (time < cutoff && (!best || time > best.time)) {
        best = { version, time };
      }
    }

    return best?.version ?? null;
  } catch {
    return null;
  }
}

async function runPnpmInstall(cwd: string) {
  return execa('pnpm', ['install'], { cwd, reject: false, all: true });
}

/**
 * Self-heals pnpm 11's `minimumReleaseAge` supply-chain policy rejections.
 *
 * A fresh resolve (no existing lockfile) already respects this policy on its
 * own — it just excludes too-recent candidates when picking "latest
 * satisfying range". The failure mode this fixes is a lockfile that's
 * already pinned to a version published before the policy caught up to it:
 * pnpm's own docs call this a "stale" lockfile. Plain `pnpm install` reuses
 * that pin without re-resolving (fails immediately on the stale entry), and
 * `pnpm update <pkg>` only reaches *direct* dependencies — not the
 * transitive ones this usually hits (e.g. electron-to-chromium via
 * browserslist, jose via an auth package) — so there's no way to just
 * "install past it" without an explicit re-pin.
 *
 * The fix: pin the violating package(s) to the newest version that predates
 * the policy cutoff via a temporary `overrides` + `minimumReleaseAge: 0` in
 * pnpm-workspace.yaml (NOT package.json's "pnpm" field — pnpm stopped
 * reading that field entirely, even in 10.x; it silently ignores it), force
 * re-resolution, then revert pnpm-workspace.yaml to its original content and
 * verify the lockfile now passes with the policy fully active again. The
 * lockfile is left holding the compliant pins; pnpm-workspace.yaml doesn't
 * change permanently.
 *
 * No-ops (returns without touching anything) when there's no
 * pnpm-workspace.yaml (this is inherently a workspace-scoped policy; a
 * single-package repo without one is left to the caller's own `pnpm
 * install`), when `pnpm install` isn't available, or when a first install
 * just succeeds. Rethrows for any install failure that ISN'T this specific
 * violation — this is not a general-purpose "swallow install errors" tool.
 */
export async function healMinimumReleaseAgeViolations(workingDir: string): Promise<void> {
  const workspaceYamlPath = path.join(workingDir, 'pnpm-workspace.yaml');

  let originalRaw: string;
  try {
    originalRaw = await fs.readFile(workspaceYamlPath, 'utf8');
  } catch {
    return;
  }

  const first = await runPnpmInstall(workingDir);
  if (first.exitCode === 0) return;

  const output = `${first.all ?? ''}\n${first.stderr ?? ''}`;
  if (!output.includes(VIOLATION_MARKER)) {
    console.error(pc.red('\n✗ pnpm install failed (not a minimumReleaseAge violation — not auto-healing):'));
    console.error(output);
    throw new Error('pnpm install failed');
  }

  const violations = parseReleaseAgeViolations(output);
  if (violations.length === 0) {
    console.error(output);
    throw new Error(
      `Detected ${VIOLATION_MARKER} but could not parse the violating package(s) from its output`,
    );
  }

  console.log(
    pc.yellow(
      `\n⚠️  pnpm's minimumReleaseAge policy rejected ${violations.length} package(s) published too recently — auto-healing:`,
    ),
  );

  const fixes: Record<string, string> = {};
  for (const violation of violations) {
    const compliant = await findCompliantVersion(violation.name, violation.cutoff);
    if (!compliant) {
      console.error(
        pc.red(
          `   ✗ ${violation.name}@${violation.version}: no older compliant version found on the registry`,
        ),
      );
      throw new Error(`Could not find a minimumReleaseAge-compliant version for ${violation.name}`);
    }
    fixes[violation.name] = compliant;
    console.log(pc.gray(`   • ${violation.name}: ${violation.version} → ${compliant}`));
  }

  // Guarantee pnpm-workspace.yaml is restored even on a hard interrupt mid-heal.
  const restoreSync = () => {
    try {
      fsSync.writeFileSync(workspaceYamlPath, originalRaw);
    } catch {
      /* best effort */
    }
  };
  const onSignal = () => {
    restoreSync();
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    const workspace = (parseYaml(originalRaw) ?? {}) as Record<string, unknown>;
    const previousOverrides = (workspace.overrides ?? {}) as Record<string, string>;
    workspace.overrides = { ...previousOverrides, ...fixes };
    workspace.minimumReleaseAge = 0;

    await fs.writeFile(workspaceYamlPath, stringifyYaml(workspace));

    const heal = await runPnpmInstall(workingDir);
    if (heal.exitCode !== 0) {
      console.error(pc.red('\n✗ Re-resolution with pinned versions still failed:'));
      console.error(`${heal.all ?? ''}\n${heal.stderr ?? ''}`);
      throw new Error('Failed to heal minimumReleaseAge lockfile violation');
    }
  } finally {
    await fs.writeFile(workspaceYamlPath, originalRaw);
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }

  // Confirm the healed lockfile now passes with the policy fully active again.
  const verify = await runPnpmInstall(workingDir);
  if (verify.exitCode !== 0) {
    console.error(pc.red('\n✗ pnpm install failed after reverting the temporary override:'));
    console.error(`${verify.all ?? ''}\n${verify.stderr ?? ''}`);
    throw new Error('Lockfile healed but install failed once the policy bypass was reverted');
  }

  console.log(
    pc.green(
      `✅ Healed ${violations.length} minimumReleaseAge violation(s) — lockfile now passes with the policy active.\n`,
    ),
  );
}

export default healMinimumReleaseAgeViolations;
