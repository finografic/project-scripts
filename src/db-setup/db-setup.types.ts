export interface SeedConfig {
  name: string;
  description?: string;
  dependencies?: string[];
}

export interface ViewConfig {
  name: string;
  description?: string;
  dependencies?: string[];
}

export interface DbSetupConfig {
  viewConfigs: ViewConfig[];
}
