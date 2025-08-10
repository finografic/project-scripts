#!/usr/bin/env node

// src/purge-builds/purge.ts
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
var DELETE_PATTERNS = {
  directories: [".turbo", ".tsup", "dist", "node_modules", ".pnpm"],
  files: ["pnpm-lock.yaml"],
  fileExtensions: [".tsbuildinfo"]
  // catches tsconfig.tsbuildinfo and any other *.tsbuildinfo files
};
function shouldDelete(itemPath, itemName, isDirectory) {
  if (itemPath.includes("packages/purge-builds/dist")) {
    return false;
  }
  const alwaysProtect = [".git", ".env", "package.json", "src"];
  if (alwaysProtect.includes(itemName)) {
    return false;
  }
  const pathParts = itemPath.split(path.sep);
  const topLevelStructural = ["apps", "packages", "config", "scripts"];
  const isTopLevelStructural = topLevelStructural.includes(itemName) && pathParts.length <= 2;
  if (isTopLevelStructural) {
    return false;
  }
  if (isDirectory && DELETE_PATTERNS.directories.includes(itemName)) {
    return true;
  }
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
async function getDirectorySize(dirPath) {
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
async function findItemsToDelete(dirPath, recursive = false, results = [], currentDepth = 0) {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      const isDirectory = item.isDirectory();
      if (shouldDelete(itemPath, item.name, isDirectory)) {
        const size = isDirectory ? await getDirectorySize(itemPath) : (await fs.stat(itemPath)).size;
        results.push({
          path: itemPath,
          type: isDirectory ? "directory" : "file",
          size
        });
        continue;
      }
      if (isDirectory && (recursive || currentDepth === 0)) {
        await findItemsToDelete(itemPath, recursive, results, currentDepth + 1);
      }
    }
  } catch {
  }
  return results;
}
async function deleteItem(itemPath, isDirectory) {
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
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
async function purge({ dryRun = false, verbose = false, recursive = false } = {}) {
  const startTime = Date.now();
  const workingDir = process.cwd();
  if (dryRun) {
    console.log(chalk.green("\u{1F512} DRY RUN MODE - NO FILES WILL BE DELETED\n"));
    console.log(chalk.yellow("\u26A0\uFE0F  This is a simulation only. Remove --dry-run to actually delete files.\n"));
  }
  console.log(chalk.white("\u{1F4C1} Scanning for build artifacts...\n"));
  console.log(chalk.gray(`Working Directory: ${workingDir}`));
  console.log(chalk.gray(`Mode: ${recursive ? "Recursive (deep)" : "Current level only"}`));
  console.log(chalk.gray(`Operation: ${dryRun ? "DRY RUN (simulation)" : "LIVE (actual deletion)"}
`));
  const itemsToDelete = await findItemsToDelete(workingDir, recursive);
  if (itemsToDelete.length === 0) {
    console.log(chalk.green("\u2728 No build artifacts found to clean!"));
    return;
  }
  const totalSize = itemsToDelete.reduce((sum, item) => sum + item.size, 0);
  const dirCount = itemsToDelete.filter((item) => item.type === "directory").length;
  const fileCount = itemsToDelete.filter((item) => item.type === "file").length;
  console.log(chalk.white(`\u{1F4CB} Found ${itemsToDelete.length} items to clean:`));
  console.log(chalk.gray(`   \u2022 ${dirCount} directories`));
  console.log(chalk.gray(`   \u2022 ${fileCount} files`));
  console.log(chalk.gray(`   \u2022 ${formatBytes(totalSize)} total size
`));
  if (verbose || dryRun) {
    console.log(chalk.white("\u{1F4DD} Items to be processed:\n"));
    const directories = itemsToDelete.filter((item) => item.type === "directory");
    const files = itemsToDelete.filter((item) => item.type === "file");
    if (directories.length > 0) {
      console.log(chalk.cyan("\u{1F4C1} Directories:"));
      directories.forEach((item) => {
        const relativePath = path.relative(workingDir, item.path);
        console.log(chalk.gray(`   ${relativePath} (${formatBytes(item.size)})`));
      });
      console.log();
    }
    if (files.length > 0) {
      console.log(chalk.cyan("\u{1F4C4} Files:"));
      files.forEach((item) => {
        const relativePath = path.relative(workingDir, item.path);
        console.log(chalk.gray(`   ${relativePath} (${formatBytes(item.size)})`));
      });
      console.log();
    }
  }
  if (dryRun) {
    console.log(chalk.yellow("\u{1F512} DRY RUN: No files were actually deleted."));
    console.log(chalk.gray(`Would have freed ${formatBytes(totalSize)} of space.`));
    return;
  }
  console.log(chalk.magenta("\u{1F5D1}\uFE0F  Deleting items...\n"));
  let deletedCount = 0;
  let freedSpace = 0;
  let errorCount = 0;
  for (const item of itemsToDelete) {
    const relativePath = path.relative(workingDir, item.path);
    if (verbose) {
      process.stdout.write(chalk.gray(`Deleting: ${relativePath}...`));
    }
    const success = await deleteItem(item.path, item.type === "directory");
    if (success) {
      deletedCount++;
      freedSpace += item.size;
      if (verbose) {
        console.log(chalk.green(" \u2713"));
      }
    } else {
      errorCount++;
      if (verbose) {
        console.log(chalk.red(" \u2717"));
      } else {
        console.log(chalk.red(`Failed to delete: ${relativePath}`));
      }
    }
  }
  const duration = Date.now() - startTime;
  console.log(chalk.green(`
\u2705 Cleanup completed in ${duration}ms`));
  console.log(chalk.gray(`   \u2022 ${deletedCount} items deleted`));
  console.log(chalk.gray(`   \u2022 ${formatBytes(freedSpace)} freed`));
  if (errorCount > 0) {
    console.log(chalk.yellow(`   \u2022 ${errorCount} errors encountered`));
  }
  console.log();
}

// src/purge-builds/index.ts
function showHelp() {
  console.log(`
purge-builds - Clean build artifacts and dependencies from monorepo

USAGE:
  purge-builds [OPTIONS]

OPTIONS:
  -d, --dry-run     Show what would be deleted without actually deleting
  -v, --verbose     Show detailed progress and file lists
  -r, --recursive   Deep recursive cleaning throughout the entire tree
  -h, --help        Show this help message

EXAMPLES:
  purge-builds                    # Clean current directory level only
  purge-builds --dry-run          # Preview what would be deleted
  purge-builds -dv                # Dry run with verbose output
  purge-builds --recursive        # Deep clean entire monorepo tree

WHAT IT DELETES:
  \u2022 Build directories (.turbo, .tsup, dist, node_modules, .pnpm)
  \u2022 Build files (*.tsbuildinfo, pnpm-lock.yaml)

WHAT IT PROTECTS:
  \u2022 Source code (src/, apps/, packages/)
  \u2022 Configuration files (package.json, .env)
  \u2022 Git repository (.git/)
  \u2022 This CLI tool itself

FEATURES:
  \u2022 Native Node.js APIs (no glob dependencies)
  \u2022 Better recursive directory walking
  \u2022 Accurate size reporting
  \u2022 Clearer dry-run output
  \u2022 More reliable deletion
`);
}
async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.includes("--help") || args.includes("-h")) {
      showHelp();
      process.exit(0);
    }
    await purge({
      dryRun: args.includes("--dry-run") || args.includes("-d"),
      verbose: args.includes("--verbose") || args.includes("-v"),
      recursive: args.includes("--recursive") || args.includes("-r")
    });
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
