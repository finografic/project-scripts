#!/usr/bin/env node
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
//#region src/utils/is-cli-entry.ts
/**
* Whether this module is the process entry point (e.g. `node bin/foo.mjs`).
* Resolves symlinks so pnpm `.bin` shims and hoisted paths match `import.meta.url`.
*
* @param metaUrl - Pass `import.meta.url` from the CLI entry module.
*/
function isCliEntry(metaUrl) {
	const entry = process.argv[1];
	if (!entry) return false;
	try {
		return realpathSync(fileURLToPath(metaUrl)) === realpathSync(path.resolve(entry));
	} catch {
		return false;
	}
}
//#endregion
export { isCliEntry as t };
