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

The genx-side decoupling is already done, so the logic lifts unchanged. The real work is the prompt
layer: the script uses `@clack/prompts` and this package standardises on `@inquirer` + `ora`.
Converting rather than adding a second prompt stack — and handling cancellation correctly, since
inquirer throws where clack returns a symbol, and the branches being guarded move and delete files.

Detail: [`TODO_TRIAGE_DOCS.md`](./TODO_TRIAGE_DOCS.md)

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
