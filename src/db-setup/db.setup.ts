#!/usr/bin/env tsx
import { checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '@dotenvx/dotenvx';
import { getAllSchemas, getSortedSchemas, validateDependencies } from './schemas.utils';
import { findConfigFile } from 'utils/findConfig';
import { findProjectRoot } from 'utils/findProjectRoot';

const projectRoot = findProjectRoot();
const configPath = findConfigFile(['scripts/seed.config.ts', 'seed.config.ts'], projectRoot);

if (!configPath) {
  throw new Error('No config file found!');
}

// Load server's env file at the start
config({ path: path.resolve(process.cwd(), 'apps/server/.env.development') });

const SCHEMA_BLACKLIST = ['auth_account', 'auth_session', 'auth_verification'];

async function getSchemaSelection() {
  const schemasDir = path.join(process.cwd(), 'apps/server/src/db/schemas');

  if (!fs.existsSync(schemasDir)) {
    console.error(chalk.red(`❌ Schemas directory not found: ${schemasDir}`));
    process.exit(1);
  }

  // Get available schemas from config
  const schemas = getAllSchemas().filter((schema) => !SCHEMA_BLACKLIST.includes(schema));

  if (schemas.length === 0) {
    console.warn(chalk.yellow('⚠️ No schema files found'));
    return [];
  }

  const selected = await checkbox({
    message: 'Select schemas to process',
    choices: schemas.map((schema) => ({
      name: schema,
      value: schema,
      checked: false,
    })),
  });

  // Validate dependencies
  const missingDeps = validateDependencies(selected);
  if (missingDeps.length > 0) {
    console.error(chalk.red('\n❌ Missing dependencies:'));
    missingDeps.forEach(({ schema, dependencies }) => {
      console.error(chalk.red(`  ${schema} requires: ${dependencies.join(', ')}`));
    });
    process.exit(1);
  }

  // Sort based on dependencies
  return getSortedSchemas(selected);
}

async function generateMigrations() {
  execSync('pnpm --filter @touch/server db.migrations.generate', {
    stdio: 'inherit',
  });
}

async function runMigrations() {
  execSync('pnpm --filter @touch/server db.migrations.run', {
    stdio: 'inherit',
  });
}

async function seedData(schemas: string[]) {
  for (const schema of schemas) {
    try {
      console.log(chalk.blue(`\nSeeding ${schema}...`));

      const seedName = schema.startsWith('auth_') ? schema.replace('auth_', '') : schema;

      // Use the working command that runs from the server context
      execSync(`pnpm --filter @touch/server db.migrations.seed ${seedName}`, {
        stdio: 'inherit',
      });

      console.log(chalk.green(`✅ Seeded ${schema} successfully!`));
    } catch (error) {
      console.error(chalk.red(`❌ Error seeding ${schema}:`), error);
      throw error;
    }
  }
}

async function main() {
  try {
    // First, select what operations to perform
    const operations = await checkbox({
      message: 'Select operations to perform',
      choices: [
        { name: 'Seed data', value: 'seed', checked: true },
        { name: 'Run migrations', value: 'migrate', checked: false },
        { name: 'Generate migrations', value: 'generate', checked: false },
      ],
    });

    if (operations.length === 0) {
      console.log('No operations selected. Exiting...');
      process.exit(0);
    }

    // Then select schemas if needed
    const schemas = operations.includes('seed') ? await getSchemaSelection() : [];

    // Execute selected operations
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
  } catch (error) {
    console.error(chalk.red('\n❌ Unexpected error:'));
    console.error(error);
    process.exit(1);
  }
}

main();
