# TODO: Migrate prompts from Inquirer to Clack (`@finografic/project-scripts`)

**Status:** Planned — not started
**Owner:** Finografic tooling
**Related:** [`TODO_TRIAGE_DOCS.md`](./TODO_TRIAGE_DOCS.md), `src/db-setup/`, `src/build-deployment/`, `src/purge-builds/`

---

## Purpose

`@inquirer/prompts` predates the move to `@clack/prompts` across the Finografic tooling. genx, gli
and everything generated from `_templates/` are clack-based; this package is the straggler, so a
user moving between `genx` and a `project-scripts` bin meets two different interaction styles.

**Goal:** one prompt library across the ecosystem, and drop the Inquirer dependencies.

---

## Current surface — smaller than it looks

Only **one** Inquirer package is actually imported, in **three files**:

| File                                       | Imports                     |
| ------------------------------------------ | --------------------------- |
| `src/db-setup/db-setup.ts`                 | `checkbox`                  |
| `src/db-setup/schemas.utils.ts`            | `checkbox`                  |
| `src/build-deployment/build-deployment.ts` | `checkbox, confirm, select` |

Spinners are separate: `ora` is used in `src/purge-builds/src/purge-builds/purge.ts` and
`purge.enhanced.ts`.

### Dependency cleanup falls out of this

These are declared in `package.json` with **zero imports anywhere in `src/`**:

- `@inquirer/confirm`
- `@inquirer/core`
- `@inquirer/input`
- `yargs`

They can be removed independently of the migration, and probably should be — that is four packages
every consumer of this CLI currently installs for nothing. Worth doing as its own commit first so
the migration diff stays about prompts.

---

## Mapping

| Inquirer                | Clack                                   |
| ----------------------- | --------------------------------------- |
| `checkbox({ choices })` | `multiselect({ options })`              |
| `select({ choices })`   | `select({ options })`                   |
| `confirm({ message })`  | `confirm({ message })`                  |
| `ora(...).start()`      | `spinner()` — `start()` / `stop()`      |
| —                       | `intro()` / `outro()` frame the run     |
| —                       | `log.info` / `log.success` / `log.warn` |

Shape differences to watch:

- Clack takes `options` with `{ value, label, hint }`; Inquirer takes `choices` with
  `{ value, name, description }`. Not a rename — `label` is required where `name` was optional.
- Clack's `multiselect` supports `required: false`; Inquirer's `checkbox` allows an empty submit by
  default. Preserve whichever each call site relies on.

---

## ⚠️ Cancellation changes shape — the one real risk

**Inquirer throws** (`ExitPromptError`) on Ctrl-C. **Clack returns a cancel symbol**, checked with
`isCancel(value)`, and execution continues if you do not check it.

So an existing `try/catch` that currently handles cancellation keeps compiling after the swap while
silently doing the wrong thing: the cancel symbol falls through as a value.

Every converted call site must be:

```ts
const answer = await select({ ... });
if (isCancel(answer)) {
  cancel('Operation cancelled');
  return;
}
```

This matters most in `build-deployment` and `db-setup`, whose prompts gate file writes and database
operations. Treat "Ctrl-C leaves nothing changed" as an explicit test per converted flow.

---

## Suggested order

1. **Remove the four unused dependencies** — standalone commit, no behaviour change.
2. **Land the `triage-docs` port** ([`TODO_TRIAGE_DOCS.md`](./TODO_TRIAGE_DOCS.md)). It is already
   clack, so it brings the dependency in, proves it builds through `tsdown`, and becomes the
   in-repo reference. Do not convert it to Inquirer on the way in.
3. **`db-setup`** — two files, `checkbox` only. Smallest real conversion.
4. **`build-deployment`** — all three prompt types; do it with the pattern settled.
5. **`purge-builds`** — `ora` to clack's `spinner()`, so one library covers prompts and spinners.
6. **Drop `@inquirer/prompts` and `ora`** once no imports remain, and verify the bins still build.

---

## Acceptance criteria

- [ ] No `@inquirer/*` or `ora` imports in `src/`
- [ ] No `@inquirer/*`, `ora` or `yargs` entries in `package.json`
- [ ] Every prompt call site checks `isCancel` before acting
- [ ] Ctrl-C in `db-setup` and `build-deployment` leaves the filesystem and database untouched
- [ ] All bins build via `tsdown` and run from `pnpm dlx`

---

## Notes

- Clack's `intro`/`outro` framing is used consistently in genx; adopting it here is what makes the
  two tools feel like one toolchain, and is worth doing rather than a literal prompt-for-prompt swap.
- `src/utils/cli.utils.ts` and `log.utils.ts` may already wrap some of this — check before adding
  new helpers.
