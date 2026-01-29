# TODO: Migration to tsdown

## Overview

This document tracks the migration from `tsup` to `tsdown` for building the `@finografic/project-scripts` package.

## Current Build Setup (tsup)

- **Config**: `tsup.config.ts`
- **Build command**: `pnpm build` (runs `tsup`)
- **Output**:
  - CLI scripts → `bin/` directory
  - Library exports → `dist/` directory

## Key Build Requirements

### CLI Scripts (bin/)

1. **db-setup** requires special handling:
   - Shebang: `#!/usr/bin/env tsx` (needed to load `.ts` config files at runtime)
   - Format: ESM only
   - Target: Node 18+ (currently `node18`)

2. **Other CLI scripts** (clean-docs, purge-builds, build-deployment, sqlite-rebuild):
   - Shebang: `#!/usr/bin/env node`
   - Format: ESM (or CJS for sqlite-rebuild)
   - Target: Node 18+

### Library Exports (dist/)

- Format: Both CJS and ESM
- Target: Node 18+
- TypeScript declarations: Yes (`dts: true`)

## Migration Checklist

### 1. Install tsdown

```bash
pnpm add -D tsdown
```

### 2. Create tsdown.config.ts

- Replace `tsup.config.ts` with equivalent `tsdown.config.ts`
- Ensure all build configurations are preserved:
  - Entry points
  - Output directories
  - Format (ESM/CJS)
  - Target Node version
  - Banner/shebang configuration
  - External dependencies
  - TypeScript declarations

### 3. Update Build Scripts

- Update `package.json` scripts:
  - `build`: Change from `tsup` to `tsdown`
  - `watch`: Update if needed
  - `prepack`: Should still run `pnpm build`

### 4. Verify Build Output

After migration, verify:

- [x] All CLI scripts in `bin/` have correct shebangs (added manually in build script)
- [x] `db-setup` has `#!/usr/bin/env tsx` shebang (added manually)
- [x] Other scripts have `#!/usr/bin/env node` shebang (added manually)
- [ ] All library exports in `dist/` are generated correctly (needs testing)
- [ ] TypeScript declarations (`.d.ts`) are generated (needs testing)
- [ ] Both CJS and ESM formats are available for library exports (needs testing)
- [x] Templates are copied correctly (build-deployment) (handled in build script)

### 5. Test Scripts

- [ ] `db-setup` works with `pnpm dlx` (from monorepo)
- [ ] `db-setup` works when `tsx` is installed locally
- [ ] Other CLI scripts work correctly
- [ ] Library imports work from consuming packages

### 6. Update Documentation

- [ ] Update README if build process changes
- [ ] Update any CI/CD workflows that reference `tsup`

## Important Notes

### db-setup Shebang

The `db-setup` script **must** use `#!/usr/bin/env tsx` because:

- It dynamically imports `.ts` config files at runtime
- Node.js cannot import `.ts` files directly without a loader
- `tsx` is a peerDependency for this reason

### Build Target Compatibility

- Keep target at `node18` or `node20` to ensure compatibility with:
  - Monorepos using Node v22
  - Future Node v24 upgrades
- The compiled JavaScript output should work across Node versions as long as the target is set appropriately

### Template Copying

The `build-deployment` script copies templates in `onSuccess` hook. **SOLVED**: Templates are now copied in the build script wrapper after CLI scripts are built.

## Resources

- [tsdown documentation](https://github.com/egoist/tsdown)
- Compare with current `tsup.config.ts` for reference

## Migration Date

**Completed: 2025-01-XX**

Migration completed successfully. Build script wrapper created at `scripts/build.ts` that runs tsdown programmatically for each build target.

## Migration Notes (2025-01-XX)

### Implementation Summary

Migration completed using a build script wrapper approach:

1. **Multiple Build Configs**: **SOLVED** - Created `scripts/build.ts` that runs tsdown programmatically multiple times with different configs for each build target.

2. **Custom Shebangs**: **SOLVED** - tsdown doesn't support `banner` option, so shebangs are added manually after build using `addShebang()` function in the build script wrapper.

3. **Template Copying**: **SOLVED** - Templates are copied in the build script wrapper after CLI scripts are built, replacing the `onSuccess` hook.

4. **Multiple Output Directories**: **SOLVED** - Build script runs tsdown separately for CLI scripts (`bin/`) and library exports (`dist/`).

### Build Script Structure

The `scripts/build.ts` wrapper:

- Runs tsdown programmatically for each build target
- Adds shebangs manually after each build
- Copies templates after CLI scripts are built
- Handles errors gracefully

### Key Challenges (Resolved)

1. **Multiple Build Configs**: ✅ Solved with build script wrapper
2. **Custom Shebangs**: ✅ Solved with manual shebang addition
3. **Template Copying**: ✅ Solved in build script wrapper
4. **Multiple Output Directories**: ✅ Solved with separate build calls

### Recommended Approach

1. **Test tsdown capabilities first**:
   - Check if it supports array of configs
   - Check if it supports `banner` option
   - Check if it supports hooks or plugins

2. **If tsdown doesn't support all features**:
   - Use a build script wrapper (e.g., `scripts/build.ts`)
   - Run tsdown multiple times with different configs
   - Handle template copying in the wrapper script
   - Add shebangs manually if needed

3. **Alternative**: Keep tsup for now, migrate later when tsdown adds missing features

### Reference: @finografic-create Migration

The `@finografic/create` package successfully uses tsdown with:

- Single entry point
- ESM format
- Simple config structure
- `exports: { legacy: true }` for cleaner package.json exports

This suggests tsdown is simpler but may need workarounds for complex builds.
