import { statSync } from "node:fs";

//#region src/utils/fs.utils.ts
const isFile = (path) => {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
};

//#endregion
export { isFile as t };