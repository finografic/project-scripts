import fs from 'node:fs';
import path from 'node:path';

const ROOT_MARKERS = ['pnpm-workspace.yaml', 'package.json', '.git'];

let cachedProjectRoot: string | undefined;

// Helper to determine if we're in a PROJECT / WORKSPACE ROOT directory
export const findProjectRoot = (startDir = process.cwd()): string => {
  if (cachedProjectRoot) {
    return cachedProjectRoot;
  }

  let dir = startDir;

  while (true) {
    // Check if this directory has workspace markers
    if (ROOT_MARKERS.some((marker) => fs.existsSync(path.join(dir, marker)))) {
      // 🎯 CRITICAL: Check if this is the REAL monorepo root
      const hasPnpmWorkspace = fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'));
      const hasAppsDir = fs.existsSync(path.join(dir, 'apps'));
      const hasPackagesDir = fs.existsSync(path.join(dir, 'packages'));

      // Monorepo root: pnpm-workspace.yaml plus at least one workspace folder (apps or packages)
      if (hasPnpmWorkspace && (hasAppsDir || hasPackagesDir)) {
        const markers: string[] = ['pnpm-workspace.yaml'];
        if (hasAppsDir) markers.push('apps/');
        if (hasPackagesDir) markers.push('packages/');
        console.log(`🎯 Found monorepo root: ${dir} (${markers.join(', ')})`);
        cachedProjectRoot = dir;
        return dir;
      }

      // If we're at the filesystem root, stop here
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    } else {
      // If no markers found, go up one level
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  // Fallback to current working directory if no monorepo found
  console.log(`⚠️  No monorepo root found, using current directory: ${process.cwd()}`);
  cachedProjectRoot = process.cwd();
  return cachedProjectRoot;
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
