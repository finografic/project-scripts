/**
 * @fileoverview Clean utility function for removing build artifacts
 * @deprecated This clean module is deprecated. Use purge-builds instead.
 * @internal This module is kept for legacy compatibility but is not exported.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { deleteAsync } from 'del';
import type { CleanOptions, DeleteProgress } from './clean.types';

import { pc } from 'utils/picocolors';
import { isFile } from '../utils/fs.utils';
import { findProjectRoot, getPackageScope } from '../utils/project.utils';
import { GLOB_DELETE_EXCLUDE, GLOB_DELETE_INCLUDE } from './clean.config';

const WORKSPACE_ROOT = findProjectRoot();

// Helper to check if a path matches any of our include patterns
const matchesIncludePattern = (filePath: string): boolean => {
  return GLOB_DELETE_INCLUDE.some((pattern) => {
    // Convert glob pattern to regex
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
    return new RegExp(`^${regexPattern}$`).test(filePath);
  });
};

/**
 * Clean function to remove build artifacts and temporary files
 * @deprecated This function is deprecated. Use purge-builds package instead.
 * @param options - Clean options configuration
 * @param options.dryRun - If true, only simulate the operation without deleting files
 * @param options.verbose - If true, show detailed progress information
 * @param options.recursive - If true, apply cleaning recursively to all workspace packages
 * @internal This function is kept for legacy compatibility but should not be used.
 */
export async function clean({ dryRun = false, verbose = false, recursive = false }: CleanOptions = {}) {
  if (dryRun) {
    console.log(pc.green('DRY RUN - no files will be deleted\n'));
  }
  // Path info
  console.log(pc.white('\nPath Information:'));
  console.log(pc.gray(`  Current Directory: ${process.cwd()}`));
  console.log(pc.gray(`  Project Root: ${WORKSPACE_ROOT}`));

  const packageScope = getPackageScope();
  const baseDir = packageScope ? path.join(WORKSPACE_ROOT, packageScope) : WORKSPACE_ROOT;

  // Determine scope type for messaging
  const scopeType = packageScope ? 'Local package' : recursive ? 'Project (deep)' : 'Project root (only)';

  console.log(pc.gray(`  Package Scope: ${packageScope || 'none'}`));
  console.log(pc.gray(`  Base Directory: ${baseDir}`));
  console.log(pc.gray(`  Scope Type: ${scopeType}`));

  // Operation info
  console.log((dryRun ? pc.white : pc.magenta)(`\nCleaning ${scopeType}...\n`));

  if (dryRun) {
    console.log(pc.gray('Patterns to be processed:'));
    GLOB_DELETE_INCLUDE.forEach((pattern) => {
      console.log(pc.gray(`  - ${pattern}`));
    });
    console.log(pc.gray('\nExcluded patterns:'));
    GLOB_DELETE_EXCLUDE.forEach((pattern) => {
      console.log(pc.gray(`  - ${pattern}`));
    });
    console.log('');
  }

  let totalPaths = 0;
  let totalFiles = 0;
  const rootPaths = new Set<string>();

  try {
    // Delete patterns in sequence to maintain order
    for (const pattern of GLOB_DELETE_INCLUDE) {
      const fullPattern = path.join(baseDir, pattern).replace(/\\/g, '/');
      // Only apply recursive flag at root level
      const finalPattern = !packageScope && recursive ? fullPattern : fullPattern.replace(/^\*\*\//, '');

      if (verbose) {
        console.log((dryRun ? pc.gray : pc.magenta)(`\nProcessing pattern: ${pattern}`));
        console.log((dryRun ? pc.gray : pc.magenta)(`Final pattern: ${finalPattern}`));
      }

      const deletedPaths = await deleteAsync(finalPattern, {
        dryRun,
        dot: true,
        onProgress: verbose
          ? (progress: DeleteProgress) => {
              const { deletedCount, totalCount, percent } = progress;
              console.log(
                (dryRun ? pc.gray : pc.magenta)(
                  `Progress: ${deletedCount}/${totalCount} (${percent.toFixed(1)}%)`,
                ),
              );
            }
          : undefined,
        ignore: GLOB_DELETE_EXCLUDE.map((p) => path.join(baseDir, p).replace(/\\/g, '/')),
      });

      if (verbose && deletedPaths.length > 0) {
        console.log((dryRun ? pc.gray : pc.magenta)('\nPaths affected:'));
        deletedPaths.forEach((file) => {
          console.log((dryRun ? pc.gray : pc.magenta)(`  - ${file}`));
        });
      }

      // Add root-level paths to our set if they match include patterns
      deletedPaths.forEach((file) => {
        const relPath = path.relative(baseDir, file);
        const rootPath = relPath.split(path.sep)[0];
        if (rootPath && matchesIncludePattern(rootPath)) {
          rootPaths.add(rootPath);
        }
      });

      totalPaths += deletedPaths.length;
      totalFiles += deletedPaths.reduce((acc, p) => acc + (isFile(p) ? 1 : 0), 0);
    }

    if (verbose || dryRun) {
      const filteredRootPaths = Array.from(rootPaths).filter(matchesIncludePattern);
      if (filteredRootPaths.length > 0) {
        console.log((dryRun ? pc.gray : pc.magenta)('\nRoot paths affected:'));
        filteredRootPaths
          .sort()
          .forEach((file) => console.log((dryRun ? pc.gray : pc.magenta)(`  - ${file}`)));
      }
    }

    // Summary
    console.log(
      (dryRun ? pc.gray : pc.green)(
        `\n✔ Clean ${dryRun ? 'simulation' : 'operation'} completed successfully`,
      ),
    );
    console.log(pc.gray(`  ${rootPaths.size} root paths ${dryRun ? 'would be' : 'were'} affected`));
    console.log(pc.gray(`  ${totalPaths} total paths processed`));
    if (totalFiles > 0) {
      console.log(pc.gray(`  ${totalFiles} total files ${dryRun ? 'would be' : 'were'} deleted\n`));
    }
  } catch (error: unknown) {
    console.error(pc.yellow('\n✘ Clean operation failed:'));
    if (error instanceof Error) {
      console.error(pc.yellow(`  Error: ${error.message}`));
      if (error.stack) {
        console.error(pc.yellow(`  Stack: ${error.stack}`));
      }
    } else {
      console.error(pc.yellow(`  Unknown error: ${String(error)}`));
    }
    process.exit(1);
  }
  console.log('\n');
}

// Allow running directly or importing
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  clean({
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    recursive: args.includes('--recursive') || args.includes('-r'),
  });
}

export default clean;
