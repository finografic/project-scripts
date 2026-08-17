# Roadmap

> **This is the primary high-level plan for the project.**
> Check this file before proposing new work. Add new items when conceiving features.
> Keep it ordered by priority — move completed items to the Done section at the bottom.

---

## How to use this file

| Tier | Meaning                                   |
| ---- | ----------------------------------------- |
| P0   | Active — being worked on now              |
| P1   | Next — fully scoped, ready to start       |
| P2   | Planned — direction decided, detail TBD   |
| P3   | Backlog — good ideas, not yet prioritised |

When an item is done, move it to the Done section at the bottom with a completion date.

---

## Next

- [ ] Review and update this list for the project.

## P0 — Active

_Nothing active right now — pick from P1._

---

## P1 — Next Up

### Port `triage-docs` from genx

Move genx's `scripts/triage-docs.ts` here as a `triage-docs` bin, consumed via `pnpm dlx` like
`clean-docs` and `purge-builds`. It is a repo-hygiene tool with nothing genx-specific about it, and
every managed repo already depends on this package.

The genx-side decoupling is already done, so the logic lifts unchanged — including its prompts,
which are already clack. Do this before the Inquirer migration below: it introduces `@clack/prompts`
via a file that is already written and verified, and becomes the in-repo reference for converting
the rest.

Detail: [`TODO_TRIAGE_DOCS.md`](./TODO_TRIAGE_DOCS.md)

### Migrate prompts from Inquirer to Clack

Inquirer predates the ecosystem's move to `@clack/prompts`. genx, gli and everything generated from
`_templates/` are clack-based, so this package is the odd one out and users meet two interaction
styles depending on which tool they run.

Smaller than it sounds: one Inquirer package is imported, across three files, plus `ora` for
spinners. Four declared dependencies (`@inquirer/confirm`, `@inquirer/core`, `@inquirer/input`,
`yargs`) have no imports at all and can be dropped first.

The risk is cancellation: Inquirer throws on Ctrl-C, clack returns a symbol that must be checked
with `isCancel`. An unconverted call site keeps compiling and treats the cancel symbol as an answer
— in `db-setup` and `build-deployment` that gates database and file operations.

Detail: [`TODO_MIGRATE_TO_CLACK.md`](./TODO_MIGRATE_TO_CLACK.md)

---

## P2 — Planned

_No items yet._

---

## P3 — Backlog

_No items yet._

---

## Done

| Item                           | Completed |
| ------------------------------ | --------- |
| _No completed milestones yet._ | —         |
