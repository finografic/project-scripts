# github-release

Opinionated GitHub release workflow for Finografic projects.

This CLI enforces a safe, repeatable release process by verifying
workspace state and git state before performing a version bump and push.

---

## What this script does

Before releasing, `github-release` verifies:

- The workspace has required build artifacts
- The working tree is clean
- The current branch is the release branch
- An upstream branch is configured
- There are no unpushed commits

If any check fails, the release is aborted.

---

## Usage

This script is intended to be invoked via `package.json` scripts
in consuming projects.

### Example

{
"scripts": {
"release.github.patch": "github-release patch",
"release.github.minor": "github-release minor",
"release.github.major": "github-release major"
}
}

Then run:

pnpm run release.github.patch

---

## Release types

- patch
- minor
- major

These map directly to `pnpm version`.

---

## Defaults

- Release branch: `master`
- Required artifacts:

  - bin/github-release.js

Defaults are defined in:

src/github-release/github-release.constants.ts

---

## Non-goals

This script intentionally does not:

- Generate changelogs
- Create GitHub Releases via API
- Prompt for confirmation
- Guess project configuration

All behavior is explicit and policy-driven.

---

## Intended audience

- TypeScript-first repositories
- Monorepos using pnpm
- Projects that want strict, repeatable releases
