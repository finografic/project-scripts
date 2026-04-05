import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkbox } from '@inquirer/prompts';

import { pc } from 'utils/picocolors';
import { PATH_FOLDER_ENV } from './schemas.config';
import { getSchemaSelection, loadSeedConfig, loadViewConfig } from './schemas.utils';

const autoConfirm = process.argv.includes('-y') || process.argv.includes('--yes');

console.log('--- [db-setup] Script started ---');

const nodeEnv = process.env.NODE_ENV || 'development';
console.log('[db-setup] NODE_ENV:', nodeEnv);

if (!['development', 'test', 'production'].includes(nodeEnv)) {
  console.warn(pc.yellow(`⚠️ Unexpected NODE_ENV: ${nodeEnv}, defaulting to development`));
}

// ─── LOAD ENV CONFIG ────────────────────────────────────────────────────────────

const envPath = path.resolve(process.cwd(), `${PATH_FOLDER_ENV}/.env.${nodeEnv}`);
console.log('[db-setup] Looking for env file at:', envPath);
if (!fs.existsSync(envPath)) {
  console.error(pc.red(`❌ Environment file not found: ${envPath}`));
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = envContent.split('\n').reduce(
  (acc, line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      acc[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    }
    return acc;
  },
  {} as Record<string, string>,
);

// Set environment variables
Object.entries(envVars).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
});

console.log('[db-setup] Loaded env config');

// ─── GENERATE MIGRATIONS FUNCTION ────────────────────────────────────────────

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

async function seedData(schemas: string[]) {
  for (const schema of schemas) {
    try {
      console.log(pc.blue(`\nSeeding ${schema}...`));
      const seedName = schema.startsWith('auth_') ? schema.replace('auth_', '') : schema;
      console.log(`[db-setup] Seeding: ${seedName}`);
      execSync(`pnpm --filter @workspace/server db.migrations.seed ${seedName}`, {
        stdio: 'inherit',
        env: process.env,
      });
      console.log(pc.green(`✅ Seeded ${schema} successfully!`));
    } catch (error) {
      console.error(pc.red(`❌ Error seeding ${schema}:`), error);
      throw error;
    }
  }
}

// ─── CREATE VIEWS FUNCTION ────────────────────────────────────────────────────

async function createViews() {
  try {
    console.log('[db-setup] Loading view config...');
    const { viewConfigs } = await loadViewConfig();

    if (!viewConfigs || viewConfigs.length === 0) {
      console.log(pc.yellow('⚠️ No views configured to create'));
      return;
    }

    for (const view of viewConfigs) {
      try {
        console.log(pc.blue(`Creating view: ${view.name}...`));
        execSync(`pnpm --filter @workspace/server db.views.create.single ${view.name}`, {
          stdio: 'inherit',
          env: process.env,
        });
        console.log(pc.green(`✅ Created view: ${view.name}`));
      } catch (error) {
        console.error(pc.red(`❌ Error creating view ${view.name}:`), error);
        throw error;
      }
    }
  } catch (error) {
    console.error(pc.red('❌ Error loading view configuration:'), error);
    throw error;
  }
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

export async function main() {
  try {
    console.log('[db-setup] About to show operations prompt...');
    // INITIAL CHOICES..
    let operations: string[];
    if (autoConfirm) {
      operations = ['seed', 'views']; // Default: only seed data, adjust as needed
      console.log('[db-setup] Auto-confirm enabled: defaulting to operations:', operations);
    } else {
      operations = await checkbox({
        message: 'Select operations to perform',
        choices: [
          { name: 'Seed data', value: 'seed', checked: true },
          { name: 'Create views', value: 'views', checked: true },
          { name: 'Run migrations', value: 'migrate', checked: false },
          { name: 'Generate migrations', value: 'generate', checked: false },
        ],
      });
    }
    console.log('[db-setup] Operations selected:', operations);

    if (operations.length === 0) {
      console.log('No operations selected. Exiting...');
      process.exit(0);
    }

    console.log('[db-setup] Loading seed config...');
    let schemas: string[] = [];
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

    // Execute selected operations
    if (operations.includes('generate')) {
      console.log(pc.blue('\n1. Generating migrations...'));
      await generateMigrations();
    }

    if (operations.includes('migrate')) {
      console.log(pc.blue('\n2. Running migrations...'));
      await runMigrations();
    }

    if (operations.includes('seed')) {
      console.log(pc.blue('\n3. Seeding data...'));
      await seedData(schemas);
    }

    if (operations.includes('views')) {
      console.log(pc.blue('\n4. Creating views...'));
      await createViews();
    }

    console.log('--- [db-setup] Script finished ---');
  } catch (error) {
    console.error(pc.red('\n❌ Unexpected error:'));
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
