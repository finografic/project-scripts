import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config } from '@dotenvx/dotenvx';
import { checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { getSchemaSelection, loadSeedConfig } from './schemas.utils';
import { PATH_FOLDER_ENV } from './schemas.config';

// ======================================================================== //
// NOTE: LOAD ENV CONFIG

const nodeEnv = process.env.NODE_ENV || 'development';

if (!['development', 'test', 'production'].includes(nodeEnv)) {
  console.warn(chalk.yellow(`⚠️ Unexpected NODE_ENV: ${nodeEnv}, defaulting to development`));
}

const envPath = path.resolve(process.cwd(), `${PATH_FOLDER_ENV}/.env.${nodeEnv}`);
if (!fs.existsSync(envPath)) {
  console.error(chalk.red(`❌ Environment file not found: ${envPath}`));
  process.exit(1);
}

config({ path: envPath });

// ======================================================================== //
// NOTE: CHOICES - EXECUTION METHODS

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

// ======================================================================== //
// NOTE: MAIN FUNCTION

export async function main() {
  try {
    // INITIAL CHOICES..
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

    const { seedOrder } = await loadSeedConfig();
    const schemas = operations.includes('seed') ? await getSchemaSelection({ seedOrder }) : [];

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

// Export both the main function and run it if this is the main module
export default main;

// Run when called directly (e.g., via CLI)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Failed to run db-setup:', error);
    process.exit(1);
  });
}
