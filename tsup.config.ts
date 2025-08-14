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
      "build-deployment": "src/build-deployment/cli.ts",
    },
    outDir: "bin",
    format: ["esm"], // CLI only needs ESM
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
    // Copy templates to output
    async onSuccess() {
      const { cp } = await import("fs/promises");
      const { join } = await import("path");
      const { fileURLToPath } = await import("url");
      const __dirname = fileURLToPath(new URL(".", import.meta.url));

      // Copy templates to bin/templates
      await cp(
        join(__dirname, "src/build-deployment/templates"),
        join(__dirname, "bin/build-deployment/templates"),
        { recursive: true }
      ).catch(console.error);

      // Also copy to dist for library usage
      await cp(
        join(__dirname, "src/build-deployment/templates"),
        join(__dirname, "dist/build-deployment/templates"),
        { recursive: true }
      ).catch(console.error);
    },
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
      "build-deployment/index": "src/build-deployment/index.ts",
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
