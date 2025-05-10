import { ERROR, fino, GLOB_ALL_SRC, OFF } from '@finografic/eslint-config';

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
    files: [...GLOB_ALL_SRC],
  },
);
