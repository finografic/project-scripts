Object.defineProperty(exports, '__esModule', { value: true });
const require_chunk = require('./chunk-CbDLau6x.cjs');
const require_project_utils = require('./project.utils-DfW3kzVk.cjs');
const require_config_utils = require('./config.utils-O7FhmXyy.cjs');
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_url = require("node:url");
let chalk = require("chalk");
chalk = require_chunk.__toESM(chalk);
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_child_process = require("node:child_process");
let _inquirer_prompts = require("@inquirer/prompts");

//#region src/db-setup/schemas.config.ts
const PATH_FOLDER_ENV = ".";
const PATH_FOLDER_SCHEMAS = "apps/server/src/db/schemas";
const PATH_FILES_CONFIG = ["config/db-setup.config.ts", "db-setup.config.ts"];
const SCHEMAS_BETTER_AUTH = [
	"auth_account",
	"auth_session",
	"auth_verification"
];
const SCHEMAS_BLOCKLIST = [...SCHEMAS_BETTER_AUTH];

//#endregion
//#region src/db-setup/schemas.utils.ts
const loadSeedConfig = async ({ configFileGlob = PATH_FILES_CONFIG } = {}) => {
	const projectRoot = require_project_utils.findProjectRoot();
	const configPath = require_config_utils.findScriptConfigFile((Array.isArray(configFileGlob) ? configFileGlob : [configFileGlob]).flatMap((pattern) => [pattern, `${pattern}.ts`]), projectRoot);
	if (!configPath) throw new Error("No config file found! Please create a db-setup.config.ts file. Note: TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.");
	try {
		return { seedConfigs: (await import((0, node_url.pathToFileURL)(configPath).href)).seedConfigs };
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ERR_UNKNOWN_FILE_EXTENSION") {
			console.error(chalk.default.red("\n❌ Error loading TypeScript config file."));
			console.error(chalk.default.yellow("Node.js cannot import .ts files directly. Please run with: NODE_OPTIONS='--import tsx' db-setup"));
			console.error(chalk.default.yellow("TypeScript is required for type safety with SeedConfig/ViewConfig interfaces."));
			process.exit(1);
		}
		console.error(chalk.default.red(`❌ Error loading config from ${configPath}:`), error);
		process.exit(1);
	}
};
const loadViewConfig = async ({ configFileGlob = PATH_FILES_CONFIG } = {}) => {
	const projectRoot = require_project_utils.findProjectRoot();
	const configPath = require_config_utils.findScriptConfigFile((Array.isArray(configFileGlob) ? configFileGlob : [configFileGlob]).flatMap((pattern) => [pattern, `${pattern}.ts`]), projectRoot);
	if (!configPath) throw new Error("No config file found! Please create a db-setup.config.ts file. Note: TypeScript is required for type safety with SeedConfig/ViewConfig interfaces.");
	try {
		return { viewConfigs: (await import((0, node_url.pathToFileURL)(configPath).href)).viewConfigs || [] };
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ERR_UNKNOWN_FILE_EXTENSION") {
			console.error(chalk.default.red("\n❌ Error loading TypeScript config file."));
			console.error(chalk.default.yellow("Node.js cannot import .ts files directly. Please run with: NODE_OPTIONS='--import tsx' db-setup"));
			console.error(chalk.default.yellow("TypeScript is required for type safety with SeedConfig/ViewConfig interfaces."));
			process.exit(1);
		}
		console.error(chalk.default.red(`❌ Error loading config from ${configPath}:`), error);
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
	const schemasDir = node_path.default.join(process.cwd(), PATH_FOLDER_SCHEMAS);
	if (!node_fs.default.existsSync(schemasDir)) {
		console.error(chalk.default.red(`❌ Schemas directory not found: ${schemasDir}`));
		process.exit(1);
	}
	const schemas = getAllSchemas({ seedConfigs }).filter((schema) => !SCHEMAS_BLOCKLIST.includes(schema));
	if (schemas.length === 0) {
		console.warn(chalk.default.yellow("⚠️ No schema files found"));
		return [];
	}
	const selectedSchemas = await (0, _inquirer_prompts.checkbox)({
		message: "Select schemas to process",
		choices: schemas.map((schema) => ({
			name: schema,
			value: schema,
			checked: true
		}))
	});
	const missingDeps = validateDependencies({
		seedConfigs,
		selectedSchemas
	});
	if (missingDeps.length > 0) {
		console.error(chalk.default.red("\n❌ Missing dependencies:"));
		missingDeps.forEach(({ schema, dependencies }) => {
			console.error(chalk.default.red(`  ${schema} requires: ${dependencies.join(", ")}`));
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
].includes(nodeEnv)) console.warn(chalk.default.yellow(`⚠️ Unexpected NODE_ENV: ${nodeEnv}, defaulting to development`));
const envPath = node_path.default.resolve(process.cwd(), `${PATH_FOLDER_ENV}/.env.${nodeEnv}`);
console.log("[db-setup] Looking for env file at:", envPath);
if (!node_fs.default.existsSync(envPath)) {
	console.error(chalk.default.red(`❌ Environment file not found: ${envPath}`));
	process.exit(1);
}
const envVars = node_fs.default.readFileSync(envPath, "utf8").split("\n").reduce((acc, line) => {
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
	(0, node_child_process.execSync)("pnpm --filter @workspace/server db.migrations.generate", {
		stdio: "inherit",
		env: process.env
	});
}
async function runMigrations() {
	console.log("[db-setup] Running runMigrations...");
	(0, node_child_process.execSync)("pnpm --filter @workspace/server db.migrations.run", {
		stdio: "inherit",
		env: process.env
	});
}
async function seedData(schemas) {
	for (const schema of schemas) try {
		console.log(chalk.default.blue(`\nSeeding ${schema}...`));
		const seedName = schema.startsWith("auth_") ? schema.replace("auth_", "") : schema;
		console.log(`[db-setup] Seeding: ${seedName}`);
		(0, node_child_process.execSync)(`pnpm --filter @workspace/server db.migrations.seed ${seedName}`, {
			stdio: "inherit",
			env: process.env
		});
		console.log(chalk.default.green(`✅ Seeded ${schema} successfully!`));
	} catch (error) {
		console.error(chalk.default.red(`❌ Error seeding ${schema}:`), error);
		throw error;
	}
}
async function createViews() {
	try {
		console.log("[db-setup] Loading view config...");
		const { viewConfigs } = await loadViewConfig();
		if (!viewConfigs || viewConfigs.length === 0) {
			console.log(chalk.default.yellow("⚠️ No views configured to create"));
			return;
		}
		for (const view of viewConfigs) try {
			console.log(chalk.default.blue(`Creating view: ${view.name}...`));
			(0, node_child_process.execSync)(`pnpm --filter @workspace/server db.views.create.single ${view.name}`, {
				stdio: "inherit",
				env: process.env
			});
			console.log(chalk.default.green(`✅ Created view: ${view.name}`));
		} catch (error) {
			console.error(chalk.default.red(`❌ Error creating view ${view.name}:`), error);
			throw error;
		}
	} catch (error) {
		console.error(chalk.default.red("❌ Error loading view configuration:"), error);
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
		} else operations = await (0, _inquirer_prompts.checkbox)({
			message: "Select operations to perform",
			choices: [
				{
					name: "Seed data",
					value: "seed",
					checked: true
				},
				{
					name: "Create views",
					value: "views",
					checked: true
				},
				{
					name: "Run migrations",
					value: "migrate",
					checked: false
				},
				{
					name: "Generate migrations",
					value: "generate",
					checked: false
				}
			]
		});
		console.log("[db-setup] Operations selected:", operations);
		if (operations.length === 0) {
			console.log("No operations selected. Exiting...");
			process.exit(0);
		}
		console.log("[db-setup] Loading seed config...");
		let schemas = [];
		if (operations.includes("seed")) if (autoConfirm) {
			const { seedConfigs } = await loadSeedConfig();
			schemas = seedConfigs.map((s) => s.name);
			console.log("[db-setup] Auto-confirm enabled: seeding all schemas:", schemas);
		} else {
			const { seedConfigs } = await loadSeedConfig();
			schemas = await getSchemaSelection({ seedConfigs });
		}
		console.log("[db-setup] Schemas selected:", schemas);
		if (operations.includes("generate")) {
			console.log(chalk.default.blue("\n1. Generating migrations..."));
			await generateMigrations();
		}
		if (operations.includes("migrate")) {
			console.log(chalk.default.blue("\n2. Running migrations..."));
			await runMigrations();
		}
		if (operations.includes("seed")) {
			console.log(chalk.default.blue("\n3. Seeding data..."));
			await seedData(schemas);
		}
		if (operations.includes("views")) {
			console.log(chalk.default.blue("\n4. Creating views..."));
			await createViews();
		}
		console.log("--- [db-setup] Script finished ---");
	} catch (error) {
		console.error(chalk.default.red("\n❌ Unexpected error:"));
		console.error(error);
		process.exit(1);
	}
}
if (require("url").pathToFileURL(__filename).href === (0, node_url.pathToFileURL)(process.argv[1]).href) main().catch((error) => {
	console.error("Failed to run db-setup:", error);
	process.exit(1);
});

//#endregion
exports.PATH_FILES_CONFIG = PATH_FILES_CONFIG;
exports.PATH_FOLDER_SCHEMAS = PATH_FOLDER_SCHEMAS;
exports.SCHEMAS_BLOCKLIST = SCHEMAS_BLOCKLIST;
exports.default = main;