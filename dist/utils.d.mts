//#region src/utils/config.utils.d.ts
declare const findScriptConfigFile: (configNames: string[], startDir?: string) => string | null;
//#endregion
//#region src/utils/fs.utils.d.ts
declare const isFile: (path: string) => boolean;
//#endregion
//#region src/utils/project.utils.d.ts
declare const findProjectRoot: (startDir?: string) => string;
declare const getPackageScope: () => string | null;
//#endregion
export { findProjectRoot, findScriptConfigFile, getPackageScope, isFile };