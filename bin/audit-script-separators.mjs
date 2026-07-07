#!/usr/bin/env node
import { join, relative } from "path";
import { readFile, readdir, writeFile } from "fs/promises";
import { styleText } from "node:util";
//#region src/audit-script-separators/audit-script-separators.ts
/**
* Audit and optionally fix `package.json` script key separators (dots → colons).
*
* Modes:
* - default → audit only (no files written)
* - `--fix` → rewrite dotted keys and references on disk
*
* Example:
* - `tsx scripts/audit-script-separators.ts` — audit
* - `tsx scripts/audit-script-separators.ts --fix` — apply fixes
*/
const WORKSPACE_ROOT = process.cwd();
const SHOULD_FIX = process.argv.slice(2).includes("--fix");
function colorize() {
	return {
		title: (s) => styleText(["yellow", "bold"], s),
		section: (s) => styleText(["gray", "bold"], s),
		filePath: (s) => styleText(["cyan", "bold"], s),
		ok: (s) => styleText("greenBright", s),
		warn: (s) => styleText("yellow", s),
		muted: (s) => styleText("gray", s),
		key: (s) => styleText("magenta", s),
		count: (s) => styleText("yellowBright", s)
	};
}
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isDottedScriptKey(key) {
	return key.includes(".");
}
function toColonKey(key) {
	return key.replace(/\./g, ":");
}
function detectScriptKeyCollisions(scripts) {
	const collisions = [];
	const seen = new Set(Object.keys(scripts));
	for (const key of Object.keys(scripts)) {
		if (!key.includes(".")) continue;
		const transformed = key.replace(/\./g, ":");
		if (seen.has(transformed) && transformed !== key) collisions.push({
			from: key,
			to: transformed
		});
	}
	return collisions;
}
async function findAllPackageJsonFiles(dir) {
	const results = [];
	async function walk(current) {
		const entries = await readdir(current, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(current, entry.name);
			if (entry.isDirectory()) {
				if ([
					"node_modules",
					".git",
					"dist",
					"bin"
				].includes(entry.name)) continue;
				await walk(fullPath);
			} else if (entry.name === "package.json") results.push(relative(WORKSPACE_ROOT, fullPath));
		}
	}
	await walk(dir);
	return results.toSorted();
}
async function findWorkflowFiles() {
	const workflowDir = join(WORKSPACE_ROOT, ".github", "workflows");
	try {
		return (await readdir(workflowDir, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => relative(WORKSPACE_ROOT, join(workflowDir, e.name))).toSorted();
	} catch {
		return [];
	}
}
async function findMarkdownFiles(dir) {
	const results = [];
	async function walk(current) {
		const entries = await readdir(current, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(current, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === "node_modules" || entry.name === ".git") continue;
				await walk(fullPath);
			} else if (entry.name.endsWith(".md")) results.push(relative(WORKSPACE_ROOT, fullPath));
		}
	}
	await walk(dir);
	return results.toSorted();
}
async function loadPackageScripts(packageJsonPath) {
	const absolutePath = join(WORKSPACE_ROOT, packageJsonPath);
	let raw;
	try {
		raw = await readFile(absolutePath, "utf-8");
	} catch {
		return [];
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		console.warn(`Failed to parse ${packageJsonPath}`);
		return [];
	}
	const scripts = parsed.scripts ?? {};
	return Object.entries(scripts).map(([key, command]) => ({
		filePath: packageJsonPath,
		key,
		command
	}));
}
async function findScriptReferences(scriptKey, targetPaths) {
	const pattern = new RegExp(`(?<![\\w.-])${escapeRegExp(scriptKey)}(?![\\w.-])`, "g");
	const matches = [];
	for (const targetPath of targetPaths) {
		const absolutePath = join(WORKSPACE_ROOT, targetPath);
		let content;
		try {
			content = await readFile(absolutePath, "utf-8");
		} catch {
			continue;
		}
		const count = [...content.matchAll(pattern)].length;
		if (count > 0) matches.push({
			filePath: targetPath,
			count
		});
	}
	return matches;
}
async function fixPackageJsonScripts(filePath) {
	const absolutePath = join(WORKSPACE_ROOT, filePath);
	let raw;
	try {
		raw = await readFile(absolutePath, "utf-8");
	} catch {
		throw new Error(`Failed to read ${filePath}`);
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(`Failed to parse ${filePath}`);
	}
	if (!parsed.scripts) return 0;
	const collisions = detectScriptKeyCollisions(parsed.scripts);
	if (collisions.length > 0) {
		console.warn(`\nCollision detected in ${filePath}:`);
		for (const c of collisions) console.warn(`- ${c.from} → ${c.to} (already exists)`);
		console.warn("Skipping file to avoid overwriting.\n");
		return 0;
	}
	const original = parsed.scripts;
	const updated = {};
	let changes = 0;
	for (const [key, value] of Object.entries(original)) if (isDottedScriptKey(key)) {
		const newKey = toColonKey(key);
		updated[newKey] = value;
		changes++;
	} else updated[key] = value;
	if (changes === 0) return 0;
	parsed.scripts = updated;
	await writeFile(absolutePath, JSON.stringify(parsed, null, 2) + "\n");
	return changes;
}
async function fixReferences(filePath, dottedToColonMap) {
	const absolutePath = join(WORKSPACE_ROOT, filePath);
	let content;
	try {
		content = await readFile(absolutePath, "utf-8");
	} catch {
		return 0;
	}
	let updated = content;
	let totalChanges = 0;
	for (const [from, to] of dottedToColonMap.entries()) {
		const pattern = new RegExp(`(?<![\\w.-])${escapeRegExp(from)}(?![\\w.-])`, "g");
		const matches = [...updated.matchAll(pattern)].length;
		if (matches > 0) {
			updated = updated.replace(pattern, to);
			totalChanges += matches;
		}
	}
	if (totalChanges > 0) await writeFile(absolutePath, updated);
	return totalChanges;
}
async function findTypeScriptFiles(dir) {
	const results = [];
	async function walk(current) {
		const entries = await readdir(current, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(current, entry.name);
			if (entry.isDirectory()) {
				if ([
					"node_modules",
					".git",
					"dist",
					"bin"
				].includes(entry.name)) continue;
				await walk(fullPath);
			} else if (entry.name.endsWith(".ts")) results.push(relative(WORKSPACE_ROOT, fullPath));
		}
	}
	await walk(dir);
	return results.toSorted();
}
/** `pnpm db.migrations.run` / `npm run build:production` style invocations */
const DOTTED_INVOCATION_PATTERN = /(?:pnpm|npm run)\s+([a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]+)+)/g;
async function findDottedScriptInvocations(targetPaths) {
	const matches = [];
	for (const targetPath of targetPaths) {
		const absolutePath = join(WORKSPACE_ROOT, targetPath);
		let content;
		try {
			content = await readFile(absolutePath, "utf-8");
		} catch {
			continue;
		}
		const count = [...content.matchAll(DOTTED_INVOCATION_PATTERN)].length;
		if (count > 0) matches.push({
			filePath: targetPath,
			count
		});
	}
	return matches;
}
async function fixDottedInvocations(filePath) {
	const absolutePath = join(WORKSPACE_ROOT, filePath);
	let content;
	try {
		content = await readFile(absolutePath, "utf-8");
	} catch {
		return 0;
	}
	const updated = content.replace(DOTTED_INVOCATION_PATTERN, (match, scriptName) => match.replace(scriptName, toColonKey(scriptName)));
	if (updated === content) return 0;
	await writeFile(absolutePath, updated);
	return 1;
}
async function main() {
	const c = colorize();
	const packageJsonFiles = await findAllPackageJsonFiles(WORKSPACE_ROOT);
	const workflowFiles = await findWorkflowFiles();
	const markdownFiles = await findMarkdownFiles(WORKSPACE_ROOT);
	const typeScriptFiles = await findTypeScriptFiles(join(WORKSPACE_ROOT, "src"));
	const scriptFiles = await findTypeScriptFiles(join(WORKSPACE_ROOT, "scripts"));
	const auditTargets = [
		...packageJsonFiles,
		...workflowFiles,
		...markdownFiles
	];
	const invocationTargets = [
		...auditTargets,
		...typeScriptFiles,
		...scriptFiles
	];
	const dottedScripts = (await Promise.all(packageJsonFiles.map((p) => loadPackageScripts(p)))).flat().filter((s) => isDottedScriptKey(s.key));
	const dottedInvocations = await findDottedScriptInvocations(invocationTargets);
	console.log("");
	console.log(c.title("Script separator audit"));
	console.log("");
	if (dottedScripts.length === 0 && dottedInvocations.length === 0) {
		console.log(c.ok("No dotted script keys or invocations found."));
		console.log("");
		return;
	}
	if (dottedScripts.length > 0) {
		console.log(c.section("Dotted package.json script keys:"));
		console.log("");
		let totalReferences = 0;
		for (const script of dottedScripts) {
			const matches = await findScriptReferences(script.key, auditTargets);
			const scriptTotal = matches.reduce((acc, m) => acc + m.count, 0);
			totalReferences += scriptTotal;
			console.log(`file: ${c.filePath(script.filePath)}`);
			console.log(`${styleText("bold", "script:")} ${c.key(script.key)}`);
			if (matches.length === 0) console.log(c.muted("references: none found"));
			else {
				console.log("references:");
				for (const match of matches) console.log(`- ${match.filePath}: ${c.count(String(match.count))}`);
			}
			console.log("");
		}
		console.log(c.section("Package.json summary:"));
		console.log("");
		console.log(`- Dotted scripts: ${dottedScripts.length}`);
		console.log(`- Total references: ${totalReferences}`);
		console.log("");
	}
	if (dottedInvocations.length > 0) {
		console.log(c.section("Dotted script invocations in source/docs:"));
		console.log("");
		for (const match of dottedInvocations) console.log(`- ${match.filePath}: ${c.count(String(match.count))}`);
		console.log("");
	}
	if (!SHOULD_FIX) {
		console.log(c.ok("No files were written (audit only)"));
		console.log("");
		return;
	}
	console.log(c.ok("Applying fixes.."));
	console.log("");
	const dottedToColon = /* @__PURE__ */ new Map();
	for (const s of dottedScripts) dottedToColon.set(s.key, toColonKey(s.key));
	let scriptFixes = 0;
	for (const file of packageJsonFiles) scriptFixes += await fixPackageJsonScripts(file);
	let referenceFixes = 0;
	for (const file of auditTargets) referenceFixes += await fixReferences(file, dottedToColon);
	let invocationFixes = 0;
	for (const file of invocationTargets) invocationFixes += await fixDottedInvocations(file);
	console.log("");
	console.log(c.section("Fix Summary:"));
	console.log("");
	console.log(`- Script keys updated: ${scriptFixes}`);
	console.log(`- References updated: ${referenceFixes}`);
	console.log(`- Invocation sites updated: ${invocationFixes}`);
	console.log("");
	console.log(c.ok("Fixes applied successfully"));
	console.log("");
}
//#endregion
//#region src/audit-script-separators/index.ts
await main();
//#endregion
export { main };
