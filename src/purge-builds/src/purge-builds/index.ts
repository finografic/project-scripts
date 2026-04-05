// CLI entry point
import { purge } from './purge';

// Display help information
function showHelp() {
  console.log(`
purge-builds - Clean build artifacts and dependencies from monorepo

USAGE:
  purge-builds [OPTIONS]

OPTIONS:
  -d, --dry-run       Show what would be deleted without actually deleting
  -v, --verbose       Show detailed progress and file lists
  -r, --recursive     Deep recursive cleaning throughout the entire tree
  --detach            Force detached process deletion for node_modules
  -h, --help          Show this help message

EXAMPLES:
  purge-builds                    # Clean current directory level only
  purge-builds --dry-run          # Preview what would be deleted
  purge-builds -dv                # Dry run with verbose output
  purge-builds --recursive        # Deep clean entire monorepo tree
  purge-builds --recursive --detach  # Force detached node_modules deletion

WHAT IT DELETES:
  • Build directories (.turbo, .tsup, dist, node_modules, .pnpm)
  • Build files (*.tsbuildinfo, pnpm-lock.yaml)

WHAT IT PROTECTS:
  • Source code (src/, apps/, packages/)
  • Configuration files (package.json, .env)
  • Git repository (.git/)
  • This CLI tool itself

FEATURES:
  • Native Node.js APIs (no glob dependencies)
  • Better recursive directory walking
  • Accurate size reporting
  • Clearer dry-run output
  • More reliable deletion
`);
}

// CLI execution - only runs when file is executed directly
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);

    // Check for help flag
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      process.exit(0);
    }

    await purge({
      dryRun: args.includes('--dry-run') || args.includes('-d'),
      verbose: args.includes('--verbose') || args.includes('-v'),
      recursive: args.includes('--recursive') || args.includes('-r'),
      forceDetach: args.includes('--detach'),
    });
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Check if this file is being run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
