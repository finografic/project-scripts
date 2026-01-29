#!/usr/bin/env node
import chalk from 'chalk';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { setTimeout } from 'node:timers';
import ora from 'ora';

// #region src/purge-builds/src/purge-builds/purge.ts
const DELETE_PATTERNS = {
  directories: [
    '.turbo',
    '.tsup',
    'dist',
    'node_modules',
    '.pnpm',
  ],
  files: ['pnpm-lock.yaml'],
  fileExtensions: ['.tsbuildinfo'],
};
/**
 * Schedule deferred deletion using process detachment techniques
 */
async function scheduleDeferredDeletion(itemPath, _relativePath) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', `timeout /t 2 /nobreak && rmdir /s /q "${itemPath}"`], {
        detached: true,
        stdio: 'ignore',
        shell: true,
      }).unref();
    } else {spawn('sh', [
        '-c',
        `sleep 2 && rm -rf "${itemPath}" && find "$(dirname "${itemPath}")" -name "node_modules" -type d -empty -delete 2>/dev/null || true`,
      ], {
        detached: true,
        stdio: 'ignore',
      }).unref();}
    return true;
  } catch {
    return false;
  }
}
/**
 * Alternative approach: Copy process to temp location and execute from there
 */
async function executeFromMemory(originalPath) {
  try {
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'purge-builds-'));
    const tempScript = path.join(tempDir, 'purge-builds-detached.js');
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
    spawn(process.execPath, [tempScript], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    try {
      await fs.access(originalPath);
    } catch {
      return true;
    }
    const spinner = ora('Waiting for node_modules deletion...').start();
    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        await fs.access(originalPath);
      } catch {
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
function getCurrentExecutionPath() {
  const scriptPath = process.argv[1];
  return path.resolve(scriptPath);
}
/**
 * Check if a path is part of our current execution environment
 */
function isPartOfCurrentExecution(itemPath) {
  const currentScript = getCurrentExecutionPath();
  if (currentScript.includes('node_modules/@finografic/project-scripts')) {
    return itemPath.includes('node_modules/@finografic/project-scripts');
  }
  if (currentScript.includes('packages/purge-builds')) {
    return itemPath.includes('packages/purge-builds/dist');
  }
  return false;
}
/**
 * Check if we should defer deletion of node_modules
 */
function shouldDeferNodeModules(itemPath) {
  const currentScript = getCurrentExecutionPath();
  const workingDir = process.cwd();
  return itemPath === path.join(workingDir, 'node_modules')
    && currentScript.includes('node_modules');
}
/**
 * Check if a path should be deleted based on patterns
 */
function shouldDelete(itemPath, itemName, isDirectory) {
  if (isPartOfCurrentExecution(itemPath)) return false;
  if (
    [
      '.git',
      '.env',
      'package.json',
      'src',
    ].includes(itemName)
  ) return false;
  const pathParts = itemPath.split(path.sep);
  if (
    [
      'apps',
      'packages',
      'config',
      'scripts',
    ].includes(itemName) && pathParts.length <= 2
  ) return false;
  if (isDirectory && DELETE_PATTERNS.directories.includes(itemName)) return true;
  if (!isDirectory) {
    if (DELETE_PATTERNS.files.includes(itemName)) return true;
    if (DELETE_PATTERNS.fileExtensions.some((ext) => itemName.endsWith(ext))) return true;
  }
  return false;
}
/**
 * Get directory size recursively
 */
async function getDirectorySize(dirPath) {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    let totalSize = 0;
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      if (item.isDirectory()) totalSize += await getDirectorySize(itemPath);
      else if (item.isFile()) {
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
async function findItemsToDelete(dirPath, recursive = false, results = [], currentDepth = 0) {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      const isDirectory = item.isDirectory();
      if (shouldDelete(itemPath, item.name, isDirectory)) {
        const size = isDirectory
          ? await getDirectorySize(itemPath)
          : (await fs.stat(itemPath)).size;
        results.push({
          path: itemPath,
          type: isDirectory ? 'directory' : 'file',
          size,
        });
        continue;
      }
      if (isDirectory && (recursive || currentDepth === 0)) {
        await findItemsToDelete(itemPath, recursive, results, currentDepth + 1);
      }
    }
  } catch {}
  return results;
}
/**
 * Delete a single item (file or directory)
 */
async function deleteItem(itemPath, isDirectory) {
  try {
    if (isDirectory) {
      await fs.rm(itemPath, {
        recursive: true,
        force: true,
      });
    } else await fs.unlink(itemPath);
    return true;
  } catch {
    return false;
  }
}
/**
 * Clean up empty parent directories after deletion
 */
async function cleanupEmptyDirectories(workingDir) {
  try {
    const emptyDirs = await findEmptyNodeModulesDirectories(workingDir);
    for (const dir of emptyDirs) {
      try {
        await fs.rmdir(dir);
      } catch {}
    }
  } catch {}
}
/**
 * Find empty node_modules directories
 */
async function findEmptyNodeModulesDirectories(dirPath) {
  const emptyDirs = [];
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        const itemPath = path.join(dirPath, item.name);
        if (item.name === 'node_modules') {
          try {
            if ((await fs.readdir(itemPath)).length === 0) emptyDirs.push(itemPath);
          } catch {}
        } else {
          const subEmptyDirs = await findEmptyNodeModulesDirectories(itemPath);
          emptyDirs.push(...subEmptyDirs);
        }
      }
    }
  } catch {}
  return emptyDirs;
}
/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = [
    'B',
    'KB',
    'MB',
    'GB',
  ];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
/**
 * Main purge function - V2 approach
 */
async function purge(
  { dryRun = false, verbose = false, recursive = false, forceDetach = false } = {},
) {
  const startTime = Date.now();
  const workingDir = process.cwd();
  if (dryRun) {
    console.log(chalk.green('🔒 DRY RUN MODE - NO FILES WILL BE DELETED\n'));
    console.log(
      chalk.yellow('⚠️  This is a simulation only. Remove --dry-run to actually delete files.\n'),
    );
  }
  console.log(chalk.gray(`Working Directory: ${workingDir}`));
  console.log(chalk.gray(`Mode: ${recursive ? 'Recursive (deep)' : 'Current level only'}`));
  console.log(
    chalk.gray(`Operation: ${dryRun ? 'DRY RUN (simulation)' : 'LIVE (actual deletion)'}`),
  );
  const currentScript = getCurrentExecutionPath();
  console.log(chalk.gray(`Self-preservation: ${currentScript}\n`));
  const scanSpinner = ora('Scanning for build artifacts...').start();
  const itemsToDelete = await findItemsToDelete(workingDir, recursive);
  if (itemsToDelete.length === 0) {
    scanSpinner.succeed('No build artifacts found to clean!');
    return;
  }
  const totalSize = itemsToDelete.reduce((sum, item) => sum + item.size, 0);
  const dirCount = itemsToDelete.filter((item) => item.type === 'directory').length;
  const fileCount = itemsToDelete.filter((item) => item.type === 'file').length;
  scanSpinner.succeed(`Found ${itemsToDelete.length} items to clean`);
  console.log(chalk.gray(`   • ${dirCount} directories`));
  console.log(chalk.gray(`   • ${fileCount} files`));
  console.log(chalk.gray(`   • ${formatBytes(totalSize)} total size\n`));
  if (verbose || dryRun) {
    console.log(chalk.white('📝 Items to be processed:\n'));
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
  const immediateItems = itemsToDelete.filter((item) => !shouldDeferNodeModules(item.path));
  const deferredItems = itemsToDelete.filter((item) => shouldDeferNodeModules(item.path));
  const deleteSpinner = ora('Deleting items...').start();
  let deletedCount = 0;
  let freedSpace = 0;
  let errorCount = 0;
  for (const item of immediateItems) {
    const relativePath = path.relative(workingDir, item.path);
    deleteSpinner.text = `Deleting: ${relativePath}`;
    if (await deleteItem(item.path, item.type === 'directory')) {
      deletedCount++;
      freedSpace += item.size;
    } else {
      errorCount++;
      if (verbose) console.log(chalk.red(`\nFailed to delete: ${relativePath}`));
    }
  }
  deleteSpinner.succeed(`Deleted ${deletedCount} items`);
  if (deferredItems.length > 0) {
    console.log(chalk.cyan('\n🔄 Handling deferred deletions...\n'));
    for (const item of deferredItems) {
      const relativePath = path.relative(workingDir, item.path);
      let deleted = false;
      if (forceDetach) {
        console.log(chalk.cyan(`🧠 Attempting memory detachment for ${relativePath}...`));
        deleted = await executeFromMemory(item.path);
        if (deleted) {
          console.log(
            chalk.green(`⏰ Memory-detached: ${relativePath} will be deleted after process exits`),
          );
        } else {
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
        deleted = await scheduleDeferredDeletion(item.path, relativePath);
        if (deleted) {
          console.log(
            chalk.green(`⏰ Scheduled: ${relativePath} will be deleted after process exits`),
          );
        }
      }
      if (!deleted) {
        console.log(chalk.yellow(`⏸️  Deferred: ${relativePath} (automatic deletion failed)`));
        console.log(
          chalk.gray(`   Run after this completes: rm -rf ${relativePath} && pnpm install`),
        );
        console.log(chalk.gray('   Or try: pnpm clean --detach for automatic deletion'));
      }
    }
  }
  const cleanupSpinner = ora('Cleaning up empty directories...').start();
  await cleanupEmptyDirectories(workingDir);
  cleanupSpinner.succeed('Cleaned up empty directories');
  const duration = Date.now() - startTime;
  console.log(chalk.green(`\n✅ Cleanup completed in ${duration}ms`));
  const deferredSize = deferredItems.reduce((sum, item) => sum + item.size, 0);
  const totalDeleted = deletedCount + deferredItems.length;
  const totalFreed = freedSpace + deferredSize;
  console.log(chalk.gray(`   • ${totalDeleted} items deleted`));
  console.log(chalk.gray(`   • ${formatBytes(totalFreed)} freed`));
  if (errorCount > 0) console.log(chalk.yellow(`   • ${errorCount} errors encountered`));
  console.log();
}

// #endregion
// #region src/purge-builds/src/purge-builds/index.ts
function showHelp() {
  console.log(`
purge-builds - Clean build artifacts and dependencies from monorepo

USAGE:
  purge-builds [OPTIONS]

OPTIONS:
  -d, --dry-run       Show what would be deleted without actually deleting
  -v, --verbose       Show detailed progress and file lists
  -r, --recursive     Deep recursive cleaning throughout the entire tree
  --detach            Force detached process deletion for node_modules
  -h, --help          Show this help message

EXAMPLES:
  purge-builds                    # Clean current directory level only
  purge-builds --dry-run          # Preview what would be deleted
  purge-builds -dv                # Dry run with verbose output
  purge-builds --recursive        # Deep clean entire monorepo tree
  purge-builds --recursive --detach  # Force detached node_modules deletion

WHAT IT DELETES:
  • Build directories (.turbo, .tsup, dist, node_modules, .pnpm)
  • Build files (*.tsbuildinfo, pnpm-lock.yaml)

WHAT IT PROTECTS:
  • Source code (src/, apps/, packages/)
  • Configuration files (package.json, .env)
  • Git repository (.git/)
  • This CLI tool itself

FEATURES:
  • Native Node.js APIs (no glob dependencies)
  • Better recursive directory walking
  • Accurate size reporting
  • Clearer dry-run output
  • More reliable deletion
`);
}
async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      process.exit(0);
    }
    await purge({
      dryRun: args.includes('--dry-run') || args.includes('-d'),
      verbose: args.includes('--verbose') || args.includes('-v'),
      recursive: args.includes('--recursive') || args.includes('-r'),
      forceDetach: args.includes('--detach'),
    });
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();

// #endregion
export {};
