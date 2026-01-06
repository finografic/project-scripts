#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers';

import chalk from 'chalk';
import ora from 'ora';

export interface PurgeOptions {
  dryRun?: boolean;
  verbose?: boolean;
  recursive?: boolean;
  forceDetach?: boolean; // Force use of detached process for node_modules deletion
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
 * Schedule deferred deletion using process detachment techniques
 */
async function scheduleDeferredDeletion(
  itemPath: string,
  _relativePath: string,
): Promise<boolean> {
  try {
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: Use timeout to delay execution
      spawn(
        'cmd',
        ['/c', `timeout /t 2 /nobreak && rmdir /s /q "${itemPath}"`],
        {
          detached: true,
          stdio: 'ignore',
          shell: true,
        },
      ).unref();
    } else {
      // Unix/macOS: Use sleep to delay execution with force
      spawn(
        'sh',
        [
          '-c',
          `sleep 2 && rm -rf "${itemPath}" && find "$(dirname "${itemPath}")" -name "node_modules" -type d -empty -delete 2>/dev/null || true`,
        ],
        {
          detached: true,
          stdio: 'ignore',
        },
      ).unref();
    }

    return true;
  } catch {
    // If process detachment fails, fall back to manual instructions
    return false;
  }
}

/**
 * Alternative approach: Copy process to temp location and execute from there
 */
async function executeFromMemory(originalPath: string): Promise<boolean> {
  try {
    // Create a temporary copy of the current script
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'purge-builds-'));
    const tempScript = path.join(tempDir, 'purge-builds-detached.js');

    // Create a minimal detached script that can delete the original node_modules
    const detachedScript = `
// Detached purge script
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

async function cleanupNodeModules() {
  try {
    console.log('🔄 Detached process cleaning up node_modules...');

    // Try multiple approaches for stubborn directories
    try {
      await fs.rm('${originalPath}', { recursive: true, force: true });
      console.log('✅ Successfully deleted node_modules (fs.rm)');
    } catch (error) {
      console.log('⚠️ fs.rm failed, trying shell command...');

      // Fallback to shell command for stubborn files like .pnpm
      return new Promise((resolve) => {
        const cmd = process.platform === 'win32'
          ? 'rmdir /s /q "${originalPath}"'
          : 'rm -rf "${originalPath}" && find "$(dirname "${originalPath}")" -name "node_modules" -type d -empty -delete 2>/dev/null || true';

        const shell = process.platform === 'win32' ? 'cmd' : 'sh';
        const args = process.platform === 'win32' ? ['/c', cmd] : ['-c', cmd];

        const proc = spawn(shell, args, { stdio: 'pipe' });
        proc.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Successfully deleted node_modules (shell command)');
          } else {
            console.log('⚠️ Shell command completed with code:', code);
          }
          resolve();
        });
      });
    }

    // Clean up temp files
    await fs.rm('${tempDir}', { recursive: true, force: true });
  } catch (error) {
    console.error('❌ Failed to delete node_modules:', error.message);
  }
}

// Wait a bit for parent process to exit, then cleanup
setTimeout(cleanupNodeModules, 1000);
`;

    await fs.writeFile(tempScript, detachedScript);

    // Execute the detached script
    spawn(process.execPath, [tempScript], {
      detached: true,
      stdio: 'ignore',
    }).unref();

    // Check if node_modules exists before waiting
    try {
      await fs.access(originalPath);
    } catch {
      // If node_modules doesn't exist, no need to wait
      return true;
    }

    // Wait for completion
    const spinner = ora('Waiting for node_modules deletion...').start();
    let attempts = 0;
    const maxAttempts = 10; // 5 seconds total (500ms * 10)

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        await fs.access(originalPath);
        // Still exists
      } catch {
        // node_modules is gone
        spinner.succeed('Successfully deleted node_modules');
        return true;
      }

      attempts++;
      spinner.text = `Waiting for node_modules deletion... (${attempts}/${maxAttempts})`;
    }

    spinner.warn('Deletion process started but completion unconfirmed');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the directory where this CLI is currently running from
 */
function getCurrentExecutionPath(): string {
  // Get the actual file path of this running script
  const scriptPath = process.argv[1];
  return path.resolve(scriptPath);
}

/**
 * Check if a path is part of our current execution environment
 */
function isPartOfCurrentExecution(itemPath: string): boolean {
  const currentScript = getCurrentExecutionPath();

  // If we're running from node_modules, protect only our specific package
  if (currentScript.includes('node_modules/@finografic/project-scripts')) {
    return itemPath.includes('node_modules/@finografic/project-scripts');
  }

  // If we're running from a local package, protect that specific path
  if (currentScript.includes('packages/purge-builds')) {
    return itemPath.includes('packages/purge-builds/dist');
  }

  return false;
}

/**
 * Check if we should defer deletion of node_modules
 */
function shouldDeferNodeModules(itemPath: string): boolean {
  const currentScript = getCurrentExecutionPath();
  const workingDir = process.cwd();

  // If this is the main node_modules and we're running from within it
  return (
    itemPath === path.join(workingDir, 'node_modules') &&
    currentScript.includes('node_modules')
  );
}

/**
 * Check if a path should be deleted based on patterns
 */
function shouldDelete(
  itemPath: string,
  itemName: string,
  isDirectory: boolean,
): boolean {
  // Never delete ourselves (self-preservation)
  if (isPartOfCurrentExecution(itemPath)) {
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
  const isTopLevelStructural =
    topLevelStructural.includes(itemName) && pathParts.length <= 2;

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
        const size = isDirectory
          ? await getDirectorySize(itemPath)
          : (await fs.stat(itemPath)).size;

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
async function deleteItem(
  itemPath: string,
  isDirectory: boolean,
): Promise<boolean> {
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
 * Clean up empty parent directories after deletion
 */
async function cleanupEmptyDirectories(workingDir: string): Promise<void> {
  try {
    // Find and remove empty node_modules directories
    const emptyDirs = await findEmptyNodeModulesDirectories(workingDir);
    for (const dir of emptyDirs) {
      try {
        await fs.rmdir(dir);
      } catch {
        // Ignore errors for directories that aren't actually empty
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Find empty node_modules directories
 */
async function findEmptyNodeModulesDirectories(
  dirPath: string,
): Promise<string[]> {
  const emptyDirs: string[] = [];

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        const itemPath = path.join(dirPath, item.name);

        if (item.name === 'node_modules') {
          // Check if this node_modules directory is empty
          try {
            const contents = await fs.readdir(itemPath);
            if (contents.length === 0) {
              emptyDirs.push(itemPath);
            }
          } catch {
            // Ignore access errors
          }
        } else {
          // Recurse into subdirectories
          const subEmptyDirs = await findEmptyNodeModulesDirectories(itemPath);
          emptyDirs.push(...subEmptyDirs);
        }
      }
    }
  } catch {
    // Ignore access errors
  }

  return emptyDirs;
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
export async function purge({
  dryRun = false,
  verbose = false,
  recursive = false,
  forceDetach = false,
}: PurgeOptions = {}) {
  const startTime = Date.now();
  const workingDir = process.cwd();

  // Safety check
  if (dryRun) {
    console.log(chalk.green('🔒 DRY RUN MODE - NO FILES WILL BE DELETED\n'));
    console.log(
      chalk.yellow(
        '⚠️  This is a simulation only. Remove --dry-run to actually delete files.\n',
      ),
    );
  }

  console.log(chalk.gray(`Working Directory: ${workingDir}`));
  console.log(
    chalk.gray(`Mode: ${recursive ? 'Recursive (deep)' : 'Current level only'}`),
  );
  console.log(
    chalk.gray(
      `Operation: ${dryRun ? 'DRY RUN (simulation)' : 'LIVE (actual deletion)'}`,
    ),
  );

  // Show self-preservation info
  const currentScript = getCurrentExecutionPath();
  console.log(chalk.gray(`Self-preservation: ${currentScript}\n`));

  // Find all items to delete
  const scanSpinner = ora('Scanning for build artifacts...').start();
  const itemsToDelete = await findItemsToDelete(workingDir, recursive);

  if (itemsToDelete.length === 0) {
    scanSpinner.succeed('No build artifacts found to clean!');
    return;
  }

  // Calculate totals
  const totalSize = itemsToDelete.reduce((sum, item) => sum + item.size, 0);
  const dirCount = itemsToDelete.filter(
    (item) => item.type === 'directory',
  ).length;
  const fileCount = itemsToDelete.filter((item) => item.type === 'file').length;

  // Show what will be deleted
  scanSpinner.succeed(`Found ${itemsToDelete.length} items to clean`);
  console.log(chalk.gray(`   • ${dirCount} directories`));
  console.log(chalk.gray(`   • ${fileCount} files`));
  console.log(chalk.gray(`   • ${formatBytes(totalSize)} total size\n`));

  if (verbose || dryRun) {
    console.log(chalk.white('📝 Items to be processed:\n'));

    // Group by type for better display
    const directories = itemsToDelete.filter(
      (item) => item.type === 'directory',
    );
    const files = itemsToDelete.filter((item) => item.type === 'file');

    if (directories.length > 0) {
      console.log(chalk.cyan('📁 Directories:'));
      directories.forEach((item) => {
        const relativePath = path.relative(workingDir, item.path);
        console.log(
          chalk.gray(`   ${relativePath} (${formatBytes(item.size)})`),
        );
      });
      console.log();
    }

    if (files.length > 0) {
      console.log(chalk.cyan('📄 Files:'));
      files.forEach((item) => {
        const relativePath = path.relative(workingDir, item.path);
        console.log(
          chalk.gray(`   ${relativePath} (${formatBytes(item.size)})`),
        );
      });
      console.log();
    }
  }

  if (dryRun) {
    console.log(chalk.yellow('🔒 DRY RUN: No files were actually deleted.'));
    console.log(
      chalk.gray(`Would have freed ${formatBytes(totalSize)} of space.`),
    );
    return;
  }

  // Separate items into immediate and deferred deletions
  const immediateItems = itemsToDelete.filter(
    (item) => !shouldDeferNodeModules(item.path),
  );
  const deferredItems = itemsToDelete.filter((item) =>
    shouldDeferNodeModules(item.path),
  );

  // Actually delete immediate items
  const deleteSpinner = ora('Deleting items...').start();
  let deletedCount = 0;
  let freedSpace = 0;
  let errorCount = 0;

  for (const item of immediateItems) {
    const relativePath = path.relative(workingDir, item.path);
    deleteSpinner.text = `Deleting: ${relativePath}`;

    const success = await deleteItem(item.path, item.type === 'directory');

    if (success) {
      deletedCount++;
      freedSpace += item.size;
    } else {
      errorCount++;
      if (verbose) {
        console.log(chalk.red(`\nFailed to delete: ${relativePath}`));
      }
    }
  }

  deleteSpinner.succeed(`Deleted ${deletedCount} items`);

  // Handle deferred deletions (node_modules that we can't delete while running from them)
  if (deferredItems.length > 0) {
    console.log(chalk.cyan('\n🔄 Handling deferred deletions...\n'));

    for (const item of deferredItems) {
      const relativePath = path.relative(workingDir, item.path);
      let deleted = false;

      // Try different approaches based on flags and platform
      if (forceDetach) {
        // Try the memory-copy approach first when forced
        console.log(
          chalk.cyan(`🧠 Attempting memory detachment for ${relativePath}...`),
        );
        deleted = await executeFromMemory(item.path);

        if (deleted) {
          console.log(
            chalk.green(
              `⏰ Memory-detached: ${relativePath} will be deleted after process exits`,
            ),
          );
        } else {
          // Fallback to timer approach
          console.log(chalk.cyan('⏰ Falling back to timer approach...'));
          deleted = await scheduleDeferredDeletion(item.path, relativePath);

          if (deleted) {
            console.log(
              chalk.green(
                `⏰ Timer-scheduled: ${relativePath} will be deleted after process exits`,
              ),
            );
          }
        }
      } else {
        // Try timer approach first (simpler)
        deleted = await scheduleDeferredDeletion(item.path, relativePath);

        if (deleted) {
          console.log(
            chalk.green(
              `⏰ Scheduled: ${relativePath} will be deleted after process exits`,
            ),
          );
        }
      }

      if (!deleted) {
        // Fallback to manual instructions
        console.log(
          chalk.yellow(
            `⏸️  Deferred: ${relativePath} (automatic deletion failed)`,
          ),
        );
        console.log(
          chalk.gray(
            `   Run after this completes: rm -rf ${relativePath} && pnpm install`,
          ),
        );
        console.log(
          chalk.gray('   Or try: pnpm clean --detach for automatic deletion'),
        );
      }
    }
  }

  // Clean up any empty directories left behind
  const cleanupSpinner = ora('Cleaning up empty directories...').start();
  await cleanupEmptyDirectories(workingDir);
  cleanupSpinner.succeed('Cleaned up empty directories');

  // Final summary
  const duration = Date.now() - startTime;
  console.log(chalk.green(`\n✅ Cleanup completed in ${duration}ms`));

  // Add deferred items to totals since we're actively deleting them
  const deferredSize = deferredItems.reduce((sum, item) => sum + item.size, 0);
  const totalDeleted = deletedCount + deferredItems.length;
  const totalFreed = freedSpace + deferredSize;

  console.log(chalk.gray(`   • ${totalDeleted} items deleted`));
  console.log(chalk.gray(`   • ${formatBytes(totalFreed)} freed`));

  if (errorCount > 0) {
    console.log(chalk.yellow(`   • ${errorCount} errors encountered`));
  }

  console.log();
}

export default purge;
