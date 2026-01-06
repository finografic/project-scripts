import chalk from 'chalk';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface RebuildOptions {
  force?: boolean;
  verbose?: boolean;
  targetVersion?: string;
  cleanOnly?: boolean;
  includeMigration?: boolean;
}

interface PackageInfo {
  name: string;
  version: string;
  path: string;
  hasBetterSqlite3: boolean;
  betterSqlite3Version?: string;
}

class SqliteRebuilder {
  private workspaceRoot: string;
  private options: RebuildOptions;
  private packages: PackageInfo[] = [];

  constructor(options: RebuildOptions = {}) {
    this.options = {
      force: false,
      verbose: false,
      targetVersion: '11.9.0',
      cleanOnly: false,
      includeMigration: false,
      ...options,
    };
    this.workspaceRoot = this.findWorkspaceRoot();
  }

  private findWorkspaceRoot(): string {
    let currentDir = process.cwd();
    while (currentDir !== path.dirname(currentDir)) {
      if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    throw new Error('Could not find workspace root (pnpm-workspace.yaml)');
  }

  private log(
    message: string,
    type: 'info' | 'success' | 'error' | 'warning' = 'info',
  ) {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow,
    };
    console.log(colors[type](`[SQLite Rebuilder] ${message}`));
  }

  private logVerbose(message: string) {
    if (this.options.verbose) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
    }
  }

  private async runCommand(command: string, cwd?: string): Promise<string> {
    this.logVerbose(`Running: ${command}${cwd ? ` in ${cwd}` : ''}`);

    try {
      const result = execSync(command, {
        cwd: cwd || this.workspaceRoot,
        encoding: 'utf8',
        stdio: this.options.verbose ? 'inherit' : 'pipe',
      });
      return result;
    } catch (error: any) {
      if (this.options.verbose) {
        throw error;
      }
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  private async scanPackages(): Promise<void> {
    this.log('Scanning packages for better-sqlite3 dependencies...');

    const packageDirs = [
      this.workspaceRoot,
      path.join(this.workspaceRoot, 'apps', 'client'),
      path.join(this.workspaceRoot, 'apps', 'server'),
      path.join(this.workspaceRoot, 'packages', 'core'),
      path.join(this.workspaceRoot, 'packages', 'i18n'),
    ];

    for (const packageDir of packageDirs) {
      if (!fs.existsSync(packageDir)) continue;

      const packageJsonPath = path.join(packageDir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) continue;

      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf8'),
        );
        const betterSqlite3Version =
          packageJson.dependencies?.['better-sqlite3'] ||
          packageJson.devDependencies?.['better-sqlite3'];

        this.packages.push({
          name: packageJson.name || path.basename(packageDir),
          version: packageJson.version || 'unknown',
          path: packageDir,
          hasBetterSqlite3: !!betterSqlite3Version,
          betterSqlite3Version,
        });
      } catch {
        this.log(`Failed to parse package.json in ${packageDir}`, 'warning');
      }
    }

    this.log(`Found ${this.packages.length} packages`);
    this.packages.forEach((pkg) => {
      if (pkg.hasBetterSqlite3) {
        this.log(
          `  ${pkg.name}: better-sqlite3@${pkg.betterSqlite3Version}`,
          'info',
        );
      }
    });
  }

  private async checkVersionConsistency(): Promise<boolean> {
    this.log('Checking version consistency...');

    const versions = this.packages
      .filter((pkg) => pkg.hasBetterSqlite3)
      .map((pkg) => pkg.betterSqlite3Version);

    const uniqueVersions = [...new Set(versions)];

    if (uniqueVersions.length === 0) {
      this.log('No better-sqlite3 dependencies found', 'warning');
      return true;
    }

    if (uniqueVersions.length === 1) {
      this.log(
        `✅ All packages use the same version: ${uniqueVersions[0]}`,
        'success',
      );
      return true;
    }

    this.log('❌ Version mismatch detected:', 'error');
    uniqueVersions.forEach((version) => {
      const packages = this.packages.filter(
        (pkg) => pkg.betterSqlite3Version === version,
      );
      this.log(
        `  ${version}: ${packages.map((pkg) => pkg.name).join(', ')}`,
        'error',
      );
    });

    return false;
  }

  private async updateVersions(): Promise<void> {
    this.log(
      `Updating all packages to use better-sqlite3@${this.options.targetVersion}...`,
    );

    for (const pkg of this.packages) {
      if (!pkg.hasBetterSqlite3) continue;

      if (pkg.betterSqlite3Version === this.options.targetVersion) {
        this.log(`  ${pkg.name}: Already using target version`, 'info');
        continue;
      }

      try {
        const packageJsonPath = path.join(pkg.path, 'package.json');
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf8'),
        );

        // Update in dependencies
        if (packageJson.dependencies?.['better-sqlite3']) {
          packageJson.dependencies['better-sqlite3'] =
            this.options.targetVersion;
        }

        // Update in devDependencies
        if (packageJson.devDependencies?.['better-sqlite3']) {
          packageJson.devDependencies['better-sqlite3'] =
            this.options.targetVersion;
        }

        fs.writeFileSync(
          packageJsonPath,
          JSON.stringify(packageJson, null, 2) + '\n',
        );
        this.log(
          `  ✅ Updated ${pkg.name} to ${this.options.targetVersion}`,
          'success',
        );
      } catch (error) {
        this.log(`  ❌ Failed to update ${pkg.name}: ${error}`, 'error');
      }
    }
  }

  private async cleanNodeModules(): Promise<void> {
    this.log('Cleaning node_modules directories...');

    const nodeModulesDirs = [
      path.join(this.workspaceRoot, 'node_modules'),
      path.join(this.workspaceRoot, 'apps', 'client', 'node_modules'),
      path.join(this.workspaceRoot, 'apps', 'server', 'node_modules'),
      path.join(this.workspaceRoot, 'packages', 'core', 'node_modules'),
      path.join(this.workspaceRoot, 'packages', 'i18n', 'node_modules'),
    ];

    for (const dir of nodeModulesDirs) {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
          this.log(
            `  ✅ Cleaned ${path.relative(this.workspaceRoot, dir)}`,
            'success',
          );
        } catch (error) {
          this.log(`  ❌ Failed to clean ${dir}: ${error}`, 'error');
        }
      }
    }
  }

  private async rebuildBetterSqlite3(): Promise<void> {
    this.log('Rebuilding better-sqlite3 native bindings...');

    try {
      // First, try to rebuild the specific package
      await this.runCommand('pnpm rebuild better-sqlite3');
      this.log('✅ Rebuild completed successfully', 'success');
    } catch {
      this.log('❌ Rebuild failed, trying alternative approach...', 'warning');

      try {
        // Try manual rebuild in the better-sqlite3 directory
        const betterSqlite3Path = path.join(
          this.workspaceRoot,
          'node_modules',
          '.pnpm',
          `better-sqlite3@${this.options.targetVersion}`,
          'node_modules',
          'better-sqlite3',
        );

        if (fs.existsSync(betterSqlite3Path)) {
          this.log('Attempting manual rebuild...', 'info');
          await this.runCommand('npm run build-release', betterSqlite3Path);
          this.log('✅ Manual rebuild completed', 'success');
        } else {
          throw new Error('Could not find better-sqlite3 package directory');
        }
      } catch (manualError) {
        this.log('❌ Manual rebuild also failed', 'error');
        throw manualError;
      }
    }
  }

  private async testBetterSqlite3(): Promise<boolean> {
    this.log('Testing better-sqlite3 functionality...');

    try {
      const testScript = `
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');
        console.log('✅ better-sqlite3 is working!');
        db.close();
      `;

      await this.runCommand(`node -e "${testScript}"`);
      this.log('✅ better-sqlite3 test passed', 'success');
      return true;
    } catch {
      this.log('❌ better-sqlite3 test failed', 'error');
      return false;
    }
  }

  private async runDatabaseMigration(): Promise<boolean> {
    if (!this.options.includeMigration) {
      this.log(
        'Skipping database migration test as --include-migration is not set.',
        'info',
      );
      return true;
    }

    this.log('Testing database migration...');

    try {
      // Check if the server directory exists
      const serverPath = path.join(this.workspaceRoot, 'apps', 'server');
      if (!fs.existsSync(serverPath)) {
        this.log(
          'Server directory not found, skipping migration test',
          'warning',
        );
        return true;
      }

      // Check if the migration script exists
      const migrationScript = path.join(
        serverPath,
        'src',
        'db',
        'utils',
        'migrate.ts',
      );
      if (!fs.existsSync(migrationScript)) {
        this.log(
          'Migration script not found, skipping migration test',
          'warning',
        );
        return true;
      }

      await this.runCommand('pnpm db.migrations.run', serverPath);
      this.log('✅ Database migration test passed', 'success');
      return true;
    } catch {
      this.log('❌ Database migration test failed', 'error');
      this.log(
        'This is often due to missing environment variables or database configuration',
        'warning',
      );
      this.log(
        'The basic better-sqlite3 functionality should still work',
        'info',
      );
      return false;
    }
  }

  public async rebuild(): Promise<void> {
    this.log('🚀 Starting better-sqlite3 rebuild process...', 'info');

    try {
      // Step 1: Scan packages
      await this.scanPackages();

      // Step 2: Check version consistency
      const isConsistent = await this.checkVersionConsistency();

      if (!isConsistent && !this.options.force) {
        this.log(
          'Version inconsistency detected. Use --force to proceed anyway.',
          'warning',
        );
        return;
      }

      // Step 3: Update versions if needed
      if (!isConsistent) {
        await this.updateVersions();
      }

      // Step 4: Clean node_modules
      await this.cleanNodeModules();

      if (this.options.cleanOnly) {
        this.log('Clean-only mode: skipping rebuild', 'info');
        return;
      }

      // Step 5: Reinstall dependencies
      this.log('Reinstalling dependencies...');
      await this.runCommand('pnpm install');

      // Step 6: Rebuild better-sqlite3
      await this.rebuildBetterSqlite3();

      // Step 7: Test the installation
      const testPassed = await this.testBetterSqlite3();
      if (!testPassed) {
        throw new Error('better-sqlite3 test failed after rebuild');
      }

      // Step 8: Test database migration
      const migrationPassed = await this.runDatabaseMigration();
      if (!migrationPassed) {
        this.log(
          'Database migration test failed, but basic functionality works',
          'warning',
        );
      }

      this.log('🎉 better-sqlite3 rebuild completed successfully!', 'success');
    } catch (error) {
      this.log(`❌ Rebuild failed: ${error}`, 'error');
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  const options: RebuildOptions = {
    force: args.includes('--force') || args.includes('-f'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    cleanOnly: args.includes('--clean-only') || args.includes('-c'),
    includeMigration:
      args.includes('--include-migration') || args.includes('-m'),
  };

  // Parse target version
  const versionIndex = args.indexOf('--version');
  if (versionIndex !== -1 && args[versionIndex + 1]) {
    options.targetVersion = args[versionIndex + 1];
  }

  const rebuilder = new SqliteRebuilder(options);

  try {
    await rebuilder.rebuild();
  } catch (error) {
    console.error(chalk.red(`\n❌ Rebuild failed: ${error}`));
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { SqliteRebuilder };
