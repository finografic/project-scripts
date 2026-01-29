//#region src/clean-docs/clean-docs.types.d.ts
interface CleanOptions {
  dryRun?: boolean;
  verbose?: boolean;
}
//#endregion
//#region src/clean-docs/clean-docs.d.ts
declare function clean({
  dryRun,
  verbose
}?: CleanOptions): Promise<void>;
//#endregion
//#region src/clean-docs/clean-docs.config.d.ts
declare const GLOB_DELETE_INCLUDE: readonly [".docs", ".tsup", "**/dist", "**/*.tsbuildinfo", "**/node_modules/.pnpm/**/.*", "**/node_modules/.pnpm/**/*", "**/node_modules/.pnpm", "**/node_modules", "pnpm-lock.yaml"];
//#endregion
export { type CleanOptions, GLOB_DELETE_INCLUDE, clean, clean as default };