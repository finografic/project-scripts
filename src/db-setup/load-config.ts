import fs from "node:fs";
import path from "node:path";
import { findProjectRoot } from "../utils/project.utils.js";
import type { ViewConfig, DbSetupConfig } from "./db-setup.types";
import { loadModule } from "../utils/module.utils";

const CONFIG_PATHS = [
  "scripts/db-setup.config.ts",
  "scripts/db-setup.config.js",
  "db-setup.config.ts",
  "db-setup.config.js",
];

const ADAPTER_PATHS = [
  "apps/server/src/db/db.adapter.ts",
  "apps/server/src/db/db.adapter.js",
];

export async function loadConfig(): Promise<DbSetupConfig> {
  const projectRoot = findProjectRoot();

  // Try to find the config file
  for (const configPath of CONFIG_PATHS) {
    const fullPath = path.join(projectRoot, configPath);
    if (fs.existsSync(fullPath)) {
      try {
        const config = await loadModule<DbSetupConfig>(fullPath);
        return config;
      } catch (error) {
        console.error(`Failed to load config from ${fullPath}:`, error);
        throw error;
      }
    }
  }

  throw new Error(
    `No config file found! Please create one of: ${CONFIG_PATHS.join(", ")}`
  );
}

export async function loadAdapter() {
  const projectRoot = findProjectRoot();

  // Try to find the adapter file
  for (const adapterPath of ADAPTER_PATHS) {
    const fullPath = path.join(projectRoot, adapterPath);
    console.log("[db-setup] Looking for adapter at:", fullPath);
    if (fs.existsSync(fullPath)) {
      try {
        const adapter = await loadModule<{ sqliteAny: any }>(fullPath);
        if (!adapter.sqliteAny) {
          throw new Error(`Adapter at ${fullPath} does not export 'sqliteAny'`);
        }
        return adapter.sqliteAny;
      } catch (error) {
        console.error(`Failed to load adapter from ${fullPath}:`, error);
        throw error;
      }
    }
  }

  throw new Error(
    `No adapter file found! Please ensure it exists at one of: ${ADAPTER_PATHS.join(", ")}`
  );
}
