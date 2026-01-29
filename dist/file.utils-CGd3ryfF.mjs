import { execSync } from "child_process";
import { existsSync, statSync } from "fs";
import { join, resolve } from "path";
import { copyFile, cp, mkdir, readdir, rm, stat, writeFile } from "fs/promises";

//#region src/build-deployment/utils/file.utils.ts
/**
* Check if rsync is available on the system
*/
function isRsyncAvailable() {
	try {
		execSync("rsync --version", { stdio: "pipe" });
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
		if (options.recursive && existsSync(src) && statSync(src).isDirectory() && (await readdir(src)).length > 0) {
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
		execSync(`rsync ${rsyncArgs.join(" ")}`, { stdio: "inherit" });
	} else {
		console.log("  📁 Using fallback cp...");
		await cp(src, dest, options);
	}
}
/**
* Create deployment directory structure in .temp folder for build isolation
*/
async function createDirectoryStructure(config) {
	const buildWorkspace = resolve(config.workspaceRoot, config.paths.temp, "deployment");
	const directories = [
		buildWorkspace,
		join(buildWorkspace, "dist"),
		join(buildWorkspace, "dist/client"),
		join(buildWorkspace, "dist/server"),
		join(buildWorkspace, "dist/data"),
		join(buildWorkspace, "dist/data/db"),
		join(buildWorkspace, "dist/data/uploads"),
		join(buildWorkspace, "dist/data/logs"),
		join(buildWorkspace, "dist/data/migrations")
	];
	for (const dir of directories) await mkdir(dir, { recursive: true });
}
/**
* Copy build artifacts to deployment directory
*/
async function copyBuildArtifacts(config, type) {
	const buildWorkspace = resolve(config.workspaceRoot, config.paths.temp, "deployment");
	const srcDir = join(buildWorkspace, config.paths[type], "dist");
	const destDir = join(buildWorkspace, "dist", type);
	console.log(`🔍 Debug paths for ${type}:`);
	console.log(`  Build workspace: ${buildWorkspace}`);
	console.log(`  Type path: ${config.paths[type]}`);
	console.log(`  Source dir: ${srcDir}`);
	console.log(`  Dest dir: ${destDir}`);
	if (!existsSync(srcDir)) throw new Error(`${type} build directory not found: ${srcDir}`);
	console.log("✅ Source directory exists, copying...");
	await mkdir(destDir, { recursive: true });
	const srcContents = await readdir(srcDir);
	for (const item of srcContents) {
		const srcItem = join(srcDir, item);
		const destItem = join(destDir, item);
		if (existsSync(srcItem)) {
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
	const buildWorkspace = resolve(config.workspaceRoot, config.paths.temp, "deployment");
	const dbSrc = resolve(config.workspaceRoot, config.paths.data, config.database.development);
	const dbDest = join(buildWorkspace, "dist/data/db", config.database.production);
	if (existsSync(dbSrc)) {
		await mkdir(join(buildWorkspace, "dist/data/db"), { recursive: true });
		await fastCopy(dbSrc, dbDest);
	}
	const migrationsDir = resolve(config.workspaceRoot, config.paths.data, "migrations");
	if (existsSync(migrationsDir)) await fastCopy(migrationsDir, join(buildWorkspace, "dist/data/migrations"), { recursive: true });
	const uploadsDir = resolve(config.workspaceRoot, config.paths.data, "uploads");
	if (existsSync(uploadsDir)) await fastCopy(uploadsDir, join(buildWorkspace, "dist/data/uploads"), { recursive: true });
}
/**
* Create zip archive of deployment and save to deployments folder
*/
async function createZipArchive(config, platform, arch) {
	const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const zipName = `${config.appName.toLowerCase().replace(/\s+/g, "-")}-${platform}-${arch}-${timestamp}.zip`;
	const deploymentsDir = resolve(config.workspaceRoot, config.paths.deployments);
	const zipPath = join(deploymentsDir, zipName);
	await mkdir(deploymentsDir, { recursive: true });
	const buildWorkspace = resolve(config.workspaceRoot, config.paths.temp, "deployment");
	const finalDeployment = resolve(config.workspaceRoot, config.paths.temp, "final-deployment");
	if (existsSync(finalDeployment)) execSync(`rm -rf "${finalDeployment}"`, { stdio: "inherit" });
	await mkdir(finalDeployment, { recursive: true });
	console.log("🎯 Creating final deployment structure...");
	for (const file of [
		"package.json",
		"package-lock.json",
		"start-client.js",
		"start-server.js",
		"ports.utils.js",
		"test-production.js"
	]) {
		const srcFile = join(buildWorkspace, file);
		const destFile = join(finalDeployment, file);
		if (existsSync(srcFile)) {
			await copyFile(srcFile, destFile);
			console.log(`  ✅ Copied ${file}`);
		}
	}
	const platformFiles = await readdir(buildWorkspace);
	for (const file of platformFiles) if (file.includes("setup") || file.includes("GUIDE") || file.includes("GUIA") || file.includes("README") || file.includes(".sh") || file.includes(".bat")) {
		const srcFile = join(buildWorkspace, file);
		const destFile = join(finalDeployment, file);
		if (existsSync(srcFile) && (await stat(srcFile)).isFile()) {
			await copyFile(srcFile, destFile);
			console.log(`  ✅ Copied platform file ${file}`);
		}
	}
	const distSrc = join(buildWorkspace, "dist");
	const distDest = join(finalDeployment, "dist");
	if (existsSync(distSrc)) {
		console.log("  📁 Copying dist/ directory...");
		await fastCopy(distSrc, distDest, { recursive: true });
		console.log("  ✅ dist/ directory copied");
	}
	console.log("✅ Final deployment structure created");
	execSync(`cd "${finalDeployment}" && zip -r "${zipPath}" . -x "node_modules/*" "*.log" ".DS_Store"`, { stdio: "inherit" });
	return zipName;
}
/**
* Clean platform-specific artifacts
*/
async function cleanPlatformArtifacts(config) {
	const cmd = [
		`cd "${resolve(config.workspaceRoot, config.paths.temp, "deployment")}"`,
		"rm -f setup.bat setup.sh setup-macos.sh",
		"rm -f start-*.bat start-*.sh",
		"rm -f USER_GUIDE*.md GUIA_USUARIO*.md"
	].join(" && ");
	try {
		execSync(cmd, { stdio: "inherit" });
	} catch {}
}
/**
* Restore workspace by moving node_modules and pnpm-lock.yaml back
*/
async function restoreWorkspace(config) {
	const workspaceRoot = config.workspaceRoot;
	const isolationDir = join(resolve(workspaceRoot, config.paths.temp), "workspace-isolation");
	console.log("🔓 Restoring workspace from isolation...");
	if (!existsSync(isolationDir)) {
		console.log("ℹ️  No isolation directory found, nothing to restore");
		return;
	}
	try {
		if (existsSync(join(isolationDir, "node_modules"))) {
			console.log("📦 Restoring node_modules...");
			console.log("  ⏳ Copying node_modules back to workspace...");
			await fastCopy(join(isolationDir, "node_modules"), join(workspaceRoot, "node_modules"), { recursive: true });
			console.log("  ✅ node_modules restored");
		}
		if (existsSync(join(isolationDir, "pnpm-lock.yaml"))) {
			console.log("🔐 Restoring pnpm-lock.yaml...");
			await copyFile(join(isolationDir, "pnpm-lock.yaml"), join(workspaceRoot, "pnpm-lock.yaml"));
			console.log("  ✅ pnpm-lock.yaml restored");
		}
		if (existsSync(join(isolationDir, "pnpm-workspace.yaml"))) {
			console.log("🏢 Restoring pnpm-workspace.yaml...");
			await copyFile(join(isolationDir, "pnpm-workspace.yaml"), join(workspaceRoot, "pnpm-workspace.yaml"));
			console.log("  ✅ pnpm-workspace.yaml restored");
		}
		console.log("✅ Workspace restored successfully");
	} catch (error) {
		console.error("❌ Failed to restore workspace:", error);
		try {
			const { restoreFromBackup } = await import("./file.utils-CtpQoQW0.mjs");
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
		join(workspaceRoot, ".temp"),
		join(workspaceRoot, "temp"),
		join(workspaceRoot, "tmp")
	];
	for (const tempDir of possibleTempDirs) {
		const isolationDir = join(tempDir, "workspace-isolation");
		if (existsSync(isolationDir)) {
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
					const { restoreFromBackup } = await import("./file.utils-CtpQoQW0.mjs");
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
	const tempDir = resolve(config.workspaceRoot, config.paths.temp);
	if (existsSync(tempDir)) {
		console.log("🧹 Cleaning up temporary build directory...");
		try {
			await restoreWorkspace(config);
			await rm(tempDir, {
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
		const result = execSync(`ps aux | grep -E "pnpm.*${workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" | grep -v grep`, { stdio: "pipe" }).toString().trim();
		if (result) {
			console.log("⚠️  Active pnpm processes detected in workspace:");
			console.log(result);
			return true;
		}
		const nodeResult = execSync(`ps aux | grep -E "node.*${workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" | grep -v grep`, { stdio: "pipe" }).toString().trim();
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
	const backupDir = join(resolve(workspaceRoot, config.paths.temp), "workspace-backup");
	console.log("🔄 Attempting to restore workspace from backup...");
	if (!existsSync(backupDir)) {
		console.log("ℹ️  No backup directory found");
		return;
	}
	try {
		const backupFolders = (await readdir(backupDir)).filter((entry) => entry.startsWith("backup-") && existsSync(join(backupDir, entry)));
		if (backupFolders.length === 0) {
			console.log("ℹ️  No backup folders found");
			return;
		}
		backupFolders.sort().reverse();
		const latestBackup = join(backupDir, backupFolders[0]);
		console.log(`📦 Restoring from backup: ${latestBackup}`);
		for (const file of [
			"pnpm-lock.yaml",
			"pnpm-workspace.yaml",
			"package.json"
		]) {
			const backupFile = join(latestBackup, file);
			const targetFile = join(workspaceRoot, file);
			if (existsSync(backupFile)) {
				await copyFile(backupFile, targetFile);
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
	const isolationDir = join(resolve(workspaceRoot, config.paths.temp), "workspace-isolation");
	console.log("🔍 Verifying build safety...");
	if (!existsSync(isolationDir)) {
		console.log("❌ Isolation directory not found - isolation may have failed");
		return false;
	}
	const criticalFiles = [join(isolationDir, "node_modules"), join(isolationDir, "pnpm-workspace.yaml")];
	for (const file of criticalFiles) if (!existsSync(file)) {
		console.log(`⚠️  Critical file not found in isolation: ${file}`);
		return false;
	}
	const workspaceFiles = [
		join(workspaceRoot, "node_modules"),
		join(workspaceRoot, "pnpm-lock.yaml"),
		join(workspaceRoot, "pnpm-workspace.yaml")
	];
	for (const file of workspaceFiles) if (existsSync(file)) {
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
		execSync(`chmod +x ${filePath}`, { stdio: "inherit" });
	} catch {}
}
/**
* Write file and make executable if needed
*/
async function writeExecutableFile(filePath, content, makeExec = false) {
	await writeFile(filePath, content);
	if (makeExec) makeExecutable(filePath);
}

//#endregion
export { copyBuildArtifacts as a, createZipArchive as c, restoreFromBackup as d, restoreWorkspace as f, cleanupTempDirectory as i, emergencyRestoreWorkspace as l, checkWorkspaceInUse as n, copyDataFiles as o, writeExecutableFile as p, cleanPlatformArtifacts as r, createDirectoryStructure as s, canProceedWithBuild as t, makeExecutable as u };