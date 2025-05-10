# @finografic/project-scripts

A collection of utility scripts for managing monorepo projects, including cleaning build artifacts and database setup tools.

## Installation

```bash
pnpm add -D @finografic/project-scripts
```

## Utilities

### `clean`

A utility for cleaning build artifacts and dependencies from your project.

```bash
# Clean with default options
clean

# Clean recursively (includes all workspaces)
clean --recursive

# Dry run (shows what would be deleted)
clean --dry-run

# Available flags
--recursive, -r    Clean all workspaces recursively
--dry-run, -d     Show what would be deleted without actually deleting
--verbose, -v     Show detailed progress
```

### `db-setup`

An interactive database setup utility for managing schema migrations and seeding data.

#### Prerequisites

1. Create a `seed.config.ts` file in your project's `scripts` folder:

```typescript
import type { SeedConfig } from '@finografic/project-scripts/db-setup';

export const seedOrder: SeedConfig[] = [
  {
    name: 'users',
    description: 'Base user tables',
  },
  {
    name: 'products',
    description: 'Product catalog',
    dependencies: ['users'], // Will ensure users are seeded first
  },
];
```

2. Ensure your project has the required Node options for TypeScript support:

```json
{
  "scripts": {
    "db.setup": "NODE_OPTIONS='--import tsx' db-setup"
  }
}
```

#### Usage

```bash
pnpm db.setup
```

The command will present an interactive interface to:
1. Select operations to perform (seed data, run migrations, generate migrations)
2. Choose specific schemas to process (if seeding data)
3. Execute operations in the correct order, respecting dependencies

#### Configuration

- Environment files should be located in `apps/server/.env.[environment]`
- Schema files should be in `apps/server/src/db/schemas/`
- Migration commands are executed using `pnpm --filter @touch/server`

## Package Scripts

To keep the package updated in your project:

```json
{
  "scripts": {
    "project-scripts": "dotenvx run -- pnpm update @finografic/project-scripts --latest --recursive"
  }
}
```
