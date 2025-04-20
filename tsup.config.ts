import { defineConfig } from 'tsup';

export default defineConfig([
  // Build CLI scripts to bin/
  {
    entry: {
      'clean-all': 'src/clean-all/clean-all.ts',
      'db-setup': 'src/db-setup/db-setup.ts',
    },
    outDir: 'bin',
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    shims: true,
    clean: true,
    minify: false,
    splitting: false,
    sourcemap: false,
    dts: false, // No types for CLI
    banner: {
      js: '#!/usr/bin/env node',
    },
    external: ['fs', 'path', 'child_process', 'chalk', '@inquirer/prompts', '@dotenvx/dotenvx'],
    treeshake: true,
  },
  // Build library entry points to dist/
  {
    entry: {
      'clean-all/index': 'src/clean-all/index.ts',
      'db-setup/index': 'src/db-setup/index.ts',
      'db-setup/config.template': 'src/db-setup/config.template.ts',
    },
    outDir: 'dist',
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    shims: true,
    clean: true,
    minify: false,
    splitting: false,
    sourcemap: false,
    dts: true,
    bundle: true,
    external: ['fs', 'path'],
    treeshake: true,
  },
]);
