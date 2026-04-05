# 🧹 purge-builds

**Advanced monorepo cleanup tool with intelligent self-preservation and automatic node_modules deletion**

## ✨ Features

- 🔒 **Smart Self-Preservation** - Never deletes itself while running
- 🧠 **Memory Detachment** - Advanced process isolation for node_modules deletion
- ⏰ **Timer-Based Deletion** - Scheduled cleanup after process exits
- 🌍 **Cross-Platform** - Works on macOS, Linux, and Windows
- 📊 **Accurate Size Reporting** - Shows exactly what will be cleaned
- 🎯 **Recursive Scanning** - Deep monorepo-wide cleanup
- 🔍 **Dry-Run Mode** - Preview deletions without risk
- 🛡️ **Protected Patterns** - Safeguards source code and critical files

## 🚀 Quick Start

```bash
# Basic cleanup (current directory only)
purge-builds

# Deep recursive cleanup
purge-builds --recursive

# Preview what would be deleted
purge-builds --dry-run --recursive

# Advanced: Force memory detachment for node_modules
purge-builds --recursive --detach
```

## 🎯 What It Deletes

### Build Artifacts

- `.turbo/` - Turborepo cache
- `.tsup/` - Tsup build cache
- `dist/` - Distribution folders
- `node_modules/` - Dependencies (with special handling)
- `.pnpm/` - PNPM cache directories

### Build Files

- `*.tsbuildinfo` - TypeScript build info
- `pnpm-lock.yaml` - Lock files

## 🛡️ What It Protects

- **Source Code**: `src/`, `apps/`, `packages/`
- **Configuration**: `package.json`, `.env*`, `.git/`
- **Documentation**: `README.md`, `docs/`
- **The CLI itself** - Advanced self-preservation logic

## 🧠 Advanced Self-Deletion Solutions

### The Problem

CLI tools face a classic paradox: "How do you delete the directory you're running from?" Traditional approaches fail because:

- Can't delete `node_modules` while process is running from it
- Simple deletion attempts result in "file in use" errors
- Process locks prevent cleanup of its own execution environment

### Our Innovative Solutions

#### 💡 Solution 1: Memory Detachment (`--detach`)

**The most advanced approach** - Creates a completely isolated process:

```bash
purge-builds --recursive --detach
```

**How it works:**

1. 📝 **Creates temporary script** in `/tmp/purge-builds-XXXXX/`
2. 📋 **Copies deletion logic** to memory/temp location
3. 🚀 **Spawns detached process** that runs independently
4. ✅ **Original process exits** cleanly, freeing all locks
5. ⏰ **Detached process waits** 1 second for full cleanup
6. 🗑️ **Executes deletion** from outside the target directory
7. 🧹 **Self-cleans** temporary files

**Advantages:**

- ✅ Complete process isolation
- ✅ No file locks or permission issues
- ✅ Works across all platforms
- ✅ Self-cleaning temporary files
- ✅ Highest success rate for node_modules deletion

#### ⏰ Solution 2: Timer-Based Deletion (Default)

**Simple and reliable** - Uses process detachment with delayed execution:

```bash
purge-builds --recursive  # Uses timer approach
```

**How it works:**

1. 🔄 **Spawns detached shell command** with platform-specific delay
2. ⏰ **Timer waits** for original process to exit (1 second)
3. 🗑️ **Executes deletion** after delay via shell command

**Platform Commands:**

- **macOS/Linux**: `sh -c "sleep 1 && rm -rf /path/to/node_modules"`
- **Windows**: `cmd /c "timeout /t 1 /nobreak && rmdir /s /q C:\path\to\node_modules"`

**Advantages:**

- ✅ Simple and lightweight
- ✅ Platform-native commands
- ✅ No temporary files needed
- ✅ Fast execution

### 🔄 Intelligent Fallback System

The tool automatically chooses the best approach:

```
┌─ --detach flag? ─┐
│                  │
├─ YES ─┐          │
│       ├─ Try Memory Detachment
│       ├─ Success? ─┐
│       │            ├─ YES ─┐
│       │            │       └─ ✅ DONE
│       │            │
│       │            └─ NO ──┐
│       │                   ├─ Fallback to Timer
│       └─────────────────── ┘
│                            │
└─ NO ─┐                     │
       ├─ Try Timer ─────────┘
       ├─ Success? ─┐
       │            ├─ YES ─┐
       │            │       └─ ✅ DONE
       │            │
       │            └─ NO ──┐
       │                   └─ 📝 Manual Instructions
       └─────────────────────────────────────────────
```

## 📋 Command Line Options

| Flag          | Short | Description                                          |
| ------------- | ----- | ---------------------------------------------------- |
| `--dry-run`   | `-d`  | Show what would be deleted without actually deleting |
| `--verbose`   | `-v`  | Show detailed progress and file lists                |
| `--recursive` | `-r`  | Deep recursive cleaning throughout the entire tree   |
| `--detach`    |       | Force detached process deletion for node_modules     |
| `--help`      | `-h`  | Show help message                                    |

## 📊 Usage Examples

### Basic Operations

```bash
# Quick cleanup (current directory only)
purge-builds

# Deep monorepo cleanup
purge-builds --recursive

# See what would be deleted
purge-builds --dry-run --verbose
```

### Advanced Operations

```bash
# Force advanced memory detachment
purge-builds --recursive --detach

# Verbose dry-run to see everything
purge-builds -drv

# Silent cleanup with fallback handling
purge-builds --recursive > cleanup.log 2>&1
```

### Integration with Package Scripts

```json
{
  "scripts": {
    "clean": "purge-builds --recursive --detach",
    "clean:preview": "purge-builds --dry-run --recursive --verbose",
    "clean:safe": "purge-builds",
    "clean:deep": "purge-builds --recursive --detach"
  }
}
```

## 🔧 How It Works

### 1. **Smart Scanning**

- Uses native Node.js `fs` APIs for maximum performance
- Recursively walks directory trees
- Calculates accurate file sizes
- Respects `.gitignore` patterns

### 2. **Intelligent Pattern Matching**

```typescript
// What gets deleted
const DELETE_PATTERNS = {
  directories: ['.turbo', '.tsup', 'dist', 'node_modules', '.pnpm'],
  files: ['pnpm-lock.yaml'],
  fileExtensions: ['.tsbuildinfo'],
};

// What gets protected
const PROTECT_PATTERNS = ['.git', '.env', 'package.json', 'src'];
```

### 3. **Self-Preservation Logic**

```typescript
function isPartOfCurrentExecution(itemPath: string): boolean {
  const currentScript = getCurrentExecutionPath();

  if (currentScript.includes('node_modules/@finografic/project-scripts')) {
    return itemPath.includes('node_modules/@finografic/project-scripts');
  }

  if (currentScript.includes('packages/purge-builds')) {
    return itemPath.includes('packages/purge-builds/dist');
  }

  return false;
}
```

## 🌍 Cross-Platform Support

### macOS & Linux

- Native `rm -rf` commands
- POSIX-compliant shell scripting
- UTF-8 path handling

### Windows

- `rmdir /s /q` commands
- CMD and PowerShell compatibility
- Windows path format handling

## 🚨 Safety Features

### Built-in Protections

- **Source Code**: Never deletes `src/`, `apps/`, `packages/`
- **Configuration**: Protects `package.json`, `.env*`, `.git/`
- **Self-Preservation**: Never deletes its own execution environment
- **Dry-Run Mode**: Safe preview before actual deletion

### Error Handling

- Graceful failure for permission issues
- Detailed error reporting
- Automatic fallback between deletion methods
- Safe cleanup of temporary files

## 🎭 Output Examples

### Dry Run Output

```
🔒 DRY RUN MODE - NO FILES WILL BE DELETED

⚠️  This is a simulation only. Remove --dry-run to actually delete files.

📁 Scanning for build artifacts...

Working Directory: /path/to/monorepo
Mode: Recursive (deep)
Operation: DRY RUN (simulation)

📋 Found 15 items to clean:
   • 12 directories
   • 3 files
   • 1.2 GB total size

📝 Items to be processed:

📁 Directories:
   node_modules (1.1 GB)
   apps/client/dist (45.2 MB)
   packages/core/.turbo (12.3 KB)
   ...

📄 Files:
   pnpm-lock.yaml (156.4 KB)
   tsconfig.tsbuildinfo (8.2 KB)

🔒 DRY RUN: No files were actually deleted.
Would have freed 1.2 GB of space.
```

### Live Operation Output

```
Working Directory: /path/to/monorepo
Mode: Recursive (deep)
Operation: LIVE (actual deletion)

✔ Found 32 items to clean
   • 30 directories
   • 2 files
   • 2.1 GB total size

✔ Deleted 31 items

🔄 Handling deferred deletions...

🧠 Attempting memory detachment for node_modules...
⚠ Deletion process started but completion unconfirmed
⏰ Memory-detached: node_modules will be deleted after process exits
✔ Cleaned up empty directories

✅ Cleanup completed in 8561ms
   • 32 items deleted
   • 2.1 GB freed
```

## 🔗 Integration

### Monorepo Usage

Perfect for monorepos with multiple build outputs:

```
monorepo/
├── apps/
│   ├── client/dist/          ← Cleaned
│   └── server/dist/          ← Cleaned
├── packages/
│   ├── ui/.turbo/           ← Cleaned
│   └── utils/dist/          ← Cleaned
├── node_modules/            ← Advanced deletion
└── pnpm-lock.yaml          ← Cleaned
```

### CI/CD Integration

```yaml
# GitHub Actions
- name: Clean build artifacts
  run: npx purge-builds --recursive --detach

# GitLab CI
script:
  - pnpm dlx @finografic/project-scripts purge-builds --recursive
```

## 🤝 Contributing

Found an edge case or have an idea for improvement? Contributions welcome!

## 📜 License

MIT License - See package root for details.

---

## 🧠 Technical Innovation

This tool represents a novel solution to the "self-deletion paradox" in CLI applications. The dual-approach system (memory detachment + timer fallback) ensures reliable cleanup across all environments while maintaining safety and user experience.

**Key innovations:**

- ✨ **Process isolation** through temporary script generation
- ✨ **Cross-platform timer commands** with native shell integration
- ✨ **Intelligent fallback system** for maximum reliability
- ✨ **Self-cleaning temporary files** to prevent system pollution
- ✨ **Real-time progress feedback** with beautiful CLI output
- ✨ **Interactive spinners** for each operation phase
- ✨ **Accurate progress tracking** with combined deletion totals

_Built with ❤️ for the JavaScript/TypeScript ecosystem_
