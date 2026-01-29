import { cp, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { defineConfig } from 'tsdown';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Helper to add shebang to files
async function addShebang(filePath: string, shebang: string): Promise<void> {
  try {
    const content = await readFile(filePath, 'utf-8');
    if (!content.startsWith('#!')) {
      await writeFile(filePath, `${shebang}\n${content}`);
    }
  } catch (_error) {
    // File might not exist yet, ignore
  }
}

// Post-build function to handle CLI scripts and templates
async function postBuild() {
  // Copy CLI scripts to bin/ directory and add shebangs
  const cliScripts = [
    { name: 'sqlite-rebuild', shebang: '#!/usr/bin/env node', needsCjs: true },
    { name: 'db-setup', shebang: '#!/usr/bin/env tsx', needsCjs: false },
    { name: 'clean-docs', shebang: '#!/usr/bin/env node', needsCjs: false },
    { name: 'purge-builds', shebang: '#!/usr/bin/env node', needsCjs: false },
    { name: 'build-deployment', shebang: '#!/usr/bin/env node', needsCjs: false },
  ];

  for (const script of cliScripts) {
    // Copy ESM version to bin/
    const esmSrc = join(__dirname, 'dist', `${script.name}.js`);
    const esmDest = join(__dirname, 'bin', `${script.name}.js`);
    try {
      await cp(esmSrc, esmDest, { force: true });
      await addShebang(esmDest, script.shebang);
    } catch (error) {
      console.error(`Warning: Could not copy ${script.name}.js:`, error);
    }

    // Copy CJS version if needed (only for sqlite-rebuild)
    if (script.needsCjs) {
      const cjsSrc = join(__dirname, 'dist', `${script.name}.cjs`);
      const cjsDest = join(__dirname, 'bin', `${script.name}.cjs`);
      try {
        await cp(cjsSrc, cjsDest, { force: true });
        await addShebang(cjsDest, script.shebang);
      } catch (error) {
        console.error(`Warning: Could not copy ${script.name}.cjs:`, error);
      }
    }
  }

  // Copy templates to bin/build-deployment/templates and dist/build-deployment/templates
  const srcTemplates = join(__dirname, 'src/build-deployment/templates');
  const binTemplates = join(__dirname, 'bin/build-deployment/templates');
  const distTemplates = join(__dirname, 'dist/build-deployment/templates');

  try {
    await cp(srcTemplates, binTemplates, { recursive: true });
    await cp(srcTemplates, distTemplates, { recursive: true });
  } catch (error) {
    console.error('Warning: Could not copy templates:', error);
  }
}

export default defineConfig({
  // Enable exports generation to simplify package.json
  exports: true,

  // All entry points - tsdown will handle them appropriately
  entry: {
    // CLI scripts → will be copied to bin/ in post-build
    'sqlite-rebuild': 'src/sqlite-rebuild/sqlite-rebuild.ts',
    'db-setup': 'src/db-setup/db-setup.ts',
    'clean-docs': 'src/clean-docs/clean-docs.ts',
    'purge-builds': 'src/purge-builds/src/purge-builds/index.ts',
    'build-deployment': 'src/build-deployment/cli.ts',

    // Library exports → dist/
    'clean-docs/index': 'src/clean-docs/index.ts',
    'db-setup/index': 'src/db-setup/index.ts',
    'db-setup/config.template': 'src/db-setup/config.template.ts',
    'purge-builds/src/purge-builds/index': 'src/purge-builds/src/purge-builds/index.ts',
    'sqlite-rebuild/index': 'src/sqlite-rebuild/index.ts',
    'utils/index': 'src/utils/index.ts',
    'build-deployment/index': 'src/build-deployment/index.ts',
  },

  // Output format - CJS and ESM (we'll filter CLI scripts in post-build)
  format: ['cjs', 'esm'],

  // Output directory - everything goes to dist first
  outDir: 'dist',

  // Target Node version
  target: 'node18',

  // Platform
  platform: 'node' as const,

  // Enable shims for better compatibility
  shims: true,

  // Clean output directory
  clean: true,

  // Generate TypeScript declarations (only for library exports)
  dts: true,

  // Tree-shaking
  treeshake: true,

  // External dependencies
  external: ['fs', 'path', 'child_process'],

  // Use onSuccess hook for post-build tasks
  onSuccess: postBuild,
});
