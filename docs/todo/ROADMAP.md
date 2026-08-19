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

### Manual prompt cancellation checks

The Inquirer/Ora migration is complete locally: source imports and package manifests now use
`@clack/prompts`.

Before calling the migration fully done, manually verify Ctrl-C in `db-setup` and
`build-deployment` exits before database or filesystem operations run.

Detail: [`TODO_MIGRATE_TO_CLACK.md`](./TODO_MIGRATE_TO_CLACK.md)

---

## P2 — Planned

_No items yet._

---

## P3 — Backlog

_No items yet._

---

## Done

| Item                                                                                                                                                                    | Completed  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `triage-docs` ported from genx and released as a bin in 2.0.0; genx deleted its local copy and repointed to `pnpm dlx` — [`DONE_TRIAGE_DOCS.md`](./DONE_TRIAGE_DOCS.md) | 2026-08-19 |
