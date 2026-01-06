import { statSync } from 'node:fs';

// Helper to safely check if path is a file
export const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};
