#!/usr/bin/env node
import { t as findProjectRoot } from './project.utils-DwHmJtzL.mjs';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkbox } from '@inquirer/prompts';

// #region src/db-setup/schemas.config.ts
const PATH_FOLDER_ENV = '.';
const PATH_FOLDER_SCHEMAS = 'apps/server/src/db/schemas';
const PATH_FILES_CONFIG = ['config/db-setup.config.ts', 'db-setup.config.ts'];
const SCHEMAS_BETTER_AUTH = [
  'auth_account',
  'auth_session',
  'auth_verification',
];
const SCHEMAS_BLOCKLIST = [...SCHEMAS_BETTER_AUTH];

// #endregion
// #region src/utils/config.utils.ts
const findScriptConfigFile = (configNames, startDir = process.cwd()) => {
  let dir = startDir;
  while (true) {
    for (const name of configNames) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
};

// #endregion
// #region src/db-setup/schemas.utils.ts
const loadSeedConfig = async ({ configFileGlob = PATH_FILES_CONFIG } = {}) => {
  const projectRoot = findProjectRoot();
  const configPath = findScriptConfigFile(
    (Array.isArray(configFileGlob) ? configFileGlob : [configFileGlob]).flatMap((
      pattern,
    ) => [pattern, `${pattern}.ts`]),
    projectRoot,
  );
  if (!configPath) {
    throw new Error(
      'No config file found! Please create a db-setup.config.ts file. Note: TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.',
    );
  }
  try {
    return { seedConfigs: (await import(pathToFileURL(configPath).href)).seedConfigs };
  } catch (error) {
    if (
      error && typeof error === 'object' && 'code' in error
      && error.code === 'ERR_UNKNOWN_FILE_EXTENSION'
    ) {
      console.error(chalk.red('\n❌ Error loading TypeScript config file.'));
      console.error(
        chalk.yellow(
          "Node.js cannot import .ts files directly. Please run with: NODE_OPTIONS='--import tsx' db-setup",
        ),
      );
      console.error(
        chalk.yellow(
          'TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.',
        ),
      );
      process.exit(1);
    }
    console.error(chalk.red(`❌ Error loading config from ${configPath}:`), error);
    process.exit(1);
  }
};
const loadViewConfig = async ({ configFileGlob = PATH_FILES_CONFIG } = {}) => {
  const projectRoot = findProjectRoot();
  const configPath = findScriptConfigFile(
    (Array.isArray(configFileGlob) ? configFileGlob : [configFileGlob]).flatMap((
      pattern,
    ) => [pattern, `${pattern}.ts`]),
    projectRoot,
  );
  if (!configPath) {
    throw new Error(
      'No config file found! Please create a db-setup.config.ts file. Note: TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.',
    );
  }
  try {
    return { viewConfigs: (await import(pathToFileURL(configPath).href)).viewConfigs || [] };
  } catch (error) {
    if (
      error && typeof error === 'object' && 'code' in error
      && error.code === 'ERR_UNKNOWN_FILE_EXTENSION'
    ) {
      console.error(chalk.red('\n❌ Error loading TypeScript config file.'));
      console.error(
        chalk.yellow(
          "Node.js cannot import .ts files directly. Please run with: NODE_OPTIONS='--import tsx' db-setup",
        ),
      );
      console.error(
        chalk.yellow(
          'TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.',
        ),
      );
      process.exit(1);
    }
    console.error(chalk.red(`❌ Error loading config from ${configPath}:`), error);
    process.exit(1);
  }
};
const getAllSchemas = ({ seedConfigs }) => seedConfigs.map((config) => config.name);
const validateDependencies = ({ seedConfigs, selectedSchemas }) => {
  const missing = [];
  selectedSchemas.forEach((schema) => {
    const config = seedConfigs.find((c) => c.name === schema);
    if (config?.dependencies) {
      const missingDeps = config.dependencies.filter((dep) => !selectedSchemas.includes(dep));
      if (missingDeps.length > 0) {
        missing.push({
          schema,
          dependencies: missingDeps,
        });
      }
    }
  });
  return missing;
};
const getSortedSchemas = ({ seedConfigs, selectedSchemas }) => {
  const result = [];
  const visited = /* @__PURE__ */ new Set();
  function visit(schema) {
    if (visited.has(schema)) return;
    const config = seedConfigs.find((c) => c.name === schema);
    if (config?.dependencies) {
      config.dependencies.forEach((dep) => {
        if (selectedSchemas.includes(dep)) visit(dep);
      });
    }
    visited.add(schema);
    result.push(schema);
  }
  selectedSchemas.forEach((schema) => visit(schema));
  return result;
};
const getSchemaSelection = async ({ seedConfigs }) => {
  const schemasDir = path.join(process.cwd(), PATH_FOLDER_SCHEMAS);
  if (!fs.existsSync(schemasDir)) {
    console.error(chalk.red(`❌ Schemas directory not found: ${schemasDir}`));
    process.exit(1);
  }
  const schemas = getAllSchemas({ seedConfigs }).filter((schema) =>
    !SCHEMAS_BLOCKLIST.includes(schema)
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
  const missingDeps = validateDependencies({
    seedConfigs,
    selectedSchemas,
  });
  if (missingDeps.length > 0) {
    console.error(chalk.red('\n❌ Missing dependencies:'));
    missingDeps.forEach(({ schema, dependencies }) => {
      console.error(chalk.red(`  ${schema} requires: ${dependencies.join(', ')}`));
    });
    process.exit(1);
  }
  return getSortedSchemas({
    seedConfigs,
    selectedSchemas,
  });
};

// #endregion
// #region src/db-setup/db-setup.ts
const autoConfirm = process.argv.includes('-y') || process.argv.includes('--yes');
console.log('--- [db-setup] Script started ---');
const nodeEnv = process.env.NODE_ENV || 'development';
console.log('[db-setup] NODE_ENV:', nodeEnv);
if (
  ![
    'development',
    'test',
    'production',
  ].includes(nodeEnv)
) console.warn(chalk.yellow(`⚠️ Unexpected NODE_ENV: ${nodeEnv}, defaulting to development`));
const envPath = path.resolve(process.cwd(), `${PATH_FOLDER_ENV}/.env.${nodeEnv}`);
console.log('[db-setup] Looking for env file at:', envPath);
if (!fs.existsSync(envPath)) {
  console.error(chalk.red(`❌ Environment file not found: ${envPath}`));
  process.exit(1);
}
const envVars = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const [, key, value] = match;
    acc[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
  }
  return acc;
}, {});
Object.entries(envVars).forEach(([key, value]) => {
  if (!process.env[key]) process.env[key] = value;
});
console.log('[db-setup] Loaded env config');
async function generateMigrations() {
  console.log('[db-setup] Running generateMigrations...');
  execSync('pnpm --filter @workspace/server db.migrations.generate', {
    stdio: 'inherit',
    env: process.env,
  });
}
async function runMigrations() {
  console.log('[db-setup] Running runMigrations...');
  execSync('pnpm --filter @workspace/server db.migrations.run', {
    stdio: 'inherit',
    env: process.env,
  });
}
async function seedData(schemas) {
  for (const schema of schemas) {
    try {
      console.log(chalk.blue(`\nSeeding ${schema}...`));
      const seedName = schema.startsWith('auth_') ? schema.replace('auth_', '') : schema;
      console.log(`[db-setup] Seeding: ${seedName}`);
      execSync(`pnpm --filter @workspace/server db.migrations.seed ${seedName}`, {
        stdio: 'inherit',
        env: process.env,
      });
      console.log(chalk.green(`✅ Seeded ${schema} successfully!`));
    } catch (error) {
      console.error(chalk.red(`❌ Error seeding ${schema}:`), error);
      throw error;
    }
  }
}
async function createViews() {
  try {
    console.log('[db-setup] Loading view config...');
    const { viewConfigs } = await loadViewConfig();
    if (!viewConfigs || viewConfigs.length === 0) {
      console.log(chalk.yellow('⚠️ No views configured to create'));
      return;
    }
    for (const view of viewConfigs) {
      try {
        console.log(chalk.blue(`Creating view: ${view.name}...`));
        execSync(`pnpm --filter @workspace/server db.views.create.single ${view.name}`, {
          stdio: 'inherit',
          env: process.env,
        });
        console.log(chalk.green(`✅ Created view: ${view.name}`));
      } catch (error) {
        console.error(chalk.red(`❌ Error creating view ${view.name}:`), error);
        throw error;
      }
    }
  } catch (error) {
    console.error(chalk.red('❌ Error loading view configuration:'), error);
    throw error;
  }
}
async function main() {
  try {
    console.log('[db-setup] About to show operations prompt...');
    let operations;
    if (autoConfirm) {
      operations = ['seed', 'views'];
      console.log('[db-setup] Auto-confirm enabled: defaulting to operations:', operations);
    } else {operations = await checkbox({
        message: 'Select operations to perform',
        choices: [
          {
            name: 'Seed data',
            value: 'seed',
            checked: true,
          },
          {
            name: 'Create views',
            value: 'views',
            checked: true,
          },
          {
            name: 'Run migrations',
            value: 'migrate',
            checked: false,
          },
          {
            name: 'Generate migrations',
            value: 'generate',
            checked: false,
          },
        ],
      });}
    console.log('[db-setup] Operations selected:', operations);
    if (operations.length === 0) {
      console.log('No operations selected. Exiting...');
      process.exit(0);
    }
    console.log('[db-setup] Loading seed config...');
    let schemas = [];
    if (operations.includes('seed')) {
      if (autoConfirm) {
        const { seedConfigs } = await loadSeedConfig();
        schemas = seedConfigs.map((s) => s.name);
        console.log('[db-setup] Auto-confirm enabled: seeding all schemas:', schemas);
      } else {
        const { seedConfigs } = await loadSeedConfig();
        schemas = await getSchemaSelection({ seedConfigs });
      }
    }
    console.log('[db-setup] Schemas selected:', schemas);
    if (operations.includes('generate')) {
      console.log(chalk.blue('\n1. Generating migrations...'));
      await generateMigrations();
    }
    if (operations.includes('migrate')) {
      console.log(chalk.blue('\n2. Running migrations...'));
      await runMigrations();
    }
    if (operations.includes('seed')) {
      console.log(chalk.blue('\n3. Seeding data...'));
      await seedData(schemas);
    }
    if (operations.includes('views')) {
      console.log(chalk.blue('\n4. Creating views...'));
      await createViews();
    }
    console.log('--- [db-setup] Script finished ---');
  } catch (error) {
    console.error(chalk.red('\n❌ Unexpected error:'));
    console.error(error);
    process.exit(1);
  }
}
var db_setup_default = main;
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Failed to run db-setup:', error);
    process.exit(1);
  });
}

// #endregion
export { db_setup_default as default, main };
