import type { SeedConfig } from './db.setup.types';

// Helper to get all available schemas
export const getAllSchemas = ({ seedOrder }: { seedOrder: SeedConfig[] }) => seedOrder.map((config) => config.name);

// Helper to validate dependencies
export const validateDependencies = ({ seedOrder, selectedSchemas }: { seedOrder: SeedConfig[]; selectedSchemas: string[] }) => {
  const missing: { schema: string; dependencies: string[] }[] = [];

  selectedSchemas.forEach((schema) => {
    const config = seedOrder.find((c) => c.name === schema);
    if (config?.dependencies) {
      const missingDeps = config.dependencies.filter((dep) => !selectedSchemas.includes(dep));
      if (missingDeps.length > 0) {
        missing.push({ schema, dependencies: missingDeps });
      }
    }
  });

  return missing;
};

// Helper to sort schemas based on dependencies
export const getSortedSchemas = ({ seedOrder, selectedSchemas }: { seedOrder: SeedConfig[]; selectedSchemas: string[] }) => {
  const result: string[] = [];
  const visited = new Set<string>();

  function visit(schema: string) {
    if (visited.has(schema)) return;

    const config = seedOrder.find((c) => c.name === schema);
    if (config?.dependencies) {
      config.dependencies.forEach((dep) => {
        if (selectedSchemas.includes(dep)) {
          visit(dep);
        }
      });
    }

    visited.add(schema);
    result.push(schema);
  }

  selectedSchemas.forEach((schema) => visit(schema));
  return result;
};
