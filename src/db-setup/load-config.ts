import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { findProjectRoot } from "../utils/project.utils.js";
import type { ViewConfig } from "./types";

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

export async function loadConfig(): Promise<{ viewConfigs: ViewConfig[] }> {
  const projectRoot = findProjectRoot();

  // Try to find the config file
  for (const configPath of CONFIG_PATHS) {
    const fullPath = path.join(projectRoot, configPath);
    if (fs.existsSync(fullPath)) {
      try {
        const configUrl = pathToFileURL(fullPath).href;
        const config = await import(configUrl);
        return config.default || config;
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
    if (fs.existsSync(fullPath)) {
      try {
        const adapterUrl = pathToFileURL(fullPath).href;
        const adapter = await import(adapterUrl);
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
