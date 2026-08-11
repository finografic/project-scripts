# TODO: Genx integration (`@finografic/project-scripts`)

## Purpose

`@finografic/project-scripts` is **not** limited to monorepos — it is the shared home for **Finografic-wide** scripts and small utilities. This document tracks work to add a **genx-related surface** here so consumer projects can stay aligned with **[@finografic/genx](https://github.com/finografic/genx)** conventions **without** multiplying cross-dependencies or one-off copies.

## Goals

1. **Single optional dependency** for “project hygiene” scripts that apply to many repos (standalone packages and monorepos).
2. **Low coupling:** do not create tight cycles between `project-scripts` and `genx`; prefer **published spec artifacts** or **documented contracts** over importing genx internals.
3. **Explicit opt-in:** genx-specific behavior should be discoverable (README section, `package.json` `exports`, or subpath) so non-genx consumers are unaffected.

## Candidate work items

### Documentation

- [ ] **README:** add a **Genx** (or **CLI conventions**) section stating scope: optional alignment helpers for repos created or maintained with genx; clarify the package remains general-purpose.
- [ ] **Keywords / description:** optionally add `genx` to `package.json` `keywords` if you want npm discovery (cosmetic).

### Published artifacts (design TBD)

- [ ] **CLI core spec:** ship a **read-only** copy of `CLI_CORE.md` (or equivalent) from a **versioned** path, e.g. `exports["./genx/cli-core-spec"]` or `files` + `docs/spec/CLI_CORE.md`, synced from genx on release (manual or small script in genx repo).
- [ ] **Optional checker:** a tiny CLI or `node` entry that compares a repo’s `docs/spec/CLI_CORE.md` to the **published** file in this package (pin by semver). **Not** the genx-internal check (`docs/spec` vs `_templates/docs/spec` — that stays in genx only).

### Dependency hygiene

- [ ] Keep **peer** or **optional** deps minimal; avoid pulling genx into `project-scripts`.
- [ ] Document which Finografic packages are expected to depend on `project-scripts` for what (e.g. `purge-builds` vs future genx helpers).

### Release / versioning

- [ ] When genx spec changes materially, decide whether to **bump** `project-scripts` with a note in changelog, or only bump when the shipped spec artifact changes.

## Non-goals

- Replacing **genx** (`create`, `migrate`, templates) — this package should not become a second generator.
- Duplicating the full **`_templates`** tree from genx in `project-scripts`.

## References

- Canonical spec (authoritative in genx): `docs/spec/CLI_CORE.md` in [@finografic/genx](https://github.com/finografic/genx).
- Internal template snapshot in genx (for `create` / `migrate` only): `_templates/docs/spec/CLI_CORE.md`.
