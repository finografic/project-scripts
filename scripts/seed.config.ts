import type { SeedConfig } from '../src/db-setup/db-setup.types';

export const seedOrder: SeedConfig[] = [
  {
    name: 'drink_types',
    description: 'Base drink types and subtypes',
  },
  {
    name: 'container_types',
    description: 'Container types (plastic, glass, metal)',
  },
  {
    name: 'volumes',
    description: 'Available volumes (33cl, 50cl, etc)',
  },
  {
    name: 'temperature_tables',
    description: 'Temperature-time cooling tables',
  },
  {
    name: 'drink_configs',
    description: 'drink configurations',
    dependencies: ['drink_types', 'container_types', 'volumes', 'temperature_tables'],
  },
  {
    name: 'elements',
    description: 'Cooling elements',
  },
  {
    name: 'running_orders',
    description: 'Example running orders',
    dependencies: ['elements', 'drink_configs'],
  },
];
