# Monorepo Deployment Builder

A powerful tool for creating cross-platform, standalone distributions of monorepo applications. Designed for monorepos using a modern TypeScript stack with:

- Client: Vite, React, TypeScript
- Server: Node.js, Hono, Drizzle ORM (SQLite)
- Structure: `apps/client`, `apps/server`, `data/` layout

## 🎯 Features

- **Cross-platform support**: Windows, Linux, macOS
- **Architecture support**: x64, ARM64, Universal
- **Standalone packaging**: Self-contained deployments
- **Automatic setup scripts**: Platform-specific installation
- **Zip archives**: Easy distribution
- **No external dependencies**: Works on target machines without Node.js setup

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add -D @finografic/project-scripts

# Using npm
npm install --save-dev @finografic/project-scripts

# Using yarn
yarn add -D @finografic/project-scripts
```

## 🚀 Quick Start

### CLI Usage

```bash
# Interactive mode (recommended)
pnpm build-deployment

# Auto-confirm with host platform
pnpm build-deployment -y

# Platform-specific builds
pnpm build-deployment --platform windows --arch x64 --zip
pnpm build-deployment --platform linux --standalone
pnpm build-deployment --platform macos
```

### Programmatic Usage

```typescript
import { buildProduction, type BuildDeploymentConfig } from '@finografic/project-scripts/build-deployment';

// Use default configuration
buildProduction();

// Or with custom configuration
const config: BuildDeploymentConfig = {
  appName: 'My App',
  appDescription: 'My Awesome App',
  version: '1.0.0',
  packageNames: {
    client: '@workspace/client',
    server: '@workspace/server',
  },
  paths: {
    client: 'apps/client',
    server: 'apps/server',
    data: 'data',
    output: 'deployment',
  },
  // ... other configuration options
};

buildProduction(config);
```

## ⚙️ Configuration

The build system is highly configurable to support different monorepo structures and requirements. While it provides sensible defaults for the recommended structure, you can customize almost every aspect through configuration.

### Build Options

| Option           | CLI Flag                   | Description                                        | Default        |
| ---------------- | -------------------------- | -------------------------------------------------- | -------------- |
| Platform         | \`--platform\`, \`-p\`     | Target platform (windows\|linux\|macos\|universal) | universal      |
| Architecture     | \`--arch\`, \`-a\`         | Target architecture (x64\|arm64\|universal)        | universal      |
| Include Node.js  | \`--include-node\`, \`-n\` | Include Node.js runtime                            | false          |
| Standalone       | \`--standalone\`, \`-s\`   | Create standalone package                          | false          |
| Zip              | \`--zip\`, \`-z\`          | Create zip archive                                 | false          |
| Output Directory | \`--output-dir\`, \`-o\`   | Output directory for zip                           | workspace root |

### Configuration File

Create a \`build-deployment.config.ts\` file:

```typescript
import type { BuildDeploymentConfig } from '@finografic/project-scripts/build-deployment';

export const config: BuildDeploymentConfig = {
  appName: 'My App',
  appDescription: 'My Awesome App',
  version: '1.0.0',

  // Package Names (for pnpm --filter)
  packageNames: {
    client: '@workspace/client',
    server: '@workspace/server',
  },

  // Directory Structure
  paths: {
    client: 'apps/client',
    server: 'apps/server',
    data: 'data',
    output: 'deployment',
  },

  // Server Configuration
  ports: {
    client: 3000,
    server: 4040,
  },

  // Build Commands
  buildCommands: {
    client: 'build.production',
    server: 'build.production',
  },

  // Environment Variables
  env: {
    production: {
      NODE_ENV: 'production',
      API_PORT: '4040',
      // ... other env vars
    },
  },

  // Database Configuration
  database: {
    type: 'sqlite',
    development: 'development.sqlite.db',
    production: 'production.sqlite.db',
  },

  // Build Options
  options: {
    includeNode: false,
    standalone: false,
    zip: true,
  },
};
```

## 📦 Output Structure

```
deployment/
├── dist/                    # Build artifacts
│   ├── client/             # Frontend application
│   ├── server/             # Backend application
│   └── data/               # Database, migrations, uploads
├── node_modules/           # Dependencies (if not standalone)
├── package.json            # Dependencies and scripts
├── .env                    # Environment configuration
├── .env.production         # Production environment
├── setup.bat              # Windows setup script
├── setup.sh               # Linux setup script
├── setup-macos.sh         # macOS setup script
├── start-server.bat       # Windows server startup
├── start-client.bat       # Windows client startup
├── start-server.sh        # Linux/macOS server startup
├── start-client.sh        # Linux/macOS client startup
├── ports.utils.js         # Port management utility
└── README.md              # Deployment instructions
```

## 🎯 Use Cases

### 1. Windows Distribution

```bash
# Create Windows deployment
pnpm build-deployment --platform windows --arch x64 --zip

# Result: my-app-windows-x64-2024-01-15T10-30-00.zip
# Contains: setup.bat, start-server.bat, start-client.bat
```

### 2. Linux Server Deployment

```bash
# Create Linux standalone package
pnpm build-deployment --platform linux --standalone --zip

# Result: my-app-linux-x64-2024-01-15T10-30-00.zip
# Contains: setup.sh, start-server.sh, start-client.sh
```

### 3. Cross-platform Distribution

```bash
# Create universal deployment
pnpm build-deployment --platform universal --zip

# Result: my-app-universal-universal-2024-01-15T10-30-00.zip
# Contains: All platform scripts and setup files
```

## 🔧 Troubleshooting

### Common Issues

1. **Node.js Not Found**
   - Setup scripts will detect and guide installation
   - Download from <https://nodejs.org/> (LTS recommended)

2. **Port Conflicts**
   - Scripts automatically kill conflicting processes
   - Manual port configuration available in \`.env\`

3. **Permission Issues**
   - Linux/macOS scripts are automatically made executable
   - Windows scripts run with current user permissions

4. **Database Issues**
   - SQLite database is included in deployment
   - Automatic migration on first run

-

## 📝 Notes

### Monorepo Compatibility

This tool is designed to work with monorepos that follow these patterns:

- **Structure**:

  ```
  monorepo/
  ├── apps/
  │   ├── client/          # Frontend application (Vite + React)
  │   └── server/          # Backend application (Node.js + Hono)
  ├── data/                # Database, migrations, uploads
  ├── package.json         # Root workspace config
  └── .env                 # Environment configuration
  ```

- **Tech Stack**:
  - **Client**: Vite, React, TypeScript
  - **Server**: Node.js, Hono, Drizzle ORM
  - **Database**: SQLite (with Drizzle migrations)
  - **Package Manager**: pnpm (workspace support)

- **Build System**:
  - Client: Vite build system
  - Server: TypeScript compilation (tsup recommended)
  - Database: Drizzle migrations

### General Notes

- **Standalone mode**: Creates minimal package.json with only essential dependencies
- **Universal mode**: Includes scripts for all platforms
- **Zip archives**: Automatically named with platform, architecture, and timestamp
- **Environment variables**: Production-ready configuration included
- **Database**: SQLite database included and pre-configured
- **Security**: Production secrets should be configured on target machines

## 🎉 Success Indicators

When deployment completes successfully:

- ✅ All platform scripts created
- ✅ Setup scripts generated
- ✅ Dependencies installed
- ✅ Zip archive created (if requested)
- 📦 Deployment ready for distribution
