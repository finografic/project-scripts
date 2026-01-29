const require_chunk = require('./chunk-CbDLau6x.cjs');
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);

//#region src/utils/project.utils.ts
const ROOT_MARKERS = [
	"pnpm-workspace.yaml",
	"package.json",
	".git"
];
const findProjectRoot = (startDir = process.cwd()) => {
	let dir = startDir;
	while (true) if (ROOT_MARKERS.some((marker) => node_fs.default.existsSync(node_path.default.join(dir, marker)))) {
		const hasPnpmWorkspace = node_fs.default.existsSync(node_path.default.join(dir, "pnpm-workspace.yaml"));
		const hasAppsDir = node_fs.default.existsSync(node_path.default.join(dir, "apps"));
		const hasPackagesDir = node_fs.default.existsSync(node_path.default.join(dir, "packages"));
		if (hasPnpmWorkspace && (hasAppsDir || hasPackagesDir)) {
			console.log(`🎯 Found monorepo root: ${dir}`);
			console.log(`  - pnpm-workspace.yaml: ${hasPnpmWorkspace ? "✅" : "❌"}`);
			console.log(`  - apps directory: ${hasAppsDir ? "✅" : "❌"}`);
			console.log(`  - packages directory: ${hasPackagesDir ? "✅" : "❌"}`);
			return dir;
		}
		const parent = node_path.default.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	} else {
		const parent = node_path.default.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	console.log(`⚠️  No monorepo root found, using current directory: ${process.cwd()}`);
	return process.cwd();
};
const getPackageScope = () => {
	const cwd = process.cwd();
	const WORKSPACE_ROOT = findProjectRoot();
	if (cwd === WORKSPACE_ROOT) return null;
	const parts = node_path.default.relative(WORKSPACE_ROOT, cwd).split(node_path.default.sep);
	if ((parts[0] === "apps" || parts[0] === "packages") && parts[1]) return node_path.default.join(parts[0], parts[1]);
	return null;
};

//#endregion
Object.defineProperty(exports, 'findProjectRoot', {
  enumerable: true,
  get: function () {
    return findProjectRoot;
  }
});
Object.defineProperty(exports, 'getPackageScope', {
  enumerable: true,
  get: function () {
    return getPackageScope;
  }
});