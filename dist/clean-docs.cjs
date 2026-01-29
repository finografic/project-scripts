Object.defineProperty(exports, '__esModule', { value: true });
const require_chunk = require('./chunk-CbDLau6x.cjs');
const require_fs_utils = require('./fs.utils-Dcq0AJQ8.cjs');
const require_project_utils = require('./project.utils-DfW3kzVk.cjs');
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_url = require("node:url");
let chalk = require("chalk");
chalk = require_chunk.__toESM(chalk);
let del = require("del");

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
const WORKSPACE_ROOT = require_project_utils.findProjectRoot();
const matchesIncludePattern = (filePath) => {
	return GLOB_DELETE_INCLUDE.some((pattern) => {
		const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
		return new RegExp(`^${regexPattern}$`).test(filePath);
	});
};
async function clean({ dryRun = false, verbose = false } = {}) {
	if (dryRun) console.log(chalk.default.green("DRY RUN - no files will be deleted\n"));
	console.log(chalk.default.white("\nPath Information:"));
	console.log(chalk.default.gray("  Current Directory:", process.cwd()));
	console.log(chalk.default.gray("  Project Root:", WORKSPACE_ROOT));
	const packageScope = require_project_utils.getPackageScope();
	const baseDir = packageScope ? node_path.default.join(WORKSPACE_ROOT, packageScope) : WORKSPACE_ROOT;
	const scopeType = packageScope ? "Local package" : "Project root (only)";
	console.log(chalk.default.gray("  Package Scope:", packageScope || "none"));
	console.log(chalk.default.gray("  Base Directory:", baseDir));
	console.log(chalk.default.gray("  Scope Type:", scopeType));
	console.log(chalk.default[dryRun ? "white" : "magenta"](`\nCleaning ${scopeType}...\n`));
	if (dryRun) {
		console.log(chalk.default.gray("Patterns to be processed:"));
		GLOB_DELETE_INCLUDE.forEach((pattern) => {
			console.log(chalk.default.gray(`  - ${pattern}`));
		});
		console.log(chalk.default.gray("\nExcluded patterns:"));
		GLOB_DELETE_EXCLUDE.forEach((pattern) => {
			console.log(chalk.default.gray(`  - ${pattern}`));
		});
		console.log("");
	}
	let totalPaths = 0;
	let totalFiles = 0;
	const rootPaths = /* @__PURE__ */ new Set();
	try {
		for (const pattern of GLOB_DELETE_INCLUDE) {
			const fullPattern = node_path.default.join(baseDir, pattern).replace(/\\/g, "/");
			const finalPattern = !packageScope ? fullPattern : fullPattern.replace(/^\*\*\//, "");
			if (verbose) {
				console.log(chalk.default[dryRun ? "gray" : "magenta"](`\nProcessing pattern: ${pattern}`));
				console.log(chalk.default[dryRun ? "gray" : "magenta"](`Final pattern: ${finalPattern}`));
			}
			const deletedPaths = await (0, del.deleteAsync)(finalPattern, {
				dryRun,
				dot: true,
				onProgress: verbose ? (progress) => {
					const { deletedCount, totalCount, percent } = progress;
					console.log(chalk.default[dryRun ? "gray" : "magenta"](`Progress: ${deletedCount}/${totalCount} (${percent.toFixed(1)}%)`));
				} : void 0,
				ignore: GLOB_DELETE_EXCLUDE.map((p) => node_path.default.join(baseDir, p).replace(/\\/g, "/"))
			});
			if (verbose && deletedPaths.length > 0) {
				console.log(chalk.default[dryRun ? "gray" : "magenta"]("\nPaths affected:"));
				deletedPaths.forEach((file) => {
					console.log(chalk.default[dryRun ? "gray" : "magenta"](`  - ${file}`));
				});
			}
			deletedPaths.forEach((file) => {
				const rootPath = node_path.default.relative(baseDir, file).split(node_path.default.sep)[0];
				if (rootPath && matchesIncludePattern(rootPath)) rootPaths.add(rootPath);
			});
			totalPaths += deletedPaths.length;
			totalFiles += deletedPaths.reduce((acc, p) => acc + (require_fs_utils.isFile(p) ? 1 : 0), 0);
		}
		if (verbose || dryRun) {
			const filteredRootPaths = Array.from(rootPaths).filter(matchesIncludePattern);
			if (filteredRootPaths.length > 0) {
				console.log(chalk.default[dryRun ? "gray" : "magenta"]("\nRoot paths affected:"));
				filteredRootPaths.sort().forEach((file) => console.log(chalk.default[dryRun ? "gray" : "magenta"](`  - ${file}`)));
			}
		}
		console.log(chalk.default[dryRun ? "gray" : "green"](`\n✔ Clean ${dryRun ? "simulation" : "operation"} completed successfully`));
		console.log(chalk.default.gray(`  ${rootPaths.size} root paths ${dryRun ? "would be" : "were"} affected`));
		console.log(chalk.default.gray(`  ${totalPaths} total paths processed`));
		if (totalFiles > 0) console.log(chalk.default.gray(`  ${totalFiles} total files ${dryRun ? "would be" : "were"} deleted\n`));
	} catch (error) {
		console.error(chalk.default.yellow("\n✘ Clean operation failed:"));
		if (error instanceof Error) {
			console.error(chalk.default.yellow("  Error:", error.message));
			if (error.stack) console.error(chalk.default.yellow("  Stack:", error.stack));
		} else console.error(chalk.default.yellow("  Unknown error:", error));
		process.exit(1);
	}
	console.log("\n");
}
if (require("url").pathToFileURL(__filename).href === (0, node_url.pathToFileURL)(process.argv[1]).href) {
	const args = process.argv.slice(2);
	clean({
		dryRun: args.includes("--dry-run") || args.includes("-d"),
		verbose: args.includes("--verbose") || args.includes("-v")
	});
}

//#endregion
exports.GLOB_DELETE_INCLUDE = GLOB_DELETE_INCLUDE;
exports.clean = clean;
exports.default = clean;