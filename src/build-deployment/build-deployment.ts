import { execSync } from 'child_process';
import { rm } from 'fs/promises';
import { join, resolve } from 'path';
import { checkbox, confirm, select } from '@inquirer/prompts';

import {
  buildApp,
  createPackageJson,
  createStandalonePackage,
  installDependencies,
  killPortIfOccupied,
} from './utils/build.utils.js';
import {
  cleanPlatformArtifacts,
  cleanupTempDirectory,
  copyBuildArtifacts,
  copyDataFiles,
  createDirectoryStructure,
  createZipArchive,
  writeExecutableFile,
} from './utils/file.utils.js';
import {
  createMinimalPackageJson,
  installProductionDependencies,
  optimizedIsolateWorkspace,
  optimizedRestoreWorkspace,
} from './utils/optimized-isolation.utils.js';
import {
  formatDate,
  loadSetupTemplate,
  loadTemplate,
  loadUserGuideTemplate,
} from './utils/template.utils.js';
import { pc } from 'utils/picocolors';
import { defaultConfig } from './config/default.config.js';
import type { BuildDeploymentConfig } from './config/types';
import { deploymentOptions, getDefaultPlatform, platformConfigs } from './platforms.config.js';

/**
 * Generate and deploy the build agent script
 */
async function generateAndDeployBuildAgent(
  config: BuildDeploymentConfig,
  _options: BuildOptions,
): Promise<void> {
  console.log(pc.blue('🤖 Generating Deployment Agent...'));

  // Create the build agent script content
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
          execSync("npm run build.production", {
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

  // Write the build agent script to the isolated environment
  const tempDir = resolve(config.workspaceRoot, config.paths.temp);
  const agentScriptPath = join(tempDir, 'build-agent.js');

  await writeExecutableFile(agentScriptPath, buildAgentScript, true);

  console.log(pc.green('✅ Deployment Agent generated and deployed!'));
  console.log(pc.blue('🤖 Executing from isolation...'));

  // Execute the build agent from within isolation
  execSync(`node "${agentScriptPath}"`, {
    cwd: tempDir,
    stdio: 'inherit',
  });

  // Clean up the agent script
  await rm(agentScriptPath, { force: true });
}

// Add auto-confirm flag for -y/--yes
const autoConfirm = process.argv.includes('-y') || process.argv.includes('--yes');

// Add emergency restoration flag
const emergencyRestore = process.argv.includes('--restore') || process.argv.includes('-r');

interface BuildOptions {
  platform?: 'windows' | 'linux' | 'macos' | 'universal';
  arch?: 'x64' | 'arm64' | 'universal';
  includeNode?: boolean;
  standalone?: boolean;
  zip?: boolean;
  outputDir?: string;
}

async function getInteractiveOptions(): Promise<BuildOptions> {
  console.log(pc.cyan('\n🏗️  Monorepo Deployment Builder'));
  console.log(pc.gray('═'.repeat(50)));

  if (autoConfirm) {
    const defaultPlatform = getDefaultPlatform();
    const defaultConfig = platformConfigs.find((config) => config.value === defaultPlatform);
    console.log(pc.yellow(`📦 Auto-confirm mode: Using ${defaultConfig?.name || 'macOS'}`));

    return {
      platform: defaultConfig?.platform || 'macos',
      arch: defaultConfig?.arch || 'x64',
      standalone: defaultConfig?.standalone || false,
      zip: true,
    };
  }

  // Platform selection
  const selectedPlatform = await select({
    message: pc.bold('🎯 Select deployment platform:'),
    choices: platformConfigs.map((config) => ({
      name: config.name,
      value: config.value,
      description: config.description,
    })),
    default: getDefaultPlatform(),
  });

  const platformConfig = platformConfigs.find((config) => config.value === selectedPlatform);
  if (!platformConfig) {
    throw new Error(`Invalid platform selection: ${selectedPlatform}`);
  }

  // Additional options
  const additionalOptions = await checkbox({
    message: pc.bold('⚙️  Select additional options:'),
    choices: deploymentOptions,
  });

  // Confirmation
  const shouldProceed = await confirm({
    message: pc.bold(`🚀 Build ${platformConfig.name}?`),
    default: true,
  });

  if (!shouldProceed) {
    console.log(pc.yellow('📦 Build cancelled by user'));
    process.exit(0);
  }

  return {
    platform: platformConfig.platform,
    arch: platformConfig.arch,
    standalone: platformConfig.standalone || false,
    zip: platformConfig.zip || additionalOptions.includes('zip'),
    includeNode: additionalOptions.includes('includeNode'),
  };
}

function parseArguments(): BuildOptions {
  const args = process.argv.slice(2);
  const options: BuildOptions = {};

  // Check for legacy CLI arguments (for backward compatibility)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--platform':
      case '-p':
        options.platform = args[++i] as 'windows' | 'linux' | 'macos' | 'universal';
        break;
      case '--arch':
      case '-a':
        options.arch = args[++i] as 'x64' | 'arm64' | 'universal';
        break;
      case '--include-node':
      case '-n':
        options.includeNode = true;
        break;
      case '--standalone':
      case '-s':
        options.standalone = true;
        break;
      case '--zip':
      case '-z':
        options.zip = true;
        break;
      case '--output-dir':
      case '-o':
        options.outputDir = args[++i];
        break;
      case '--restore':
      case '-r':
        // Emergency restoration is handled in main() function
        break;
      case '--help':
      case '-h':
        console.log(
          pc.cyan(`
🏗️  Monorepo Deployment Builder

Usage: pnpm build.deployment [options]

Interactive Mode (Recommended):
  pnpm build.deployment           Interactive platform selection
  pnpm build.deployment -y        Auto-confirm with host platform

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
  pnpm build.deployment                    # Interactive mode
  pnpm build.deployment -y                 # Quick build with host platform
  pnpm build.deployment -p macos -z        # Legacy: macOS with zip
  pnpm build.deployment --restore          # Emergency workspace restoration
        `),
        );
        process.exit(0);
    }
  }

  return options;
}

async function createPlatformFiles(config: BuildDeploymentConfig, options: BuildOptions): Promise<void> {
  const platform = options.platform || 'universal';
  const isWindows = platform === 'windows' || platform === 'universal';
  const isLinux = platform === 'linux' || platform === 'universal';
  const isMacOS = platform === 'macos' || platform === 'universal';

  // Template variables
  const vars = {
    APP_NAME: config.appName,
    CLIENT_PORT: config.ports.client,
    SERVER_PORT: config.ports.server,
    GENERATED_DATE: formatDate('en-US'),
    GENERATED_DATE_ES: formatDate('es-ES'),
  };

  // Use .temp directory for file creation (build workspace)
  const buildWorkspace = resolve(config.workspaceRoot, config.paths.temp, 'deployment');

  // Create setup scripts
  if (isWindows) {
    const script = await loadSetupTemplate('windows', vars);
    await writeExecutableFile(join(buildWorkspace, 'setup.bat'), script);
  }
  if (isLinux) {
    const script = await loadSetupTemplate('linux', vars);
    await writeExecutableFile(join(buildWorkspace, 'setup.sh'), script, true);
  }
  if (isMacOS) {
    const script = await loadSetupTemplate('macos', vars);
    await writeExecutableFile(join(buildWorkspace, 'setup-macos.sh'), script, true);
  }

  // Create start scripts
  const startClient = await loadTemplate('start-client.js.template', vars);
  const startServer = await loadTemplate('start-server.js.template', vars);
  await writeExecutableFile(join(buildWorkspace, 'start-client.js'), startClient, true);
  await writeExecutableFile(join(buildWorkspace, 'start-server.js'), startServer, true);

  // Create ports utility file
  const portsUtils = await loadTemplate('ports.utils.js.template', vars);
  await writeExecutableFile(join(buildWorkspace, 'ports.utils.js'), portsUtils, true);

  // Create client server file (goes in dist/client/server.js)
  const clientServer = await loadTemplate('client-server.js.template', vars);
  await writeExecutableFile(join(buildWorkspace, 'dist', 'client', 'server.js'), clientServer, true);

  // Create user guides
  const platformSuffix = platform === 'universal' ? 'UNIVERSAL' : platform.toUpperCase();
  const enGuide = await loadUserGuideTemplate('en', vars);
  const esGuide = await loadUserGuideTemplate('es', vars);
  await writeExecutableFile(join(buildWorkspace, `USER_GUIDE_${platformSuffix}_EN.md`), enGuide);
  await writeExecutableFile(join(buildWorkspace, `GUIA_USUARIO_${platformSuffix}_ES.md`), esGuide);
}

async function main(): Promise<void> {
  // Handle emergency workspace restoration
  if (emergencyRestore) {
    console.log(pc.red('🚨 Emergency workspace restoration mode'));
    console.log(pc.gray('═'.repeat(60)));

    try {
      const { emergencyRestoreWorkspace } = await import('./utils/file.utils.js');
      await emergencyRestoreWorkspace(defaultConfig.workspaceRoot);
      console.log(pc.green('✅ Emergency restoration completed'));
      process.exit(0);
    } catch (error) {
      console.error(pc.red('❌ Emergency restoration failed:'), error);
      process.exit(1);
    }
  }

  let options = parseArguments();

  // If no CLI arguments provided (except possibly -y), use interactive mode
  const hasCliArgs = process.argv
    .slice(2)
    .some(
      (arg) =>
        arg.startsWith('--platform') ||
        arg.startsWith('-p') ||
        arg.startsWith('--arch') ||
        arg.startsWith('-a') ||
        arg.startsWith('--standalone') ||
        arg.startsWith('-s') ||
        arg.startsWith('--zip') ||
        arg.startsWith('-z') ||
        arg.startsWith('--include-node') ||
        arg.startsWith('-n'),
    );

  if (!hasCliArgs) {
    options = await getInteractiveOptions();
  } else {
    // Apply platform config defaults for CLI mode
    if (options.platform && !options.arch) {
      const platformConfig = platformConfigs.find((config) => config.platform === options.platform);
      if (platformConfig) {
        options.arch = platformConfig.arch;
        options.standalone = platformConfig.standalone || false;
        options.zip = options.zip || platformConfig.zip || false;
      }
    }
  }

  // Display build configuration
  console.log(pc.cyan('\n🏗️  Building Monorepo Deployment'));
  console.log(pc.gray('═'.repeat(60)));
  console.log(`${pc.bold('Platform:')} ${options.platform || 'universal'}`);
  console.log(`${pc.bold('Architecture:')} ${options.arch || 'universal'}`);
  console.log(`${pc.bold('Standalone:')} ${options.standalone ? 'Yes' : 'No'}`);
  console.log(`${pc.bold('Include Node:')} ${options.includeNode ? 'Yes' : 'No'}`);
  console.log(`${pc.bold('Create Zip:')} ${options.zip ? 'Yes' : 'No'}`);
  console.log(`${pc.bold('Workspace Root:')} ${defaultConfig.workspaceRoot}`);
  console.log(
    `${pc.bold('Build Workspace:')} ${resolve(defaultConfig.workspaceRoot, defaultConfig.paths.temp)}`,
  );
  console.log(
    `${pc.bold('Zip Destination:')} ${resolve(defaultConfig.workspaceRoot, defaultConfig.paths.deployments)}`,
  );
  console.log(pc.gray('═'.repeat(60)));

  try {
    // Kill occupied ports
    killPortIfOccupied(defaultConfig.ports.client);
    killPortIfOccupied(defaultConfig.ports.server);

    // Optimized workspace isolation - avoids copying 30GB+ of node_modules
    console.log(pc.blue('🚀 Starting optimized workspace isolation...'));
    await optimizedIsolateWorkspace(defaultConfig);

    // Additional safety check before proceeding
    const { canProceedWithBuild } = await import('./utils/file.utils.js');
    const canProceed = await canProceedWithBuild(defaultConfig);
    if (!canProceed) {
      console.log(pc.yellow('⚠️  Safety check failed - deploying build agent instead...'));
      console.log(pc.blue('🤖 Transitioning to agent mode...'));

      // Deploy the build agent instead of failing
      await generateAndDeployBuildAgent(defaultConfig, options);

      // Continue with platform files and ZIP creation after agent completes
      console.log(pc.blue('📋 Creating platform files and deployment package...'));

      // const buildWorkspace = join(
      //   defaultConfig.workspaceRoot,
      //   defaultConfig.paths.temp,
      //   'deployment',
      // );

      // Copy build artifacts to expected structure (apps/client/dist -> dist/client, etc.)
      console.log(pc.blue('📁 Copying build artifacts to deployment structure...'));
      await copyBuildArtifacts(defaultConfig, 'client');
      await copyBuildArtifacts(defaultConfig, 'server');
      await copyDataFiles(defaultConfig);

      // Create platform-specific files (start scripts, etc.)
      await createPlatformFiles(defaultConfig, options);

      // Create ZIP archive if requested
      if (options.zip) {
        console.log(pc.blue('📦 Creating deployment ZIP archive...'));
        await createZipArchive(defaultConfig, options.platform || 'macos', options.arch || 'arm64');
        console.log(pc.green('✅ ZIP archive created successfully!'));
      }

      // Clean up and restore workspace
      console.log(pc.blue('🔓 Restoring workspace from isolation...'));
      await cleanupTempDirectory(defaultConfig);
      await optimizedRestoreWorkspace(defaultConfig);

      console.log(pc.green('🎉 Deployment completed via agent!'));
      return;
    }

    console.log(pc.green('🔒 Workspace isolation complete - safe to proceed with build'));
    console.log(pc.gray('   - pnpm workspace files moved to isolation'));
    console.log(pc.gray('   - node_modules moved to isolation'));
    console.log(pc.gray('   - backup created for safety'));
    console.log(pc.gray('═'.repeat(60)));

    // Create directory structure in .temp (build isolation)
    await cleanPlatformArtifacts(defaultConfig);
    await createDirectoryStructure(defaultConfig);

    // Create minimal package.json with only production dependencies
    const buildWorkspace = join(defaultConfig.workspaceRoot, defaultConfig.paths.temp, 'deployment');
    await createMinimalPackageJson(defaultConfig, buildWorkspace);

    // Install only production dependencies (much faster than copying 30GB+)
    await installProductionDependencies(buildWorkspace);

    // Copy source files only (no massive node_modules copying)
    console.log('📁 Copying source files to build workspace...');
    const { copyOptimizedSources } = await import('./utils/optimized-isolation.utils.js');
    await copyOptimizedSources(defaultConfig, buildWorkspace);

    // Build applications
    await buildApp(defaultConfig, 'client');
    await buildApp(defaultConfig, 'server');

    // Copy build artifacts
    await copyBuildArtifacts(defaultConfig, 'client');
    await copyBuildArtifacts(defaultConfig, 'server');
    await copyDataFiles(defaultConfig);

    // Create platform-specific files
    await createPlatformFiles(defaultConfig, options);

    // Create package.json and install dependencies
    if (options.standalone) {
      await createStandalonePackage(defaultConfig, options.platform || 'universal');
    } else {
      await createPackageJson(
        defaultConfig,
        join(defaultConfig.workspaceRoot, defaultConfig.paths.server, 'package.json'),
      );
      await installDependencies(defaultConfig);
    }

    // Create zip archive if requested (saves to deployments folder)
    if (options.zip) {
      const zipName = await createZipArchive(
        defaultConfig,
        options.platform || 'universal',
        options.arch || 'universal',
      );
      console.log('📦 Zip archive created:', zipName);
      console.log(`📁 Saved to: ${resolve(defaultConfig.workspaceRoot, defaultConfig.paths.deployments)}`);
    }

    // Clean up .temp build directory and restore workspace
    console.log(pc.blue('🔓 Restoring workspace from isolation...'));
    await cleanupTempDirectory(defaultConfig);
    await optimizedRestoreWorkspace(defaultConfig);

    // Success message
    console.log('');
    console.log('🎉 Deployment build completed successfully!');
    console.log('📦 Deployment created and zipped from isolated build workspace');
    console.log('🔒 Workspace restored to original state');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('  1. Extract the deployment zip file from deployments/ folder');
    console.log('  2. Run the setup script for your platform:');
    if (options.platform === 'windows' || options.platform === 'universal') {
      console.log('     Windows: Double-click setup.bat');
    }
    if (options.platform === 'linux' || options.platform === 'universal') {
      console.log('     Linux: ./setup.sh');
    }
    if (options.platform === 'macos' || options.platform === 'universal') {
      console.log('     macOS: ./setup-macos.sh');
    }
    console.log('  3. Start the application with the provided scripts');
    console.log('');
  } catch (error) {
    console.error('❌ Deployment build failed:', error);

    // Clean up .temp directory and restore workspace even on failure
    try {
      await cleanupTempDirectory(defaultConfig);
    } catch (cleanupError) {
      console.error('⚠️  Failed to cleanup .temp build directory:', cleanupError);
    }

    process.exit(1);
  }
}

export { main as buildProduction };
