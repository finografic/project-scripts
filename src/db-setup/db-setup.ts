import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkbox } from "@inquirer/prompts";
import chalk from "chalk";
import { execSync } from "node:child_process";
import { getSchemaSelection, loadSeedConfig } from "./schemas.utils";
import { PATH_FOLDER_ENV } from "./schemas.config";
import { loadConfig, loadAdapter } from "./load-config";
import { findProjectRoot } from "../utils/project.utils.js";

// Add autoConfirm flag for -y/--yes
const autoConfirm =
  process.argv.includes("-y") || process.argv.includes("--yes");

console.log("--- [db-setup] Script started ---");

// ======================================================================== //
// NOTE: LOAD ENV CONFIG

const nodeEnv = process.env.NODE_ENV || "development";
console.log("[db-setup] NODE_ENV:", nodeEnv);

if (!["development", "test", "production"].includes(nodeEnv)) {
  console.warn(
    chalk.yellow(
      `⚠️ Unexpected NODE_ENV: ${nodeEnv}, defaulting to development`
    )
  );
}

const envPath = path.resolve(
  process.cwd(),
  `${PATH_FOLDER_ENV}/.env.${nodeEnv}`
);
console.log("[db-setup] Looking for env file at:", envPath);
if (!fs.existsSync(envPath)) {
  console.error(chalk.red(`❌ Environment file not found: ${envPath}`));
  process.exit(1);
}

// Load env file manually
const envContent = fs.readFileSync(envPath, "utf8");
const envVars = envContent.split("\n").reduce(
  (acc, line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      acc[key.trim()] = value.trim();
    }
    return acc;
  },
  {} as Record<string, string>
);

// Set environment variables
Object.entries(envVars).forEach(([key, value]) => {
  process.env[key] = value;
});

console.log("[db-setup] Loaded env config");

// ======================================================================== //
// NOTE: CHOICES - EXECUTION METHODS

async function generateMigrations() {
  console.log("[db-setup] Running generateMigrations...");
  execSync("pnpm --filter @workspace/server db.migrations.generate", {
    stdio: "inherit",
    env: process.env,
  });
}

async function runMigrations() {
  console.log("[db-setup] Running runMigrations...");
  execSync("pnpm --filter @workspace/server db.migrations.run", {
    stdio: "inherit",
    env: process.env,
  });
}

async function seedData(schemas: string[]) {
  for (const schema of schemas) {
    try {
      console.log(chalk.blue(`\nSeeding ${schema}...`));
      const seedName = schema.startsWith("auth_")
        ? schema.replace("auth_", "")
        : schema;
      console.log(`[db-setup] Seeding: ${seedName}`);
      execSync(
        `pnpm --filter @workspace/server db.migrations.seed ${seedName}`,
        {
          stdio: "inherit",
          env: process.env,
        }
      );
      console.log(chalk.green(`✅ Seeded ${schema} successfully!`));
    } catch (error) {
      console.error(chalk.red(`❌ Error seeding ${schema}:`), error);
      throw error;
    }
  }
}

// ======================================================================== //
// NOTE: CREATE VIEWS FUNCTION

async function createViews__V2() {
  const { viewConfigs } = await loadConfig();
  const sqlite = await loadAdapter();
  const projectRoot = findProjectRoot();

  for (const view of viewConfigs) {
    const sqlPath = path.resolve(
      projectRoot,
      "apps/server/src/db/views",
      `${view.name}.sql`
    );
    if (!fs.existsSync(sqlPath)) {
      console.warn(chalk.yellow(`View SQL file not found: ${sqlPath}`));
      continue;
    }
    const sql = fs.readFileSync(sqlPath, "utf-8");
    try {
      console.log(chalk.blue(`Dropping view if exists: ${view.name}`));
      sqlite.exec(`DROP VIEW IF EXISTS ${view.name};`);
      console.log(chalk.blue(`Creating view: ${view.name}`));
      sqlite.exec(sql);
      console.log(chalk.green(`✅ Created view: ${view.name}`));
    } catch (err) {
      console.error(chalk.red(`❌ Error creating view ${view.name}:`), err);
    }
  }
}

async function createViews() {
  // const { viewConfigs } = await loadConfig();
  const projectRoot = findProjectRoot();
  console.log(">>>>>", 0, { projectRoot });
  // const sqlite = await loadAdapter();

  // console.log(">>>>> SQL", !!sqlite);
  // for (const view of viewConfigs) {
  //   console.log(">>>>>", 1, { projectRoot });
  //   const sqlPath = path.resolve(
  //     process.cwd(),
  //     "apps/server/src/db/views",
  //     `${view.name}.sql`
  //   );
  //   if (!fs.existsSync(sqlPath)) {
  //     console.warn(chalk.yellow(`View SQL file not found: ${sqlPath}`));
  //     continue;
  //   }
  //   console.log(">>>>>", 2);
  //   const sql = fs.readFileSync(sqlPath, "utf-8");
  //   try {
  //     console.log(">>>>>", 3);
  //     console.log(chalk.blue(`Dropping view if exists: ${view.name}`));
  //     sqlite.exec(`DROP VIEW IF EXISTS ${view.name};`);
  //     console.log(chalk.blue(`Creating view: ${view.name}`));
  //     sqlite.exec(sql);
  //     console.log(chalk.green(`✅ Created view: ${view.name}`));
  //     console.log(">>>>>", 4);
  //   } catch (err) {
  //     console.log(">>>>>", 5);
  //     console.error(chalk.red(`❌ Error creating view ${view.name}:`), err);
  //   }
  // }
}

// ======================================================================== //
// NOTE: MAIN FUNCTION

export async function main() {
  try {
    console.log("[db-setup] About to show operations prompt...");
    // INITIAL CHOICES..
    let operations: string[];
    if (autoConfirm) {
      operations = ["seed", "views"]; // Default: only seed data, adjust as needed
      console.log(
        "[db-setup] Auto-confirm enabled: defaulting to operations:",
        operations
      );
    } else {
      operations = await checkbox({
        message: "Select operations to perform",
        choices: [
          { name: "Seed data", value: "seed", checked: true },
          { name: "Create views", value: "views", checked: true },
          { name: "Run migrations", value: "migrate", checked: false },
          { name: "Generate migrations", value: "generate", checked: false },
        ],
      });
    }
    console.log("[db-setup] Operations selected:", operations);

    if (operations.length === 0) {
      console.log("No operations selected. Exiting...");
      process.exit(0);
    }

    console.log("[db-setup] Loading seed config...");
    let schemas: string[] = [];
    if (operations.includes("seed")) {
      if (autoConfirm) {
        const { seedConfigs } = await loadSeedConfig();
        schemas = seedConfigs.map((s) => s.name);
        console.log(
          "[db-setup] Auto-confirm enabled: seeding all schemas:",
          schemas
        );
      } else {
        const { seedConfigs } = await loadSeedConfig();
        schemas = await getSchemaSelection({ seedConfigs });
      }
    }
    console.log("[db-setup] Schemas selected:", schemas);

    // Execute selected operations
    if (operations.includes("generate")) {
      console.log(chalk.blue("\n1. Generating migrations..."));
      await generateMigrations();
    }

    if (operations.includes("migrate")) {
      console.log(chalk.blue("\n2. Running migrations..."));
      await runMigrations();
    }

    if (operations.includes("seed")) {
      console.log(chalk.blue("\n3. Seeding data..."));
      await seedData(schemas);
    }

    if (operations.includes("views")) {
      console.log(chalk.blue("\n4. (XX) Creating views..."));
      await createViews();
    }

    console.log("--- [db-setup] Script finished ---");
  } catch (error) {
    console.error(chalk.red("\n❌ Unexpected error:"));
    console.error(error);
    process.exit(1);
  }
}

// Export both the main function and run it if this is the main module
export default main;

// Run when called directly (e.g., via CLI)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Failed to run db-setup:", error);
    process.exit(1);
  });
}
