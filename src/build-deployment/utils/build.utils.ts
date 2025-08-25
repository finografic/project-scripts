import { execSync } from "child_process";
import { readFile, writeFile } from "fs/promises";
import { join, resolve } from "path";
import type { BuildDeploymentConfig } from "../config/types";

/**
 * Build client or server application
 */
export async function buildApp(
  config: BuildDeploymentConfig,
  type: "client" | "server"
): Promise<void> {
  const command = `pnpm --filter ${config.packageNames[type]} ${config.buildCommands[type]}`;
  
  // Safety check: ensure we're building from the main workspace, not from .temp
  if (process.cwd().includes(config.paths.temp)) {
    throw new Error(`Safety check failed: Attempting to run pnpm build from ${config.paths.temp} directory. Must run from main workspace.`);
  }
  
  console.log(`🔒 Building from workspace root: ${config.workspaceRoot}`);
  execSync(command, {
    cwd: config.workspaceRoot, // Use workspace root for pnpm commands
    stdio: "inherit",
  });
}

/**
 * Create production package.json
 */
export async function createPackageJson(
  config: BuildDeploymentConfig,
  serverPackagePath: string
): Promise<void> {
  // Read server package.json to get dependencies
  const serverPackageContent = await readFile(serverPackagePath, "utf-8");
  const serverPackage = JSON.parse(serverPackageContent);

  // Get all server dependencies (excluding workspace packages)
  const serverDependencies = { ...serverPackage.dependencies };
  Object.keys(serverDependencies).forEach((key) => {
    if (key.startsWith("@workspace/")) {
      delete serverDependencies[key];
    }
  });

  const packageJson = {
    name: config.appName.toLowerCase().replace(/\s+/g, "-"),
    version: config.version,
    description: config.appDescription,
    private: true,
    type: "module",
    scripts: {
      start: "run-p start:server start:client",
      "start:server": "node start-server.js",
      "start:client": "node start-client.js",
    },
    dependencies: {
      ...serverDependencies,
      dotenv: "^16.0.0",
    },
    optionalDependencies: {
      "npm-run-all": "^4.1.5",
      serve: "^14.0.0",
    },
    engines: {
      node: ">=20.0.0",
    },
  };

  const tempOutput = resolve(
    config.workspaceRoot,
    config.paths.temp,
    "deployment"
  );
  await writeFile(
    join(tempOutput, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
}

/**
 * Create standalone package.json
 */
export async function createStandalonePackage(
  config: BuildDeploymentConfig,
  platform: string
): Promise<void> {
  const packageJson = {
    name: `${config.appName.toLowerCase().replace(/\s+/g, "-")}-standalone`,
    version: config.version,
    description: `${config.appName} Standalone Deployment`,
    private: true,
    type: "module",
    scripts: {
      start: "run-p start:server start:client",
      "start:server": "node dist/server/index.js",
      "start:client": "node dist/client/server.js",
      setup: platform === "windows" ? "setup.bat" : "./setup.sh",
    },
    dependencies: {
      "better-sqlite3": "^11.9.0",
      dotenv: "^16.0.0",
    },
    optionalDependencies: {
      "npm-run-all": "^4.1.5",
    },
    engines: {
      node: ">=20.0.0",
    },
  };

  const tempOutput = resolve(
    config.workspaceRoot,
    config.paths.temp,
    "deployment"
  );
  await writeFile(
    join(tempOutput, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
}

/**
 * Install production dependencies
 */
export async function installDependencies(
  config: BuildDeploymentConfig
): Promise<void> {
  const tempOutput = resolve(
    config.workspaceRoot,
    config.paths.temp,
    "deployment"
  );

  // Safety check: ensure we're working in the isolated .temp directory
  if (!tempOutput.includes(config.paths.temp)) {
    throw new Error(`Safety check failed: Attempting to install dependencies outside of isolated ${config.paths.temp} directory`);
  }

  try {
    // Use npm instead of pnpm to avoid workspace conflicts
    console.log("📦 Installing production dependencies with npm...");
    console.log(`🔒 Working in isolated directory: ${tempOutput}`);
    execSync("npm install --production", {
      cwd: tempOutput,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    });
  } catch (error) {
    console.log("⚠️  Standard install failed, trying with force flag...");

    try {
      // Second attempt: force reinstall (handles corrupted cache/modules)
      execSync("npm install --production --force", {
        cwd: tempOutput,
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: "production" },
      });
    } catch (forceError) {
      console.log(
        "⚠️  Force install failed, trying with no-frozen-lockfile..."
      );

      try {
        // Third attempt: allow lockfile updates
        execSync("npm install --production", {
          cwd: tempOutput,
          stdio: "inherit",
          env: { ...process.env, NODE_ENV: "production" },
        });
      } catch (lockfileError) {
        console.log(
          "⚠️  Lockfile install failed, trying with ignore-scripts..."
        );

        // Fourth attempt: skip problematic postinstall scripts
        execSync("npm install --production --ignore-scripts", {
          cwd: tempOutput,
          stdio: "inherit",
          env: { ...process.env, NODE_ENV: "production" },
        });
      }
    }
  }
}

/**
 * Check and kill occupied ports
 */
export function killPortIfOccupied(port: number): void {
  try {
    const result = execSync(`lsof -ti:${port}`, { stdio: "pipe" })
      .toString()
      .trim();
    if (result) {
      console.log(`⚠️  Port ${port} is occupied, killing process...`);
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: "inherit" });
      console.log(`✅ Killed process on port ${port}`);
    } else {
      console.log(`✅ Port ${port} is available`);
    }
  } catch (error) {
    // Port is not in use (lsof returns non-zero exit code)
    console.log(`✅ Port ${port} is available`);
  }
}
