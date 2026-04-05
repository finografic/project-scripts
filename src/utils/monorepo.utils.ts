import fs from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_MARKERS = [
  /** Files or directories that mark the repo root */
  'pnpm-workspace.yaml',
  'turbo.json',
  'lerna.json',
  'nx.json',
  '.git',
];

/** Cached result to avoid repeated filesystem lookups */
let cachedRoot: string | null = null;

/**
 * Universal Monorepo Root Finder
 *
 * Works in:
 * - ✅ Node (CJS or ESM)
 * - ✅ Vite / Browser
 *
 * Returns an absolute path to the monorepo root.
 */
export function findRootDir(startDir?: string): string {
  if (cachedRoot) return cachedRoot;

  //
  // 1️⃣ Browser / Vite environment
  //
  if (typeof window !== 'undefined') {
    try {
      const viteEnv =
        typeof import.meta !== 'undefined' && typeof (import.meta as any).env !== 'undefined'
          ? (import.meta as any).env
          : undefined;

      if (viteEnv?.VITE_MONOREPO_ROOT) {
        cachedRoot = viteEnv.VITE_MONOREPO_ROOT as string;
        return cachedRoot;
      }
    } catch {
      /* no-op */
    }

    // fallback for non-Vite browser
    cachedRoot = '/';
    return cachedRoot;
  }

  //
  // 2️⃣ Node environment (CJS or ESM)
  //
  let dir =
    startDir ||
    (typeof __dirname !== 'undefined'
      ? process.cwd() // CJS
      : dirname(fileURLToPath(import.meta.url))); // ESM

  //
  // 3️⃣ Walk upward until a root marker is found

  while (dir !== parse(dir).root) {
    const hasPackage = fs.existsSync(join(dir, 'package.json'));
    const hasMarker = ROOT_MARKERS.some((marker) => fs.existsSync(join(dir, marker)));

    if (hasPackage && hasMarker) {
      cachedRoot = dir;
      return cachedRoot;
    }

    dir = dirname(dir);
  }

  //
  // 4️⃣ Final fallback
  //
  cachedRoot = process.cwd();
  return cachedRoot;
}
