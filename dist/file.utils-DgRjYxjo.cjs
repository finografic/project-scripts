const require_chunk = require('./chunk-CbDLau6x.cjs');
let child_process = require("child_process");
let fs = require("fs");
let path = require("path");
let fs_promises = require("fs/promises");

//#region src/build-deployment/utils/file.utils.ts
/**
* Check if rsync is available on the system
*/
function isRsyncAvailable() {
	try {
		(0, child_process.execSync)("rsync --version", { stdio: "pipe" });
		return true;
	} catch {
		return false;
	}
}
/**
* Fast copy using rsync if available, fallback to cp
*/
async function fastCopy(src, dest, options = {}) {
	if (isRsyncAvailable()) {
		console.log("  🚀 Using rsync for fast copy...");
		let rsyncSrc = src;
		let rsyncDest = dest;
		if (options.recursive && (0, fs.existsSync)(src) && (0, fs.statSync)(src).isDirectory() && (await (0, fs_promises.readdir)(src)).length > 0) {
			if (!src.endsWith("/")) rsyncSrc = src + "/";
			if (dest.endsWith("/")) rsyncDest = dest.slice(0, -1);
		}
		const rsyncArgs = [
			"-a",
			options.recursive ? "-r" : "",
			"-v",
			rsyncSrc,
			rsyncDest
		].filter(Boolean);
		console.log(`  🔍 rsync command: rsync ${rsyncArgs.join(" ")}`);
		(0, child_process.execSync)(`rsync ${rsyncArgs.join(" ")}`, { stdio: "inherit" });
	} else {
		console.log("  📁 Using fallback cp...");
		await (0, fs_promises.cp)(src, dest, options);
	}
}
/**
* Create deployment directory structure in .temp folder for build isolation
*/
async function createDirectoryStructure(config) {
	const buildWorkspace = (0, path.resolve)(config.workspaceRoot, config.paths.temp, "deployment");
	const directories = [
		buildWorkspace,
		(0, path.join)(buildWorkspace, "dist"),
		(0, path.join)(buildWorkspace, "dist/client"),
		(0, path.join)(buildWorkspace, "dist/server"),
		(0, path.join)(buildWorkspace, "dist/data"),
		(0, path.join)(buildWorkspace, "dist/data/db"),
		(0, path.join)(buildWorkspace, "dist/data/uploads"),
		(0, path.join)(buildWorkspace, "dist/data/logs"),
		(0, path.join)(buildWorkspace, "dist/data/migrations")
	];
	for (const dir of directories) await (0, fs_promises.mkdir)(dir, { recursive: true });
}
/**
* Copy build artifacts to deployment directory
*/
async function copyBuildArtifacts(config, type) {
	const buildWorkspace = (0, path.resolve)(config.workspaceRoot, config.paths.temp, "deployment");
	const srcDir = (0, path.join)(buildWorkspace, config.paths[type], "dist");
	const destDir = (0, path.join)(buildWorkspace, "dist", type);
	console.log(`🔍 Debug paths for ${type}:`);
	console.log(`  Build workspace: ${buildWorkspace}`);
	console.log(`  Type path: ${config.paths[type]}`);
	console.log(`  Source dir: ${srcDir}`);
	console.log(`  Dest dir: ${destDir}`);
	if (!(0, fs.existsSync)(srcDir)) throw new Error(`${type} build directory not found: ${srcDir}`);
	console.log("✅ Source directory exists, copying...");
	await (0, fs_promises.mkdir)(destDir, { recursive: true });
	const srcContents = await (0, fs_promises.readdir)(srcDir);
	for (const item of srcContents) {
		const srcItem = (0, path.join)(srcDir, item);
		const destItem = (0, path.join)(destDir, item);
		if ((0, fs.existsSync)(srcItem)) {
			await fastCopy(srcItem, destItem, { recursive: true });
			console.log(`  📁 Copied: ${item}`);
		}
	}
	console.log(`✅ Copied ${type} build artifacts to ${destDir}`);
}
/**
* Copy data files (database, migrations, uploads)
*/
async function copyDataFiles(config) {
	const buildWorkspace = (0, path.resolve)(config.workspaceRoot, config.paths.temp, "deployment");
	const dbSrc = (0, path.resolve)(config.workspaceRoot, config.paths.data, config.database.development);
	const dbDest = (0, path.join)(buildWorkspace, "dist/data/db", config.database.production);
	if ((0, fs.existsSync)(dbSrc)) {
		await (0, fs_promises.mkdir)((0, path.join)(buildWorkspace, "dist/data/db"), { recursive: true });
		await fastCopy(dbSrc, dbDest);
	}
	const migrationsDir = (0, path.resolve)(config.workspaceRoot, config.paths.data, "migrations");
	if ((0, fs.existsSync)(migrationsDir)) await fastCopy(migrationsDir, (0, path.join)(buildWorkspace, "dist/data/migrations"), { recursive: true });
	const uploadsDir = (0, path.resolve)(config.workspaceRoot, config.paths.data, "uploads");
	if ((0, fs.existsSync)(uploadsDir)) await fastCopy(uploadsDir, (0, path.join)(buildWorkspace, "dist/data/uploads"), { recursive: true });
}
/**
* Create zip archive of deployment and save to deployments folder
*/
async function createZipArchive(config, platform, arch) {
	const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const zipName = `${config.appName.toLowerCase().replace(/\s+/g, "-")}-${platform}-${arch}-${timestamp}.zip`;
	const deploymentsDir = (0, path.resolve)(config.workspaceRoot, config.paths.deployments);
	const zipPath = (0, path.join)(deploymentsDir, zipName);
	await (0, fs_promises.mkdir)(deploymentsDir, { recursive: true });
	const buildWorkspace = (0, path.resolve)(config.workspaceRoot, config.paths.temp, "deployment");
	const finalDeployment = (0, path.resolve)(config.workspaceRoot, config.paths.temp, "final-deployment");
	if ((0, fs.existsSync)(finalDeployment)) (0, child_process.execSync)(`rm -rf "${finalDeployment}"`, { stdio: "inherit" });
	await (0, fs_promises.mkdir)(finalDeployment, { recursive: true });
	console.log("🎯 Creating final deployment structure...");
	for (const file of [
		"package.json",
		"package-lock.json",
		"start-client.js",
		"start-server.js",
		"ports.utils.js",
		"test-production.js"
	]) {
		const srcFile = (0, path.join)(buildWorkspace, file);
		const destFile = (0, path.join)(finalDeployment, file);
		if ((0, fs.existsSync)(srcFile)) {
			await (0, fs_promises.copyFile)(srcFile, destFile);
			console.log(`  ✅ Copied ${file}`);
		}
	}
	const platformFiles = await (0, fs_promises.readdir)(buildWorkspace);
	for (const file of platformFiles) if (file.includes("setup") || file.includes("GUIDE") || file.includes("GUIA") || file.includes("README") || file.includes(".sh") || file.includes(".bat")) {
		const srcFile = (0, path.join)(buildWorkspace, file);
		const destFile = (0, path.join)(finalDeployment, file);
		if ((0, fs.existsSync)(srcFile) && (await (0, fs_promises.stat)(srcFile)).isFile()) {
			await (0, fs_promises.copyFile)(srcFile, destFile);
			console.log(`  ✅ Copied platform file ${file}`);
		}
	}
	const distSrc = (0, path.join)(buildWorkspace, "dist");
	const distDest = (0, path.join)(finalDeployment, "dist");
	if ((0, fs.existsSync)(distSrc)) {
		console.log("  📁 Copying dist/ directory...");
		await fastCopy(distSrc, distDest, { recursive: true });
		console.log("  ✅ dist/ directory copied");
	}
	console.log("✅ Final deployment structure created");
	(0, child_process.execSync)(`cd "${finalDeployment}" && zip -r "${zipPath}" . -x "node_modules/*" "*.log" ".DS_Store"`, { stdio: "inherit" });
	return zipName;
}
/**
* Clean platform-specific artifacts
*/
async function cleanPlatformArtifacts(config) {
	const cmd = [
		`cd "${(0, path.resolve)(config.workspaceRoot, config.paths.temp, "deployment")}"`,
		"rm -f setup.bat setup.sh setup-macos.sh",
		"rm -f start-*.bat start-*.sh",
		"rm -f USER_GUIDE*.md GUIA_USUARIO*.md"
	].join(" && ");
	try {
		(0, child_process.execSync)(cmd, { stdio: "inherit" });
	} catch {}
}
/**
* Restore workspace by moving node_modules and pnpm-lock.yaml back
*/
async function restoreWorkspace(config) {
	const workspaceRoot = config.workspaceRoot;
	const isolationDir = (0, path.join)((0, path.resolve)(workspaceRoot, config.paths.temp), "workspace-isolation");
	console.log("🔓 Restoring workspace from isolation...");
	if (!(0, fs.existsSync)(isolationDir)) {
		console.log("ℹ️  No isolation directory found, nothing to restore");
		return;
	}
	try {
		if ((0, fs.existsSync)((0, path.join)(isolationDir, "node_modules"))) {
			console.log("📦 Restoring node_modules...");
			console.log("  ⏳ Copying node_modules back to workspace...");
			await fastCopy((0, path.join)(isolationDir, "node_modules"), (0, path.join)(workspaceRoot, "node_modules"), { recursive: true });
			console.log("  ✅ node_modules restored");
		}
		if ((0, fs.existsSync)((0, path.join)(isolationDir, "pnpm-lock.yaml"))) {
			console.log("🔐 Restoring pnpm-lock.yaml...");
			await (0, fs_promises.copyFile)((0, path.join)(isolationDir, "pnpm-lock.yaml"), (0, path.join)(workspaceRoot, "pnpm-lock.yaml"));
			console.log("  ✅ pnpm-lock.yaml restored");
		}
		if ((0, fs.existsSync)((0, path.join)(isolationDir, "pnpm-workspace.yaml"))) {
			console.log("🏢 Restoring pnpm-workspace.yaml...");
			await (0, fs_promises.copyFile)((0, path.join)(isolationDir, "pnpm-workspace.yaml"), (0, path.join)(workspaceRoot, "pnpm-workspace.yaml"));
			console.log("  ✅ pnpm-workspace.yaml restored");
		}
		console.log("✅ Workspace restored successfully");
	} catch (error) {
		console.error("❌ Failed to restore workspace:", error);
		try {
			const { restoreFromBackup } = await Promise.resolve().then(() => require("./file.utils-CqkRTLx0.cjs"));
			await restoreFromBackup(config);
		} catch (backupError) {
			console.error("❌ Failed to restore from backup:", backupError);
		}
		throw error;
	}
}
/**
* Emergency workspace restoration - can be called manually if needed
*/
async function emergencyRestoreWorkspace(workspaceRoot) {
	console.log("🚨 Emergency workspace restoration...");
	console.log(`  Workspace root: ${workspaceRoot}`);
	const possibleTempDirs = [
		(0, path.join)(workspaceRoot, ".temp"),
		(0, path.join)(workspaceRoot, "temp"),
		(0, path.join)(workspaceRoot, "tmp")
	];
	for (const tempDir of possibleTempDirs) {
		const isolationDir = (0, path.join)(tempDir, "workspace-isolation");
		if ((0, fs.existsSync)(isolationDir)) {
			console.log(`  Found isolation directory: ${isolationDir}`);
			try {
				await restoreWorkspace({
					workspaceRoot,
					paths: { temp: tempDir.replace(workspaceRoot, "").replace(/^[/\\]/, "") }
				});
				return;
			} catch (error) {
				console.error(`  Failed to restore from ${isolationDir}:`, error);
				try {
					const { restoreFromBackup } = await Promise.resolve().then(() => require("./file.utils-CqkRTLx0.cjs"));
					await restoreFromBackup({
						workspaceRoot,
						paths: { temp: tempDir.replace(workspaceRoot, "").replace(/^[/\\]/, "") }
					});
					console.log("  ✅ Emergency restoration completed from backup");
					return;
				} catch (backupError) {
					console.error("  Failed to restore from backup:", backupError);
				}
			}
		}
	}
	console.log("  No isolation directory found for emergency restoration");
}
/**
* Clean up .temp directory and restore workspace
*/
async function cleanupTempDirectory(config) {
	const tempDir = (0, path.resolve)(config.workspaceRoot, config.paths.temp);
	if ((0, fs.existsSync)(tempDir)) {
		console.log("🧹 Cleaning up temporary build directory...");
		try {
			await restoreWorkspace(config);
			await (0, fs_promises.rm)(tempDir, {
				recursive: true,
				force: true
			});
			console.log("✅ Temporary directory cleaned up");
		} catch (error) {
			console.error("⚠️  Failed to cleanup temp directory:", error);
		}
	}
}
/**
* Check if workspace is currently in use (has active processes)
*/
async function checkWorkspaceInUse(config) {
	const workspaceRoot = config.workspaceRoot;
	try {
		const result = (0, child_process.execSync)(`ps aux | grep -E "pnpm.*${workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" | grep -v grep`, { stdio: "pipe" }).toString().trim();
		if (result) {
			console.log("⚠️  Active pnpm processes detected in workspace:");
			console.log(result);
			return true;
		}
		const nodeResult = (0, child_process.execSync)(`ps aux | grep -E "node.*${workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" | grep -v grep`, { stdio: "pipe" }).toString().trim();
		if (nodeResult) {
			console.log("⚠️  Active Node.js processes detected in workspace:");
			console.log(nodeResult);
			return true;
		}
		return false;
	} catch {
		return false;
	}
}
/**
* Restore workspace from backup if main restoration fails
*/
async function restoreFromBackup(config) {
	const workspaceRoot = config.workspaceRoot;
	const backupDir = (0, path.join)((0, path.resolve)(workspaceRoot, config.paths.temp), "workspace-backup");
	console.log("🔄 Attempting to restore workspace from backup...");
	if (!(0, fs.existsSync)(backupDir)) {
		console.log("ℹ️  No backup directory found");
		return;
	}
	try {
		const backupFolders = (await (0, fs_promises.readdir)(backupDir)).filter((entry) => entry.startsWith("backup-") && (0, fs.existsSync)((0, path.join)(backupDir, entry)));
		if (backupFolders.length === 0) {
			console.log("ℹ️  No backup folders found");
			return;
		}
		backupFolders.sort().reverse();
		const latestBackup = (0, path.join)(backupDir, backupFolders[0]);
		console.log(`📦 Restoring from backup: ${latestBackup}`);
		for (const file of [
			"pnpm-lock.yaml",
			"pnpm-workspace.yaml",
			"package.json"
		]) {
			const backupFile = (0, path.join)(latestBackup, file);
			const targetFile = (0, path.join)(workspaceRoot, file);
			if ((0, fs.existsSync)(backupFile)) {
				await (0, fs_promises.copyFile)(backupFile, targetFile);
				console.log(`  📄 Restored: ${file}`);
			}
		}
		console.log("✅ Workspace restored from backup");
	} catch (error) {
		console.error("❌ Failed to restore from backup:", error);
		throw error;
	}
}
/**
* Check if build can proceed safely after isolation
*/
async function canProceedWithBuild(config) {
	const workspaceRoot = config.workspaceRoot;
	const isolationDir = (0, path.join)((0, path.resolve)(workspaceRoot, config.paths.temp), "workspace-isolation");
	console.log("🔍 Verifying build safety...");
	if (!(0, fs.existsSync)(isolationDir)) {
		console.log("❌ Isolation directory not found - isolation may have failed");
		return false;
	}
	const criticalFiles = [(0, path.join)(isolationDir, "node_modules"), (0, path.join)(isolationDir, "pnpm-workspace.yaml")];
	for (const file of criticalFiles) if (!(0, fs.existsSync)(file)) {
		console.log(`⚠️  Critical file not found in isolation: ${file}`);
		return false;
	}
	const workspaceFiles = [
		(0, path.join)(workspaceRoot, "node_modules"),
		(0, path.join)(workspaceRoot, "pnpm-lock.yaml"),
		(0, path.join)(workspaceRoot, "pnpm-workspace.yaml")
	];
	for (const file of workspaceFiles) if ((0, fs.existsSync)(file)) {
		console.log(`⚠️  Workspace file still present: ${file}`);
		return false;
	}
	console.log("✅ Build safety verified - workspace is properly isolated");
	return true;
}
/**
* Make scripts executable (Unix only)
*/
function makeExecutable(filePath) {
	if (process.platform !== "win32") try {
		(0, child_process.execSync)(`chmod +x ${filePath}`, { stdio: "inherit" });
	} catch {}
}
/**
* Write file and make executable if needed
*/
async function writeExecutableFile(filePath, content, makeExec = false) {
	await (0, fs_promises.writeFile)(filePath, content);
	if (makeExec) makeExecutable(filePath);
}

//#endregion
Object.defineProperty(exports, 'canProceedWithBuild', {
  enumerable: true,
  get: function () {
    return canProceedWithBuild;
  }
});
Object.defineProperty(exports, 'checkWorkspaceInUse', {
  enumerable: true,
  get: function () {
    return checkWorkspaceInUse;
  }
});
Object.defineProperty(exports, 'cleanPlatformArtifacts', {
  enumerable: true,
  get: function () {
    return cleanPlatformArtifacts;
  }
});
Object.defineProperty(exports, 'cleanupTempDirectory', {
  enumerable: true,
  get: function () {
    return cleanupTempDirectory;
  }
});
Object.defineProperty(exports, 'copyBuildArtifacts', {
  enumerable: true,
  get: function () {
    return copyBuildArtifacts;
  }
});
Object.defineProperty(exports, 'copyDataFiles', {
  enumerable: true,
  get: function () {
    return copyDataFiles;
  }
});
Object.defineProperty(exports, 'createDirectoryStructure', {
  enumerable: true,
  get: function () {
    return createDirectoryStructure;
  }
});
Object.defineProperty(exports, 'createZipArchive', {
  enumerable: true,
  get: function () {
    return createZipArchive;
  }
});
Object.defineProperty(exports, 'emergencyRestoreWorkspace', {
  enumerable: true,
  get: function () {
    return emergencyRestoreWorkspace;
  }
});
Object.defineProperty(exports, 'makeExecutable', {
  enumerable: true,
  get: function () {
    return makeExecutable;
  }
});
Object.defineProperty(exports, 'restoreFromBackup', {
  enumerable: true,
  get: function () {
    return restoreFromBackup;
  }
});
Object.defineProperty(exports, 'restoreWorkspace', {
  enumerable: true,
  get: function () {
    return restoreWorkspace;
  }
});
Object.defineProperty(exports, 'writeExecutableFile', {
  enumerable: true,
  get: function () {
    return writeExecutableFile;
  }
});