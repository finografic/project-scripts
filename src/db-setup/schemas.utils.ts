import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { findScriptConfigFile } from '../utils/config.utils';
import { findProjectRoot } from '../utils/project.utils';
import type { SeedConfig } from './db-setup.types';
import { PATH_FILES_CONFIG, PATH_FOLDER_SCHEMAS, SCHEMAS_BLOCKLIST } from './schemas.config';
import { checkbox } from '@inquirer/prompts';

export const loadSeedConfig = async ({
  configFileGlob = PATH_FILES_CONFIG,
}: { configFileGlob?: string | string[] } = {}): Promise<{ seedOrder: SeedConfig[] }> => {
  const projectRoot = findProjectRoot();
  const configFileGlobArr = Array.isArray(configFileGlob) ? configFileGlob : [configFileGlob];
  const configPath = findScriptConfigFile([...configFileGlobArr], projectRoot);

  if (!configPath) {
    throw new Error('No config file found!');
  }

  try {
    const configModule = await import(configPath);
    return { seedOrder: configModule.seedOrder };
  } catch (error) {
    console.error(chalk.red(`❌ Error loading config from ${configPath}:`), error);
    process.exit(1);
  }
};

// Helper to get all available schemas
export const getAllSchemas = ({ seedOrder }: { seedOrder: SeedConfig[] }) =>
  seedOrder.map((config) => config.name);

// Helper to validate dependencies
export const validateDependencies = ({
  seedOrder,
  selectedSchemas,
}: { seedOrder: SeedConfig[]; selectedSchemas: string[] }) => {
  const missing: { schema: string; dependencies: string[] }[] = [];

  selectedSchemas.forEach((schema) => {
    const config = seedOrder.find((c) => c.name === schema);
    if (config?.dependencies) {
      const missingDeps = config.dependencies.filter((dep) => !selectedSchemas.includes(dep));
      if (missingDeps.length > 0) {
        missing.push({ schema, dependencies: missingDeps });
      }
    }
  });

  return missing;
};

// Helper to sort schemas based on dependencies
export const getSortedSchemas = ({
  seedOrder,
  selectedSchemas,
}: { seedOrder: SeedConfig[]; selectedSchemas: string[] }) => {
  const result: string[] = [];
  const visited = new Set<string>();

  function visit(schema: string) {
    if (visited.has(schema)) return;

    const config = seedOrder.find((c) => c.name === schema);
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

export const getSchemaSelection = async ({ seedOrder }: { seedOrder: SeedConfig[] }) => {
  const schemasDir = path.join(process.cwd(), PATH_FOLDER_SCHEMAS);

  if (!fs.existsSync(schemasDir)) {
    console.error(chalk.red(`❌ Schemas directory not found: ${schemasDir}`));
    process.exit(1);
  }

  // Get available schemas from config
  const schemas = getAllSchemas({ seedOrder }).filter((schema) => !SCHEMAS_BLOCKLIST.includes(schema));

  if (schemas.length === 0) {
    console.warn(chalk.yellow('⚠️ No schema files found'));
    return [];
  }

  const selectedSchemas = await checkbox({
    message: 'Select schemas to process',
    choices: schemas.map((schema) => ({
      name: schema,
      value: schema,
      checked: false,
    })),
  });

  // Validate dependencies
  const missingDeps = validateDependencies({ seedOrder, selectedSchemas });
  if (missingDeps.length > 0) {
    console.error(chalk.red('\n❌ Missing dependencies:'));
    missingDeps.forEach(({ schema, dependencies }) => {
      console.error(chalk.red(`  ${schema} requires: ${dependencies.join(', ')}`));
    });
    process.exit(1);
  }

  // Sort based on dependencies
  return getSortedSchemas({ seedOrder, selectedSchemas });
};
