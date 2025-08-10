import path from 'node:path';
import fs from 'node:fs';

const ROOT_MARKERS = ['pnpm-workspace.yaml', 'package.json', '.git'];

// Helper to determine if we're in a PROJECT / WORKSPACE ROOT directory
export const findProjectRoot = (startDir = process.cwd()): string => {
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
};

// Helper to determine if we're in a WORKSPACE PACKAGE directory
export const getPackageScope = (): string | null => {
  const cwd = process.cwd();
  const WORKSPACE_ROOT = findProjectRoot();

  // If we're in workspace root, return null
  if (cwd === WORKSPACE_ROOT) return null;

  // Check if we're in a package directory (apps/* or packages/*)
  const relativePath = path.relative(WORKSPACE_ROOT, cwd);
  const parts = relativePath.split(path.sep);

  if ((parts[0] === 'apps' || parts[0] === 'packages') && parts[1]) {
    return path.join(parts[0], parts[1]);
  }

  return null;
};
