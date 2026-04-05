import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { findProjectRoot } from '../../utils/project.utils.js';
import type { BuildDeploymentConfig } from './types';

// Get the current file's directory and resolve workspace root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use the smart findProjectRoot function to find the actual monorepo root
// This works regardless of where the script is run from!
const WORKSPACE_ROOT = findProjectRoot();

export const defaultConfig: BuildDeploymentConfig = {
  appName: 'Touch Monorepo',
  appDescription: 'Touch Monorepo Production Distribution',
  version: '1.0.0',

  // Workspace root for absolute path resolution
  workspaceRoot: WORKSPACE_ROOT,

  packageNames: {
    client: '@workspace/client',
    server: '@workspace/server',
  },

  paths: {
    client: 'apps/client',
    server: 'apps/server',
    data: 'data',
    output: 'deployment',
    temp: '.temp', // Build isolation - gets cleaned up after each run
    deployments: 'deployments', // Organized output - gitignored, multiple versions
  },

  ports: {
    client: 3000,
    server: 4040,
  },

  buildCommands: {
    client: 'build.production',
    server: 'build.production',
  },

  env: {
    production: {
      // Application Environment
      NODE_ENV: 'production',

      // API Server Configuration
      API_PROTOCOL: 'http',
      API_HOST: 'localhost',
      API_PORT: '4040',
      API_BASE_PATH: '/api',
      API_URL: 'http://localhost:4040/api',

      // Client Configuration
      CLIENT_PROTOCOL: 'http',
      CLIENT_HOST: 'localhost',
      CLIENT_PORT: '3000',
      CLIENT_ORIGIN: 'http://localhost:3000',
      VITE_APP_NAME: 'Touch Monorepo',

      // Database Configuration
      DB_DIALECT: 'sqlite',
      DB_HOST: 'localhost',
      DB_USER: 'admin',
      DB_PORT: '0',
      DATABASE_URL: './dist/data/db/production.sqlite.db',
      DB_NAME: 'production.sqlite.db',

      // File Uploads
      UPLOAD_DIR: './dist/data/uploads',

      // Path Configuration
      DATA_DIR: './dist/data',
      LOGS_DIR: './dist/data/logs',
      UPLOADS_DIR: './dist/data/uploads',

      // Logging Configuration
      PINO_DISABLE_WORKER_THREADS: 'true',
      PINO_LOG_LEVEL: 'info',
    },
  },

  database: {
    type: 'sqlite',
    development: 'development.sqlite.db',
    production: 'production.sqlite.db',
  },

  options: {
    includeNode: false,
    standalone: false,
    zip: true,
  },
};
