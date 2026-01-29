import { n as ViewConfig, t as SeedConfig } from "./db-setup.types-CpfTU0Xu.mjs";

//#region src/db-setup/db-setup.d.ts
declare function main(): Promise<void>;
//#endregion
//#region src/db-setup/schemas.config.d.ts
declare const PATH_FOLDER_SCHEMAS = "apps/server/src/db/schemas";
declare const PATH_FILES_CONFIG: string[];
declare const SCHEMAS_BLOCKLIST: string[];
//#endregion
export { PATH_FILES_CONFIG, PATH_FOLDER_SCHEMAS, SCHEMAS_BLOCKLIST, type SeedConfig, type ViewConfig, main as default };