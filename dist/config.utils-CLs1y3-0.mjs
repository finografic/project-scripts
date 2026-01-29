import path from "node:path";
import fs from "node:fs";

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
export { findScriptConfigFile as t };