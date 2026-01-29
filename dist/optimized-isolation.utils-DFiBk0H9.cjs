const require_chunk = require('./chunk-CbDLau6x.cjs');
let child_process = require("child_process");
let fs = require("fs");
let path = require("path");
let fs_promises = require("fs/promises");

//#region src/build-deployment/utils/optimized-isolation.utils.ts
/**
* Optimized workspace isolation for deployment
* This avoids copying the massive node_modules (30GB+) by creating minimal production dependencies
*/
/**
* Create a minimal package.json with only production dependencies
* This dramatically reduces the size by avoiding dev dependencies
*/
async function createMinimalPackageJson(config, buildWorkspace) {
	console.log("📦 Creating minimal production package.json...");
	const rootPackageJsonPath = (0, path.join)(config.workspaceRoot, "package.json");
	const rootPackageJson = JSON.parse(await (0, fs_promises.readFile)(rootPackageJsonPath, "utf8"));
	const serverPackageJsonPath = (0, path.join)(config.workspaceRoot, "apps/server/package.json");
	const productionDependencies = {
		...JSON.parse(await (0, fs_promises.readFile)(serverPackageJsonPath, "utf8")).dependencies,
		"cross-env": rootPackageJson.devDependencies["cross-env"],
		tsx: rootPackageJson.devDependencies["tsx"],
		"better-sqlite3": rootPackageJson.devDependencies["better-sqlite3"]
	};
	const optionalDependencies = {
		"npm-run-all": "^4.1.5",
		serve: "^14.0.0"
	};
	delete productionDependencies["@workspace/core"];
	delete productionDependencies["@workspace/i18n"];
	delete productionDependencies["@workspace/server"];
	delete productionDependencies["@workspace/scripts"];
	Object.keys(productionDependencies).forEach((key) => {
		if (productionDependencies[key] && productionDependencies[key].includes("workspace:")) {
			delete productionDependencies[key];
			console.log(`  🧹 Removed workspace dependency: ${key}`);
		}
	});
	const minimalPackageJson = {
		name: "touch-monorepo-deployment",
		version: rootPackageJson.version,
		type: "module",
		private: true,
		engines: {
			node: ">=18.0.0",
			npm: ">=8.0.0"
		},
		scripts: {
			start: "run-p start:server start:client",
			"start:server": "node start-server.js",
			"start:client": "node start-client.js",
			postinstall: "echo 'Touch Monorepo deployed successfully!'"
		},
		dependencies: productionDependencies,
		optionalDependencies
	};
	await (0, fs_promises.writeFile)((0, path.join)(buildWorkspace, "package.json"), JSON.stringify(minimalPackageJson, null, 2), "utf8");
	console.log("✅ Minimal package.json created");
	console.log(`   Dependencies: ${Object.keys(productionDependencies).length} (vs ${Object.keys(rootPackageJson.dependencies || {}).length + Object.keys(rootPackageJson.devDependencies || {}).length} in original)`);
	console.log("   Size reduction: ~90% fewer dependencies");
}
/**
* Install only production dependencies in isolated workspace
* This is much faster than copying 30GB+ of node_modules
*/
async function installProductionDependencies(buildWorkspace) {
	console.log("🚀 Installing production dependencies (this will be much faster)...");
	const startTime = Date.now();
	try {
		(0, child_process.execSync)("npm install --production --no-optional --no-audit --no-fund", {
			cwd: buildWorkspace,
			stdio: "inherit",
			env: {
				...process.env,
				NODE_ENV: "production",
				PNPM_HOME: void 0
			}
		});
		const duration = ((Date.now() - startTime) / 1e3).toFixed(1);
		console.log(`✅ Production dependencies installed in ${duration}s`);
		console.log("   This is dramatically faster than copying 30GB+ of node_modules!");
	} catch (error) {
		console.error("❌ Failed to install production dependencies:", error);
		throw error;
	}
}
/**
* Optimized workspace isolation - avoids massive file copying
*/
async function optimizedIsolateWorkspace(config) {
	console.log("🚀 Starting optimized workspace isolation...");
	console.log("   This new approach avoids copying 30GB+ of node_modules!");
	const workspaceRoot = config.workspaceRoot;
	const tempDir = (0, path.resolve)(workspaceRoot, config.paths.temp);
	if (workspaceRoot.includes(config.paths.temp)) throw new Error("Safety check failed: Cannot isolate workspace from within temp directory");
	await (0, fs_promises.mkdir)(tempDir, { recursive: true });
	const pnpmLockPath = (0, path.join)(workspaceRoot, "pnpm-lock.yaml");
	const pnpmWorkspacePath = (0, path.join)(workspaceRoot, "pnpm-workspace.yaml");
	const isolationDir = (0, path.join)(tempDir, "workspace-isolation");
	await (0, fs_promises.mkdir)(isolationDir, { recursive: true });
	if ((0, fs.existsSync)(pnpmLockPath)) {
		console.log("🔐 Moving pnpm-lock.yaml to isolation...");
		await (0, fs_promises.copyFile)(pnpmLockPath, (0, path.join)(isolationDir, "pnpm-lock.yaml"));
	}
	if ((0, fs.existsSync)(pnpmWorkspacePath)) {
		console.log("🏢 Moving pnpm-workspace.yaml to isolation...");
		await (0, fs_promises.copyFile)(pnpmWorkspacePath, (0, path.join)(isolationDir, "pnpm-workspace.yaml"));
	}
	console.log("✅ Optimized workspace isolation completed");
	console.log("   ⚡ No massive file copying required!");
	console.log("   ⚡ Build will be dramatically faster!");
}
/**
* Restore workspace after deployment
*/
async function optimizedRestoreWorkspace(config) {
	const workspaceRoot = config.workspaceRoot;
	const isolationDir = (0, path.join)((0, path.resolve)(workspaceRoot, config.paths.temp), "workspace-isolation");
	console.log("🔓 Restoring workspace from optimized isolation...");
	if (!(0, fs.existsSync)(isolationDir)) {
		console.log("ℹ️  No isolation directory found, nothing to restore");
		return;
	}
	if ((0, fs.existsSync)((0, path.join)(isolationDir, "pnpm-lock.yaml"))) {
		await (0, fs_promises.copyFile)((0, path.join)(isolationDir, "pnpm-lock.yaml"), (0, path.join)(workspaceRoot, "pnpm-lock.yaml"));
		console.log("✅ pnpm-lock.yaml restored");
	}
	if ((0, fs.existsSync)((0, path.join)(isolationDir, "pnpm-workspace.yaml"))) {
		await (0, fs_promises.copyFile)((0, path.join)(isolationDir, "pnpm-workspace.yaml"), (0, path.join)(workspaceRoot, "pnpm-workspace.yaml"));
		console.log("✅ pnpm-workspace.yaml restored");
	}
	console.log("✅ Optimized workspace restoration completed");
}
/**
* Copy only source files (not node_modules) to build workspace
* This is much faster than the old approach
*/
async function copyOptimizedSources(config, buildWorkspace) {
	const workspaceRoot = config.workspaceRoot;
	for (const dir of [
		"apps/client",
		"apps/server",
		"packages/core",
		"packages/i18n"
	]) {
		const srcDir = (0, path.join)(workspaceRoot, dir);
		const destDir = (0, path.join)(buildWorkspace, dir);
		if ((0, fs.existsSync)(srcDir)) {
			console.log(`  📁 Copying ${dir}...`);
			await (0, fs_promises.cp)(srcDir, destDir, { recursive: true });
			console.log(`  ✅ ${dir} copied`);
		}
	}
	for (const file of [
		".env",
		".env.local",
		".env.production",
		"env.shared.ts",
		"tsconfig.json",
		"vite.config.ts",
		"tailwind.config.js",
		"postcss.config.js"
	]) {
		const srcFile = (0, path.join)(workspaceRoot, file);
		const destFile = (0, path.join)(buildWorkspace, file);
		if ((0, fs.existsSync)(srcFile)) {
			await (0, fs_promises.copyFile)(srcFile, destFile);
			console.log(`  📄 ${file} copied`);
		}
	}
	console.log("✅ Source files copied successfully");
}

//#endregion
Object.defineProperty(exports, 'copyOptimizedSources', {
  enumerable: true,
  get: function () {
    return copyOptimizedSources;
  }
});
Object.defineProperty(exports, 'createMinimalPackageJson', {
  enumerable: true,
  get: function () {
    return createMinimalPackageJson;
  }
});
Object.defineProperty(exports, 'installProductionDependencies', {
  enumerable: true,
  get: function () {
    return installProductionDependencies;
  }
});
Object.defineProperty(exports, 'optimizedIsolateWorkspace', {
  enumerable: true,
  get: function () {
    return optimizedIsolateWorkspace;
  }
});
Object.defineProperty(exports, 'optimizedRestoreWorkspace', {
  enumerable: true,
  get: function () {
    return optimizedRestoreWorkspace;
  }
});