#!/usr/bin/env node
import { t as isCliEntry } from "./is-cli-entry.mjs";
import { t as pc } from "./picocolors.mjs";
import { n as getPackageScope, t as findProjectRoot } from "./project.utils.mjs";
import { statSync } from "node:fs";
import path from "node:path";
import { deleteAsync } from "del";
//#region src/utils/fs.utils.ts
const isFile = (path) => {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
};
//#endregion
//#region src/clean-docs/clean-docs.config.ts
const GLOB_DELETE_EXCLUDE = [
	".git",
	".env",
	".env.*",
	"pnpm-workspace.yaml",
	"package.json",
	"apps",
	"packages",
	"config",
	"scripts"
];
const GLOB_DELETE_INCLUDE = [
	".docs",
	".tsup",
	"**/dist",
	"**/*.tsbuildinfo",
	"**/node_modules/.pnpm/**/.*",
	"**/node_modules/.pnpm/**/*",
	"**/node_modules/.pnpm",
	"**/node_modules",
	"pnpm-lock.yaml"
];
//#endregion
//#region src/clean-docs/clean-docs.ts
const WORKSPACE_ROOT = findProjectRoot();
const matchesIncludePattern = (filePath) => {
	return GLOB_DELETE_INCLUDE.some((pattern) => {
		const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
		return new RegExp(`^${regexPattern}$`).test(filePath);
	});
};
async function clean({ dryRun = false, verbose = false } = {}) {
	if (dryRun) console.log(pc.green("DRY RUN - no files will be deleted\n"));
	console.log(pc.white("\nPath Information:"));
	console.log(pc.gray(`  Current Directory: ${process.cwd()}`));
	console.log(pc.gray(`  Project Root: ${WORKSPACE_ROOT}`));
	const packageScope = getPackageScope();
	const baseDir = packageScope ? path.join(WORKSPACE_ROOT, packageScope) : WORKSPACE_ROOT;
	const scopeType = packageScope ? "Local package" : "Project root (only)";
	console.log(pc.gray(`  Package Scope: ${packageScope || "none"}`));
	console.log(pc.gray(`  Base Directory: ${baseDir}`));
	console.log(pc.gray(`  Scope Type: ${scopeType}`));
	console.log((dryRun ? pc.white : pc.magenta)(`\nCleaning ${scopeType}...\n`));
	if (dryRun) {
		console.log(pc.gray("Patterns to be processed:"));
		GLOB_DELETE_INCLUDE.forEach((pattern) => {
			console.log(pc.gray(`  - ${pattern}`));
		});
		console.log(pc.gray("\nExcluded patterns:"));
		GLOB_DELETE_EXCLUDE.forEach((pattern) => {
			console.log(pc.gray(`  - ${pattern}`));
		});
		console.log("");
	}
	let totalPaths = 0;
	let totalFiles = 0;
	const rootPaths = /* @__PURE__ */ new Set();
	try {
		for (const pattern of GLOB_DELETE_INCLUDE) {
			const fullPattern = path.join(baseDir, pattern).replace(/\\/g, "/");
			const finalPattern = !packageScope ? fullPattern : fullPattern.replace(/^\*\*\//, "");
			if (verbose) {
				console.log((dryRun ? pc.gray : pc.magenta)(`\nProcessing pattern: ${pattern}`));
				console.log((dryRun ? pc.gray : pc.magenta)(`Final pattern: ${finalPattern}`));
			}
			const deletedPaths = await deleteAsync(finalPattern, {
				dryRun,
				dot: true,
				onProgress: verbose ? (progress) => {
					const { deletedCount, totalCount, percent } = progress;
					console.log((dryRun ? pc.gray : pc.magenta)(`Progress: ${deletedCount}/${totalCount} (${percent.toFixed(1)}%)`));
				} : void 0,
				ignore: GLOB_DELETE_EXCLUDE.map((p) => path.join(baseDir, p).replace(/\\/g, "/"))
			});
			if (verbose && deletedPaths.length > 0) {
				console.log((dryRun ? pc.gray : pc.magenta)("\nPaths affected:"));
				deletedPaths.forEach((file) => {
					console.log((dryRun ? pc.gray : pc.magenta)(`  - ${file}`));
				});
			}
			deletedPaths.forEach((file) => {
				const rootPath = path.relative(baseDir, file).split(path.sep)[0];
				if (rootPath && matchesIncludePattern(rootPath)) rootPaths.add(rootPath);
			});
			totalPaths += deletedPaths.length;
			totalFiles += deletedPaths.reduce((acc, p) => acc + (isFile(p) ? 1 : 0), 0);
		}
		if (verbose || dryRun) {
			const filteredRootPaths = Array.from(rootPaths).filter(matchesIncludePattern);
			if (filteredRootPaths.length > 0) {
				console.log((dryRun ? pc.gray : pc.magenta)("\nRoot paths affected:"));
				filteredRootPaths.toSorted().forEach((file) => console.log((dryRun ? pc.gray : pc.magenta)(`  - ${file}`)));
			}
		}
		console.log((dryRun ? pc.gray : pc.green)(`\n✔ Clean ${dryRun ? "simulation" : "operation"} completed successfully`));
		console.log(pc.gray(`  ${rootPaths.size} root paths ${dryRun ? "would be" : "were"} affected`));
		console.log(pc.gray(`  ${totalPaths} total paths processed`));
		if (totalFiles > 0) console.log(pc.gray(`  ${totalFiles} total files ${dryRun ? "would be" : "were"} deleted\n`));
	} catch (error) {
		console.error(pc.yellow("\n✘ Clean operation failed:"));
		if (error instanceof Error) {
			console.error(pc.yellow(`  Error: ${error.message}`));
			if (error.stack) console.error(pc.yellow(`  Stack: ${error.stack}`));
		} else console.error(pc.yellow(`  Unknown error: ${String(error)}`));
		process.exit(1);
	}
	console.log("\n");
}
if (isCliEntry(import.meta.url)) {
	const args = process.argv.slice(2);
	clean({
		dryRun: args.includes("--dry-run") || args.includes("-d"),
		verbose: args.includes("--verbose") || args.includes("-v")
	});
}
//#endregion
export { clean, clean as default };
