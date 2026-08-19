#!/usr/bin/env node
import { t as pc } from "./picocolors.mjs";
import { t as findProjectRoot } from "./project.utils.mjs";
import { execSync } from "child_process";
import { existsSync, statSync } from "fs";
import { dirname, join, resolve } from "path";
import { cancel, confirm, isCancel, multiselect, select } from "@clack/prompts";
import { arch, platform } from "node:os";
import { copyFile, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { createRequire } from "module";
import { fileURLToPath } from "url";
//#region src/build-deployment/utils/build.utils.ts
/**
* Build client or server application
*/
async function buildApp(config, type) {
	const command = `pnpm --filter ${config.packageNames[type]} ${config.buildCommands[type]}`;
	const buildWorkspace = resolve(config.workspaceRoot, config.paths.temp, "deployment");
	console.log(`🔒 Building from isolated workspace: ${buildWorkspace}`);
	console.log(`  📦 Command: ${command}`);
	console.log(`  📁 Working directory: ${buildWorkspace}`);
	console.log(`  📁 Package path: ${config.paths[type]}`);
	console.log(`  📁 Expected dist location: ${join(buildWorkspace, config.paths[type], "dist")}`);
	const packageDir = join(buildWorkspace, config.paths[type]);
	if (!existsSync(packageDir)) throw new Error(`Package directory not found: ${packageDir}`);
	console.log(`  ✅ Package directory exists: ${packageDir}`);
	const packageJsonPath = join(packageDir, "package.json");
	if (!existsSync(packageJsonPath)) throw new Error(`Package.json not found: ${packageJsonPath}`);
	console.log(`  ✅ Package.json exists: ${packageJsonPath}`);
	execSync(command, {
		cwd: buildWorkspace,
		stdio: "inherit"
	});
	const distDir = join(packageDir, "dist");
	if (existsSync(distDir)) {
		console.log(`  ✅ Build successful - dist directory created: ${distDir}`);
		const distContents = await readdir(distDir);
		console.log(`  📁 Dist contents: ${distContents.join(", ")}`);
	} else {
		console.log(`  ❌ Build failed - dist directory not created: ${distDir}`);
		throw new Error(`Build failed - dist directory not created: ${distDir}`);
	}
}
/**
* Create production package.json
*/
async function createPackageJson(config, serverPackagePath) {
	const serverPackageContent = await readFile(serverPackagePath, "utf-8");
	const serverDependencies = { ...JSON.parse(serverPackageContent).dependencies };
	Object.keys(serverDependencies).forEach((key) => {
		if (key.startsWith("@workspace/")) delete serverDependencies[key];
	});
	const packageJson = {
		name: config.appName.toLowerCase().replace(/\s+/g, "-"),
		version: config.version,
		description: config.appDescription,
		private: true,
		type: "module",
		scripts: {
			"start": "run-p start:server start:client",
			"start:server": "node start-server.js",
			"start:client": "node start-client.js"
		},
		dependencies: {
			...serverDependencies,
			dotenv: "^16.0.0"
		},
		optionalDependencies: {
			"npm-run-all": "^4.1.5",
			"serve": "^14.0.0"
		},
		engines: { node: ">=20.0.0" }
	};
	const buildWorkspace = resolve(config.workspaceRoot, config.paths.temp, "deployment");
	await writeFile(join(buildWorkspace, "package.json"), JSON.stringify(packageJson, null, 2));
}
/**
* Create standalone package.json
*/
async function createStandalonePackage(config, platform) {
	const packageJson = {
		name: `${config.appName.toLowerCase().replace(/\s+/g, "-")}-standalone`,
		version: config.version,
		description: `${config.appName} Standalone Deployment`,
		private: true,
		type: "module",
		scripts: {
			"start": "run-p start:server start:client",
			"start:server": "node dist/server/index.js",
			"start:client": "node dist/client/server.js",
			"setup": platform === "windows" ? "setup.bat" : "./setup.sh"
		},
		dependencies: {
			"better-sqlite3": "^11.9.0",
			"dotenv": "^16.0.0"
		},
		optionalDependencies: { "npm-run-all": "^4.1.5" },
		engines: { node: ">=20.0.0" }
	};
	const buildWorkspace = resolve(config.workspaceRoot, config.paths.temp, "deployment");
	await writeFile(join(buildWorkspace, "package.json"), JSON.stringify(packageJson, null, 2));
}
/**
* Install production dependencies
*/
async function installDependencies(config) {
	const buildWorkspace = resolve(config.workspaceRoot, config.paths.temp, "deployment");
	if (!buildWorkspace.includes(config.paths.temp)) throw new Error(`Safety check failed: Attempting to install dependencies outside of isolated ${config.paths.temp} directory`);
	try {
		console.log("📦 Installing production dependencies with npm...");
		console.log(`🔒 Working in isolated directory: ${buildWorkspace}`);
		execSync("npm install --production", {
			cwd: buildWorkspace,
			stdio: "inherit",
			env: {
				...process.env,
				NODE_ENV: "production"
			}
		});
	} catch (_error) {
		console.log("⚠️  Standard install failed, trying with force flag...");
		try {
			execSync("npm install --production --force", {
				cwd: buildWorkspace,
				stdio: "inherit",
				env: {
					...process.env,
					NODE_ENV: "production"
				}
			});
		} catch (_forceError) {
			console.log("⚠️  Force install failed, trying with no-frozen-lockfile...");
			try {
				execSync("npm install --production", {
					cwd: buildWorkspace,
					stdio: "inherit",
					env: {
						...process.env,
						NODE_ENV: "production"
					}
				});
			} catch (_lockfileError) {
				console.log("⚠️  Lockfile install failed, trying with ignore-scripts...");
				execSync("npm install --production --ignore-scripts", {
					cwd: buildWorkspace,
					stdio: "inherit",
					env: {
						...process.env,
						NODE_ENV: "production"
					}
				});
			}
		}
	}
}
/**
* Check and kill occupied ports
*/
function killPortIfOccupied(port) {
	try {
		if (execSync(`lsof -ti:${port}`, { stdio: "pipe" }).toString().trim()) {
			console.log(`⚠️  Port ${port} is occupied, killing process...`);
			execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: "inherit" });
			console.log(`✅ Killed process on port ${port}`);
		} else console.log(`✅ Port ${port} is available`);
	} catch {
		console.log(`✅ Port ${port} is available`);
	}
}
//#endregion
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
	const zipCommand = `cd "${finalDeployment}" && zip -r "${zipPath}" . -x "node_modules/*" "*.log" ".DS_Store"`;
	execSync(zipCommand, { stdio: "inherit" });
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
	const { workspaceRoot } = config;
	const tempDir = resolve(workspaceRoot, config.paths.temp);
	const isolationDir = join(tempDir, "workspace-isolation");
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
* Restore workspace from backup if main restoration fails
*/
async function restoreFromBackup(config) {
	const { workspaceRoot } = config;
	const tempDir = resolve(workspaceRoot, config.paths.temp);
	const backupDir = join(tempDir, "workspace-backup");
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
		backupFolders.toSorted().reverse();
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
	const { workspaceRoot } = config;
	const tempDir = resolve(workspaceRoot, config.paths.temp);
	const isolationDir = join(tempDir, "workspace-isolation");
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
	const rootPackageJsonPath = join(config.workspaceRoot, "package.json");
	const rootPackageJson = JSON.parse(await readFile(rootPackageJsonPath, "utf8"));
	const serverPackageJsonPath = join(config.workspaceRoot, "apps/server/package.json");
	const productionDependencies = {
		...JSON.parse(await readFile(serverPackageJsonPath, "utf8")).dependencies,
		"cross-env": rootPackageJson.devDependencies["cross-env"],
		"tsx": rootPackageJson.devDependencies["tsx"],
		"better-sqlite3": rootPackageJson.devDependencies["better-sqlite3"]
	};
	const optionalDependencies = {
		"npm-run-all": "^4.1.5",
		"serve": "^14.0.0"
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
			"start": "run-p start:server start:client",
			"start:server": "node start-server.js",
			"start:client": "node start-client.js",
			"postinstall": "echo 'Touch Monorepo deployed successfully!'"
		},
		dependencies: productionDependencies,
		optionalDependencies
	};
	const buildPackageJsonPath = join(buildWorkspace, "package.json");
	await writeFile(buildPackageJsonPath, JSON.stringify(minimalPackageJson, null, 2), "utf8");
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
		execSync("npm install --production --no-optional --no-audit --no-fund", {
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
	const { workspaceRoot } = config;
	const tempDir = resolve(workspaceRoot, config.paths.temp);
	if (workspaceRoot.includes(config.paths.temp)) throw new Error("Safety check failed: Cannot isolate workspace from within temp directory");
	await mkdir(tempDir, { recursive: true });
	const pnpmLockPath = join(workspaceRoot, "pnpm-lock.yaml");
	const pnpmWorkspacePath = join(workspaceRoot, "pnpm-workspace.yaml");
	const isolationDir = join(tempDir, "workspace-isolation");
	await mkdir(isolationDir, { recursive: true });
	if (existsSync(pnpmLockPath)) {
		console.log("🔐 Moving pnpm-lock.yaml to isolation...");
		await copyFile(pnpmLockPath, join(isolationDir, "pnpm-lock.yaml"));
	}
	if (existsSync(pnpmWorkspacePath)) {
		console.log("🏢 Moving pnpm-workspace.yaml to isolation...");
		await copyFile(pnpmWorkspacePath, join(isolationDir, "pnpm-workspace.yaml"));
	}
	console.log("✅ Optimized workspace isolation completed");
	console.log("   ⚡ No massive file copying required!");
	console.log("   ⚡ Build will be dramatically faster!");
}
/**
* Restore workspace after deployment
*/
async function optimizedRestoreWorkspace(config) {
	const { workspaceRoot } = config;
	const tempDir = resolve(workspaceRoot, config.paths.temp);
	const isolationDir = join(tempDir, "workspace-isolation");
	console.log("🔓 Restoring workspace from optimized isolation...");
	if (!existsSync(isolationDir)) {
		console.log("ℹ️  No isolation directory found, nothing to restore");
		return;
	}
	if (existsSync(join(isolationDir, "pnpm-lock.yaml"))) {
		await copyFile(join(isolationDir, "pnpm-lock.yaml"), join(workspaceRoot, "pnpm-lock.yaml"));
		console.log("✅ pnpm-lock.yaml restored");
	}
	if (existsSync(join(isolationDir, "pnpm-workspace.yaml"))) {
		await copyFile(join(isolationDir, "pnpm-workspace.yaml"), join(workspaceRoot, "pnpm-workspace.yaml"));
		console.log("✅ pnpm-workspace.yaml restored");
	}
	console.log("✅ Optimized workspace restoration completed");
}
/**
* Copy only source files (not node_modules) to build workspace
* This is much faster than the old approach
*/
async function copyOptimizedSources(config, buildWorkspace) {
	const { workspaceRoot } = config;
	for (const dir of [
		"apps/client",
		"apps/server",
		"packages/core",
		"packages/i18n"
	]) {
		const srcDir = join(workspaceRoot, dir);
		const destDir = join(buildWorkspace, dir);
		if (existsSync(srcDir)) {
			console.log(`  📁 Copying ${dir}...`);
			await cp(srcDir, destDir, { recursive: true });
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
		const srcFile = join(workspaceRoot, file);
		const destFile = join(buildWorkspace, file);
		if (existsSync(srcFile)) {
			await copyFile(srcFile, destFile);
			console.log(`  📄 ${file} copied`);
		}
	}
	console.log("✅ Source files copied successfully");
}
//#endregion
//#region src/build-deployment/utils/template.utils.ts
function getTemplateDir() {
	try {
		const packageJsonPath = createRequire(import.meta.url).resolve("@finografic/project-scripts/package.json");
		const packageRoot = dirname(packageJsonPath);
		const possiblePaths = [
			join(packageRoot, "src", "build-deployment", "templates"),
			join(packageRoot, "bin", "build-deployment", "templates"),
			join(packageRoot, "dist", "build-deployment", "templates"),
			join(packageRoot, "templates")
		];
		for (const templatePath of possiblePaths) if (existsSync(join(templatePath, "setup", "macos.template.sh"))) return templatePath;
		const currentDir = dirname(fileURLToPath(import.meta.url));
		const fallbackPaths = [
			join(currentDir, "..", "src", "build-deployment", "templates"),
			join(currentDir, "..", "bin", "build-deployment", "templates"),
			join(currentDir, "..", "templates")
		];
		for (const templatePath of fallbackPaths) if (existsSync(join(templatePath, "setup", "macos.template.sh"))) return templatePath;
		return possiblePaths[0];
	} catch {
		const currentDir = dirname(fileURLToPath(import.meta.url));
		const fallbackPaths = [
			join(currentDir, "..", "src", "build-deployment", "templates"),
			join(currentDir, "..", "bin", "build-deployment", "templates"),
			join(currentDir, "..", "templates")
		];
		for (const templatePath of fallbackPaths) if (existsSync(join(templatePath, "setup", "macos.template.sh"))) return templatePath;
		return fallbackPaths[0];
	}
}
const TEMPLATE_DIR = getTemplateDir();
async function loadTemplateFile(templatePath) {
	const fullPath = join(TEMPLATE_DIR, templatePath);
	return readFile(fullPath, "utf-8");
}
/**
* Process a template with variables
*/
async function loadTemplate(templatePath, variables) {
	return (await loadTemplateFile(templatePath)).replace(/\{\{([^}]+)\}\}/g, (_, key) => {
		const value = variables[key.trim()];
		return value !== void 0 ? String(value) : "";
	});
}
/**
* Load platform-specific setup script template
*/
async function loadSetupTemplate(platform, variables) {
	const templateFile = {
		windows: "setup/windows.template.bat",
		linux: "setup/linux.template.sh",
		macos: "setup/macos.template.sh"
	}[platform];
	return loadTemplate(templateFile, variables);
}
/**
* Load user guide template in specified language
*/
async function loadUserGuideTemplate(language, variables) {
	return loadTemplate(`user-guide.${language}.template.md`, variables);
}
/**
* Format a date for the specified locale
*/
function formatDate(locale) {
	return (/* @__PURE__ */ new Date()).toLocaleDateString(locale, {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	});
}
//#endregion
//#region src/build-deployment/config/default.config.ts
const __filename = fileURLToPath(import.meta.url);
dirname(__filename);
const defaultConfig = {
	appName: "Touch Monorepo",
	appDescription: "Touch Monorepo Production Distribution",
	version: "1.0.0",
	workspaceRoot: findProjectRoot(),
	packageNames: {
		client: "@workspace/client",
		server: "@workspace/server"
	},
	paths: {
		client: "apps/client",
		server: "apps/server",
		data: "data",
		output: "deployment",
		temp: ".temp",
		deployments: "deployments"
	},
	ports: {
		client: 3e3,
		server: 4040
	},
	buildCommands: {
		client: "build:production",
		server: "build:production"
	},
	env: { production: {
		NODE_ENV: "production",
		API_PROTOCOL: "http",
		API_HOST: "localhost",
		API_PORT: "4040",
		API_BASE_PATH: "/api",
		API_URL: "http://localhost:4040/api",
		CLIENT_PROTOCOL: "http",
		CLIENT_HOST: "localhost",
		CLIENT_PORT: "3000",
		CLIENT_ORIGIN: "http://localhost:3000",
		VITE_APP_NAME: "Touch Monorepo",
		DB_DIALECT: "sqlite",
		DB_HOST: "localhost",
		DB_USER: "admin",
		DB_PORT: "0",
		DATABASE_URL: "./dist/data/db/production.sqlite.db",
		DB_NAME: "production.sqlite.db",
		UPLOAD_DIR: "./dist/data/uploads",
		DATA_DIR: "./dist/data",
		LOGS_DIR: "./dist/data/logs",
		UPLOADS_DIR: "./dist/data/uploads",
		PINO_DISABLE_WORKER_THREADS: "true",
		PINO_LOG_LEVEL: "info"
	} },
	database: {
		type: "sqlite",
		development: "development.sqlite.db",
		production: "production.sqlite.db"
	},
	options: {
		includeNode: false,
		standalone: false,
		zip: true
	}
};
//#endregion
//#region src/build-deployment/platforms.config.ts
function getHostPlatform() {
	switch (platform()) {
		case "win32": return "windows";
		case "linux": return "linux";
		case "darwin": return "macos";
		default: return "universal";
	}
}
function getHostArch() {
	switch (arch()) {
		case "x64":
		case "x86_64": return "x64";
		case "arm64":
		case "aarch64": return "arm64";
		default: return "x64";
	}
}
const hostPlatform = getHostPlatform();
const hostArch = getHostArch();
const platformConfigs = [
	{
		name: `🍎 macOS (${hostArch}) - Recommended`,
		value: "macos",
		description: "macOS deployment with setup script and user guide",
		platform: "macos",
		arch: hostArch,
		zip: true,
		checked: hostPlatform === "macos"
	},
	{
		name: `🐧 Linux (${hostArch}) - Server Ready`,
		value: "linux",
		description: "Linux deployment with automatic package manager detection",
		platform: "linux",
		arch: hostArch,
		zip: true,
		checked: hostPlatform === "linux"
	},
	{
		name: "🪟 Windows (x64) - User Friendly",
		value: "windows",
		description: "Windows deployment with automatic Node.js installation",
		platform: "windows",
		arch: "x64",
		zip: true,
		checked: hostPlatform === "windows"
	},
	{
		name: "🌍 Universal (Cross-Platform) - Maximum Compatibility",
		value: "universal",
		description: "Universal deployment that works on any platform",
		platform: "universal",
		arch: "universal",
		zip: true,
		checked: false
	},
	{
		name: "📦 Standalone (Minimal) - Quick Deploy",
		value: "standalone",
		description: "Minimal standalone package without platform-specific scripts",
		platform: "universal",
		arch: "universal",
		standalone: true,
		zip: true,
		checked: false
	}
];
const deploymentOptions = [{
	name: "Create ZIP archive",
	value: "zip",
	checked: true
}, {
	name: "Include Node.js runtime (experimental)",
	value: "includeNode",
	checked: false
}];
const getDefaultPlatform = () => {
	return platformConfigs.find((config) => config.checked)?.value || "macos";
};
console.log(`🖥️  Host system detected: ${hostPlatform} (${hostArch})`);
//#endregion
//#region src/build-deployment/build-deployment.ts
/**
* Generate and deploy the build agent script
*/
async function generateAndDeployBuildAgent(config, _options) {
	console.log(pc.blue("🤖 Generating Deployment Agent..."));
	const buildAgentScript = `#!/usr/bin/env node

import { join, resolve } from "path";
import { execSync } from "child_process";
import { mkdir, rm, copyFile, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

// Build Agent - Running from within isolated environment

// Helper function to create production package.json
async function createProductionPackageJson(workspaceRoot, buildWorkspace) {
  console.log("📦 Creating minimal production package.json...");

  // Read the original root package.json
  const rootPackageJsonPath = join(workspaceRoot, "package.json");
  const rootPackageJson = JSON.parse(await readFile(rootPackageJsonPath, "utf8"));

  // Read server package.json for production dependencies
  const serverPackageJsonPath = join(workspaceRoot, "apps/server/package.json");
  const serverPackageJson = JSON.parse(await readFile(serverPackageJsonPath, "utf8"));

  // Extract only production dependencies from server
  const productionDependencies = {
    // Runtime dependencies from server
    ...serverPackageJson.dependencies,
    // Essential build tools that are needed for production
    "cross-env": rootPackageJson.devDependencies["cross-env"],
    "tsx": rootPackageJson.devDependencies["tsx"],
    "better-sqlite3": rootPackageJson.devDependencies["better-sqlite3"],
  };

  // Define optional dependencies for the deployment
  const optionalDependencies = {
    "npm-run-all": "^4.1.5",
    "serve": "^14.0.0"
  };

  // Remove all workspace dependencies as they'll be built locally
  delete productionDependencies["@workspace/core"];
  delete productionDependencies["@workspace/i18n"];
  delete productionDependencies["@workspace/server"];
  delete productionDependencies["@workspace/scripts"];

  // Filter out any remaining workspace: dependencies
  Object.keys(productionDependencies).forEach(key => {
    if (productionDependencies[key] && productionDependencies[key].includes('workspace:')) {
      delete productionDependencies[key];
      console.log("  🧹 Removed workspace dependency: " + key);
    }
  });

  // Create minimal package.json for deployment
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

  // Write the minimal package.json
  const packageJsonPath = join(buildWorkspace, "package.json");
  await writeFile(packageJsonPath, JSON.stringify(minimalPackageJson, null, 2));
  console.log("  ✅ Production package.json created");

  return minimalPackageJson;
}

async function executeBuild() {
  console.log("🤖 Deployment Agent executing from isolation...");

  const workspaceRoot = "${config.workspaceRoot}";
  const tempDir = resolve(workspaceRoot, "${config.paths.temp}");
  const buildWorkspace = join(tempDir, "deployment");

  try {
    // Create directory structure
    console.log("🏗️  Creating build workspace structure...");
    await mkdir(join(buildWorkspace, "dist"), { recursive: true });
    await mkdir(join(buildWorkspace, "apps"), { recursive: true });
    await mkdir(join(buildWorkspace, "packages"), { recursive: true });
    await mkdir(join(buildWorkspace, "config"), { recursive: true });

    // Copy essential configuration files
    console.log("📋 Copying essential configuration files...");
    const configFiles = [
      ".env",
      ".env.local",
      ".env.production",
      ".env.shared.ts",
      "env.example",
      "drizzle.config.ts",
      "tsconfig.json",
      "vite.config.ts",
      "tailwind.config.js",
      "postcss.config.js"
    ];

    for (const file of configFiles) {
      const srcFile = join(workspaceRoot, file);
      const destFile = join(buildWorkspace, file);

      if (existsSync(srcFile)) {
        await copyFile(srcFile, destFile);
        console.log("  📄 " + file + " copied");
      }
    }

    // Copy any other config directories
    const configDirs = ["config", "deployment/config"];
    for (const dir of configDirs) {
      const srcDir = join(workspaceRoot, dir);
      const destDir = join(buildWorkspace, dir);

      if (existsSync(srcDir)) {
        console.log("📁 Copying " + dir + " configuration...");
        execSync("mkdir -p \\"" + join(buildWorkspace, dir) + "\\" && cp -r \\"" + srcDir + "\\"/* \\"" + destDir + "\\"", { stdio: "inherit" });
        console.log("  ✅ " + dir + " copied");
      }
    }

    // Copy source code directories (needed for builds)
    const sourceDirs = ["apps/client", "apps/server", "packages"];

    for (const dir of sourceDirs) {
      const srcDir = join(workspaceRoot, dir);
      const destDir = join(buildWorkspace, dir);

      if (existsSync(srcDir)) {
        console.log("📁 Copying " + dir + " to build workspace...");
        execSync("mkdir -p \\"" + join(buildWorkspace, dir.split('/')[0]) + "\\" && cp -r \\"" + srcDir + "\\" \\"" + destDir + "\\"", { stdio: "inherit" });
        console.log("  ✅ " + dir + " copied");
      }
    }

    // Copy existing build artifacts if they exist
    console.log("📦 Copying existing build artifacts...");
    const distDirs = ["apps/client/dist", "apps/server/dist"];

    for (const distDir of distDirs) {
      const srcDist = join(workspaceRoot, distDir);
      const destDist = join(buildWorkspace, distDir);

      if (existsSync(srcDist)) {
        console.log("  📁 Copying " + distDir + "...");
        execSync("mkdir -p \\"" + join(buildWorkspace, distDir.split('/').slice(0, -1).join('/')) + "\\" && cp -r \\"" + srcDist + "\\" \\"" + destDist + "\\"", { stdio: "inherit" });
        console.log("    ✅ " + distDir + " copied");
      }
    }

    // Create minimal package.json for production deployment
    console.log("📋 Creating production-ready package.json...");
    const productionPackageJson = await createProductionPackageJson(workspaceRoot, buildWorkspace);

    // Install dependencies with dotenvx for GitHub token
    console.log("📦 Installing production dependencies with dotenvx...");
    console.log("  Using .env configuration for GitHub registry...");

    // Use dotenvx run to ensure environment variables are loaded
    // Start with legacy peer deps to handle version conflicts gracefully
    try {
      console.log("  🔧 Attempting with --legacy-peer-deps...");
      execSync("dotenvx run -- npm install --production --legacy-peer-deps", {
        cwd: buildWorkspace,
        stdio: "inherit"
      });
    } catch (error) {
      console.log("⚠️  Legacy peer deps failed, trying with force flag...");
      try {
        execSync("dotenvx run -- npm install --production --force", {
          cwd: buildWorkspace,
          stdio: "inherit"
        });
      } catch (forceError) {
        console.log("⚠️  Force install failed, trying with both flags...");
        execSync("dotenvx run -- npm install --production --force --legacy-peer-deps", {
          cwd: buildWorkspace,
          stdio: "inherit"
        });
      }
    }

    // Build applications (only if dist artifacts don't exist)
    console.log("🏗️  Checking for existing build artifacts...");

    const clientDistExists = existsSync(join(buildWorkspace, "apps/client/dist"));
    const serverDistExists = existsSync(join(buildWorkspace, "apps/server/dist"));

    if (clientDistExists && serverDistExists) {
      console.log("  ✅ Found existing build artifacts - skipping build step");
      console.log("  📁 Client dist: " + join(buildWorkspace, "apps/client/dist"));
      console.log("  📁 Server dist: " + join(buildWorkspace, "apps/server/dist"));
    } else {
      console.log("  ⚠️  Missing build artifacts - attempting to build...");

      if (!clientDistExists) {
        console.log("  📱 Building client app...");
        try {
          execSync("npm run build", {
            cwd: join(buildWorkspace, "apps/client"),
            stdio: "inherit"
          });
          console.log("  ✅ Client build completed");
        } catch (error) {
          console.log("  ⚠️  Client build failed - proceeding without client dist");
        }
      }

      if (!serverDistExists) {
        console.log("  🖥️  Building server app...");
        try {
          execSync("npm run build:production", {
            cwd: join(buildWorkspace, "apps/server"),
            stdio: "inherit"
          });
          console.log("  ✅ Server build completed");
        } catch (error) {
          console.log("  ⚠️  Server build failed - proceeding without server dist");
        }
      }
    }

    console.log("✅ Build agent completed successfully!");

    // Self-destruct after completion
    console.log("🧹 Cleaning up build agent...");
    process.exit(0);

  } catch (error) {
    console.error("❌ Build agent failed:", error);
    process.exit(1);
  }
}

executeBuild();
`;
	const tempDir = resolve(config.workspaceRoot, config.paths.temp);
	const agentScriptPath = join(tempDir, "build-agent.js");
	await writeExecutableFile(agentScriptPath, buildAgentScript, true);
	console.log(pc.green("✅ Deployment Agent generated and deployed!"));
	console.log(pc.blue("🤖 Executing from isolation..."));
	execSync(`node "${agentScriptPath}"`, {
		cwd: tempDir,
		stdio: "inherit"
	});
	await rm(agentScriptPath, { force: true });
}
const autoConfirm = process.argv.includes("-y") || process.argv.includes("--yes");
const emergencyRestore = process.argv.includes("--restore") || process.argv.includes("-r");
async function getInteractiveOptions() {
	console.log(pc.cyan("\n🏗️  Monorepo Deployment Builder"));
	console.log(pc.gray("═".repeat(50)));
	if (autoConfirm) {
		const defaultPlatform = getDefaultPlatform();
		const defaultPlatformConfig = platformConfigs.find((config) => config.value === defaultPlatform);
		console.log(pc.yellow(`📦 Auto-confirm mode: Using ${defaultPlatformConfig?.name || "macOS"}`));
		return {
			platform: defaultPlatformConfig?.platform || "macos",
			arch: defaultPlatformConfig?.arch || "x64",
			standalone: defaultPlatformConfig?.standalone || false,
			zip: true
		};
	}
	const selectedPlatform = await select({
		message: pc.bold("🎯 Select deployment platform:"),
		options: platformConfigs.map((config) => ({
			label: config.name,
			value: config.value,
			hint: config.description
		})),
		initialValue: getDefaultPlatform()
	});
	if (isCancel(selectedPlatform)) {
		cancel("Operation cancelled");
		process.exit(0);
	}
	const platformConfig = platformConfigs.find((config) => config.value === selectedPlatform);
	if (!platformConfig) throw new Error(`Invalid platform selection: ${selectedPlatform}`);
	const additionalOptions = await multiselect({
		message: pc.bold("⚙️  Select additional options:"),
		options: deploymentOptions.map((option) => ({
			label: option.name,
			value: option.value
		})),
		initialValues: deploymentOptions.filter((option) => option.checked).map((option) => option.value),
		required: false
	});
	if (isCancel(additionalOptions)) {
		cancel("Operation cancelled");
		process.exit(0);
	}
	const shouldProceed = await confirm({
		message: pc.bold(`🚀 Build ${platformConfig.name}?`),
		initialValue: true
	});
	if (isCancel(shouldProceed)) {
		cancel("Operation cancelled");
		process.exit(0);
	}
	if (!shouldProceed) {
		console.log(pc.yellow("📦 Build cancelled by user"));
		process.exit(0);
	}
	return {
		platform: platformConfig.platform,
		arch: platformConfig.arch,
		standalone: platformConfig.standalone || false,
		zip: platformConfig.zip || additionalOptions.includes("zip"),
		includeNode: additionalOptions.includes("includeNode")
	};
}
function parseArguments() {
	const args = process.argv.slice(2);
	const options = {};
	for (let i = 0; i < args.length; i++) switch (args[i]) {
		case "--platform":
		case "-p":
			options.platform = args[++i];
			break;
		case "--arch":
		case "-a":
			options.arch = args[++i];
			break;
		case "--include-node":
		case "-n":
			options.includeNode = true;
			break;
		case "--standalone":
		case "-s":
			options.standalone = true;
			break;
		case "--zip":
		case "-z":
			options.zip = true;
			break;
		case "--output-dir":
		case "-o":
			options.outputDir = args[++i];
			break;
		case "--restore":
		case "-r": break;
		case "--help":
		case "-h":
			console.log(pc.cyan(`
🏗️  Monorepo Deployment Builder

Usage: pnpm build:deployment [options]

Interactive Mode (Recommended):
  pnpm build:deployment           Interactive platform selection
  pnpm build:deployment -y        Auto-confirm with host platform

Legacy CLI Mode:
  --platform, -p <platform>      Target platform (windows|linux|macos|universal)
  --arch, -a <arch>              Target architecture (x64|arm64|universal)
  --include-node, -n             Include Node.js runtime
  --standalone, -s               Create standalone package
  --zip, -z                      Create zip archive
  --output-dir, -o <dir>         Output directory for zip
  --yes, -y                      Auto-confirm with defaults
  --restore, -r                  Emergency workspace restoration
  --help, -h                     Show this help

Examples:
  pnpm build:deployment                    # Interactive mode
  pnpm build:deployment -y                 # Quick build with host platform
  pnpm build:deployment -p macos -z        # Legacy: macOS with zip
  pnpm build:deployment --restore          # Emergency workspace restoration
        `));
			process.exit(0);
	}
	return options;
}
async function createPlatformFiles(config, options) {
	const platform = options.platform || "universal";
	const isWindows = platform === "windows" || platform === "universal";
	const isLinux = platform === "linux" || platform === "universal";
	const isMacOS = platform === "macos" || platform === "universal";
	const vars = {
		APP_NAME: config.appName,
		CLIENT_PORT: config.ports.client,
		SERVER_PORT: config.ports.server,
		GENERATED_DATE: formatDate("en-US"),
		GENERATED_DATE_ES: formatDate("es-ES")
	};
	const buildWorkspace = resolve(config.workspaceRoot, config.paths.temp, "deployment");
	if (isWindows) {
		const script = await loadSetupTemplate("windows", vars);
		await writeExecutableFile(join(buildWorkspace, "setup.bat"), script);
	}
	if (isLinux) {
		const script = await loadSetupTemplate("linux", vars);
		await writeExecutableFile(join(buildWorkspace, "setup.sh"), script, true);
	}
	if (isMacOS) {
		const script = await loadSetupTemplate("macos", vars);
		await writeExecutableFile(join(buildWorkspace, "setup-macos.sh"), script, true);
	}
	const startClient = await loadTemplate("start-client.js.template", vars);
	const startServer = await loadTemplate("start-server.js.template", vars);
	await writeExecutableFile(join(buildWorkspace, "start-client.js"), startClient, true);
	await writeExecutableFile(join(buildWorkspace, "start-server.js"), startServer, true);
	const portsUtils = await loadTemplate("ports.utils.js.template", vars);
	await writeExecutableFile(join(buildWorkspace, "ports.utils.js"), portsUtils, true);
	const clientServer = await loadTemplate("client-server.js.template", vars);
	await writeExecutableFile(join(buildWorkspace, "dist", "client", "server.js"), clientServer, true);
	const platformSuffix = platform === "universal" ? "UNIVERSAL" : platform.toUpperCase();
	const enGuide = await loadUserGuideTemplate("en", vars);
	const esGuide = await loadUserGuideTemplate("es", vars);
	await writeExecutableFile(join(buildWorkspace, `USER_GUIDE_${platformSuffix}_EN.md`), enGuide);
	await writeExecutableFile(join(buildWorkspace, `GUIA_USUARIO_${platformSuffix}_ES.md`), esGuide);
}
async function main() {
	if (emergencyRestore) {
		console.log(pc.red("🚨 Emergency workspace restoration mode"));
		console.log(pc.gray("═".repeat(60)));
		try {
			await emergencyRestoreWorkspace(defaultConfig.workspaceRoot);
			console.log(pc.green("✅ Emergency restoration completed"));
			process.exit(0);
		} catch (error) {
			console.error(pc.red("❌ Emergency restoration failed:"), error);
			process.exit(1);
		}
	}
	let options = parseArguments();
	if (!process.argv.slice(2).some((arg) => arg.startsWith("--platform") || arg.startsWith("-p") || arg.startsWith("--arch") || arg.startsWith("-a") || arg.startsWith("--standalone") || arg.startsWith("-s") || arg.startsWith("--zip") || arg.startsWith("-z") || arg.startsWith("--include-node") || arg.startsWith("-n"))) options = await getInteractiveOptions();
	else if (options.platform && !options.arch) {
		const platformConfig = platformConfigs.find((config) => config.platform === options.platform);
		if (platformConfig) {
			options.arch = platformConfig.arch;
			options.standalone = platformConfig.standalone || false;
			options.zip = options.zip || platformConfig.zip || false;
		}
	}
	console.log(pc.cyan("\n🏗️  Building Monorepo Deployment"));
	console.log(pc.gray("═".repeat(60)));
	console.log(`${pc.bold("Platform:")} ${options.platform || "universal"}`);
	console.log(`${pc.bold("Architecture:")} ${options.arch || "universal"}`);
	console.log(`${pc.bold("Standalone:")} ${options.standalone ? "Yes" : "No"}`);
	console.log(`${pc.bold("Include Node:")} ${options.includeNode ? "Yes" : "No"}`);
	console.log(`${pc.bold("Create Zip:")} ${options.zip ? "Yes" : "No"}`);
	console.log(`${pc.bold("Workspace Root:")} ${defaultConfig.workspaceRoot}`);
	console.log(`${pc.bold("Build Workspace:")} ${resolve(defaultConfig.workspaceRoot, defaultConfig.paths.temp)}`);
	console.log(`${pc.bold("Zip Destination:")} ${resolve(defaultConfig.workspaceRoot, defaultConfig.paths.deployments)}`);
	console.log(pc.gray("═".repeat(60)));
	try {
		killPortIfOccupied(defaultConfig.ports.client);
		killPortIfOccupied(defaultConfig.ports.server);
		console.log(pc.blue("🚀 Starting optimized workspace isolation..."));
		await optimizedIsolateWorkspace(defaultConfig);
		if (!await canProceedWithBuild(defaultConfig)) {
			console.log(pc.yellow("⚠️  Safety check failed - deploying build agent instead..."));
			console.log(pc.blue("🤖 Transitioning to agent mode..."));
			await generateAndDeployBuildAgent(defaultConfig, options);
			console.log(pc.blue("📋 Creating platform files and deployment package..."));
			console.log(pc.blue("📁 Copying build artifacts to deployment structure..."));
			await copyBuildArtifacts(defaultConfig, "client");
			await copyBuildArtifacts(defaultConfig, "server");
			await copyDataFiles(defaultConfig);
			await createPlatformFiles(defaultConfig, options);
			if (options.zip) {
				console.log(pc.blue("📦 Creating deployment ZIP archive..."));
				await createZipArchive(defaultConfig, options.platform || "macos", options.arch || "arm64");
				console.log(pc.green("✅ ZIP archive created successfully!"));
			}
			console.log(pc.blue("🔓 Restoring workspace from isolation..."));
			await cleanupTempDirectory(defaultConfig);
			await optimizedRestoreWorkspace(defaultConfig);
			console.log(pc.green("🎉 Deployment completed via agent!"));
			return;
		}
		console.log(pc.green("🔒 Workspace isolation complete - safe to proceed with build"));
		console.log(pc.gray("   - pnpm workspace files moved to isolation"));
		console.log(pc.gray("   - node_modules moved to isolation"));
		console.log(pc.gray("   - backup created for safety"));
		console.log(pc.gray("═".repeat(60)));
		await cleanPlatformArtifacts(defaultConfig);
		await createDirectoryStructure(defaultConfig);
		const buildWorkspace = join(defaultConfig.workspaceRoot, defaultConfig.paths.temp, "deployment");
		await createMinimalPackageJson(defaultConfig, buildWorkspace);
		await installProductionDependencies(buildWorkspace);
		console.log("📁 Copying source files to build workspace...");
		await copyOptimizedSources(defaultConfig, buildWorkspace);
		await buildApp(defaultConfig, "client");
		await buildApp(defaultConfig, "server");
		await copyBuildArtifacts(defaultConfig, "client");
		await copyBuildArtifacts(defaultConfig, "server");
		await copyDataFiles(defaultConfig);
		await createPlatformFiles(defaultConfig, options);
		if (options.standalone) await createStandalonePackage(defaultConfig, options.platform || "universal");
		else {
			await createPackageJson(defaultConfig, join(defaultConfig.workspaceRoot, defaultConfig.paths.server, "package.json"));
			await installDependencies(defaultConfig);
		}
		if (options.zip) {
			const zipName = await createZipArchive(defaultConfig, options.platform || "universal", options.arch || "universal");
			console.log("📦 Zip archive created:", zipName);
			console.log(`📁 Saved to: ${resolve(defaultConfig.workspaceRoot, defaultConfig.paths.deployments)}`);
		}
		console.log(pc.blue("🔓 Restoring workspace from isolation..."));
		await cleanupTempDirectory(defaultConfig);
		await optimizedRestoreWorkspace(defaultConfig);
		console.log("");
		console.log("🎉 Deployment build completed successfully!");
		console.log("📦 Deployment created and zipped from isolated build workspace");
		console.log("🔒 Workspace restored to original state");
		console.log("");
		console.log("🚀 Next steps:");
		console.log("  1. Extract the deployment zip file from deployments/ folder");
		console.log("  2. Run the setup script for your platform:");
		if (options.platform === "windows" || options.platform === "universal") console.log("     Windows: Double-click setup.bat");
		if (options.platform === "linux" || options.platform === "universal") console.log("     Linux: ./setup.sh");
		if (options.platform === "macos" || options.platform === "universal") console.log("     macOS: ./setup-macos.sh");
		console.log("  3. Start the application with the provided scripts");
		console.log("");
	} catch (error) {
		console.error("❌ Deployment build failed:", error);
		try {
			await cleanupTempDirectory(defaultConfig);
		} catch (cleanupError) {
			console.error("⚠️  Failed to cleanup .temp build directory:", cleanupError);
		}
		process.exit(1);
	}
}
//#endregion
//#region src/build-deployment/cli.ts
main().catch((error) => {
	console.error("Failed to run build-deployment:", error);
	process.exit(1);
});
//#endregion
export {};
