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

- [ ] All CLI scripts in `bin/` have correct shebangs
- [ ] `db-setup` has `#!/usr/bin/env tsx` shebang
- [ ] Other scripts have `#!/usr/bin/env node` shebang
- [ ] All library exports in `dist/` are generated correctly
- [ ] TypeScript declarations (`.d.ts`) are generated
- [ ] Both CJS and ESM formats are available for library exports
- [ ] Templates are copied correctly (build-deployment)

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

The `build-deployment` script copies templates in `onSuccess` hook. Ensure `tsdown` supports similar hooks or find an alternative approach.

## Resources

- [tsdown documentation](https://github.com/egoist/tsdown)
- Compare with current `tsup.config.ts` for reference

## Migration Date

_To be filled when migration is completed_
