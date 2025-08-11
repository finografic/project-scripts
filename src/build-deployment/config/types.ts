export interface BuildDeploymentConfig {
  // Application Info
  appName: string;
  appDescription: string;
  version: string;

  // Package Names
  packageNames: {
    client: string; // e.g., "@workspace/client"
    server: string; // e.g., "@workspace/server"
  };

  // Directory Structure
  paths: {
    client: string; // e.g., "apps/client"
    server: string; // e.g., "apps/server"
    data: string; // e.g., "data"
    output: string; // e.g., "deployment"
  };

  // Server Configuration
  ports: {
    client: number; // e.g., 3000
    server: number; // e.g., 4040
  };

  // Build Commands
  buildCommands: {
    client: string; // e.g., "build.production"
    server: string; // e.g., "build.production"
  };

  // Environment Variables
  env: {
    production: Record<string, string>;
    development?: Record<string, string>;
  };

  // Database Configuration
  database: {
    type: "sqlite"; // Could expand later
    development: string; // e.g., "development.sqlite.db"
    production: string; // e.g., "production.sqlite.db"
  };

  // Build Options
  options: {
    includeNode?: boolean;
    standalone?: boolean;
    zip?: boolean;
    outputDir?: string;
  };
}
