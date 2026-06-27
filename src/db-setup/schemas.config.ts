export const PATH_FOLDER_ENV = '.';
export const PATH_FOLDER_SCHEMAS = 'apps/server/src/db/schemas';
export const PATH_FILES_CONFIG = ['config/db-setup.config.ts', 'db-setup.config.ts'];

export const SERVER_PACKAGE = '@workspace/server';

/** Pnpm script names on `@workspace/server` — colon-separated segment convention. */
export const SERVER_DB_SCRIPTS = {
  migrationsGenerate: 'db:migrations:generate',
  migrationsRun: 'db:migrations:run',
  migrationsSeed: 'db:migrations:seed',
  viewsCreateSingle: 'db:views:create:single',
} as const;

export const SCHEMAS_BETTER_AUTH = ['auth_account', 'auth_session', 'auth_verification'];
export const SCHEMAS_BLOCKLIST = [...SCHEMAS_BETTER_AUTH];
