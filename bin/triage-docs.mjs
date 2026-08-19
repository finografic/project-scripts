#!/usr/bin/env node
import { t as isCliEntry } from "./is-cli-entry.mjs";
import { t as pc } from "./picocolors.mjs";
import { existsSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { cancel, confirm, intro, isCancel, log, note, outro, select, spinner } from "@clack/prompts";
import { copyFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import process from "node:process";
//#region src/triage-docs/triage-docs.config.ts
const DEFAULT_SCAN_DIRS = [
	"docs/superpowers",
	"docs/superpowers/specs",
	"docs/superpowers/plans",
	"docs/planning",
	"docs/drafts",
	".cursor/plans",
	".claude/drafts"
];
const SPECS_DIR = "docs/specs";
const DRAFTS_DIR = "docs/drafts";
const DOC_EXTENSIONS = /* @__PURE__ */ new Set([".md"]);
const SPEC_MARKERS = [
	"## Goal",
	"## Non-Goals",
	"## Decision Summary",
	"## Architecture",
	"## Migration Strategy",
	"**Status:**",
	"## Chosen approach",
	"## Rejected approach",
	"## Proposed Architecture"
];
const DRAFTS_MARKERS = [
	"- [ ]",
	"- [x]",
	"## Checklist",
	"## TODO",
	"## Tasks",
	"manual checks",
	"Quick test"
];
//#endregion
//#region src/triage-docs/triage-docs.ts
function scoreMarkers(content, markers) {
	return markers.filter((marker) => content.includes(marker)).length;
}
function suggestCategory(content) {
	const specScore = scoreMarkers(content, SPEC_MARKERS);
	const draftScore = scoreMarkers(content, DRAFTS_MARKERS);
	if (specScore >= 2 && specScore > draftScore) return "spec";
	if (draftScore >= 2 && draftScore > specScore) return "draft";
	return "unknown";
}
async function findDocFiles(scanDirs, cwd) {
	const found = [];
	for (const dir of scanDirs) {
		const absDir = resolve(cwd, dir);
		if (!existsSync(absDir)) continue;
		if (!(await stat(absDir)).isDirectory()) continue;
		const entries = await readdir(absDir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isFile()) continue;
			if (!DOC_EXTENSIONS.has(extname(entry.name))) continue;
			const absPath = join(absDir, entry.name);
			const content = await readFile(absPath, "utf8");
			found.push({
				absolutePath: absPath,
				relativePath: relative(cwd, absPath),
				filename: entry.name,
				content,
				suggestion: suggestCategory(content)
			});
		}
	}
	return found;
}
function formatSuggestion(suggestion) {
	switch (suggestion) {
		case "spec": return pc.cyan("spec");
		case "draft": return pc.yellow("draft");
		case "unknown": return pc.dim("unknown");
	}
}
function previewContent(content, maxLines = 6) {
	return content.split("\n").slice(0, maxLines).map((line) => pc.dim(`  │ ${line}`)).join("\n");
}
async function readProjectLabel(cwd) {
	try {
		const raw = await readFile(resolve(cwd, "package.json"), "utf8");
		const { name } = JSON.parse(raw);
		return name ? `${name} · triage docs` : "triage docs";
	} catch {
		return "triage docs";
	}
}
function parseArgs(args) {
	let root = process.cwd();
	const extraDirs = [];
	for (const arg of args) if (arg.startsWith("--scan-dir=")) extraDirs.push(arg.slice(11));
	else if (arg.startsWith("--root=")) root = resolve(arg.slice(7));
	return {
		root,
		extraDirs
	};
}
async function triageDocs(args = process.argv.slice(2)) {
	const { root: cwd, extraDirs } = parseArgs(args);
	const scanDirs = [...DEFAULT_SCAN_DIRS, ...extraDirs];
	intro(pc.bgCyan(pc.black(` ${await readProjectLabel(cwd)} `)));
	const spin = spinner();
	spin.start("Scanning for planning artifacts...");
	const docs = await findDocFiles(scanDirs, cwd);
	if (docs.length === 0) {
		spin.stop("No documents found in scan directories");
		outro(pc.dim("Nothing to triage"));
		return;
	}
	spin.stop(`Found ${docs.length} document${docs.length === 1 ? "" : "s"}`);
	await mkdir(resolve(cwd, SPECS_DIR), { recursive: true });
	await mkdir(resolve(cwd, DRAFTS_DIR), { recursive: true });
	let movedToSpecs = 0;
	let movedToDrafts = 0;
	let discarded = 0;
	let skipped = 0;
	for (const doc of docs) {
		log.info(`${pc.bold(doc.relativePath)} ${pc.dim("·")} suggestion: ${formatSuggestion(doc.suggestion)}`);
		console.log(previewContent(doc.content));
		console.log();
		const action = await select({
			message: `What to do with ${doc.filename}?`,
			options: [
				{
					value: "spec",
					label: `Move to ${SPECS_DIR}/`,
					hint: doc.suggestion === "spec" ? "suggested" : void 0
				},
				{
					value: "draft",
					label: `Move to ${DRAFTS_DIR}/ (gitignored)`,
					hint: doc.suggestion === "draft" ? "suggested" : void 0
				},
				{
					value: "discard",
					label: "Delete"
				},
				{
					value: "skip",
					label: "Leave in place"
				}
			]
		});
		if (isCancel(action)) {
			cancel("Operation cancelled");
			return;
		}
		switch (action) {
			case "spec": {
				const dest = resolve(cwd, SPECS_DIR, doc.filename);
				await copyFile(doc.absolutePath, dest);
				await rm(doc.absolutePath);
				movedToSpecs++;
				log.success(pc.green(`→ ${SPECS_DIR}/${doc.filename}`));
				break;
			}
			case "draft": {
				const dest = resolve(cwd, DRAFTS_DIR, doc.filename);
				await copyFile(doc.absolutePath, dest);
				await rm(doc.absolutePath);
				movedToDrafts++;
				log.success(pc.yellow(`→ ${DRAFTS_DIR}/${doc.filename}`));
				break;
			}
			case "discard": {
				const shouldDelete = await confirm({
					message: `Delete ${doc.filename}? This cannot be undone.`,
					initialValue: false
				});
				if (isCancel(shouldDelete)) {
					cancel("Operation cancelled");
					return;
				}
				if (!shouldDelete) {
					skipped++;
					break;
				}
				await rm(doc.absolutePath);
				discarded++;
				log.warn(pc.dim(`Deleted ${doc.filename}`));
				break;
			}
			case "skip": skipped++;
		}
	}
	for (const dir of scanDirs) {
		const absDir = resolve(cwd, dir);
		if (!existsSync(absDir)) continue;
		try {
			if ((await readdir(absDir)).length === 0) {
				await rm(absDir, { recursive: true });
				log.info(pc.dim(`Removed empty directory: ${dir}`));
			}
		} catch {}
	}
	note([
		movedToSpecs > 0 ? `${pc.cyan(`${movedToSpecs}`)} → ${SPECS_DIR}/` : null,
		movedToDrafts > 0 ? `${pc.yellow(`${movedToDrafts}`)} → ${DRAFTS_DIR}/` : null,
		discarded > 0 ? `${pc.red(`${discarded}`)} deleted` : null,
		skipped > 0 ? `${pc.dim(`${skipped}`)} skipped` : null
	].filter(Boolean).join("\n"), "Triage complete");
	outro(pc.green("Done"));
}
if (isCliEntry(import.meta.url)) triageDocs().catch((error) => {
	console.error(error);
	process.exit(1);
});
//#endregion
export { triageDocs as default, triageDocs, findDocFiles, scoreMarkers, suggestCategory };
