import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  // From first config
  entry: ['src/index.ts', 'src/cli.ts'],
  external: ['fs', 'path'],
  format: ['cjs', 'esm'],
  minify: false,
  noExternal: ['eslint-config-flat-gitignore'],
  outDir: 'dist',
  platform: 'node',
  shims: true,
  sourcemap: false,
  splitting: false,
  target: 'node18',
  treeshake: true,
});
