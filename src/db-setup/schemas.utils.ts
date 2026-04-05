import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { checkbox } from '@inquirer/prompts';
import chalk from 'chalk';

import { findScriptConfigFile } from '../utils/config.utils';
import { findProjectRoot } from '../utils/project.utils';
import type { SeedConfig, ViewConfig } from './db-setup.types';
import {
  PATH_FILES_CONFIG,
  PATH_FOLDER_SCHEMAS,
  SCHEMAS_BLOCKLIST,
} from './schemas.config';

export const loadSeedConfig = async ({
  configFileGlob = PATH_FILES_CONFIG,
}: { configFileGlob?: string | string[] } = {}): Promise<{
  seedConfigs: SeedConfig[];
}> => {
  const projectRoot = findProjectRoot();
  const configFileGlobArr = Array.isArray(configFileGlob)
    ? configFileGlob
    : [configFileGlob];

  // Find .ts config file (TypeScript is required for type safety with SeedConfig/ViewConfig)
  // Note: Node.js cannot import .ts files directly - requires NODE_OPTIONS='--import tsx'
  const configPath = findScriptConfigFile(
    configFileGlobArr.flatMap((pattern) => [
      pattern, // Primary: .ts file (e.g., 'config/db-setup.config.ts')
      `${pattern}.ts`, // Fallback: add .ts if not present
    ]),
    projectRoot,
  );

  if (!configPath) {
    throw new Error(
      'No config file found! Please create a db-setup.config.ts file. ' +
        'Note: TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.',
    );
  }

  try {
    const configModule = await import(pathToFileURL(configPath).href);
    return { seedConfigs: configModule.seedConfigs };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ERR_UNKNOWN_FILE_EXTENSION'
    ) {
      console.error(chalk.red('\n❌ Error loading TypeScript config file.'));
      console.error(
        chalk.yellow(
          'Node.js cannot import .ts files directly. Please run with: NODE_OPTIONS=\'--import tsx\' db-setup',
        ),
      );
      console.error(
        chalk.yellow(
          'TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.',
        ),
      );
      process.exit(1);
    }
    console.error(
      chalk.red(`❌ Error loading config from ${configPath}:`),
      error,
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

  // Find .ts config file (TypeScript is required for type safety with SeedConfig/ViewConfig)
  // Note: Node.js cannot import .ts files directly - requires NODE_OPTIONS='--import tsx'
  const configPath = findScriptConfigFile(
    configFileGlobArr.flatMap((pattern) => [
      pattern, // Primary: .ts file (e.g., 'config/db-setup.config.ts')
      `${pattern}.ts`, // Fallback: add .ts if not present
    ]),
    projectRoot,
  );

  if (!configPath) {
    throw new Error(
      'No config file found! Please create a db-setup.config.ts file. ' +
        'Note: TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.',
    );
  }

  try {
    const configModule = await import(pathToFileURL(configPath).href);
    return { viewConfigs: configModule.viewConfigs || [] };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ERR_UNKNOWN_FILE_EXTENSION'
    ) {
      console.error(chalk.red('\n❌ Error loading TypeScript config file.'));
      console.error(
        chalk.yellow(
          'Node.js cannot import .ts files directly. Please run with: NODE_OPTIONS=\'--import tsx\' db-setup',
        ),
      );
      console.error(
        chalk.yellow(
          'TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.',
        ),
      );
      process.exit(1);
    }
    console.error(
      chalk.red(`❌ Error loading config from ${configPath}:`),
      error,
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
        (dep) => !selectedSchemas.includes(dep),
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
    (schema) => !SCHEMAS_BLOCKLIST.includes(schema),
  );

  if (schemas.length === 0) {
    console.warn(chalk.yellow('⚠️ No schema files found'));
    return [];
  }

  const selectedSchemas = await checkbox({
    message: 'Select schemas to process',
    choices: schemas.map((schema) => ({
      name: schema,
      value: schema,
      checked: true,
    })),
  });

  // Validate dependencies
  const missingDeps = validateDependencies({ seedConfigs, selectedSchemas });
  if (missingDeps.length > 0) {
    console.error(chalk.red('\n❌ Missing dependencies:'));
    missingDeps.forEach(({ schema, dependencies }) => {
      console.error(
        chalk.red(`  ${schema} requires: ${dependencies.join(', ')}`),
      );
    });
    process.exit(1);
  }

  // Sort based on dependencies
  return getSortedSchemas({ seedConfigs, selectedSchemas });
};
