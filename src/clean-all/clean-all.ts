import { deleteAsync } from 'del';
import chalk from 'chalk';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CleanOptions, DeleteProgress } from './clean-all.types';
import { GLOB_DELETE_EXCLUDE, GLOB_DELETE_INCLUDE } from './clean.config';
import { isFile } from '../utils/fs.utils';
import { findProjectRoot, getPackageScope } from '../utils/project.utils';

const WORKSPACE_ROOT = findProjectRoot();

// Helper to determine if we're in a package directory

export async function clean({ dryRun = false, verbose = false, recursive = false }: CleanOptions = {}) {
  // Debug info
  console.log(chalk.magenta('\nDebug Information:'));
  console.log(chalk.magenta('  Current Directory:', process.cwd()));
  console.log(chalk.magenta('  Project Root:', WORKSPACE_ROOT));

  const packageScope = getPackageScope();
  const baseDir = packageScope ? path.join(WORKSPACE_ROOT, packageScope) : WORKSPACE_ROOT;

  console.log(chalk.magenta('  Package Scope:', packageScope || 'none'));
  console.log(chalk.magenta('  Base Directory:', baseDir));

  // Operation info
  console.log(
    chalk[dryRun ? 'gray' : 'magenta'](
      `\nCleaning ${packageScope || 'workspace root'}${recursive ? ' recursively' : ''}...`,
    ),
  );

  if (dryRun) {
    console.log(chalk.gray('DRY RUN - no files will be deleted'));
    console.log(chalk.gray('Patterns to be processed:'));
    GLOB_DELETE_INCLUDE.forEach((pattern) => {
      console.log(chalk.gray(`  - ${pattern}`));
    });
    console.log(chalk.gray('\nExcluded patterns:'));
    GLOB_DELETE_EXCLUDE.forEach((pattern) => {
      console.log(chalk.gray(`  - ${pattern}`));
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
        console.log(chalk[dryRun ? 'gray' : 'magenta'](`\nProcessing pattern: ${pattern}`));
        console.log(chalk[dryRun ? 'gray' : 'magenta'](`Final pattern: ${finalPattern}`));
      }

      const deletedPaths = await deleteAsync(finalPattern, {
        dryRun,
        dot: true,
        onProgress: verbose
          ? (progress: DeleteProgress) => {
              const { deletedCount, totalCount, percent } = progress;
              console.log(
                chalk[dryRun ? 'gray' : 'magenta'](
                  `Progress: ${deletedCount}/${totalCount} (${percent.toFixed(1)}%)`,
                ),
              );
            }
          : undefined,
        ignore: GLOB_DELETE_EXCLUDE.map((p) => path.join(baseDir, p).replace(/\\/g, '/')),
      });

      if (verbose && deletedPaths.length > 0) {
        console.log(chalk[dryRun ? 'gray' : 'magenta']('\nPaths affected:'));
        deletedPaths.forEach((file) => {
          console.log(chalk[dryRun ? 'gray' : 'magenta'](`  - ${file}`));
        });
      }

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
      console.log(chalk[dryRun ? 'gray' : 'magenta']('\nRoot paths affected:'));
      Array.from(rootPaths)
        .sort()
        .forEach((file) => console.log(chalk[dryRun ? 'gray' : 'magenta'](`  - ${file}`)));
    }

    // Summary
    console.log(
      chalk[dryRun ? 'gray' : 'green'](
        `\n✔ Clean ${dryRun ? 'simulation' : 'operation'} completed successfully`,
      ),
    );
    console.log(
      chalk[dryRun ? 'gray' : 'magenta'](
        `  ${rootPaths.size} root paths ${dryRun ? 'would be' : 'were'} affected`,
      ),
    );
    console.log(chalk[dryRun ? 'gray' : 'magenta'](`  ${totalPaths} total paths processed`));
    if (totalFiles > 0) {
      console.log(
        chalk[dryRun ? 'gray' : 'magenta'](
          `  ${totalFiles} total files ${dryRun ? 'would be' : 'were'} deleted\n`,
        ),
      );
    }
  } catch (error: unknown) {
    console.error(chalk.yellow('\n✘ Clean operation failed:'));
    if (error instanceof Error) {
      console.error(chalk.yellow('  Error:', error.message));
      if (error.stack) {
        console.error(chalk.yellow('  Stack:', error.stack));
      }
    } else {
      console.error(chalk.yellow('  Unknown error:', error));
    }
    process.exit(1);
  }
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

// Export as both named and default
export default clean;
