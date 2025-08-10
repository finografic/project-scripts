/**
 * @fileoverview Clean module exports
 * @deprecated This clean module is deprecated. Use purge-builds instead.
 * @internal This module is kept for legacy compatibility but is not exported from the main package.
 */

export { clean } from "./clean";
export { clean as default } from "./clean";
export { GLOB_DELETE_EXCLUDE, GLOB_DELETE_INCLUDE } from "./clean.config";
export type { CleanOptions } from "./clean.types";
