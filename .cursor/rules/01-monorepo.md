# Monorepo-Specific Rules

## Package Management

- Use pnpm for all package management operations
- Always run commands from the workspace root unless package-specific
- Use workspace protocols (workspace:*) for internal package dependencies
- Keep package.json files synchronized where needed
- Run `pnpm install` after adding new dependencies

## Cross-Package Imports

- Use workspace aliases (@workspace/core, @workspace/i18n) for internal imports
- Prefer importing from package entry points rather than deep imports
- For development, ensure vite.config.ts aliases point to source files
- For production builds, rely on built package exports

## Code Organization

- Keep shared types and utilities in packages/core
- Business logic should be in apps/
- Reusable components belong in packages/ if used across apps
- Configuration files belong in config/ folder for project-specific settings

## Build & Development

- Always test that packages build successfully before committing
- Use turbo for orchestrating builds across packages
- Run type checking across the entire monorepo
- Ensure hot reload works properly in development

## Package Architecture

- Packages should be generic and reusable
- Project-specific configuration goes in config/ folder
- Generated files should be in config/generated/
- Each package should have clear entry points and exports
