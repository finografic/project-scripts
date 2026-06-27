---
name: scaffold-cli-help
description: Define or update root CLI help for @finografic CLI projects using HelpConfig in src/cli.help.ts and renderHelp from core/render-help. Use when adding commands, changing help layout, or aligning help with the normalized pattern.
trigger: User asks to add or change CLI help, root help, cli.help.ts, HelpConfig, or renderHelp for a finografic CLI
tools: [file-read, file-edit, terminal]
---

# Scaffold / maintain CLI help (`cli.help.ts`)

Use this skill for the root CLI help surface only. For reusable `src/core/` infrastructure, use
`scaffold-core-module`.

## Read first

- `.github/instructions/project/cli-help-patterns.instructions.md` — rules, file locations, `HelpConfig` shape, examples/footer conventions.
- **`docs/spec/CLI_CORE.md`** — full **`core/render-help`** API (`HelpConfig`, `renderHelp`, section shapes), export table, and examples.

## Prerequisites

- `src/core/render-help/` exists (shared module; do not rewrite the renderer unless intentionally changing `core/` across all CLI repos).
- `tsconfig.json` includes `"core/*": ["./src/core/*"]` (or equivalent).
- You know the CLI **binary name** (e.g. `genx`) and the **commands** to list.

## Procedure

1. **Open or create** `src/cli.help.ts` at the **repository root of `src/`** (never nested under `commands/` for root help).

2. **Import types** from the barrel only:

   ```ts
   import type { HelpConfig } from 'core/render-help';
   ```

   Do not import help types from `src/types/` or `utils/`.

3. **Export a single named config** `cliHelp` (not default export):

   ```ts
   export const cliHelp: HelpConfig = {
     main: { bin: '…', args: '<command> [options]' },
     // commands, examples, footer — see instruction file
   };
   ```

4. **Follow section conventions** (details in the instruction file):
   - **examples:** `label` = human description, `description` = exact command line.
   - **footer:** `label` may use `<placeholder>` tokens; `description` optional dim line.

5. **Wire `src/cli.ts`:** import `renderHelp` from `core/render-help` and `cliHelp` from `./cli.help.js` (use `.js` extension if the project uses `verbatimModuleSyntax`). Call `renderHelp(cliHelp)` only from the CLI entry / help branch — **not** inside `cli.help.ts`.

6. **Optional shared defaults:** genx uses `defaultHelpOptions` from `config/help.config` for `minWidth` / alignment — follow existing project pattern if present.

7. **Verify:** `pnpm typecheck` and run the binary with `--help` or no args to confirm layout.

## When adding a new command

- Add a row to `commands.list` (keep descriptions one line).
- Add **Examples** entries where users will copy-paste real invocations.
- Update any command-specific help files (`src/help/*.help.ts`) if this repo splits per-command help — root skill covers **root** `HelpConfig` only.

Root help stays declarative data (`HelpConfig`); rendering stays centralized in `core/render-help`.
