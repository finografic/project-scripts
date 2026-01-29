
//#region src/db-setup/config.template.ts
const seedConfigs = [{
	name: "example_schema",
	description: "Example schema with no dependencies"
}, {
	name: "dependent_schema",
	description: "Example schema with dependencies",
	dependencies: ["example_schema"]
}];
const viewsOrder = [{
	name: "example_readable",
	description: "Example view with no dependencies"
}, {
	name: "dependent_readable",
	description: "Example view with dependencies",
	dependencies: ["example_readable"]
}];

//#endregion
exports.seedConfigs = seedConfigs;
exports.viewsOrder = viewsOrder;