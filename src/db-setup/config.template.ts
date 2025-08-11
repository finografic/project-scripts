//NOTE: template for `db-setup.config.ts` file, located in `scripts/` folder

import type { SeedConfig, ViewConfig } from './db-setup.types';

export const seedConfigs: SeedConfig[] = [
  {
    name: 'example_schema',
    description: 'Example schema with no dependencies',
  },
  {
    name: 'dependent_schema',
    description: 'Example schema with dependencies',
    dependencies: ['example_schema'],
  },
];

export const viewsOrder: ViewConfig[] = [
  {
    name: 'example_readable',
    description: 'Example view with no dependencies',
  },
  {
    name: 'dependent_readable',
    description: 'Example view with dependencies',
    dependencies: ['example_readable'], // TODO: views dependencies local or based on `seedConfigs` ??
  },
];
