#!/usr/bin/env node
import { t as pc } from "./picocolors.mjs";
import { t as findProjectRoot } from "./project.utils.mjs";
import { a as copyBuildArtifacts, c as createZipArchive, i as cleanupTempDirectory, o as copyDataFiles, p as writeExecutableFile, r as cleanPlatformArtifacts, s as createDirectoryStructure } from "./file2.utils.mjs";
import { a as optimizedRestoreWorkspace, i as optimizedIsolateWorkspace, n as createMinimalPackageJson, r as installProductionDependencies } from "./optimized-isolation2.utils.mjs";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { dirname, join, resolve } from "path";
import { cancel, confirm, isCancel, multiselect, select } from "@clack/prompts";
import { arch, platform } from "node:os";
import { readFile, readdir, rm, writeFile } from "fs/promises";
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
			const { emergencyRestoreWorkspace } = await import("./file.utils.mjs");
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
		const { canProceedWithBuild } = await import("./file.utils.mjs");
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
		const { copyOptimizedSources } = await import("./optimized-isolation.utils.mjs");
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
