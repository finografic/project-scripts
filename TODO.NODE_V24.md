# TODO: Upgrade to Node.js v24

## Overview

This document tracks the upgrade of `@finografic/project-scripts` to Node.js v24.

## Current Setup

- **Node version**: v22.17.1 (via `.nvmrc`)
- **Build target**: `node18` (in `tsup.config.ts`)
- **Package engines**: Not currently specified

## Compatibility Considerations

### Can project-scripts built with Node v24 be used in monorepos using Node v22?

**Answer: YES, with caveats:**

1. **Build Target**: The compiled JavaScript output is compatible as long as:
   - Build target is set to `node18`, `node20`, or `node22` (not `node24`)
   - No Node v24-specific runtime features are used in the compiled code
   - The package is built with a compatible target

2. **Runtime Execution**:
   - When using `pnpm dlx`, the script runs with the **monorepo's Node version** (v22), not the build Node version
   - The shebang `#!/usr/bin/env tsx` will use whatever Node version is available in PATH
   - As long as the compiled code targets a compatible ES version, it will work

3. **Package.json engines field**:
   - If `engines.node` is set to `>=24.0.0`, it will cause warnings/errors in Node v22 environments
   - Should be set to `>=22.17.1` or `>=18.0.0` to maintain compatibility

## Upgrade Checklist

### 1. Update Node Version

- [ ] Update `.nvmrc` to `24.x.x` (specific version TBD)
- [ ] Update CI/CD workflows to use Node v24
- [ ] Test build locally with Node v24

### 2. Update Build Configuration

- [ ] Review `tsup.config.ts` (or `tsdown.config.ts` if migrated):
  - Consider if build target should remain `node18` for compatibility
  - Or update to `node22` if dropping Node v22 support
  - Or update to `node24` if only supporting Node v24+

### 3. Update Package.json

- [ ] Add/update `engines` field:

  ```json
  "engines": {
    "node": ">=24.0.0"  // or ">=22.17.1" if maintaining compatibility
  }
  ```

### 4. Test Compatibility

- [ ] Build package with Node v24
- [ ] Test in monorepo using Node v22:
  - [ ] `pnpm dlx db-setup` works
  - [ ] Other CLI scripts work
  - [ ] Library imports work
- [ ] Test in monorepo using Node v24:
  - [ ] All scripts work
  - [ ] No compatibility issues

### 5. Update Dependencies

- [ ] Review and update dependencies that may have Node v24 requirements
- [ ] Check for any deprecated APIs that were removed in Node v24
- [ ] Update `@types/node` to match Node v24 version

### 6. ESM Considerations

Node v24 has stricter ESM handling:

- [ ] Verify all `.ts` file imports work correctly
- [ ] Ensure `tsx` loader works with Node v24
- [ ] Test dynamic imports (used in `db-setup` for config loading)

### 7. Update Documentation

- [ ] Update README with Node version requirements
- [ ] Update any setup/installation instructions
- [ ] Document compatibility matrix if supporting multiple Node versions

## Breaking Changes in Node v24

Review Node v24 release notes for:

- [ ] Deprecated APIs removed
- [ ] ESM behavior changes
- [ ] Module resolution changes
- [ ] Any other breaking changes affecting the build or runtime

## Migration Strategy Options

### Option A: Maintain Node v22 Compatibility

- Keep build target at `node18` or `node22`
- Set `engines.node` to `>=22.17.1`
- Build with Node v24 but target compatible output
- **Pros**: Works in both Node v22 and v24 environments
- **Cons**: Can't use Node v24-specific features

### Option B: Require Node v24

- Update build target to `node24`
- Set `engines.node` to `>=24.0.0`
- Use Node v24-specific features if beneficial
- **Pros**: Can leverage latest Node features
- **Cons**: Monorepos must upgrade to Node v24

### Option C: Dual Support (Complex)

- Build multiple versions or use feature detection
- **Not recommended** - adds complexity

## Recommended Approach

**Option A** is recommended if:

- The package is used by multiple monorepos
- Not all monorepos can upgrade to Node v24 immediately
- No Node v24-specific features are needed

**Option B** is recommended if:

- All consuming monorepos can upgrade together
- Node v24 features provide significant benefits
- Simpler maintenance with single Node version

## Testing Plan

1. **Local Testing**:
   - Install Node v24
   - Run `nvm use` to switch
   - Build package: `pnpm build`
   - Test all CLI scripts locally

2. **Monorepo Testing** (Node v22):
   - In monorepo with Node v22
   - Run `pnpm dlx db-setup` (uses latest published version)
   - Verify all functionality works

3. **Monorepo Testing** (Node v24):
   - In monorepo with Node v24
   - Run all scripts
   - Verify no regressions

## Resources

- [Node.js v24 Release Notes](https://nodejs.org/en/blog/release/v24.0.0)
- [Node.js ESM Documentation](https://nodejs.org/api/esm.html)
- Current `.nvmrc` file
- Current `tsup.config.ts` (or `tsdown.config.ts`)

## Migration Date

_To be filled when upgrade is completed_

## Decision: Node v24 Compatibility (2025-01-XX)

### Can project-scripts built with Node v24 be used in monorepos using Node v22?

**YES, with proper configuration:**

1. **Build Target**: Keep `target: 'node18'` or `target: 'node22'` in build config
   - The compiled JavaScript will be compatible with Node v22
   - Building with Node v24 doesn't affect runtime compatibility if target is set correctly

2. **Runtime Execution**:
   - When using `pnpm dlx`, scripts run with the **monorepo's Node version** (v22)
   - The shebang `#!/usr/bin/env tsx` uses whatever Node is in PATH
   - As long as compiled code targets compatible ES version, it works

3. **Package.json engines**:
   - Set to `">=22.17.1"` to allow both Node v22 and v24
   - Or `">=18.0.0"` for maximum compatibility

### Recommended Strategy

**Option A: Upgrade project-scripts to Node v24, keep monorepo on v22** ✅ RECOMMENDED

- Build project-scripts with Node v24
- Keep build target at `node18` or `node22`
- Set `engines.node` to `">=22.17.1"`
- Monorepo can continue using Node v22
- **Pros**: Can use Node v24 features in development, maintain compatibility
- **Cons**: None significant

**Option B: Upgrade everything to Node v24**

- Upgrade both project-scripts and monorepo to Node v24
- Update build target to `node24` if desired
- Set `engines.node` to `">=24.0.0"`
- **Pros**: Latest features everywhere, simpler maintenance
- **Cons**: Requires coordinated upgrade, may break other dependencies

### Testing Plan

1. Build project-scripts with Node v24 (target: node18)
2. Test in monorepo with Node v22:
   - `pnpm dlx db-setup` works
   - All CLI scripts work
   - Library imports work
3. If successful, proceed with Option A
