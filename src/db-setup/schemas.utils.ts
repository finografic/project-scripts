import fs from "node:fs";
import { loadModule } from "../utils/module.utils";
import path from "node:path";
import chalk from "chalk";
import { findScriptConfigFile } from "../utils/config.utils";
import { findProjectRoot } from "../utils/project.utils";
import type { SeedConfig, ViewConfig } from "./db-setup.types";
import {
  PATH_FILES_CONFIG,
  PATH_FOLDER_SCHEMAS,
  SCHEMAS_BLOCKLIST,
} from "./schemas.config";
import { checkbox } from "@inquirer/prompts";

export const loadSeedConfig = async ({
  configFileGlob = PATH_FILES_CONFIG,
}: { configFileGlob?: string | string[] } = {}): Promise<{
  seedConfigs: SeedConfig[];
}> => {
  const projectRoot = findProjectRoot();
  const configFileGlobArr = Array.isArray(configFileGlob)
    ? configFileGlob
    : [configFileGlob];

  // Try both .ts and .js extensions
  const configPath = findScriptConfigFile(
    configFileGlobArr.flatMap((pattern) => [
      pattern,
      pattern.replace(/\.ts$/, ".js"),
      `${pattern}.js`,
      `${pattern}.ts`,
    ]),
    projectRoot
  );

  if (!configPath) {
    throw new Error(
      "No config file found! Please create a db-setup.config.ts or db-setup.config.js file."
    );
  }

  try {
    const configModule = await loadModule<{ seedConfigs: SeedConfig[] }>(
      configPath
    );
    return { seedConfigs: configModule.seedConfigs };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ERR_UNKNOWN_FILE_EXTENSION"
    ) {
      console.error(chalk.red("\n❌ Error loading TypeScript config file."));
      console.error(chalk.yellow("Please either:"));
      console.error(
        chalk.yellow("1. Use a .js extension for your config file")
      );
      console.error(
        chalk.yellow("2. Run with tsx if you want to keep the .ts extension")
      );
      process.exit(1);
    }
    console.error(
      chalk.red(`❌ Error loading config from ${configPath}:`),
      error
    );
    process.exit(1);
  }
};

export const loadViewConfig = async ({
  configFileGlob = PATH_FILES_CONFIG,
}: { configFileGlob?: string | string[] } = {}): Promise<{
  viewConfigs: ViewConfig[];
}> => {
  const projectRoot = findProjectRoot();
  const configFileGlobArr = Array.isArray(configFileGlob)
    ? configFileGlob
    : [configFileGlob];

  // Try both .ts and .js extensions
  const configPath = findScriptConfigFile(
    configFileGlobArr.flatMap((pattern) => [
      pattern,
      pattern.replace(/\.ts$/, ".js"),
      `${pattern}.js`,
      `${pattern}.ts`,
    ]),
    projectRoot
  );

  if (!configPath) {
    throw new Error(
      "No config file found! Please create a db-setup.config.ts or db-setup.config.js file."
    );
  }

  try {
    const configModule = await loadModule<{ viewConfigs: ViewConfig[] }>(
      configPath
    );
    return { viewConfigs: configModule.viewConfigs || [] };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ERR_UNKNOWN_FILE_EXTENSION"
    ) {
      console.error(chalk.red("\n❌ Error loading TypeScript config file."));
      console.error(chalk.yellow("Please either:"));
      console.error(
        chalk.yellow("1. Use a .js extension for your config file")
      );
      console.error(
        chalk.yellow("2. Run with tsx if you want to keep the .ts extension")
      );
      process.exit(1);
    }
    console.error(
      chalk.red(`❌ Error loading config from ${configPath}:`),
      error
    );
    process.exit(1);
  }
};

// Helper to get all available schemas
export const getAllSchemas = ({ seedConfigs }: { seedConfigs: SeedConfig[] }) =>
  seedConfigs.map((config) => config.name);

// Helper to validate dependencies
export const validateDependencies = ({
  seedConfigs,
  selectedSchemas,
}: {
  seedConfigs: SeedConfig[];
  selectedSchemas: string[];
}) => {
  const missing: { schema: string; dependencies: string[] }[] = [];

  selectedSchemas.forEach((schema) => {
    const config = seedConfigs.find((c) => c.name === schema);
    if (config?.dependencies) {
      const missingDeps = config.dependencies.filter(
        (dep) => !selectedSchemas.includes(dep)
      );
      if (missingDeps.length > 0) {
        missing.push({ schema, dependencies: missingDeps });
      }
    }
  });

  return missing;
};

// Helper to sort schemas based on dependencies
export const getSortedSchemas = ({
  seedConfigs,
  selectedSchemas,
}: {
  seedConfigs: SeedConfig[];
  selectedSchemas: string[];
}) => {
  const result: string[] = [];
  const visited = new Set<string>();

  function visit(schema: string) {
    if (visited.has(schema)) return;

    const config = seedConfigs.find((c) => c.name === schema);
    if (config?.dependencies) {
      config.dependencies.forEach((dep) => {
        if (selectedSchemas.includes(dep)) {
          visit(dep);
        }
      });
    }

    visited.add(schema);
    result.push(schema);
  }

  selectedSchemas.forEach((schema) => visit(schema));
  return result;
};

export const getSchemaSelection = async ({
  seedConfigs,
}: {
  seedConfigs: SeedConfig[];
}) => {
  const schemasDir = path.join(process.cwd(), PATH_FOLDER_SCHEMAS);

  if (!fs.existsSync(schemasDir)) {
    console.error(chalk.red(`❌ Schemas directory not found: ${schemasDir}`));
    process.exit(1);
  }

  // Get available schemas from config
  const schemas = getAllSchemas({ seedConfigs }).filter(
    (schema) => !SCHEMAS_BLOCKLIST.includes(schema)
  );

  if (schemas.length === 0) {
    console.warn(chalk.yellow("⚠️ No schema files found"));
    return [];
  }

  const selectedSchemas = await checkbox({
    message: "Select schemas to process",
    choices: schemas.map((schema) => ({
      name: schema,
      value: schema,
      checked: true,
    })),
  });

  // Validate dependencies
  const missingDeps = validateDependencies({ seedConfigs, selectedSchemas });
  if (missingDeps.length > 0) {
    console.error(chalk.red("\n❌ Missing dependencies:"));
    missingDeps.forEach(({ schema, dependencies }) => {
      console.error(
        chalk.red(`  ${schema} requires: ${dependencies.join(", ")}`)
      );
    });
    process.exit(1);
  }

  // Sort based on dependencies
  return getSortedSchemas({ seedConfigs, selectedSchemas });
};
