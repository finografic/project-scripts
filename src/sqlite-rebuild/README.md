# SQLite Rebuilder

A comprehensive script to fix `better-sqlite3` native binding issues in monorepos.

## 🎯 Purpose

This script addresses the common and painful `better-sqlite3` binding issues that occur when:

- Switching between branches
- Updating Node.js versions
- Changing macOS versions
- Native bindings get out of sync
- Version mismatches between packages

**Note**: This script focuses on fixing the `better-sqlite3` library itself. Database schema, migrations, and table creation should be handled separately with your existing database scripts.

## 🚀 Usage

### Basic Usage

```bash
# Run the full rebuild process
pnpm sqlite-rebuild

# Or use the binary directly
node scripts/bin/sqlite-rebuild.js
```

### Advanced Options

```bash
# Force rebuild even with version mismatches
pnpm sqlite-rebuild --force

# Verbose output for debugging
pnpm sqlite-rebuild --verbose

# Only clean node_modules (skip rebuild)
pnpm sqlite-rebuild --clean-only

# Specify target version
pnpm sqlite-rebuild --version 11.9.0

# Combine options
pnpm sqlite-rebuild --force --verbose --version 11.9.0
```

## 🔧 What It Does

### 1. **Package Scanning**

- Scans all packages in the monorepo
- Identifies `better-sqlite3` dependencies
- Reports version inconsistencies

### 2. **Version Consistency Check**

- Ensures all packages use the same `better-sqlite3` version
- Can auto-fix version mismatches
- Warns about inconsistencies

### 3. **Clean Environment**

- Removes all `node_modules` directories
- Ensures fresh installation
- Cleans pnpm cache if needed

### 4. **Rebuild Process**

- Reinstalls all dependencies with `pnpm install`
- Triggers native binding compilation
- Falls back to manual rebuild if needed

### 5. **Verification**

- Tests basic `better-sqlite3` functionality
- Optionally tests database migration (only when `--include-migration` is specified)
- Reports success/failure status

**Note**: The migration test is optional and only runs when explicitly requested.

## 📋 Options

| Option | Short | Description |
|--------|-------|-------------|
| `--force` | `-f` | Force rebuild even with version mismatches |
| `--verbose` | `-v` | Show detailed output and commands |
| `--clean-only` | `-c` | Only clean node_modules, skip rebuild |
| `--include-migration` | `-m` | Include database migration test |
| `--version <version>` | | Specify target better-sqlite3 version |

## 🎯 When to Use

### ✅ **Use this script when:**

- `better-sqlite3` fails to load with "Could not locate the bindings file"
- Database migrations fail with binding errors
- Switching between different Node.js versions
- Updating macOS or Xcode Command Line Tools
- Version mismatches between packages
- Native modules need recompilation

### ❌ **Don't use when:**

- Database is working fine
- Just want to update dependencies normally
- Have uncommitted changes (script modifies package.json files)

## 🔍 Troubleshooting

### Common Issues

1. **Permission Errors**

   ```bash
   # Make sure the script is executable
   chmod +x scripts/bin/sqlite-rebuild.js
   ```

2. **Version Conflicts**

   ```bash
   # Force update to specific version
   pnpm sqlite-rebuild --force --version 11.9.0
   ```

3. **Build Failures**

   ```bash
   # Try with verbose output
   pnpm sqlite-rebuild --verbose
   ```

4. **Partial Clean**

   ```bash
   # Only clean, then manually reinstall
   pnpm sqlite-rebuild --clean-only
   pnpm install
   ```

## 🏗️ Architecture

The script is built as a TypeScript class with the following components:

- **SqliteRebuilder**: Main class handling the rebuild process
- **Package Scanner**: Identifies and analyzes package dependencies
- **Version Manager**: Handles version consistency and updates
- **Cleaner**: Removes node_modules and caches
- **Rebuilder**: Handles native module compilation
- **Tester**: Verifies the installation works

## 🔧 Development

### Building the Script

```bash
cd scripts
pnpm build
```

### Running in Development

```bash
cd scripts
pnpm sqlite-rebuild
```

### Testing

```bash
# Test with verbose output
pnpm sqlite-rebuild --verbose

# Test clean-only mode
pnpm sqlite-rebuild --clean-only

# Test with different version
pnpm sqlite-rebuild --version 11.10.0
```

## 📝 Notes

- The script modifies `package.json` files to ensure version consistency
- Always commit your changes before running the script
- The script is designed for pnpm workspaces
- Default target version is `11.9.0` (known stable version)
- Script includes fallback mechanisms for different failure scenarios

## 🎉 Success Indicators

When the script completes successfully, you should see:

- ✅ All packages use the same version
- ✅ Rebuild completed successfully
- ✅ better-sqlite3 test passed
- ✅ Database migration test passed (or skipped by default)
- 🎉 better-sqlite3 rebuild completed successfully!

**The script is successful if the basic `better-sqlite3` functionality works. Database migrations can be handled separately.**
