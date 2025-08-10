import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/purge-builds/index.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  minify: false,
  sourcemap: false,
  dts: false,
  bundle: true,
  external: ['fs', 'path', 'os', 'process'],
  onSuccess: 'chmod +x dist/index.js',
});
