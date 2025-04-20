import { ERROR, fino, INCLUDE_FILES_TS, OFF } from '@finografic/eslint-config';

export default fino(
  {
    typescript: true,
    gitignore: true,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    overrides: {
      jsonc: {
        'jsonc/sort-keys': ERROR,
      },
    },
    rules: {
      'node/prefer-global/process': OFF,
      'lint/complexity/noForEach': OFF,
    },
  },
  {
    files: [...INCLUDE_FILES_TS],
  },
);
