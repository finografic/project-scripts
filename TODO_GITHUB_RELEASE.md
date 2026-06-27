# TODO: Complete `github-release` CLI (`@finografic/project-scripts`)

**Status:** Active — planning / implementation backlog  
**Owner:** Finografic tooling  
**Related:** `src/github-release/`, `bin/github-release.mjs`, [design-system `scripts/release.ts`](https://github.com/finografic/design-system/blob/master/scripts/release.ts) (reference only; do not copy file into this repo)

---

## Purpose

Finish the **`github-release`** binary so Finografic repos can share one GitHub Packages release workflow instead of per-repo `scripts/release.ts` copies.

Today:

| Location                          | State                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **`@finografic/project-scripts`** | `github-release` verifies workspace + git, then exits with _“release flow not yet complete”_                           |
| **Most Finografic packages**      | `release:github:*` → `release:check` → `pnpm version <bump>` → `git push --follow-tags` (+ optional `release:publish`) |
| **`@finografic/design-system`**   | Custom `scripts/release.ts` — monorepo, committed `dist/`, dual publish, manual release commit                         |

**Goal:** Implement the missing steps in `github-release` with **configurable profiles** so both styles (and future repos) work from one CLI.

---

## Current `github-release` scaffold (this repo)

| File                                             | Role                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `src/github-release/github-release.ts`           | Entry: parse `patch\|minor\|major`, call verifiers, stub exit                   |
| `src/github-release/verify-git.ts`               | Repo, detached HEAD, clean tree, branch `master`, upstream, no unpushed commits |
| `src/github-release/verify-workspace.ts`         | `access()` on `REQUIRED_BUILD_ARTIFACTS` (today: `bin/github-release.mjs` only) |
| `src/github-release/github-release.constants.ts` | `DEFAULT_RELEASE_BRANCH`, artifact list                                         |
| `src/github-release/README.md`                   | Consumer-facing overview (update when flow ships)                               |
| `tsdown.config.ts`                               | Builds `bin/github-release.mjs`                                                 |

**This package’s own `package.json` scripts** (dogfood target for **single-package** profile):

```json
"release:github:patch": "pnpm run release:check && pnpm version patch && git push --follow-tags",
"release:check": "pnpm format:check && pnpm lint:fix && pnpm typecheck && pnpm test:run:silent",
"release:publish": "pnpm publish --registry https://npm.pkg.github.com"
```

---

## Reference implementation (design-system)

Source of truth today: **`@finografic/design-system`** → `scripts/release.ts` (embedded below for porting; **do not** add a duplicate `release.ts` file to `project-scripts`).

### What it does (step order)

1. `pnpm lint:md` — pre-check (CI parity for that repo)
2. Clean working tree (`git diff` + `git diff --cached`)
3. Guard: `packages/design-system/package.json` + `packages/icons/package.json` exist
4. `pnpm version <bump> --no-git-tag-version --ignore-scripts` in each package dir
5. `pnpm build:all`
6. `git add` fixed paths → `git commit -m "feat: release v{dsVersion}"`
7. Annotated tags: `v{dsVersion}`, `icons-v{iconsVersion}`
8. `pnpm --filter @finografic/icons publish …` + `@finografic/design-system publish …`
9. `git push --follow-tags`

### Repo-specific ties (must become config, not hardcode)

- Paths: `packages/icons`, `packages/design-system`
- Script names: `lint:md`, `build:all`
- Staged files: both `dist/`, icon `src/icons.ts` + `src/index.ts`
- Publish filters: `@finografic/icons`, `@finografic/design-system`
- Dual tags + commit message keyed off DS version
- Does **not** check release branch or unpushed commits (unlike current `verify-git.ts`)

### Reference source (`scripts/release.ts`)

```typescript
#!/usr/bin/env node
/**
 * Scripts/release.ts — @finografic/design-system
 * Usage: tsx scripts/release.ts <patch|minor|major>
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

process.env.NODE_ENV = 'production';
const REGISTRY = 'https://npm.pkg.github.com';

const bump = process.argv[2];

if (!['patch', 'minor', 'major'].includes(bump ?? '')) {
  console.error('\n  Usage: tsx scripts/release.ts <patch|minor|major>\n');
  process.exit(1);
}

function run(cmd: string, opts: { cwd?: string } = {}): void {
  try {
    console.log(`\n  → ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: opts.cwd });
  } catch {
    console.error(`\n  ✘ Failed: ${cmd}\n`);
    process.exit(1);
  }
}

function readVersion(path: string): string {
  return (JSON.parse(readFileSync(path, 'utf8')) as { version: string }).version;
}

console.log('\n  Checking markdown (pnpm lint:md)…\n');
run('pnpm lint:md');

try {
  execSync('git diff --exit-code --quiet', { stdio: 'pipe' });
  execSync('git diff --cached --exit-code --quiet', { stdio: 'pipe' });
} catch {
  console.error(
    '\n  ✘  Working tree is dirty.\n' +
      '     Commit source changes before releasing (dist is rebuilt and committed by this script).\n',
  );
  process.exit(1);
}

if (!existsSync('packages/design-system/package.json')) {
  console.error('Missing packages/design-system');
  process.exit(1);
}

if (!existsSync('packages/icons/package.json')) {
  console.error('Missing packages/icons');
  process.exit(1);
}

run(`pnpm version ${bump} --no-git-tag-version --ignore-scripts`, { cwd: 'packages/icons' });
run(`pnpm version ${bump} --no-git-tag-version --ignore-scripts`, { cwd: 'packages/design-system' });

const iconsVersion = readVersion('packages/icons/package.json');
const dsVersion = readVersion('packages/design-system/package.json');

console.log(`\n  ✔  icons → ${iconsVersion}   design-system → ${dsVersion}`);

console.log('\n  Building packages (pnpm build:all)…\n');
run('pnpm build:all');

run(
  'git add packages/icons/package.json packages/icons/dist packages/icons/src/icons.ts packages/icons/src/index.ts packages/design-system/package.json packages/design-system/dist',
);
run(`git commit -m "feat: release v${dsVersion}"`);

run(`git tag -a "v${dsVersion}" -m "@finografic/design-system v${dsVersion}"`);
run(`git tag -a "icons-v${iconsVersion}" -m "@finografic/icons v${iconsVersion}"`);

run(`pnpm --filter @finografic/icons publish --no-git-checks --ignore-scripts --registry ${REGISTRY}`);
run(
  `pnpm --filter @finografic/design-system publish --no-git-checks --ignore-scripts --registry ${REGISTRY}`,
);

run('git push --follow-tags');

console.log(
  `\n  ✔  Released @finografic/design-system@${dsVersion}` + ` + @finografic/icons@${iconsVersion}\n`,
);
```

---

## NOTE: EXTRA CHECKS NEEDED ??? (example from use-case where release was able to be made DESPITE lint errors being found)

![47549](/Users/justin/repos-finografic/@finografic-project-scripts/TODO_GITHUB_RELEASE.assets/47549.png)

---

## Target architecture

### Profiles (built-in presets)

| Profile                  | Use case                                               | Bump                                                                              | Build                   | Commit / tag                     | Publish                            |
| ------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------- | -------------------------------- | ---------------------------------- |
| **`single-npm`**         | Default Finografic libs (`project-scripts`, `genx`, …) | Root `pnpm version <bump>` (npm creates commit + tag unless configured otherwise) | Optional pre-check only | Delegated to npm                 | Optional `release:publish` or flag |
| **`monorepo-artifacts`** | `@finografic/design-system`                            | Per-package `pnpm version … --no-git-tag-version --ignore-scripts`                | `release:build` script  | Manual `git add` + commit + tags | `pnpm --filter` list               |
| **`custom`**             | Future repos                                           | Fully driven by config file                                                       | Config                  | Config                           | Config                             |

CLI examples (TBD exact flag names):

```bash
github-release patch                          # auto-detect from config
github-release patch --profile single-npm
github-release patch --profile monorepo-artifacts
github-release patch --dry-run
```

### Configuration (consumer repo)

Resolve from **first match**:

1. `package.json` → `"finograficRelease": { … }`
2. `.finografic-release.json` at repo root
3. Built-in preset only if `--profile` passed

**Proposed schema (draft):**

```jsonc
{
  "profile": "monorepo-artifacts",
  "registry": "https://npm.pkg.github.com",
  "releaseBranch": "master",
  "preCheck": "pnpm lint:md",
  "build": "pnpm build:all",
  "packages": [
    {
      "path": "packages/icons",
      "name": "@finografic/icons",
      "tag": "icons-v{{version}}",
    },
    {
      "path": "packages/design-system",
      "name": "@finografic/design-system",
      "tag": "v{{version}}",
      "primary": true,
    },
  ],
  "stage": [
    "packages/icons/package.json",
    "packages/icons/dist/**",
    "packages/icons/src/icons.ts",
    "packages/icons/src/index.ts",
    "packages/design-system/package.json",
    "packages/design-system/dist/**",
  ],
  "commitMessage": "feat: release v{{primaryVersion}}",
  "publish": true,
  "push": true,
  "git": {
    "requireCleanBefore": true,
    "requireReleaseBranch": true,
    "requireNoUnpushedBefore": true,
  },
}
```

For **`single-npm`** profile, minimal config:

```jsonc
{
  "profile": "single-npm",
  "preCheck": "pnpm release:check",
  "versionArgs": ["--no-git-tag-version"],
  "publish": false,
}
```

### Unified pipeline (all profiles)

```
parse argv (patch|minor|major, flags)
  → load config + profile
  → run preCheck (if configured)
  → verifyGit (configurable assertions)
  → verifyWorkspace (configurable; not hardcoded to bin/github-release.mjs)
  → bumpVersion
  → run build (if configured)
  → stage + commit (monorepo-artifacts)
  → create tags
  → publish (if enabled)
  → push --follow-tags (if enabled)
  → success summary
```

Use existing **`execa`** + **`log`** utils (same as `verify-git.ts`); avoid new `execSync` unless needed for npm interop.

---

## Mapping: design-system steps → `github-release` modules

| Step                | New module (suggested)        | Notes                                                          |
| ------------------- | ----------------------------- | -------------------------------------------------------------- |
| Parse bump type     | `github-release.ts` (exists)  | Add `--dry-run`, `--profile`, `--no-publish`                   |
| Load config         | `load-config.ts`              | Zod or hand-rolled validation; clear errors                    |
| Pre-check           | `run-pre-check.ts`            | `pnpm run <script>` from config                                |
| Clean tree          | `verify-git.ts` (exists)      | Already has `assertCleanWorkingTree`; align message with DS    |
| Branch / unpushed   | `verify-git.ts` (exists)      | Make optional via `git.*` config — DS may want branch check on |
| Package paths exist | `verify-workspace.ts`         | Extend beyond artifact list                                    |
| Version bump        | `bump-version.ts`             | Single vs multi-package loops                                  |
| Build               | `run-build.ts`                | `execa` inherit stdio                                          |
| Stage + commit      | `release-commit.ts`           | `git add` globs; commit message template                       |
| Tags                | `create-tags.ts`              | Annotated tags from config                                     |
| Publish             | `publish-packages.ts`         | `pnpm publish` / `--filter` with `--ignore-scripts`            |
| Push                | `push-tags.ts`                | `git push --follow-tags`                                       |
| Registry constant   | `github-release.constants.ts` | Default `GITHUB_PACKAGES_REGISTRY`                             |

---

## Implementation checklist

### Phase 0 — Design lock

- [ ] Confirm config location: `package.json` field vs `.finografic-release.json` vs both
- [ ] Confirm profile names: `single-npm`, `monorepo-artifacts`, `custom`
- [ ] Decide: `github-release` replaces `pnpm version` in **single-npm** scripts, or wraps it (backward compatible)
- [ ] Decide publish: always in CLI vs separate `release:publish` (today split in many repos)

### Phase 1 — Core runner (no presets yet)

- [ ] `load-config.ts` + types in `github-release.types.ts`
- [ ] `run-pre-check.ts` — run configured script, fail fast
- [ ] `bump-version.ts` — `pnpm version <type> --no-git-tag-version --ignore-scripts` with `cwd` per package
- [ ] `run-build.ts`
- [ ] `release-commit.ts` — stage paths + commit
- [ ] `create-tags.ts`
- [ ] `publish-packages.ts` — registry + `--no-git-checks` + `--ignore-scripts`
- [ ] `push-tags.ts`
- [ ] Wire pipeline in `github-release.ts`; remove stub message
- [ ] `--dry-run` logs commands without mutating git/npm

### Phase 2 — Git / workspace policy

- [ ] Make `verify-git` assertions configurable (`requireReleaseBranch`, `requireNoUnpushedBefore`, etc.)
- [ ] Re-order verifiers: pre-check → clean tree (before bump) vs unpushed (before bump only)
- [ ] Replace `REQUIRED_BUILD_ARTIFACTS` default for consumers with `preBuildArtifacts: []` or optional `build` script instead
- [ ] `NODE_ENV=production` during release (design-system sets this)

### Phase 3 — Presets

- [ ] **`single-npm`**: `preCheck` → `pnpm version <bump>` (document whether to use `--no-git-tag-version`) → push → optional publish
- [ ] **`monorepo-artifacts`**: encode design-system preset (paths/filters/tags/stage) as default JSON shipped in package, e.g. `presets/design-system.json` **or** document copy-paste block for DS `package.json`
- [ ] Export preset path: `@finografic/project-scripts/github-release/presets/design-system.json` (optional)

### Phase 4 — Tests & docs

- [ ] Vitest: config loader, template interpolation (`{{version}}`), dry-run command list
- [ ] Integration test with temp git repo (mock `execa` or use `vitest` + fixture) — at least clean-tree failure + dry-run success
- [ ] Update `src/github-release/README.md` with profiles, config schema, examples
- [ ] Update `docs/process/RELEASE_PROCESS.md` in this repo
- [ ] Add `chmod` for `bin/github-release.mjs` in `tsdown` `onSuccess` (other bins already chmod some entries)

### Phase 5 — Consumer adoption

- [ ] **`@finografic/project-scripts`**: switch `release:github:*` to `github-release patch` (dogfood `single-npm`)
- [ ] **`@finografic/design-system`**: add `finograficRelease` config; replace `tsx scripts/release.ts` with `github-release patch`; delete `scripts/release.ts` after validation
- [ ] Document migration in design-system `docs/RELEASE_AND_INSTALL.md`

---

## Behavioral differences to reconcile

| Topic                  | `verify-git.ts` today             | design-system `release.ts`  | Resolution                                                                |
| ---------------------- | --------------------------------- | --------------------------- | ------------------------------------------------------------------------- |
| Release branch         | Must be `master`                  | Not checked                 | Config default `master`, optional off                                     |
| Unpushed commits       | Fail if any                       | Not checked                 | Default **on** for `single-npm`; consider **on** for monorepo before bump |
| Pre-check              | None                              | `pnpm lint:md`              | `preCheck` script name in config                                          |
| Workspace artifacts    | Requires `bin/github-release.mjs` | Requires package.json paths | Artifact check only for `project-scripts` self; config elsewhere          |
| Version + git          | N/A                               | Manual commit after bump    | `monorepo-artifacts` only                                                 |
| `pnpm version` git tag | N/A                               | `--no-git-tag-version`      | Always for artifact profile; profile-dependent for single                 |

---

## Consumer `package.json` examples (target)

### Typical package (today’s style, powered by CLI)

```json
{
  "scripts": {
    "release:check": "pnpm format:check && pnpm lint:fix && pnpm typecheck && pnpm test:run",
    "release:github:patch": "github-release patch",
    "release:publish": "pnpm publish --registry https://npm.pkg.github.com"
  },
  "finograficRelease": {
    "profile": "single-npm",
    "preCheck": "release:check",
    "publish": false
  }
}
```

### Design-system monorepo

```json
{
  "scripts": {
    "release:patch": "github-release patch",
    "release:minor": "github-release minor",
    "release:major": "github-release major"
  },
  "finograficRelease": {
    "profile": "monorepo-artifacts",
    "preCheck": "pnpm lint:md",
    "build": "pnpm build:all",
    "packages": ["... see preset above ..."]
  }
}
```

---

## Non-goals (v1)

- GitHub Releases API / changelog generation
- Interactive prompts (keep explicit, CI-friendly)
- npmjs.org registry (GitHub Packages only unless config extended later)
- Changesets / semantic-release integration
- Auto-detect monorepo layout without config

---

## Open questions

1. Should **`release:check`** run **inside** `github-release` always, or remain a separate script consumers call before `github-release` (current split)?
2. For **single-npm**, keep `pnpm version` creating the git tag, or standardize on manual tag like monorepo?
3. Publish in same command vs `github-release publish` subcommand?
4. Ship **design-system preset** inside this package, or only document config in DS repo?

---

## Verification before shipping

- [ ] `pnpm build` — `bin/github-release.mjs` updated
- [ ] `pnpm test:run` — new unit tests green
- [ ] Dry-run in `@finografic/project-scripts` repo
- [ ] Dry-run against linked `@finografic/design-system` (monorepo profile)
- [ ] Real patch release on a test package (optional)

---

## References

- Design-system release docs: `docs/RELEASE_AND_INSTALL.md` (consumer repo)
- Stub README: `src/github-release/README.md`
- Existing git policy: `.github/instructions/10-git-policy.instructions.md`
- Related backlog style: `TODO_GENX.md`
