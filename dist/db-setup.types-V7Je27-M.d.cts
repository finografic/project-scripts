//#region src/db-setup/db-setup.types.d.ts
interface SeedConfig {
  name: string;
  description?: string;
  dependencies?: string[];
}
interface ViewConfig {
  name: string;
  description?: string;
  dependencies?: string[];
}
//#endregion
export { ViewConfig as n, SeedConfig as t };