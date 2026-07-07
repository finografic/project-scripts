#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
//#region src/utils/project.utils.ts
const ROOT_MARKERS = [
	"pnpm-workspace.yaml",
	"package.json",
	".git"
];
let cachedProjectRoot;
const findProjectRoot = (startDir = process.cwd()) => {
	if (cachedProjectRoot) return cachedProjectRoot;
	let dir = startDir;
	while (true) if (ROOT_MARKERS.some((marker) => fs.existsSync(path.join(dir, marker)))) {
		const hasPnpmWorkspace = fs.existsSync(path.join(dir, "pnpm-workspace.yaml"));
		const hasAppsDir = fs.existsSync(path.join(dir, "apps"));
		const hasPackagesDir = fs.existsSync(path.join(dir, "packages"));
		if (hasPnpmWorkspace && (hasAppsDir || hasPackagesDir)) {
			const markers = ["pnpm-workspace.yaml"];
			if (hasAppsDir) markers.push("apps/");
			if (hasPackagesDir) markers.push("packages/");
			console.log(`🎯 Found monorepo root: ${dir} (${markers.join(", ")})`);
			cachedProjectRoot = dir;
			return dir;
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	} else {
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	console.log(`⚠️  No monorepo root found, using current directory: ${process.cwd()}`);
	cachedProjectRoot = process.cwd();
	return cachedProjectRoot;
};
const getPackageScope = () => {
	const cwd = process.cwd();
	const WORKSPACE_ROOT = findProjectRoot();
	if (cwd === WORKSPACE_ROOT) return null;
	const parts = path.relative(WORKSPACE_ROOT, cwd).split(path.sep);
	if ((parts[0] === "apps" || parts[0] === "packages") && parts[1]) return path.join(parts[0], parts[1]);
	return null;
};
//#endregion
export { getPackageScope as n, findProjectRoot as t };
