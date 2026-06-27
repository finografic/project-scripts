import {
  configOverrides,
  ignorePatterns,
  loosenRules,
  oxlintCliConfig,
  testOverrides,
} from '@finografic/oxc-config/oxlint';
import { defineConfig } from 'oxlint';
import type { OxlintConfig } from 'oxlint';

export default defineConfig({
  ...oxlintCliConfig,
  rules: {
    ...oxlintCliConfig.rules,
    ...loosenRules,
    /** Legacy build-deployment helpers use dynamic imports with matching export names. */
    'eslint/no-shadow': 'warn',
  },
  overrides: [testOverrides, configOverrides],
  ignorePatterns: [...ignorePatterns],
} satisfies OxlintConfig);
