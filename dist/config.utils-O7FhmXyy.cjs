const require_chunk = require('./chunk-CbDLau6x.cjs');
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);

//#region src/utils/config.utils.ts
const findScriptConfigFile = (configNames, startDir = process.cwd()) => {
	let dir = startDir;
	while (true) {
		for (const name of configNames) {
			const candidate = node_path.default.join(dir, name);
			if (node_fs.default.existsSync(candidate)) return candidate;
		}
		const parent = node_path.default.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
};

//#endregion
Object.defineProperty(exports, 'findScriptConfigFile', {
  enumerable: true,
  get: function () {
    return findScriptConfigFile;
  }
});