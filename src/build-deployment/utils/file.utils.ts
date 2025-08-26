import { mkdir, cp, copyFile, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";
import type { BuildDeploymentConfig } from "../config/types";
import { readdir } from "fs/promises";

/**
 * Check if rsync is available on the system
 */
function isRsyncAvailable(): boolean {
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
async function fastCopy(
  src: string,
  dest: string,
  options: { recursive?: boolean } = {}
): Promise<void> {
  if (isRsyncAvailable()) {
    // TODO: Add spinner here for better UX
    console.log("  🚀 Using rsync for fast copy...");
    const rsyncArgs = [
      "-a", // archive mode (preserves permissions, timestamps, etc.)
      options.recursive ? "-r" : "",
      "-q", // quiet mode (silent)
      src,
      dest,
    ].filter(Boolean);

    execSync(`rsync ${rsyncArgs.join(" ")}`, { stdio: "inherit" });
  } else {
    console.log("  📁 Using fallback cp...");
    await cp(src, dest, options);
  }
}

/**
 * Create deployment directory structure in .temp folder for build isolation
 */
export async function createDirectoryStructure(
  config: BuildDeploymentConfig
): Promise<void> {
  // Use .temp directory for build isolation
  const buildWorkspace = resolve(
    config.workspaceRoot,
    config.paths.temp,
    "deployment"
  );
  const directories = [
    buildWorkspace,
    join(buildWorkspace, "dist"),
    join(buildWorkspace, "dist/client"),
    join(buildWorkspace, "dist/server"),
    join(buildWorkspace, "dist/data"),
    join(buildWorkspace, "dist/data/db"),
    join(buildWorkspace, "dist/data/uploads"),
    join(buildWorkspace, "dist/data/logs"),
    join(buildWorkspace, "dist/data/migrations"),
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
  const srcDir = resolve(config.workspaceRoot, config.paths[type], "dist");
  const buildWorkspace = resolve(
    config.workspaceRoot,
    config.paths.temp,
    "deployment"
  );
  const destDir = join(buildWorkspace, "dist", type);

  console.log(`🔍 Debug paths for ${type}:`);
  console.log(`  Workspace root: ${config.workspaceRoot}`);
  console.log(`  Type path: ${config.paths[type]}`);
  console.log(`  Source dir: ${srcDir}`);
  console.log(`  Build workspace: ${buildWorkspace}`);
  console.log(`  Dest dir: ${destDir}`);

  if (!existsSync(srcDir)) {
    throw new Error(`${type} build directory not found: ${srcDir}`);
  }

  console.log(`✅ Source directory exists, copying...`);
  await fastCopy(srcDir, destDir, { recursive: true });
  console.log(`✅ Copied ${type} build artifacts`);
}

/**
 * Copy data files (database, migrations, uploads)
 */
export async function copyDataFiles(
  config: BuildDeploymentConfig
): Promise<void> {
  const buildWorkspace = resolve(
    config.workspaceRoot,
    config.paths.temp,
    "deployment"
  );

  // Copy database
  const dbSrc = resolve(
    config.workspaceRoot,
    config.paths.data,
    config.database.development
  );
  const dbDest = join(
    buildWorkspace,
    "dist/data/db",
    config.database.production
  );
  if (existsSync(dbSrc)) {
    await fastCopy(dbSrc, dbDest);
  }

  // Copy migrations
  const migrationsDir = resolve(
    config.workspaceRoot,
    config.paths.data,
    "migrations"
  );
  if (existsSync(migrationsDir)) {
    await fastCopy(
      migrationsDir,
      join(buildWorkspace, "dist/data/migrations"),
      {
        recursive: true,
      }
    );
  }

  // Copy uploads
  const uploadsDir = resolve(
    config.workspaceRoot,
    config.paths.data,
    "uploads"
  );
  if (existsSync(uploadsDir)) {
    await fastCopy(uploadsDir, join(buildWorkspace, "dist/data/uploads"), {
      recursive: true,
    });
  }
}

/**
 * Create zip archive of deployment and save to deployments folder
 */
export async function createZipArchive(
  config: BuildDeploymentConfig,
  platform: string,
  arch: string
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const zipName = `${config.appName.toLowerCase().replace(/\s+/g, "-")}-${platform}-${arch}-${timestamp}.zip`;

  // Save zip to deployments folder
  const deploymentsDir = resolve(
    config.workspaceRoot,
    config.paths.deployments
  );
  const zipPath = join(deploymentsDir, zipName);

  // Ensure deployments directory exists
  await mkdir(deploymentsDir, { recursive: true });

  // Build workspace is in .temp
  const buildWorkspace = resolve(
    config.workspaceRoot,
    config.paths.temp,
    "deployment"
  );

  const zipCommand = `cd "${buildWorkspace}" && zip -r "${zipPath}" . -x "node_modules/*" "*.log" ".DS_Store"`;
  execSync(zipCommand, { stdio: "inherit" });

  return zipName;
}

/**
 * Clean platform-specific artifacts
 */
export async function cleanPlatformArtifacts(
  config: BuildDeploymentConfig
): Promise<void> {
  const buildWorkspace = resolve(
    config.workspaceRoot,
    config.paths.temp,
    "deployment"
  );

  const cmd = [
    `cd "${buildWorkspace}"`,
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
 * Isolate workspace by temporarily moving node_modules and pnpm-lock.yaml
 * This prevents pnpm from interfering with the main monorepo during deployment
 */
export async function isolateWorkspace(
  config: BuildDeploymentConfig
): Promise<void> {
  const workspaceRoot = config.workspaceRoot;
  const tempDir = resolve(workspaceRoot, config.paths.temp);
  const nodeModulesPath = join(workspaceRoot, "node_modules");
  const pnpmLockPath = join(workspaceRoot, "pnpm-lock.yaml");
  const pnpmWorkspacePath = join(workspaceRoot, "pnpm-workspace.yaml");

  console.log("🔒 Isolating workspace for deployment...");
  console.log(`  Workspace root: ${workspaceRoot}`);
  console.log(`  Temp directory: ${tempDir}`);
  console.log(
    "  This will temporarily move pnpm workspace files to prevent interference"
  );

  // Safety check: ensure we're not already in a temp directory
  if (workspaceRoot.includes(config.paths.temp)) {
    throw new Error(
      `Safety check failed: Cannot isolate workspace from within ${config.paths.temp} directory`
    );
  }

  // Check if workspace is currently in use
  const { checkWorkspaceInUse } = await import("./file.utils.js");
  const workspaceInUse = await checkWorkspaceInUse(config);
  if (workspaceInUse) {
    throw new Error(
      "Workspace is currently in use. Please stop all pnpm and Node.js processes before isolation."
    );
  }

  // Create temp directory if it doesn't exist
  await mkdir(tempDir, { recursive: true });

  // Check if we need to isolate
  if (!existsSync(nodeModulesPath)) {
    console.log("ℹ️  No node_modules found, skipping isolation");
    return;
  }

  // Create backup before isolation
  const { createWorkspaceBackup } = await import("./file.utils.js");
  const backupPath = await createWorkspaceBackup(config);

  // Create isolation subdirectory
  const isolationDir = join(tempDir, "workspace-isolation");
  await mkdir(isolationDir, { recursive: true });

  try {
    // Move workspace files to isolation directory
    if (existsSync(nodeModulesPath)) {
      console.log("📦 Moving node_modules to isolation...");
      console.log("  ⏳ Copying node_modules (this may take a moment)...");
      await fastCopy(nodeModulesPath, join(isolationDir, "node_modules"), {
        recursive: true,
      });
      console.log("  ✅ node_modules copied, removing from workspace...");
      await rm(nodeModulesPath, { recursive: true, force: true });
      console.log("  ✅ node_modules moved to isolation");
    }

    if (existsSync(pnpmLockPath)) {
      console.log("🔐 Removing pnpm-lock.yaml for fresh npm install...");
      console.log("  🚀 This prevents external linking issues in isolation");
      await rm(pnpmLockPath, { force: true });
      console.log(
        "  ✅ pnpm-lock.yaml removed - npm will create fresh lock file"
      );
    }

    if (existsSync(pnpmWorkspacePath)) {
      console.log("🏢 Moving pnpm-workspace.yaml to isolation...");
      await copyFile(
        pnpmWorkspacePath,
        join(isolationDir, "pnpm-workspace.yaml")
      );
      await rm(pnpmWorkspacePath, { force: true });
      console.log("  ✅ pnpm-workspace.yaml moved to isolation");
    }

    console.log("✅ Workspace isolated successfully");
    console.log("   - node_modules moved to isolation");
    console.log("   - pnpm-lock.yaml moved to isolation");
    console.log("   - pnpm-workspace.yaml moved to isolation");
    console.log("   - pnpm will no longer interfere with main workspace");
  } catch (error) {
    console.error("❌ Failed to isolate workspace:", error);

    // Try to restore on failure
    try {
      console.log(
        "🔄 Attempting to restore workspace after isolation failure..."
      );
      await restoreWorkspace(config);
    } catch (restoreError) {
      console.error(
        "❌ Failed to restore workspace after isolation failure:",
        restoreError
      );
    }

    throw error;
  }
}

/**
 * Restore workspace by moving node_modules and pnpm-lock.yaml back
 */
export async function restoreWorkspace(
  config: BuildDeploymentConfig
): Promise<void> {
  const workspaceRoot = config.workspaceRoot;
  const tempDir = resolve(workspaceRoot, config.paths.temp);
  const isolationDir = join(tempDir, "workspace-isolation");

  console.log("🔓 Restoring workspace from isolation...");

  if (!existsSync(isolationDir)) {
    console.log("ℹ️  No isolation directory found, nothing to restore");
    return;
  }

  try {
    // Restore workspace files
    if (existsSync(join(isolationDir, "node_modules"))) {
      console.log("📦 Restoring node_modules...");
      console.log("  ⏳ Copying node_modules back to workspace...");
      await fastCopy(
        join(isolationDir, "node_modules"),
        join(workspaceRoot, "node_modules"),
        { recursive: true }
      );
      console.log("  ✅ node_modules restored");
    }

    if (existsSync(join(isolationDir, "pnpm-lock.yaml"))) {
      console.log("🔐 Restoring pnpm-lock.yaml...");
      await copyFile(
        join(isolationDir, "pnpm-lock.yaml"),
        join(workspaceRoot, "pnpm-lock.yaml")
      );
      console.log("  ✅ pnpm-lock.yaml restored");
    }

    if (existsSync(join(isolationDir, "pnpm-workspace.yaml"))) {
      console.log("🏢 Restoring pnpm-workspace.yaml...");
      await copyFile(
        join(isolationDir, "pnpm-workspace.yaml"),
        join(workspaceRoot, "pnpm-workspace.yaml")
      );
      console.log("  ✅ pnpm-workspace.yaml restored");
    }

    console.log("✅ Workspace restored successfully");
  } catch (error) {
    console.error("❌ Failed to restore workspace:", error);

    // Try to restore from backup if main restoration fails
    try {
      const { restoreFromBackup } = await import("./file.utils.js");
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
export async function emergencyRestoreWorkspace(
  workspaceRoot: string
): Promise<void> {
  console.log("🚨 Emergency workspace restoration...");
  console.log(`  Workspace root: ${workspaceRoot}`);

  // Look for isolation directory in common temp locations
  const possibleTempDirs = [
    join(workspaceRoot, ".temp"),
    join(workspaceRoot, "temp"),
    join(workspaceRoot, "tmp"),
  ];

  for (const tempDir of possibleTempDirs) {
    const isolationDir = join(tempDir, "workspace-isolation");
    if (existsSync(isolationDir)) {
      console.log(`  Found isolation directory: ${isolationDir}`);

      try {
        await restoreWorkspace({
          workspaceRoot,
          paths: {
            temp: tempDir.replace(workspaceRoot, "").replace(/^[\/\\]/, ""),
          },
        } as any);
        return;
      } catch (error) {
        console.error(`  Failed to restore from ${isolationDir}:`, error);

        // Try backup restoration
        try {
          const { restoreFromBackup } = await import("./file.utils.js");
          await restoreFromBackup({
            workspaceRoot,
            paths: {
              temp: tempDir.replace(workspaceRoot, "").replace(/^[\/\\]/, ""),
            },
          } as any);
          console.log("  ✅ Emergency restoration completed from backup");
          return;
        } catch (backupError) {
          console.error(`  Failed to restore from backup:`, backupError);
        }
      }
    }
  }

  console.log("  No isolation directory found for emergency restoration");
}

/**
 * Clean up .temp directory and restore workspace
 */
export async function cleanupTempDirectory(
  config: BuildDeploymentConfig
): Promise<void> {
  const tempDir = resolve(config.workspaceRoot, config.paths.temp);

  if (existsSync(tempDir)) {
    console.log("🧹 Cleaning up temporary build directory...");

    try {
      // First restore the workspace
      await restoreWorkspace(config);

      // Then remove the temp directory
      await rm(tempDir, { recursive: true, force: true });
      console.log("✅ Temporary directory cleaned up");
    } catch (error) {
      console.error("⚠️  Failed to cleanup temp directory:", error);
      // Don't throw here - we want to ensure workspace is restored even if cleanup fails
    }
  }
}

/**
 * Verify that workspace is properly isolated
 */
export async function verifyWorkspaceIsolation(
  config: BuildDeploymentConfig
): Promise<void> {
  const workspaceRoot = config.workspaceRoot;
  const nodeModulesPath = join(workspaceRoot, "node_modules");
  const pnpmLockPath = join(workspaceRoot, "pnpm-lock.yaml");
  const pnpmWorkspacePath = join(workspaceRoot, "pnpm-workspace.yaml");

  console.log("🔍 Verifying workspace isolation...");

  const isolated =
    !existsSync(nodeModulesPath) &&
    !existsSync(pnpmLockPath) &&
    !existsSync(pnpmWorkspacePath);

  if (isolated) {
    console.log("✅ Workspace is properly isolated");
    console.log("   - node_modules: removed");
    console.log("   - pnpm-lock.yaml: removed");
    console.log("   - pnpm-workspace.yaml: removed");
  } else {
    console.log("⚠️  Workspace isolation incomplete:");
    if (existsSync(nodeModulesPath))
      console.log("   - node_modules: still present");
    if (existsSync(pnpmLockPath))
      console.log("   - pnpm-lock.yaml: still present");
    if (existsSync(pnpmWorkspacePath))
      console.log("   - pnpm-workspace.yaml: still present");

    throw new Error(
      "Workspace isolation failed - pnpm workspace files still present"
    );
  }
}

/**
 * Check if workspace is currently in use (has active processes)
 */
export async function checkWorkspaceInUse(
  config: BuildDeploymentConfig
): Promise<boolean> {
  const workspaceRoot = config.workspaceRoot;

  try {
    // Check if there are any active pnpm processes in this workspace
    const result = execSync(
      `ps aux | grep -E "pnpm.*${workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" | grep -v grep`,
      { stdio: "pipe" }
    )
      .toString()
      .trim();

    if (result) {
      console.log("⚠️  Active pnpm processes detected in workspace:");
      console.log(result);
      return true;
    }

    // Check if there are any active Node.js processes in this workspace
    const nodeResult = execSync(
      `ps aux | grep -E "node.*${workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" | grep -v grep`,
      { stdio: "pipe" }
    )
      .toString()
      .trim();

    if (nodeResult) {
      console.log("⚠️  Active Node.js processes detected in workspace:");
      console.log(nodeResult);
      return true;
    }

    return false;
  } catch (error) {
    // If grep fails, assume no processes found
    return false;
  }
}

/**
 * Create backup of workspace files before isolation
 */
export async function createWorkspaceBackup(
  config: BuildDeploymentConfig
): Promise<string> {
  const workspaceRoot = config.workspaceRoot;
  const tempDir = resolve(workspaceRoot, config.paths.temp);
  const backupDir = join(tempDir, "workspace-backup");

  console.log("💾 Creating workspace backup before isolation...");

  try {
    await mkdir(backupDir, { recursive: true });

    // Create timestamp for backup
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const backupPath = join(backupDir, `backup-${timestamp}`);
    await mkdir(backupPath, { recursive: true });

    // Backup critical workspace files
    const criticalFiles = [
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "package.json",
    ];

    for (const file of criticalFiles) {
      const filePath = join(workspaceRoot, file);
      if (existsSync(filePath)) {
        await copyFile(filePath, join(backupPath, file));
        console.log(`  📄 Backed up: ${file}`);
      }
    }

    console.log(`✅ Workspace backup created: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error("❌ Failed to create workspace backup:", error);
    throw error;
  }
}

/**
 * Restore workspace from backup if main restoration fails
 */
export async function restoreFromBackup(
  config: BuildDeploymentConfig
): Promise<void> {
  const workspaceRoot = config.workspaceRoot;
  const tempDir = resolve(workspaceRoot, config.paths.temp);
  const backupDir = join(tempDir, "workspace-backup");

  console.log("🔄 Attempting to restore workspace from backup...");

  if (!existsSync(backupDir)) {
    console.log("ℹ️  No backup directory found");
    return;
  }

  try {
    // Find the most recent backup
    const backupEntries = await readdir(backupDir);
    const backupFolders = backupEntries.filter(
      (entry) =>
        entry.startsWith("backup-") && existsSync(join(backupDir, entry))
    );

    if (backupFolders.length === 0) {
      console.log("ℹ️  No backup folders found");
      return;
    }

    // Sort by timestamp (newest first)
    backupFolders.sort().reverse();
    const latestBackup = join(backupDir, backupFolders[0]);

    console.log(`📦 Restoring from backup: ${latestBackup}`);

    // Restore critical files
    const criticalFiles = [
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "package.json",
    ];

    for (const file of criticalFiles) {
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
export async function canProceedWithBuild(
  config: BuildDeploymentConfig
): Promise<boolean> {
  const workspaceRoot = config.workspaceRoot;
  const tempDir = resolve(workspaceRoot, config.paths.temp);
  const isolationDir = join(tempDir, "workspace-isolation");

  console.log("🔍 Verifying build safety...");

  // Check if isolation directory exists
  if (!existsSync(isolationDir)) {
    console.log("❌ Isolation directory not found - isolation may have failed");
    return false;
  }

  // Check if critical files are in isolation
  const criticalFiles = [
    join(isolationDir, "node_modules"),
    // 🚀 Skip pnpm-lock.yaml check - we intentionally delete it for fresh npm install
    join(isolationDir, "pnpm-workspace.yaml"),
  ];

  for (const file of criticalFiles) {
    if (!existsSync(file)) {
      console.log(`⚠️  Critical file not found in isolation: ${file}`);
      return false;
    }
  }

  // Check if workspace is clean (no pnpm files)
  const workspaceFiles = [
    join(workspaceRoot, "node_modules"),
    join(workspaceRoot, "pnpm-lock.yaml"),
    join(workspaceRoot, "pnpm-workspace.yaml"),
  ];

  for (const file of workspaceFiles) {
    if (existsSync(file)) {
      console.log(`⚠️  Workspace file still present: ${file}`);
      return false;
    }
  }

  console.log("✅ Build safety verified - workspace is properly isolated");
  return true;
}

/**
 * Prepare isolated build workspace with necessary dependencies
 */
export async function prepareIsolatedBuildWorkspace(
  config: BuildDeploymentConfig
): Promise<void> {
  const workspaceRoot = config.workspaceRoot;
  const tempDir = resolve(workspaceRoot, config.paths.temp);
  const isolationDir = join(tempDir, "workspace-isolation");
  const buildWorkspace = join(tempDir, "deployment");

  console.log("🏗️  Preparing isolated build workspace...");

  try {
    // Create build workspace structure
    await mkdir(buildWorkspace, { recursive: true });

    // 🚀 OPTIMIZATION: Skip copying node_modules - let npm install handle it fresh!
    // This saves massive time and avoids dependency conflicts
    console.log(
      "📦 Skipping node_modules copy - will install fresh dependencies"
    );

    // Copy only essential package files to build workspace
    const packageFiles = [
      "package.json",
      // 🚀 Skip pnpm-lock.yaml - npm will create fresh one without external links
      "pnpm-workspace.yaml",
    ];

    for (const file of packageFiles) {
      const srcFile = join(isolationDir, file);
      const destFile = join(buildWorkspace, file);

      if (existsSync(srcFile)) {
        await fastCopy(srcFile, destFile);
        console.log(`  📄 ${file} copied to build workspace`);
      }
    }

    // Copy source code directories (needed for builds)
    const sourceDirs = ["apps/client", "apps/server", "packages"];

    for (const dir of sourceDirs) {
      const srcDir = join(workspaceRoot, dir);
      const destDir = join(buildWorkspace, dir);

      if (existsSync(srcDir)) {
        console.log(`📁 Copying ${dir} to build workspace...`);
        await fastCopy(srcDir, destDir, { recursive: true });
        console.log(`  ✅ ${dir} copied`);
      }
    }

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
      "postcss.config.js",
    ];

    for (const file of configFiles) {
      const srcFile = join(workspaceRoot, file);
      const destFile = join(buildWorkspace, file);

      if (existsSync(srcFile)) {
        await copyFile(srcFile, destFile);
        console.log(`  📄 ${file} copied`);
      }
    }

    // Copy any other config directories
    const configDirs = ["config", "deployment/config"];
    for (const dir of configDirs) {
      const srcDir = join(workspaceRoot, dir);
      const destDir = join(buildWorkspace, dir);

      if (existsSync(srcDir)) {
        console.log(`📁 Copying ${dir} configuration...`);
        await fastCopy(srcDir, destDir, { recursive: true });
        console.log(`  ✅ ${dir} copied`);
      }
    }

    console.log(
      "✅ Isolated build workspace prepared (optimized - no node_modules copy)"
    );
  } catch (error) {
    console.error("❌ Failed to prepare isolated build workspace:", error);
    throw error;
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
