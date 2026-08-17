# TODO: Port `triage-docs` from genx (`@finografic/project-scripts`)

**Status:** Planned — not started
**Owner:** Finografic tooling
**Source:** [`@finografic/genx` → `scripts/triage-docs.ts`](https://github.com/finografic/genx/blob/master/scripts/triage-docs.ts) (297 lines)
**Related:** `src/clean-docs/`, `src/audit-script-separators/`, `bin/`

---

## Purpose

`triage-docs` scans the places AI agents drop planning artifacts — `docs/superpowers/`,
`docs/planning/`, `.cursor/plans/`, `.claude/drafts/` — and walks the user through filing each one
into `docs/specs/`, `docs/drafts/`, or the bin.

It was written in genx because that is where the need appeared first, but nothing about it is
genx-specific: it is a repo-hygiene tool of exactly the same shape as `clean-docs` and
`purge-builds`, which already live here and are consumed via `pnpm dlx`. Every managed repo already
depends on this package, so no new distribution mechanism is needed.

**Goal:** move the tool here, expose it as a `triage-docs` bin, and delete genx's copy.

---

## Prerequisite — already done

genx commit `9974543` decoupled the script from genx internals so it can be lifted without
rewriting its logic:

| Was                                                  | Now                                            |
| ---------------------------------------------------- | ---------------------------------------------- |
| `import { fileExists } from '../src/utils/fs.utils'` | `existsSync` from `node:fs`                    |
| `import { pc } from '../src/utils/picocolors'`       | Interop shim inlined in the file               |
| Intro hardcoded to `genx · triage docs`              | Reads the consuming repo's `package.json` name |

Verified running unchanged from an unrelated scratch repo with no genx on the path.

---

## Prompts: keep clack, do not convert

`triage-docs` is written against `@clack/prompts`. This package still uses `@inquirer/prompts` in
three files, but **clack is the direction of travel** — see
[`TODO_MIGRATE_TO_CLACK.md`](./TODO_MIGRATE_TO_CLACK.md).

So the port lands the file as-is and adds `@clack/prompts` as a dependency. Converting it to
inquirer on the way in would mean writing code that is already scheduled for deletion.

**Do this port first.** It is the cheapest way to introduce clack here: the file is already written,
already verified, and proves the dependency builds through `tsdown` before any existing bin is
touched. It then serves as the in-repo reference for converting the other three.

The two prompt stacks coexist only for the window between this port and the migration completing.
That is the intended sequence, not an oversight — but do not let the window stay open indefinitely,
since it means two interaction styles depending on which bin a user runs.

---

## Steps

1. **Create `src/triage-docs/`**, matching the layout used by `clean-docs`:

   | File                    | Contents                                                                         |
   | ----------------------- | -------------------------------------------------------------------------------- |
   | `triage-docs.ts`        | Entry, `isCliEntry(import.meta.url)` guard, arg parsing                          |
   | `triage-docs.config.ts` | `DEFAULT_SCAN_DIRS`, `SPECS_DIR`, `DRAFTS_DIR`, `SPEC_MARKERS`, `DRAFTS_MARKERS` |
   | `triage-docs.types.ts`  | `DocFile`                                                                        |
   | `index.ts`              | Library export                                                                   |
   | `README.md`             | Consumer-facing overview                                                         |

2. **Swap internals for this package's own utils** — the inlined picocolors shim becomes
   `src/utils/picocolors.ts`, and `isCliEntry` comes from `src/utils/is-cli-entry.ts`.

3. **Add `@clack/prompts`** to `dependencies`. No prompt-layer rewrite — see above.

4. **Decide the scan root.** genx uses `process.cwd()`. Other bins here use `findProjectRoot()` /
   `getPackageScope()` from `src/utils/project.utils.ts`. In a monorepo those differ: `cwd` triages
   the package you are standing in, `findProjectRoot()` the workspace root. Suggested: keep `cwd` as
   the default (least surprising for a destructive tool) and add `--root` to opt into the workspace
   root.

5. **Register the build**: add `'triage-docs': 'src/triage-docs/triage-docs.ts'` to the bin entry
   block in `tsdown.config.ts`, and `'triage-docs': 'src/triage-docs/index.ts'` to the library block.

6. **Add the bin** to `package.json`: `"triage-docs": "bin/triage-docs.mjs"`.

7. **Tests.** `suggestCategory` and `scoreMarkers` are pure and currently untested — worth covering
   on the way in, including the tie case where spec and draft scores are equal (should be
   `unknown`).

8. **Release**, then in genx: delete `scripts/triage-docs.ts`, and point the `triage-docs` skill and
   any docs at `pnpm --package=@finografic/project-scripts dlx triage-docs` — the same invocation
   shape genx already uses for `purge-builds`.

---

## Acceptance criteria

- [ ] `pnpm --package=@finografic/project-scripts dlx triage-docs` runs in any repo
- [ ] Ctrl-C at the prompt aborts without moving or deleting anything (clack's `isCancel` path)
- [ ] Intro names the repo being triaged, from its `package.json`
- [ ] `--scan-dir=<path>` still adds directories to the default set
- [ ] Empty scan exits cleanly with "Nothing to triage"
- [ ] genx's copy deleted, no genx-side duplicate remains

---

## Notes

- genx has a `triage-docs` **skill** (`.agents/skills/`) that describes the workflow; it references
  the script and will need its invocation updated once the bin ships.
- The `docs/drafts/` target is expected to be gitignored in consuming repos. The tool creates the
  directory but does not manage `.gitignore` — genx's `ai-memory` feature owns that.
- Blocks genx roadmap item #4 (`design-docs` genx feature), which wants to scaffold
  `docs/specs/` + `docs/drafts/` + this script into any package.
