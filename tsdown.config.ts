import { chmod } from 'fs/promises';
import { defineConfig } from 'tsdown';

export default defineConfig([
  /* ---------------------------------------------------------------------- */
  /* CLI SCRIPTS → bin/                                                      */
  /* ---------------------------------------------------------------------- */
  {
    entry: {
      'sqlite-rebuild': 'src/sqlite-rebuild/sqlite-rebuild.ts',
      'db-setup': 'src/db-setup/db-setup.ts',
      'clean-docs': 'src/clean-docs/clean-docs.ts',
      'purge-builds': 'src/purge-builds/src/purge-builds/index.ts',
      'build-deployment': 'src/build-deployment/cli.ts',
      'github-release': 'src/github-release/github-release.ts',
    },

    outDir: 'bin',
    format: ['esm'],
    target: 'node22',
    platform: 'node',
    clean: true,
    dts: false,
    treeshake: true,
    shims: true,

    banner: {
      js: '#!/usr/bin/env node',
    },

    copy: [
      {
        from: 'src/build-deployment/templates',
        to: 'bin/build-deployment/templates',
      },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /* LIBRARY EXPORTS → dist/                                                 */
  /* ---------------------------------------------------------------------- */
  {
    entry: {
      'clean-docs': 'src/clean-docs/index.ts',
      'db-setup': 'src/db-setup/index.ts',
      'db-setup/config.template': 'src/db-setup/config.template.ts',
      'purge-builds': 'src/purge-builds/src/purge-builds/index.ts',
      'sqlite-rebuild': 'src/sqlite-rebuild/index.ts',
      utils: 'src/utils/index.ts',
      'build-deployment': 'src/build-deployment/index.ts',
    },

    outDir: 'dist',
    format: ['esm', 'cjs'],
    target: 'node22',
    platform: 'node',
    clean: true,
    dts: true,
    treeshake: true,
    shims: true,

    copy: [
      {
        from: 'src/build-deployment/templates',
        to: 'dist/build-deployment/templates',
      },
    ],

    onSuccess: async () => {
      await chmod('bin/sqlite-rebuild.mjs', 0o755);
    },
  },
]);
