export interface DeleteProgress {
  totalCount: number;
  deletedCount: number;
  percent: number;
}

export interface CleanOptions {
  dryRun?: boolean;
  verbose?: boolean;
  recursive?: boolean;
}
