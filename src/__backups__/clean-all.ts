#!/usr/bin/env tsx
import { deleteAsync } from 'del';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

// Get workspace root - it's 2 levels up from this script
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

// Helper to determine if we're in a package directory
function getPackageScope(): string | null {
  const cwd = process.cwd();
  // If we're in workspace root, return null
  if (cwd === WORKSPACE_ROOT) return null;

  // Check if we're in a package directory (apps/* or packages/*)
  const relativePath = path.relative(WORKSPACE_ROOT, cwd);
  const parts = relativePath.split(path.sep);

  if ((parts[0] === 'apps' || parts[0] === 'packages') && parts[1]) {
    return path.join(parts[0], parts[1]);
  }

  return null;
}

// Never delete these
const GLOB_DELETE_EXCLUDE = [
  '.git',
  '.env',
  '.env.*',
  'pnpm-workspace.yaml',
  'package.json',
  'apps',
  'packages',
  'config',
  'scripts',
] as const;

// Patterns to delete, in order of safety
const GLOB_DELETE_INCLUDE = [
  // Build artifacts first
  '.turbo',
  '**/dist',
  '**/*.tsbuildinfo',

  // PNPM specific - most problematic parts first
  '**/node_modules/.pnpm/**/.*',
  '**/node_modules/.pnpm/**/*',
  '**/node_modules/.pnpm',
  '**/node_modules',

  // Root specific files
  'pnpm-lock.yaml',
] as const;

interface CleanOptions {
  dryRun?: boolean;
  verbose?: boolean;
  recursive?: boolean;
}

// Helper to safely check if path is a file
function isFile(path: string): boolean {
  try {
    return fs.statSync(path).isFile();
  } catch (error) {
    return false;
  }
}

async function cleanAll({ dryRun = false, verbose = false, recursive = false }: CleanOptions = {}) {
  const packageScope = getPackageScope();
  const baseDir = packageScope ? path.join(WORKSPACE_ROOT, packageScope) : WORKSPACE_ROOT;

  console.log(
    chalk.yellow(`\nCleaning ${packageScope || 'workspace root'}${recursive ? ' recursively' : ''}...`),
  );
  if (dryRun) console.log(chalk.yellow('DRY RUN - no files will be deleted\n'));

  let totalPaths = 0;
  let totalFiles = 0;
  const rootPaths = new Set<string>();

  try {
    // Delete patterns in sequence to maintain order
    for (const pattern of GLOB_DELETE_INCLUDE) {
      const fullPattern = path.join(baseDir, pattern).replace(/\\/g, '/');
      // Only apply recursive flag at root level
      const finalPattern = !packageScope && recursive ? fullPattern : fullPattern.replace(/^\*\*\//, '');

      const deletedPaths = await deleteAsync(finalPattern, {
        dryRun,
        dot: true,
        onProgress: verbose
          ? (progress: { totalCount: number; deletedCount: number; percent: number }) => {
              const { deletedCount, totalCount, percent } = progress;
              console.log(chalk.gray(`Progress: ${deletedCount}/${totalCount} (${percent.toFixed(1)}%)`));
            }
          : undefined,
        ignore: GLOB_DELETE_EXCLUDE.map((p) => path.join(baseDir, p).replace(/\\/g, '/')),
      });

      // Add root-level paths to our set
      deletedPaths.forEach((file) => {
        const relPath = path.relative(baseDir, file);
        const rootPath = relPath.split(path.sep)[0];
        if (rootPath) rootPaths.add(rootPath);
      });

      totalPaths += deletedPaths.length;
      totalFiles += deletedPaths.reduce((acc, p) => acc + (isFile(p) ? 1 : 0), 0);
    }

    if (verbose || dryRun) {
      console.log('\nRoot paths that would be affected:');
      Array.from(rootPaths)
        .sort()
        .forEach((file) => console.log(chalk.gray(`- ${file}`)));
    }

    console.log(chalk.green(`\n✔ Clean ${dryRun ? 'simulation' : 'operation'} completed successfully`));
    console.log(chalk.gray(`  ${rootPaths.size} root paths ${dryRun ? 'would be' : 'were'} affected`));
    if (totalFiles > 0) {
      const fileCount = totalFiles;
      console.log(chalk.gray(`  ${fileCount} total files ${dryRun ? 'would be' : 'were'} deleted\n`));
    }
  } catch (error) {
    console.error(chalk.red('\n✘ Clean operation failed:'), error);
    process.exit(1);
  }
}

// Allow running directly or importing
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  cleanAll({
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    recursive: args.includes('--recursive') || args.includes('-r'),
  });
}

export type { CleanOptions };
export { cleanAll as clean, GLOB_DELETE_EXCLUDE, GLOB_DELETE_INCLUDE };
