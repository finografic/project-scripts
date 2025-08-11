import { defineConfig } from "tsup";

export default defineConfig([
  // Build sqlite-rebuild CLI script
  {
    entry: ["src/sqlite-rebuild/sqlite-rebuild.ts"],
    outDir: "./bin",
    format: ["cjs", "esm"],
    target: "node18",
    platform: "node",
    clean: false,
    dts: false,
    bundle: true,
    splitting: false,
    treeshake: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
    external: ["fs", "path", "child_process"],
  },
  // Build CLI scripts to bin/
  {
    entry: {
      "clean-docs": "src/clean-docs/clean-docs.ts",
      "db-setup": "src/db-setup/db-setup.ts",
      "purge-builds": "src/purge-builds/src/purge-builds/index.ts",
    },
    outDir: "bin",
    format: ["cjs", "esm"],
    target: "node18",
    platform: "node",
    shims: true,
    clean: true,
    minify: false,
    splitting: false,
    sourcemap: false,
    dts: false, // No types for CLI
    banner: {
      js: "#!/usr/bin/env node",
    },
    external: ["fs", "path", "child_process"],
    treeshake: true,
  },
  // Build library entry points to dist/
  {
    entry: {
      "clean-docs/index": "src/clean-docs/index.ts",
      "db-setup/index": "src/db-setup/index.ts",
      "db-setup/config.template": "src/db-setup/config.template.ts",
      "purge-builds/src/purge-builds/index":
        "src/purge-builds/src/purge-builds/index.ts",
      "sqlite-rebuild/index": "src/sqlite-rebuild/index.ts",
      "utils/index": "src/utils/index.ts",
    },
    outDir: "dist",
    format: ["cjs", "esm"],
    target: "node18",
    platform: "node",
    shims: true,
    clean: true,
    minify: false,
    splitting: false,
    sourcemap: false,
    dts: true,
    bundle: true,
    external: ["fs", "path"],
    treeshake: true,
  },
]);
