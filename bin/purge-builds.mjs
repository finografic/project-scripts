#!/usr/bin/env node
import { t as isCliEntry } from "./is-cli-entry.mjs";
import { t as pc } from "./picocolors.mjs";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import fs$1 from "node:fs/promises";
import { tmpdir } from "node:os";
import { setTimeout } from "node:timers";
import ora from "ora";
import { execa } from "execa";
import { parse, stringify } from "yaml";
//#region src/purge-builds/src/purge-builds/heal-lockfile.ts
const VIOLATION_MARKER = "ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION";
const VIOLATION_LINE = /^\s+(.+)@([^@\s]+) was published at (\S+), within the minimumReleaseAge cutoff \(([^)]+)\)/;
/** Parses pnpm's ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION output into structured violations. */
function parseReleaseAgeViolations(output) {
	const violations = [];
	for (const line of output.split("\n")) {
		const match = VIOLATION_LINE.exec(line);
		if (match) {
			const [, name, version, publishedAt, cutoff] = match;
			violations.push({
				name,
				version,
				publishedAt,
				cutoff
			});
		}
	}
	return violations;
}
/**
* Finds the newest version of `pkgName` published strictly before `cutoffIso`,
* by reading the registry's per-version publish-time map. Returns null if the
* package can't be resolved (private/scoped package on a registry this
* doesn't know how to reach, network failure, etc.) — callers should treat
* that as "can't heal automatically".
*/
async function findCompliantVersion(pkgName, cutoffIso) {
	try {
		const res = await fetch(`https://registry.npmjs.org/${pkgName}`);
		if (!res.ok) return null;
		const data = await res.json();
		const cutoff = new Date(cutoffIso).getTime();
		let best = null;
		for (const [version, iso] of Object.entries(data.time ?? {})) {
			if (version === "created" || version === "modified") continue;
			const time = new Date(iso).getTime();
			if (time < cutoff && (!best || time > best.time)) best = {
				version,
				time
			};
		}
		return best?.version ?? null;
	} catch {
		return null;
	}
}
async function runPnpmInstall(cwd) {
	return execa("pnpm", ["install"], {
		cwd,
		reject: false,
		all: true
	});
}
/**
* Self-heals pnpm 11's `minimumReleaseAge` supply-chain policy rejections.
*
* A fresh resolve (no existing lockfile) already respects this policy on its
* own — it just excludes too-recent candidates when picking "latest
* satisfying range". The failure mode this fixes is a lockfile that's
* already pinned to a version published before the policy caught up to it:
* pnpm's own docs call this a "stale" lockfile. Plain `pnpm install` reuses
* that pin without re-resolving (fails immediately on the stale entry), and
* `pnpm update <pkg>` only reaches *direct* dependencies — not the
* transitive ones this usually hits (e.g. electron-to-chromium via
* browserslist, jose via an auth package) — so there's no way to just
* "install past it" without an explicit re-pin.
*
* The fix: pin the violating package(s) to the newest version that predates
* the policy cutoff via a temporary `overrides` + `minimumReleaseAge: 0` in
* pnpm-workspace.yaml (NOT package.json's "pnpm" field — pnpm stopped
* reading that field entirely, even in 10.x; it silently ignores it), force
* re-resolution, then revert pnpm-workspace.yaml to its original content and
* verify the lockfile now passes with the policy fully active again. The
* lockfile is left holding the compliant pins; pnpm-workspace.yaml doesn't
* change permanently.
*
* No-ops (returns without touching anything) when there's no
* pnpm-workspace.yaml (this is inherently a workspace-scoped policy; a
* single-package repo without one is left to the caller's own `pnpm
* install`), when `pnpm install` isn't available, or when a first install
* just succeeds. Rethrows for any install failure that ISN'T this specific
* violation — this is not a general-purpose "swallow install errors" tool.
*/
async function healMinimumReleaseAgeViolations(workingDir) {
	const workspaceYamlPath = path.join(workingDir, "pnpm-workspace.yaml");
	let originalRaw;
	try {
		originalRaw = await fs$1.readFile(workspaceYamlPath, "utf8");
	} catch {
		return;
	}
	const first = await runPnpmInstall(workingDir);
	if (first.exitCode === 0) return;
	const output = `${first.all ?? ""}\n${first.stderr ?? ""}`;
	if (!output.includes(VIOLATION_MARKER)) {
		console.error(pc.red("\n✗ pnpm install failed (not a minimumReleaseAge violation — not auto-healing):"));
		console.error(output);
		throw new Error("pnpm install failed");
	}
	const violations = parseReleaseAgeViolations(output);
	if (violations.length === 0) {
		console.error(output);
		throw new Error(`Detected ${VIOLATION_MARKER} but could not parse the violating package(s) from its output`);
	}
	console.log(pc.yellow(`\n⚠️  pnpm's minimumReleaseAge policy rejected ${violations.length} package(s) published too recently — auto-healing:`));
	const fixes = {};
	for (const violation of violations) {
		const compliant = await findCompliantVersion(violation.name, violation.cutoff);
		if (!compliant) {
			console.error(pc.red(`   ✗ ${violation.name}@${violation.version}: no older compliant version found on the registry`));
			throw new Error(`Could not find a minimumReleaseAge-compliant version for ${violation.name}`);
		}
		fixes[violation.name] = compliant;
		console.log(pc.gray(`   • ${violation.name}: ${violation.version} → ${compliant}`));
	}
	const restoreSync = () => {
		try {
			fs.writeFileSync(workspaceYamlPath, originalRaw);
		} catch {}
	};
	const onSignal = () => {
		restoreSync();
		process.exit(130);
	};
	process.once("SIGINT", onSignal);
	process.once("SIGTERM", onSignal);
	try {
		const workspace = parse(originalRaw) ?? {};
		workspace.overrides = {
			...workspace.overrides ?? {},
			...fixes
		};
		workspace.minimumReleaseAge = 0;
		await fs$1.writeFile(workspaceYamlPath, stringify(workspace));
		const heal = await runPnpmInstall(workingDir);
		if (heal.exitCode !== 0) {
			console.error(pc.red("\n✗ Re-resolution with pinned versions still failed:"));
			console.error(`${heal.all ?? ""}\n${heal.stderr ?? ""}`);
			throw new Error("Failed to heal minimumReleaseAge lockfile violation");
		}
	} finally {
		await fs$1.writeFile(workspaceYamlPath, originalRaw);
		process.removeListener("SIGINT", onSignal);
		process.removeListener("SIGTERM", onSignal);
	}
	const verify = await runPnpmInstall(workingDir);
	if (verify.exitCode !== 0) {
		console.error(pc.red("\n✗ pnpm install failed after reverting the temporary override:"));
		console.error(`${verify.all ?? ""}\n${verify.stderr ?? ""}`);
		throw new Error("Lockfile healed but install failed once the policy bypass was reverted");
	}
	console.log(pc.green(`✅ Healed ${violations.length} minimumReleaseAge violation(s) — lockfile now passes with the policy active.\n`));
}
//#endregion
//#region src/purge-builds/src/purge-builds/purge.ts
const DELETE_PATTERNS = {
	directories: [
		".turbo",
		".tsup",
		"dist",
		"node_modules",
		".pnpm"
	],
	files: ["pnpm-lock.yaml"],
	fileExtensions: [".tsbuildinfo"]
};
/**
* Schedule deferred deletion using process detachment techniques
*/
async function scheduleDeferredDeletion(itemPath, _relativePath) {
	try {
		const { platform } = process;
		if (platform === "win32") spawn("cmd", ["/c", `timeout /t 2 /nobreak && rmdir /s /q "${itemPath}"`], {
			detached: true,
			stdio: "ignore",
			shell: true
		}).unref();
		else spawn("sh", ["-c", `sleep 2 && rm -rf "${itemPath}" && find "$(dirname "${itemPath}")" -name "node_modules" -type d -empty -delete 2>/dev/null || true`], {
			detached: true,
			stdio: "ignore"
		}).unref();
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
		const tempDir = await fs$1.mkdtemp(path.join(tmpdir(), "purge-builds-"));
		const tempScript = path.join(tempDir, "purge-builds-detached.js");
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
		await fs$1.writeFile(tempScript, detachedScript);
		spawn(process.execPath, [tempScript], {
			detached: true,
			stdio: "ignore"
		}).unref();
		try {
			await fs$1.access(originalPath);
		} catch {
			return true;
		}
		const spinner = ora("Waiting for node_modules deletion...").start();
		let attempts = 0;
		const maxAttempts = 10;
		while (attempts < maxAttempts) {
			await new Promise((resolve) => setTimeout(resolve, 500));
			try {
				await fs$1.access(originalPath);
			} catch {
				spinner.succeed("Successfully deleted node_modules");
				return true;
			}
			attempts++;
			spinner.text = `Waiting for node_modules deletion... (${attempts}/${maxAttempts})`;
		}
		spinner.warn("Deletion process started but completion unconfirmed");
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
	if (currentScript.includes("node_modules/@finografic/project-scripts")) return itemPath.includes("node_modules/@finografic/project-scripts");
	if (currentScript.includes("packages/purge-builds")) return itemPath.includes("packages/purge-builds/dist");
	return false;
}
/**
* Check if we should defer deletion of node_modules
*/
function shouldDeferNodeModules(itemPath) {
	const currentScript = getCurrentExecutionPath();
	const workingDir = process.cwd();
	return itemPath === path.join(workingDir, "node_modules") && currentScript.includes("node_modules");
}
/**
* Check if a path should be deleted based on patterns
*/
function shouldDelete(itemPath, itemName, isDirectory) {
	if (isPartOfCurrentExecution(itemPath)) return false;
	if ([
		".git",
		".env",
		"package.json",
		"src"
	].includes(itemName)) return false;
	const pathParts = itemPath.split(path.sep);
	if ([
		"apps",
		"packages",
		"config",
		"scripts"
	].includes(itemName) && pathParts.length <= 2) return false;
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
		const items = await fs$1.readdir(dirPath, { withFileTypes: true });
		let totalSize = 0;
		for (const item of items) {
			const itemPath = path.join(dirPath, item.name);
			if (item.isDirectory()) totalSize += await getDirectorySize(itemPath);
			else if (item.isFile()) {
				const stats = await fs$1.stat(itemPath);
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
		const items = await fs$1.readdir(dirPath, { withFileTypes: true });
		for (const item of items) {
			const itemPath = path.join(dirPath, item.name);
			const isDirectory = item.isDirectory();
			if (shouldDelete(itemPath, item.name, isDirectory)) {
				const size = isDirectory ? await getDirectorySize(itemPath) : (await fs$1.stat(itemPath)).size;
				results.push({
					path: itemPath,
					type: isDirectory ? "directory" : "file",
					size
				});
				continue;
			}
			if (isDirectory && (recursive || currentDepth === 0)) await findItemsToDelete(itemPath, recursive, results, currentDepth + 1);
		}
	} catch {}
	return results;
}
/**
* Delete a single item (file or directory)
*/
async function deleteItem(itemPath, isDirectory) {
	try {
		if (isDirectory) await fs$1.rm(itemPath, {
			recursive: true,
			force: true
		});
		else await fs$1.unlink(itemPath);
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
		for (const dir of emptyDirs) try {
			await fs$1.rmdir(dir);
		} catch {}
	} catch {}
}
/**
* Find empty node_modules directories
*/
async function findEmptyNodeModulesDirectories(dirPath) {
	const emptyDirs = [];
	try {
		const items = await fs$1.readdir(dirPath, { withFileTypes: true });
		for (const item of items) if (item.isDirectory()) {
			const itemPath = path.join(dirPath, item.name);
			if (item.name === "node_modules") try {
				if ((await fs$1.readdir(itemPath)).length === 0) emptyDirs.push(itemPath);
			} catch {}
			else {
				const subEmptyDirs = await findEmptyNodeModulesDirectories(itemPath);
				emptyDirs.push(...subEmptyDirs);
			}
		}
	} catch {}
	return emptyDirs;
}
/**
* Format bytes to human readable string
*/
function formatBytes(bytes) {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = [
		"B",
		"KB",
		"MB",
		"GB"
	];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
/**
* Main purge function - V2 approach
*/
async function purge({ dryRun = false, verbose = false, recursive = false, forceDetach = false, noHealLockfile = false } = {}) {
	const startTime = Date.now();
	const workingDir = process.cwd();
	if (dryRun) {
		console.log(pc.green("🔒 DRY RUN MODE - NO FILES WILL BE DELETED\n"));
		console.log(pc.yellow("⚠️  This is a simulation only. Remove --dry-run to actually delete files.\n"));
	}
	console.log(pc.gray(`Working Directory: ${workingDir}`));
	console.log(pc.gray(`Mode: ${recursive ? "Recursive (deep)" : "Current level only"}`));
	console.log(pc.gray(`Operation: ${dryRun ? "DRY RUN (simulation)" : "LIVE (actual deletion)"}`));
	const currentScript = getCurrentExecutionPath();
	console.log(pc.gray(`Self-preservation: ${currentScript}\n`));
	const scanSpinner = ora("Scanning for build artifacts...").start();
	const itemsToDelete = await findItemsToDelete(workingDir, recursive);
	if (itemsToDelete.length === 0) {
		scanSpinner.succeed("No build artifacts found to clean!");
		return;
	}
	const totalSize = itemsToDelete.reduce((sum, item) => sum + item.size, 0);
	const dirCount = itemsToDelete.filter((item) => item.type === "directory").length;
	const fileCount = itemsToDelete.filter((item) => item.type === "file").length;
	scanSpinner.succeed(`Found ${itemsToDelete.length} items to clean`);
	console.log(pc.gray(`   • ${dirCount} directories`));
	console.log(pc.gray(`   • ${fileCount} files`));
	console.log(pc.gray(`   • ${formatBytes(totalSize)} total size\n`));
	if (verbose || dryRun) {
		console.log(pc.white("📝 Items to be processed:\n"));
		const directories = itemsToDelete.filter((item) => item.type === "directory");
		const files = itemsToDelete.filter((item) => item.type === "file");
		if (directories.length > 0) {
			console.log(pc.cyan("📁 Directories:"));
			directories.forEach((item) => {
				const relativePath = path.relative(workingDir, item.path);
				console.log(pc.gray(`   ${relativePath} (${formatBytes(item.size)})`));
			});
			console.log();
		}
		if (files.length > 0) {
			console.log(pc.cyan("📄 Files:"));
			files.forEach((item) => {
				const relativePath = path.relative(workingDir, item.path);
				console.log(pc.gray(`   ${relativePath} (${formatBytes(item.size)})`));
			});
			console.log();
		}
	}
	if (dryRun) {
		console.log(pc.yellow("🔒 DRY RUN: No files were actually deleted."));
		console.log(pc.gray(`Would have freed ${formatBytes(totalSize)} of space.`));
		return;
	}
	const immediateItems = itemsToDelete.filter((item) => !shouldDeferNodeModules(item.path));
	const deferredItems = itemsToDelete.filter((item) => shouldDeferNodeModules(item.path));
	const deleteSpinner = ora("Deleting items...").start();
	let deletedCount = 0;
	let freedSpace = 0;
	let errorCount = 0;
	for (const item of immediateItems) {
		const relativePath = path.relative(workingDir, item.path);
		deleteSpinner.text = `Deleting: ${relativePath}`;
		if (await deleteItem(item.path, item.type === "directory")) {
			deletedCount++;
			freedSpace += item.size;
		} else {
			errorCount++;
			if (verbose) console.log(pc.red(`\nFailed to delete: ${relativePath}`));
		}
	}
	deleteSpinner.succeed(`Deleted ${deletedCount} items`);
	if (deferredItems.length > 0) {
		console.log(pc.cyan("\n🔄 Handling deferred deletions...\n"));
		for (const item of deferredItems) {
			const relativePath = path.relative(workingDir, item.path);
			let deleted = false;
			if (forceDetach) {
				console.log(pc.cyan(`🧠 Attempting memory detachment for ${relativePath}...`));
				deleted = await executeFromMemory(item.path);
				if (deleted) console.log(pc.green(`⏰ Memory-detached: ${relativePath} will be deleted after process exits`));
				else {
					console.log(pc.cyan("⏰ Falling back to timer approach..."));
					deleted = await scheduleDeferredDeletion(item.path, relativePath);
					if (deleted) console.log(pc.green(`⏰ Timer-scheduled: ${relativePath} will be deleted after process exits`));
				}
			} else {
				deleted = await scheduleDeferredDeletion(item.path, relativePath);
				if (deleted) console.log(pc.green(`⏰ Scheduled: ${relativePath} will be deleted after process exits`));
			}
			if (!deleted) {
				console.log(pc.yellow(`⏸️  Deferred: ${relativePath} (automatic deletion failed)`));
				console.log(pc.gray(`   Run after this completes: rm -rf ${relativePath} && pnpm install`));
				console.log(pc.gray("   Or try: pnpm clean --detach for automatic deletion"));
			}
		}
	}
	const cleanupSpinner = ora("Cleaning up empty directories...").start();
	await cleanupEmptyDirectories(workingDir);
	cleanupSpinner.succeed("Cleaned up empty directories");
	if (!noHealLockfile) try {
		await healMinimumReleaseAgeViolations(workingDir);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(pc.red(`\n✗ Automatic lockfile heal failed: ${message}`));
		console.error(pc.gray("   Continuing — your own `pnpm install` step will surface the underlying error.\n"));
	}
	const duration = Date.now() - startTime;
	console.log(pc.green(`\n✅ Cleanup completed in ${duration}ms`));
	const deferredSize = deferredItems.reduce((sum, item) => sum + item.size, 0);
	const totalDeleted = deletedCount + deferredItems.length;
	const totalFreed = freedSpace + deferredSize;
	console.log(pc.gray(`   • ${totalDeleted} items deleted`));
	console.log(pc.gray(`   • ${formatBytes(totalFreed)} freed`));
	if (errorCount > 0) console.log(pc.yellow(`   • ${errorCount} errors encountered`));
	console.log();
}
//#endregion
//#region src/purge-builds/src/purge-builds/index.ts
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
  --no-heal-lockfile  Skip auto-fixing pnpm's minimumReleaseAge lockfile
                      rejections (see FEATURES below)
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
  • Auto-heals pnpm 11's minimumReleaseAge lockfile rejections: after
    deleting pnpm-lock.yaml, runs \`pnpm install\` and if it fails with
    ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION, pins the offending package(s)
    to the newest compliant version and re-resolves, so the caller's own
    subsequent \`pnpm install\` just succeeds. Disable with
    --no-heal-lockfile.
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
			recursive: args.includes("--recursive") || args.includes("-r"),
			forceDetach: args.includes("--detach"),
			noHealLockfile: args.includes("--no-heal-lockfile")
		});
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	}
}
if (isCliEntry(import.meta.url)) main();
//#endregion
export {};
