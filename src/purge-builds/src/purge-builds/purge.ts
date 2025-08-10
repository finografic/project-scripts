#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

export interface PurgeOptions {
  dryRun?: boolean;
  verbose?: boolean;
  recursive?: boolean;
}

interface FindResult {
  path: string;
  type: 'file' | 'directory';
  size: number;
}

// Patterns to delete
const DELETE_PATTERNS = {
  directories: ['.turbo', '.tsup', 'dist', 'node_modules', '.pnpm'],
  files: ['pnpm-lock.yaml'],
  fileExtensions: ['.tsbuildinfo'], // catches tsconfig.tsbuildinfo and any other *.tsbuildinfo files
};

// Protection patterns are now handled directly in shouldDelete function

/**
 * Check if a path should be deleted based on patterns
 */
function shouldDelete(itemPath: string, itemName: string, isDirectory: boolean): boolean {
  // Never delete ourselves (self-preservation)
  if (itemPath.includes('packages/purge-builds/dist')) {
    return false;
  }

  // Always protect certain directories regardless of level (like src, .git, etc.)
  const alwaysProtect = ['.git', '.env', 'package.json', 'src'];
  if (alwaysProtect.includes(itemName)) {
    return false;
  }

  // Protect top-level structural directories
  const pathParts = itemPath.split(path.sep);
  const topLevelStructural = ['apps', 'packages', 'config', 'scripts'];
  const isTopLevelStructural = topLevelStructural.includes(itemName) && pathParts.length <= 2;

  if (isTopLevelStructural) {
    return false;
  }

  // Check directory patterns
  if (isDirectory && DELETE_PATTERNS.directories.includes(itemName)) {
    return true;
  }

  // Check file patterns
  if (!isDirectory) {
    if (DELETE_PATTERNS.files.includes(itemName)) {
      return true;
    }
    if (DELETE_PATTERNS.fileExtensions.some((ext) => itemName.endsWith(ext))) {
      return true;
    }
  }

  return false;
}

/**
 * Get directory size recursively
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    let totalSize = 0;

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        totalSize += await getDirectorySize(itemPath);
      } else if (item.isFile()) {
        const stats = await fs.stat(itemPath);
        totalSize += stats.size;
      }
    }

    return totalSize;
  } catch {
    return 0;
  }
}

/**
 * Find all items to delete in a directory
 */

async function findItemsToDelete(
  dirPath: string,
  // biome-ignore lint/style/noInferrableTypes: is's fine
  recursive: boolean = false,
  results: FindResult[] = [],
  // biome-ignore lint/style/noInferrableTypes: is's fine
  currentDepth: number = 0,
): Promise<FindResult[]> {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      const isDirectory = item.isDirectory();

      // Check if this item should be deleted
      if (shouldDelete(itemPath, item.name, isDirectory)) {
        const size = isDirectory ? await getDirectorySize(itemPath) : (await fs.stat(itemPath)).size;

        results.push({
          path: itemPath,
          type: isDirectory ? 'directory' : 'file',
          size,
        });

        // If we're deleting this directory, don't recurse into it
        continue;
      }

      // Recurse into subdirectories (if recursive mode or if we're at depth 0)
      if (isDirectory && (recursive || currentDepth === 0)) {
        await findItemsToDelete(itemPath, recursive, results, currentDepth + 1);
      }
    }
  } catch {
    // Skip directories we can't read (permissions, etc.)
  }

  return results;
}

/**
 * Delete a single item (file or directory)
 */
async function deleteItem(itemPath: string, isDirectory: boolean): Promise<boolean> {
  try {
    if (isDirectory) {
      await fs.rm(itemPath, { recursive: true, force: true });
    } else {
      await fs.unlink(itemPath);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

/**
 * Main purge function - V2 approach
 */
export async function purge({ dryRun = false, verbose = false, recursive = false }: PurgeOptions = {}) {
  const startTime = Date.now();
  const workingDir = process.cwd();

  // Safety check
  if (dryRun) {
    console.log(chalk.green('🔒 DRY RUN MODE - NO FILES WILL BE DELETED\n'));
    console.log(chalk.yellow('⚠️  This is a simulation only. Remove --dry-run to actually delete files.\n'));
  }

  console.log(chalk.white('📁 Scanning for build artifacts...\n'));
  console.log(chalk.gray(`Working Directory: ${workingDir}`));
  console.log(chalk.gray(`Mode: ${recursive ? 'Recursive (deep)' : 'Current level only'}`));
  console.log(chalk.gray(`Operation: ${dryRun ? 'DRY RUN (simulation)' : 'LIVE (actual deletion)'}\n`));

  // Find all items to delete
  const itemsToDelete = await findItemsToDelete(workingDir, recursive);

  if (itemsToDelete.length === 0) {
    console.log(chalk.green('✨ No build artifacts found to clean!'));
    return;
  }

  // Calculate totals
  const totalSize = itemsToDelete.reduce((sum, item) => sum + item.size, 0);
  const dirCount = itemsToDelete.filter((item) => item.type === 'directory').length;
  const fileCount = itemsToDelete.filter((item) => item.type === 'file').length;

  // Show what will be deleted
  console.log(chalk.white(`📋 Found ${itemsToDelete.length} items to clean:`));
  console.log(chalk.gray(`   • ${dirCount} directories`));
  console.log(chalk.gray(`   • ${fileCount} files`));
  console.log(chalk.gray(`   • ${formatBytes(totalSize)} total size\n`));

  if (verbose || dryRun) {
    console.log(chalk.white('📝 Items to be processed:\n'));

    // Group by type for better display
    const directories = itemsToDelete.filter((item) => item.type === 'directory');
    const files = itemsToDelete.filter((item) => item.type === 'file');

    if (directories.length > 0) {
      console.log(chalk.cyan('📁 Directories:'));
      directories.forEach((item) => {
        const relativePath = path.relative(workingDir, item.path);
        console.log(chalk.gray(`   ${relativePath} (${formatBytes(item.size)})`));
      });
      console.log();
    }

    if (files.length > 0) {
      console.log(chalk.cyan('📄 Files:'));
      files.forEach((item) => {
        const relativePath = path.relative(workingDir, item.path);
        console.log(chalk.gray(`   ${relativePath} (${formatBytes(item.size)})`));
      });
      console.log();
    }
  }

  if (dryRun) {
    console.log(chalk.yellow('🔒 DRY RUN: No files were actually deleted.'));
    console.log(chalk.gray(`Would have freed ${formatBytes(totalSize)} of space.`));
    return;
  }

  // Actually delete items
  console.log(chalk.magenta('🗑️  Deleting items...\n'));

  let deletedCount = 0;
  let freedSpace = 0;
  let errorCount = 0;

  for (const item of itemsToDelete) {
    const relativePath = path.relative(workingDir, item.path);

    if (verbose) {
      process.stdout.write(chalk.gray(`Deleting: ${relativePath}...`));
    }

    const success = await deleteItem(item.path, item.type === 'directory');

    if (success) {
      deletedCount++;
      freedSpace += item.size;
      if (verbose) {
        console.log(chalk.green(' ✓'));
      }
    } else {
      errorCount++;
      if (verbose) {
        console.log(chalk.red(' ✗'));
      } else {
        console.log(chalk.red(`Failed to delete: ${relativePath}`));
      }
    }
  }

  // Final summary
  const duration = Date.now() - startTime;
  console.log(chalk.green(`\n✅ Cleanup completed in ${duration}ms`));
  console.log(chalk.gray(`   • ${deletedCount} items deleted`));
  console.log(chalk.gray(`   • ${formatBytes(freedSpace)} freed`));

  if (errorCount > 0) {
    console.log(chalk.yellow(`   • ${errorCount} errors encountered`));
  }

  console.log();
}

export default purge;
