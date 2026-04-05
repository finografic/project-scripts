import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkbox } from '@inquirer/prompts';
import type { SeedConfig, ViewConfig } from './db-setup.types';

import { pc } from 'utils/picocolors';
import { findScriptConfigFile } from '../utils/config.utils';
import { findProjectRoot } from '../utils/project.utils';
import { PATH_FILES_CONFIG, PATH_FOLDER_SCHEMAS, SCHEMAS_BLOCKLIST } from './schemas.config';

export const loadSeedConfig = async ({
  configFileGlob = PATH_FILES_CONFIG,
}: { configFileGlob?: string | string[] } = {}): Promise<{
  seedConfigs: SeedConfig[];
}> => {
  const projectRoot = findProjectRoot();
  const configFileGlobArr = Array.isArray(configFileGlob) ? configFileGlob : [configFileGlob];

  /**
   * Find the db-setup `.ts` config (typed SeedConfig / ViewConfig).
   * Tries each glob as given, then `${pattern}.ts`. Runtime `.ts` import needs `NODE_OPTIONS='--import tsx'`.
   */
  const configPath = findScriptConfigFile(
    configFileGlobArr.flatMap((pattern) => [pattern, `${pattern}.ts`]),
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
      console.error(pc.red('\n❌ Error loading TypeScript config file.'));
      console.error(
        pc.yellow(
          "Node.js cannot import .ts files directly. Please run with: NODE_OPTIONS='--import tsx' db-setup",
        ),
      );
      console.error(
        pc.yellow('TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.'),
      );
      process.exit(1);
    }
    console.error(pc.red(`❌ Error loading config from ${configPath}:`), error);
    process.exit(1);
  }
};

export const loadViewConfig = async ({
  configFileGlob = PATH_FILES_CONFIG,
}: { configFileGlob?: string | string[] } = {}): Promise<{
  viewConfigs: ViewConfig[];
}> => {
  const projectRoot = findProjectRoot();
  const configFileGlobArr = Array.isArray(configFileGlob) ? configFileGlob : [configFileGlob];

  /**
   * Find the db-setup `.ts` config (typed SeedConfig / ViewConfig).
   * Tries each glob as given, then `${pattern}.ts`. Runtime `.ts` import needs `NODE_OPTIONS='--import tsx'`.
   */
  const configPath = findScriptConfigFile(
    configFileGlobArr.flatMap((pattern) => [pattern, `${pattern}.ts`]),
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
      console.error(pc.red('\n❌ Error loading TypeScript config file.'));
      console.error(
        pc.yellow(
          "Node.js cannot import .ts files directly. Please run with: NODE_OPTIONS='--import tsx' db-setup",
        ),
      );
      console.error(
        pc.yellow('TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.'),
      );
      process.exit(1);
    }
    console.error(pc.red(`❌ Error loading config from ${configPath}:`), error);
    process.exit(1);
  }
};

export const getAllSchemas = ({ seedConfigs }: { seedConfigs: SeedConfig[] }) =>
  seedConfigs.map((config) => config.name);

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
      const missingDeps = config.dependencies.filter((dep) => !selectedSchemas.includes(dep));
      if (missingDeps.length > 0) {
        missing.push({ schema, dependencies: missingDeps });
      }
    }
  });

  return missing;
};

// ─── SORT SCHEMAS BASED ON DEPENDENCIES ──────────────────────────────────────

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

export const getSchemaSelection = async ({ seedConfigs }: { seedConfigs: SeedConfig[] }) => {
  const schemasDir = path.join(process.cwd(), PATH_FOLDER_SCHEMAS);

  if (!fs.existsSync(schemasDir)) {
    console.error(pc.red(`❌ Schemas directory not found: ${schemasDir}`));
    process.exit(1);
  }

  // ─── GET AVAILABLE SCHEMAS ────────────────────────────────────────────────────

  const schemas = getAllSchemas({ seedConfigs }).filter((schema) => !SCHEMAS_BLOCKLIST.includes(schema));

  if (schemas.length === 0) {
    console.warn(pc.yellow('⚠️ No schema files found'));
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

  // ─── VALIDATE DEPENDENCIES ────────────────────────────────────────────────────

  const missingDeps = validateDependencies({ seedConfigs, selectedSchemas });
  if (missingDeps.length > 0) {
    console.error(pc.red('\n❌ Missing dependencies:'));
    missingDeps.forEach(({ schema, dependencies }) => {
      console.error(pc.red(`  ${schema} requires: ${dependencies.join(', ')}`));
    });
    process.exit(1);
  }

  return getSortedSchemas({ seedConfigs, selectedSchemas });
};
