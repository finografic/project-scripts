import { access } from 'fs/promises';

const files = [
  'bin/sqlite-rebuild.js',
  'dist/utils.mjs',
];

await Promise.all(files.map((f) => access(f)));
