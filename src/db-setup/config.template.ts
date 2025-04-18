import type { SeedConfig } from './db-setup.types';

export const seedOrder: SeedConfig[] = [
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
