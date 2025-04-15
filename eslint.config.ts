import { ERROR, fino, OFF } from '@finografic/eslint-config';

export default fino({
  typescript: true,
  gitignore: true,
  parserOptions: {
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
  },
});
