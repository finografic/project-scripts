export interface ViewConfig {
  name: string;
  description?: string;
}

export interface DbSetupConfig {
  viewConfigs: ViewConfig[];
}
