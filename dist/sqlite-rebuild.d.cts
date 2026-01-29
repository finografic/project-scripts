//#region src/sqlite-rebuild/sqlite-rebuild.d.ts
interface RebuildOptions {
  force?: boolean;
  verbose?: boolean;
  targetVersion?: string;
  cleanOnly?: boolean;
  includeMigration?: boolean;
}
declare class SqliteRebuilder {
  private workspaceRoot;
  private options;
  private packages;
  constructor(options?: RebuildOptions);
  private findWorkspaceRoot;
  private log;
  private logVerbose;
  private runCommand;
  private scanPackages;
  private checkVersionConsistency;
  private updateVersions;
  private cleanNodeModules;
  private rebuildBetterSqlite3;
  private testBetterSqlite3;
  private runDatabaseMigration;
  rebuild(): Promise<void>;
}
//#endregion
export { SqliteRebuilder };