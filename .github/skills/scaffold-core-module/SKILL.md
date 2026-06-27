---
name: scaffold-core-module
description: Add or modify a portable module under src/core/ in @finografic CLI projects — folder layout, barrel exports, TypeScript rules, and cross-repo propagation. Use when introducing new shared infrastructure or syncing core with gli/genx.
trigger: User asks to add a core module, src/core, portable CLI infrastructure, flow, render-help, or sync core across finografic CLIs
tools: [file-read, file-edit, terminal]
---

# Scaffold / maintain a `src/core/` module

Use this skill for portable `src/core/` infrastructure only. For root CLI help configuration, use
`scaffold-cli-help`.

## Read first

- `.github/instructions/project/core-module-patterns.instructions.md` — folder layout, rules, imports, picocolors, header comment, current module table.
- **`docs/spec/CLI_CORE.md`** — full **CLI Core Module Spec**: what `core/` is, TypeScript rules, consuming from app code, **Adding a New `core/` Module** checklist, and **Current Modules** (`core/flow/`, `core/render-help/`).

## Prerequisites

- The module is **useful in more than one** `@finografic` CLI project (not app-specific logic).
- No imports from repo aliases (`utils/*`, `config/*`, `commands/*`, `types/*`).
- No side effects on import (beyond `const` init).
- **Single** clear responsibility.

## Procedure — new module

1. **Choose a kebab-case folder name** under `src/core/{module-name}/`.

2. **Create files** (minimum pattern):
   - `{module-name}.utils.ts` — implementation (or types-only module if appropriate).
   - `index.ts` — **barrel only** public API; named re-exports, no default exports.

   Add `{module-name}.types.ts` and tests if needed per `docs/spec/CLI_CORE.md`.

3. **Implementation file header** (required on `*.utils.ts`):

   ```ts
   // ⚠️ AVOID EDITING THIS FILE DIRECTLY — changes must be propagated to all @finografic CLI repos
   ```

4. **TypeScript rules (core-only):**
   - Top-level functions: **`function` keyword**, not `const` arrow for exported module-level functions.
   - Explicit return types on exports (and internal helpers where practical).
   - **Named exports only** through the barrel.
   - Relative imports inside the module use **`.js` extensions** in import paths where the project uses that rule.
   - **Picocolors:** `import pc from 'picocolors'` — never `utils/picocolors` from `core/`.

5. **tsconfig:** ensure `"core/*": ["./src/core/*"]` exists under `compilerOptions.paths`.

6. **App code** imports only from barrels:

   ```ts
   import { createFlowContext } from 'core/flow';
   import type { HelpConfig } from 'core/render-help';
   ```

7. **Cross-repo workflow** (required for real `core/` changes):
   - Update **`docs/spec/CLI_CORE.md`** in genx (**Current Modules** / new section).
   - **Propagate** the same files (or a reviewed diff) to every `@finografic` CLI repo that ships that module.
   - Consider a **genx template** or feature so new scaffolds include the module if applicable.

## Procedure — edit existing module

- Assume changes may need **identical patches** in `genx`, `gli`, and any other consumer.
- Do not pull app-layer code into `core/` to “fix” a single repo.

## Checklist (copy from `docs/spec/CLI_CORE.md`)

Before considering a module “done”:

- [ ] Useful across multiple CLI projects
- [ ] No repo-specific alias imports
- [ ] No import side effects
- [ ] Single responsibility
- [ ] Barrel `index.ts` present
- [ ] ⚠️ header on implementation files
- [ ] `core/*` path alias in `tsconfig.json`
- [ ] Documented in `docs/spec/CLI_CORE.md` (genx)
- [ ] Propagated to other repos as needed
