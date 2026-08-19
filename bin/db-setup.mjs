#!/usr/bin/env node
import { t as isCliEntry } from "./is-cli-entry.mjs";
import { t as pc } from "./picocolors.mjs";
import { t as findProjectRoot } from "./project.utils.mjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import { cancel, isCancel, multiselect } from "@clack/prompts";
//#region src/db-setup/schemas.config.ts
const PATH_FOLDER_SCHEMAS = "apps/server/src/db/schemas";
const PATH_FILES_CONFIG = ["config/db-setup.config.ts", "db-setup.config.ts"];
const SERVER_PACKAGE = "@workspace/server";
/** Pnpm script names on `@workspace/server` — colon-separated segment convention. */
const SERVER_DB_SCRIPTS = {
	migrationsGenerate: "db:migrations:generate",
	migrationsRun: "db:migrations:run",
	migrationsSeed: "db:migrations:seed",
	viewsCreateSingle: "db:views:create:single"
};
const SCHEMAS_BLOCKLIST = [...[
	"auth_account",
	"auth_session",
	"auth_verification"
]];
//#endregion
//#region src/utils/config.utils.ts
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
//#endregion
//#region src/db-setup/schemas.utils.ts
const loadSeedConfig = async ({ configFileGlob = PATH_FILES_CONFIG } = {}) => {
	const projectRoot = findProjectRoot();
	/**
	* Find the db-setup `.ts` config (typed SeedConfig / ViewConfig).
	* Tries each glob as given, then `${pattern}.ts`. Runtime `.ts` import needs `NODE_OPTIONS='--import tsx'`.
	*/
	const configPath = findScriptConfigFile((Array.isArray(configFileGlob) ? configFileGlob : [configFileGlob]).flatMap((pattern) => [pattern, `${pattern}.ts`]), projectRoot);
	if (!configPath) throw new Error("No config file found! Please create a db-setup.config.ts file. Note: TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.");
	try {
		return { seedConfigs: (await import(pathToFileURL(configPath).href)).seedConfigs };
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ERR_UNKNOWN_FILE_EXTENSION") {
			console.error(pc.red("\n❌ Error loading TypeScript config file."));
			console.error(pc.yellow("Node.js cannot import .ts files directly. Please run with: NODE_OPTIONS='--import tsx' db-setup"));
			console.error(pc.yellow("TypeScript is required for type safety with SeedConfig/ViewConfig interfaces."));
			process.exit(1);
		}
		console.error(pc.red(`❌ Error loading config from ${configPath}:`), error);
		process.exit(1);
	}
};
const loadViewConfig = async ({ configFileGlob = PATH_FILES_CONFIG } = {}) => {
	const projectRoot = findProjectRoot();
	/**
	* Find the db-setup `.ts` config (typed SeedConfig / ViewConfig).
	* Tries each glob as given, then `${pattern}.ts`. Runtime `.ts` import needs `NODE_OPTIONS='--import tsx'`.
	*/
	const configPath = findScriptConfigFile((Array.isArray(configFileGlob) ? configFileGlob : [configFileGlob]).flatMap((pattern) => [pattern, `${pattern}.ts`]), projectRoot);
	if (!configPath) throw new Error("No config file found! Please create a db-setup.config.ts file. Note: TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.");
	try {
		return { viewConfigs: (await import(pathToFileURL(configPath).href)).viewConfigs || [] };
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ERR_UNKNOWN_FILE_EXTENSION") {
			console.error(pc.red("\n❌ Error loading TypeScript config file."));
			console.error(pc.yellow("Node.js cannot import .ts files directly. Please run with: NODE_OPTIONS='--import tsx' db-setup"));
			console.error(pc.yellow("TypeScript is required for type safety with SeedConfig/ViewConfig interfaces."));
			process.exit(1);
		}
		console.error(pc.red(`❌ Error loading config from ${configPath}:`), error);
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
			if (missingDeps.length > 0) missing.push({
				schema,
				dependencies: missingDeps
			});
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
		if (config?.dependencies) config.dependencies.forEach((dep) => {
			if (selectedSchemas.includes(dep)) visit(dep);
		});
		visited.add(schema);
		result.push(schema);
	}
	selectedSchemas.forEach((schema) => visit(schema));
	return result;
};
const getSchemaSelection = async ({ seedConfigs }) => {
	const schemasDir = path.join(process.cwd(), PATH_FOLDER_SCHEMAS);
	if (!fs.existsSync(schemasDir)) {
		console.error(pc.red(`❌ Schemas directory not found: ${schemasDir}`));
		process.exit(1);
	}
	const schemas = getAllSchemas({ seedConfigs }).filter((schema) => !SCHEMAS_BLOCKLIST.includes(schema));
	if (schemas.length === 0) {
		console.warn(pc.yellow("⚠️ No schema files found"));
		return [];
	}
	const selectedSchemas = await multiselect({
		message: "Select schemas to process",
		options: schemas.map((schema) => ({
			label: schema,
			value: schema
		})),
		initialValues: schemas,
		required: false
	});
	if (isCancel(selectedSchemas)) {
		cancel("Operation cancelled");
		process.exit(0);
	}
	const missingDeps = validateDependencies({
		seedConfigs,
		selectedSchemas
	});
	if (missingDeps.length > 0) {
		console.error(pc.red("\n❌ Missing dependencies:"));
		missingDeps.forEach(({ schema, dependencies }) => {
			console.error(pc.red(`  ${schema} requires: ${dependencies.join(", ")}`));
		});
		process.exit(1);
	}
	return getSortedSchemas({
		seedConfigs,
		selectedSchemas
	});
};
//#endregion
//#region src/db-setup/db-setup.ts
const autoConfirm = process.argv.includes("-y") || process.argv.includes("--yes");
console.log("--- [db-setup] Script started ---");
const nodeEnv = process.env.NODE_ENV || "development";
console.log("[db-setup] NODE_ENV:", nodeEnv);
if (![
	"development",
	"test",
	"production"
].includes(nodeEnv)) console.warn(pc.yellow(`⚠️ Unexpected NODE_ENV: ${nodeEnv}, defaulting to development`));
const envPath = path.resolve(process.cwd(), `./.env.${nodeEnv}`);
console.log("[db-setup] Looking for env file at:", envPath);
if (!fs.existsSync(envPath)) {
	console.error(pc.red(`❌ Environment file not found: ${envPath}`));
	process.exit(1);
}
const envVars = fs.readFileSync(envPath, "utf8").split("\n").reduce((acc, line) => {
	const match = line.match(/^([^=]+)=(.*)$/);
	if (match) {
		const [, key, value] = match;
		acc[key.trim()] = value.trim().replace(/^["']|["']$/g, "");
	}
	return acc;
}, {});
Object.entries(envVars).forEach(([key, value]) => {
	if (!process.env[key]) process.env[key] = value;
});
console.log("[db-setup] Loaded env config");
async function generateMigrations() {
	console.log("[db-setup] Running generateMigrations...");
	execSync(`pnpm --filter ${SERVER_PACKAGE} ${SERVER_DB_SCRIPTS.migrationsGenerate}`, {
		stdio: "inherit",
		env: process.env
	});
}
async function runMigrations() {
	console.log("[db-setup] Running runMigrations...");
	execSync(`pnpm --filter ${SERVER_PACKAGE} ${SERVER_DB_SCRIPTS.migrationsRun}`, {
		stdio: "inherit",
		env: process.env
	});
}
async function seedData(schemas) {
	for (const schema of schemas) try {
		console.log(pc.blue(`\nSeeding ${schema}...`));
		const seedName = schema.startsWith("auth_") ? schema.replace("auth_", "") : schema;
		console.log(`[db-setup] Seeding: ${seedName}`);
		execSync(`pnpm --filter ${SERVER_PACKAGE} ${SERVER_DB_SCRIPTS.migrationsSeed} ${seedName}`, {
			stdio: "inherit",
			env: process.env
		});
		console.log(pc.green(`✅ Seeded ${schema} successfully!`));
	} catch (error) {
		console.error(pc.red(`❌ Error seeding ${schema}:`), error);
		throw error;
	}
}
async function createViews(viewConfigs) {
	for (const view of viewConfigs) try {
		console.log(pc.blue(`Creating view: ${view.name}...`));
		execSync(`pnpm --filter ${SERVER_PACKAGE} ${SERVER_DB_SCRIPTS.viewsCreateSingle} ${view.name}`, {
			stdio: "inherit",
			env: process.env
		});
		console.log(pc.green(`✅ Created view: ${view.name}`));
	} catch (error) {
		console.error(pc.red(`❌ Error creating view ${view.name}:`), error);
		throw error;
	}
}
async function main() {
	try {
		console.log("[db-setup] About to show operations prompt...");
		let operations;
		if (autoConfirm) {
			operations = ["seed", "views"];
			console.log("[db-setup] Auto-confirm enabled: defaulting to operations:", operations);
		} else {
			const selectedOperations = await multiselect({
				message: "Select operations to perform",
				options: [
					{
						label: "Seed data",
						value: "seed"
					},
					{
						label: "Create views",
						value: "views"
					},
					{
						label: "Run migrations",
						value: "migrate"
					},
					{
						label: "Generate migrations",
						value: "generate"
					}
				],
				initialValues: ["seed", "views"],
				required: false
			});
			if (isCancel(selectedOperations)) {
				cancel("Operation cancelled");
				return;
			}
			operations = selectedOperations;
		}
		console.log("[db-setup] Operations selected:", operations);
		if (operations.length === 0) {
			console.log("No operations selected. Exiting...");
			process.exit(0);
		}
		console.log("[db-setup] Loading seed config...");
		let schemas = [];
		if (operations.includes("seed")) {
			if (autoConfirm) {
				const { seedConfigs } = await loadSeedConfig();
				schemas = seedConfigs.map((s) => s.name);
				console.log("[db-setup] Auto-confirm enabled: seeding all schemas:", schemas);
			} else {
				const { seedConfigs } = await loadSeedConfig();
				schemas = await getSchemaSelection({ seedConfigs });
			}
		}
		console.log("[db-setup] Schemas selected:", schemas);
		if (operations.includes("generate")) {
			console.log(pc.blue("\n1. Generating migrations..."));
			await generateMigrations();
		}
		if (operations.includes("migrate")) {
			console.log(pc.blue("\n2. Running migrations..."));
			await runMigrations();
		}
		if (operations.includes("seed")) {
			console.log(pc.blue("\n3. Seeding data..."));
			await seedData(schemas);
		}
		if (operations.includes("views")) try {
			const { viewConfigs } = await loadViewConfig();
			if (viewConfigs.length > 0) {
				console.log(pc.blue("\n4. Creating views..."));
				await createViews(viewConfigs);
			}
		} catch (error) {
			console.error(pc.red("❌ Error loading view configuration:"), error);
			throw error;
		}
		console.log("--- [db-setup] Script finished ---");
	} catch (error) {
		console.error(pc.red("\n❌ Unexpected error:"));
		console.error(error);
		process.exit(1);
	}
}
if (isCliEntry(import.meta.url)) main().catch((error) => {
	console.error("Failed to run db-setup:", error);
	process.exit(1);
});
//#endregion
export { main as default, main };
