import fs from 'node:fs';

// Helper to safely check if path is a file
export const isFile = (path: string): boolean => {
  try {
    return fs.statSync(path).isFile();
  } catch (_error: unknown) {
    return false;
  }
};
