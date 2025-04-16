import path from 'path';
import fs from 'fs';

export function findConfigFile(configNames: string[], startDir = process.cwd()): string | null {
  let dir = startDir;
  while (true) {
    for (const name of configNames) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
