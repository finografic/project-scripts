//#region src/build-deployment/build-deployment.d.ts
declare function main(): Promise<void>;
//#endregion
//#region src/build-deployment/config/types.d.ts
interface BuildDeploymentConfig {
  appName: string;
  appDescription: string;
  version: string;
  workspaceRoot: string;
  packageNames: {
    client: string;
    server: string;
  };
  paths: {
    client: string;
    server: string;
    data: string;
    output: string;
    temp: string;
    deployments: string;
  };
  ports: {
    client: number;
    server: number;
  };
  buildCommands: {
    client: string;
    server: string;
  };
  env: {
    production: Record<string, string>;
    development?: Record<string, string>;
  };
  database: {
    type: 'sqlite';
    development: string;
    production: string;
  };
  options: {
    includeNode?: boolean;
    standalone?: boolean;
    zip?: boolean;
    outputDir?: string;
  };
}
//#endregion
//#region src/build-deployment/config/default.config.d.ts
declare const defaultConfig: BuildDeploymentConfig;
//#endregion
//#region src/build-deployment/platforms.config.d.ts
interface PlatformConfig {
  name: string;
  value: string;
  description: string;
  platform: 'windows' | 'linux' | 'macos' | 'universal';
  arch: 'x64' | 'arm64' | 'universal';
  standalone?: boolean;
  zip?: boolean;
  checked?: boolean;
}
//#endregion
export { type BuildDeploymentConfig, type PlatformConfig, main as buildProduction, defaultConfig };