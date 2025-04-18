import path from 'node:path';
import fs from 'node:fs';

const ROOT_MARKERS = ['pnpm-workspace.yaml', 'package.json', '.git'];

export function findProjectRoot(startDir = process.cwd()): string {
  let dir = startDir;
  while (true) {
    if (ROOT_MARKERS.some((marker) => fs.existsSync(path.join(dir, marker)))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
