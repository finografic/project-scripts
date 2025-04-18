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
          ? (progress: DeleteProgress) => {
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
    console.log(chalk.gray(`  ${totalPaths} total paths processed`));
    if (totalFiles > 0) {
      const fileCount = totalFiles;
      console.log(chalk.gray(`  ${fileCount} total files ${dryRun ? 'would be' : 'were'} deleted\n`));
    }
  } catch (error: unknown) {
    console.error(chalk.red('\n✘ Clean operation failed:'), error);
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
