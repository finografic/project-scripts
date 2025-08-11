import { mkdir, cp, copyFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import type { BuildDeploymentConfig } from "../config/types";

/**
 * Create deployment directory structure
 */
export async function createDirectoryStructure(
  config: BuildDeploymentConfig
): Promise<void> {
  const directories = [
    config.paths.output,
    join(config.paths.output, "dist"),
    join(config.paths.output, "dist/client"),
    join(config.paths.output, "dist/server"),
    join(config.paths.output, "dist/data"),
    join(config.paths.output, "dist/data/db"),
    join(config.paths.output, "dist/data/uploads"),
    join(config.paths.output, "dist/data/logs"),
    join(config.paths.output, "dist/data/migrations"),
  ];

  for (const dir of directories) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Copy build artifacts to deployment directory
 */
export async function copyBuildArtifacts(
  config: BuildDeploymentConfig,
  type: "client" | "server"
): Promise<void> {
  const srcDir = join(config.paths[type], "dist");
  const destDir = join(config.paths.output, "dist", type);

  if (!existsSync(srcDir)) {
    throw new Error(`${type} build directory not found: ${srcDir}`);
  }

  await cp(srcDir, destDir, { recursive: true });
}

/**
 * Copy data files (database, migrations, uploads)
 */
export async function copyDataFiles(
  config: BuildDeploymentConfig
): Promise<void> {
  // Copy database
  const dbSrc = join(config.paths.data, config.database.development);
  const dbDest = join(
    config.paths.output,
    "dist/data/db",
    config.database.production
  );
  if (existsSync(dbSrc)) {
    await copyFile(dbSrc, dbDest);
  }

  // Copy migrations
  const migrationsDir = join(config.paths.data, "migrations");
  if (existsSync(migrationsDir)) {
    await cp(migrationsDir, join(config.paths.output, "dist/data/migrations"), {
      recursive: true,
    });
  }

  // Copy uploads
  const uploadsDir = join(config.paths.data, "uploads");
  if (existsSync(uploadsDir)) {
    await cp(uploadsDir, join(config.paths.output, "dist/data/uploads"), {
      recursive: true,
    });
  }
}

/**
 * Create zip archive of deployment
 */
export async function createZipArchive(
  config: BuildDeploymentConfig,
  platform: string,
  arch: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const zipName = `${config.appName.toLowerCase().replace(/\s+/g, "-")}-${platform}-${arch}-${timestamp}.zip`;
  const zipPath = join(config.options.outputDir || process.cwd(), zipName);

  const zipCommand = `cd "${config.paths.output}" && zip -r "${zipPath}" . -x "node_modules/*" "*.log" ".DS_Store"`;
  execSync(zipCommand, { stdio: "inherit" });

  return zipName;
}

/**
 * Clean platform-specific artifacts
 */
export async function cleanPlatformArtifacts(
  config: BuildDeploymentConfig
): Promise<void> {
  const cmd = [
    `cd "${config.paths.output}"`,
    "rm -f setup.bat setup.sh setup-macos.sh",
    "rm -f start-*.bat start-*.sh",
    "rm -f USER_GUIDE*.md GUIA_USUARIO*.md",
  ].join(" && ");

  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (error) {
    // Ignore errors - files might not exist
  }
}

/**
 * Make scripts executable (Unix only)
 */
export function makeExecutable(filePath: string): void {
  if (process.platform !== "win32") {
    try {
      execSync(`chmod +x ${filePath}`, { stdio: "inherit" });
    } catch (error) {
      // Ignore errors
    }
  }
}

/**
 * Write file and make executable if needed
 */
export async function writeExecutableFile(
  filePath: string,
  content: string,
  makeExec = false
): Promise<void> {
  await writeFile(filePath, content);
  if (makeExec) {
    makeExecutable(filePath);
  }
}
