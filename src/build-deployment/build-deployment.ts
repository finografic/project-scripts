import { join } from "path";
import { select, checkbox, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import {
  platformConfigs,
  deploymentOptions,
  getDefaultPlatform,
  type PlatformConfig,
} from "./platforms.config.js";
import { defaultConfig } from "./config/default.config.js";
import type { BuildDeploymentConfig } from "./config/types";
import {
  createDirectoryStructure,
  copyBuildArtifacts,
  copyDataFiles,
  createZipArchive,
  cleanPlatformArtifacts,
  writeExecutableFile,
} from "./utils/file.utils.js";
import {
  buildApp,
  createPackageJson,
  createStandalonePackage,
  installDependencies,
  killPortIfOccupied,
} from "./utils/build.utils.js";
import {
  loadSetupTemplate,
  loadUserGuideTemplate,
  formatDate,
} from "./utils/template.utils.js";

// Add auto-confirm flag for -y/--yes
const autoConfirm =
  process.argv.includes("-y") || process.argv.includes("--yes");

interface BuildOptions {
  platform?: "windows" | "linux" | "macos" | "universal";
  arch?: "x64" | "arm64" | "universal";
  includeNode?: boolean;
  standalone?: boolean;
  zip?: boolean;
  outputDir?: string;
}

async function getInteractiveOptions(): Promise<BuildOptions> {
  console.log(chalk.cyan("\n🏗️  Monorepo Deployment Builder"));
  console.log(chalk.gray("═".repeat(50)));

  if (autoConfirm) {
    const defaultPlatform = getDefaultPlatform();
    const defaultConfig = platformConfigs.find(
      (config) => config.value === defaultPlatform
    );
    console.log(
      chalk.yellow(
        `📦 Auto-confirm mode: Using ${defaultConfig?.name || "macOS"}`
      )
    );

    return {
      platform: defaultConfig?.platform || "macos",
      arch: defaultConfig?.arch || "x64",
      standalone: defaultConfig?.standalone || false,
      zip: true,
    };
  }

  // Platform selection
  const selectedPlatform = await select({
    message: chalk.bold("🎯 Select deployment platform:"),
    choices: platformConfigs.map((config) => ({
      name: config.name,
      value: config.value,
      description: config.description,
    })),
    default: getDefaultPlatform(),
  });

  const platformConfig = platformConfigs.find(
    (config) => config.value === selectedPlatform
  );
  if (!platformConfig) {
    throw new Error(`Invalid platform selection: ${selectedPlatform}`);
  }

  // Additional options
  const additionalOptions = await checkbox({
    message: chalk.bold("⚙️  Select additional options:"),
    choices: deploymentOptions,
  });

  // Confirmation
  const shouldProceed = await confirm({
    message: chalk.bold(`🚀 Build ${platformConfig.name}?`),
    default: true,
  });

  if (!shouldProceed) {
    console.log(chalk.yellow("📦 Build cancelled by user"));
    process.exit(0);
  }

  return {
    platform: platformConfig.platform,
    arch: platformConfig.arch,
    standalone: platformConfig.standalone || false,
    zip: platformConfig.zip || additionalOptions.includes("zip"),
    includeNode: additionalOptions.includes("includeNode"),
  };
}

function parseArguments(): BuildOptions {
  const args = process.argv.slice(2);
  const options: BuildOptions = {};

  // Check for legacy CLI arguments (for backward compatibility)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--platform":
      case "-p":
        options.platform = args[++i] as
          | "windows"
          | "linux"
          | "macos"
          | "universal";
        break;
      case "--arch":
      case "-a":
        options.arch = args[++i] as "x64" | "arm64" | "universal";
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
      case "--help":
      case "-h":
        console.log(
          chalk.cyan(`
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
  --help, -h                     Show this help

Examples:
  pnpm build.deployment                    # Interactive mode
  pnpm build.deployment -y                 # Quick build with host platform
  pnpm build.deployment -p macos -z        # Legacy: macOS with zip
        `)
        );
        process.exit(0);
    }
  }

  return options;
}

async function createPlatformFiles(
  config: BuildDeploymentConfig,
  options: BuildOptions
): Promise<void> {
  const platform = options.platform || "universal";
  const isWindows = platform === "windows" || platform === "universal";
  const isLinux = platform === "linux" || platform === "universal";
  const isMacOS = platform === "macos" || platform === "universal";

  // Template variables
  const vars = {
    APP_NAME: config.appName,
    CLIENT_PORT: config.ports.client,
    SERVER_PORT: config.ports.server,
    GENERATED_DATE: formatDate("en-US"),
    GENERATED_DATE_ES: formatDate("es-ES"),
  };

  // Create setup scripts
  if (isWindows) {
    const script = await loadSetupTemplate("windows", vars);
    await writeExecutableFile(join(config.paths.output, "setup.bat"), script);
  }
  if (isLinux) {
    const script = await loadSetupTemplate("linux", vars);
    await writeExecutableFile(
      join(config.paths.output, "setup.sh"),
      script,
      true
    );
  }
  if (isMacOS) {
    const script = await loadSetupTemplate("macos", vars);
    await writeExecutableFile(
      join(config.paths.output, "setup-macos.sh"),
      script,
      true
    );
  }

  // Create start scripts
  const startClient = await loadTemplate("start-client.js.template", vars);
  const startServer = await loadTemplate("start-server.js.template", vars);
  await writeExecutableFile(
    join(config.paths.output, "start-client.js"),
    startClient,
    true
  );
  await writeExecutableFile(
    join(config.paths.output, "start-server.js"),
    startServer,
    true
  );

  // Create user guides
  const platformSuffix =
    platform === "universal" ? "UNIVERSAL" : platform.toUpperCase();
  const enGuide = await loadUserGuideTemplate("en", vars);
  const esGuide = await loadUserGuideTemplate("es", vars);
  await writeExecutableFile(
    join(config.paths.output, `USER_GUIDE_${platformSuffix}_EN.md`),
    enGuide
  );
  await writeExecutableFile(
    join(config.paths.output, `GUIA_USUARIO_${platformSuffix}_ES.md`),
    esGuide
  );
}

async function main(): Promise<void> {
  let options = parseArguments();

  // If no CLI arguments provided (except possibly -y), use interactive mode
  const hasCliArgs = process.argv
    .slice(2)
    .some(
      (arg) =>
        arg.startsWith("--platform") ||
        arg.startsWith("-p") ||
        arg.startsWith("--arch") ||
        arg.startsWith("-a") ||
        arg.startsWith("--standalone") ||
        arg.startsWith("-s") ||
        arg.startsWith("--zip") ||
        arg.startsWith("-z") ||
        arg.startsWith("--include-node") ||
        arg.startsWith("-n")
    );

  if (!hasCliArgs) {
    options = await getInteractiveOptions();
  } else {
    // Apply platform config defaults for CLI mode
    if (options.platform && !options.arch) {
      const platformConfig = platformConfigs.find(
        (config) => config.platform === options.platform
      );
      if (platformConfig) {
        options.arch = platformConfig.arch;
        options.standalone = platformConfig.standalone || false;
        options.zip = options.zip || platformConfig.zip || false;
      }
    }
  }

  // Display build configuration
  console.log(chalk.cyan("\n🏗️  Building Monorepo Deployment"));
  console.log(chalk.gray("═".repeat(60)));
  console.log(`${chalk.bold("Platform:")} ${options.platform || "universal"}`);
  console.log(`${chalk.bold("Architecture:")} ${options.arch || "universal"}`);
  console.log(
    `${chalk.bold("Standalone:")} ${options.standalone ? "Yes" : "No"}`
  );
  console.log(
    `${chalk.bold("Include Node:")} ${options.includeNode ? "Yes" : "No"}`
  );
  console.log(`${chalk.bold("Create Zip:")} ${options.zip ? "Yes" : "No"}`);
  console.log(chalk.gray("═".repeat(60)));

  try {
    // Kill occupied ports
    killPortIfOccupied(defaultConfig.ports.client);
    killPortIfOccupied(defaultConfig.ports.server);

    // Create directory structure
    await cleanPlatformArtifacts(defaultConfig);
    await createDirectoryStructure(defaultConfig);

    // Build applications
    await buildApp(defaultConfig, "client");
    await buildApp(defaultConfig, "server");

    // Copy build artifacts
    await copyBuildArtifacts(defaultConfig, "client");
    await copyBuildArtifacts(defaultConfig, "server");
    await copyDataFiles(defaultConfig);

    // Create platform-specific files
    await createPlatformFiles(defaultConfig, options);

    // Create package.json and install dependencies
    if (options.standalone) {
      await createStandalonePackage(
        defaultConfig,
        options.platform || "universal"
      );
    } else {
      await createPackageJson(
        defaultConfig,
        join(defaultConfig.paths.server, "package.json")
      );
      await installDependencies(defaultConfig);
    }

    // Create zip archive if requested
    if (options.zip) {
      const zipName = await createZipArchive(
        defaultConfig,
        options.platform || "universal",
        options.arch || "universal"
      );
      console.log("📦 Zip archive created:", zipName);
    }

    // Success message
    console.log("");
    console.log("🎉 Deployment build completed successfully!");
    console.log("📦 Deployment created at:", defaultConfig.paths.output);
    console.log("");
    console.log("🚀 Next steps:");
    console.log("  1. Extract the deployment folder");
    console.log("  2. Run the setup script for your platform:");
    if (options.platform === "windows" || options.platform === "universal") {
      console.log("     Windows: Double-click setup.bat");
    }
    if (options.platform === "linux" || options.platform === "universal") {
      console.log("     Linux: ./setup.sh");
    }
    if (options.platform === "macos" || options.platform === "universal") {
      console.log("     macOS: ./setup-macos.sh");
    }
    console.log("  3. Start the application with the provided scripts");
    console.log("");
  } catch (error) {
    console.error("❌ Deployment build failed:", error);
    process.exit(1);
  }
}

export { main as buildProduction };
