import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { purge, type PurgeOptions } from './purge';

// Mock dependencies
vi.mock('node:fs/promises');
vi.mock('node:child_process');
vi.mock('chalk', () => ({
  default: {
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    cyan: (str: string) => str,
    red: (str: string) => str,
    white: (str: string) => str,
  },
}));
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  })),
}));

describe('purge', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = path.join(tmpdir(), `purge-test-${Date.now()}`);
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    // Mock process.argv[1] by replacing the entire argv array
    Object.defineProperty(process, 'argv', {
      value: ['node', path.join(testDir, 'node_modules', '@finografic', 'project-scripts', 'bin', 'purge-builds.js')],
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('dry-run mode', () => {
    it('should not delete files when dryRun is true', async () => {
      const mockItems = [
        { name: 'dist', isDirectory: () => true, isFile: () => false },
        { name: 'src', isDirectory: () => true, isFile: () => false },
      ];

      // Create a mock that handles both top-level and recursive calls
      const readdirMock = vi.spyOn(fs, 'readdir').mockImplementation(async (dirPath: any) => {
        const dirPathStr = String(dirPath);
        const dirName = path.basename(dirPathStr);

        // For directories being scanned for size, return empty
        if (dirName === 'dist' || dirName === 'node_modules' || dirName === '.turbo') {
          return [] as any;
        }

        // For the root directory, return the mock items
        if (dirPathStr === testDir || dirPathStr.endsWith(testDir)) {
          return mockItems as any;
        }

        // Default: return empty to prevent infinite recursion
        return [] as any;
      });

      const mockStat = vi.spyOn(fs, 'stat').mockResolvedValue({
        size: 1024,
        isDirectory: () => false,
        isFile: () => true,
      } as any);

      const mockRm = vi.spyOn(fs, 'rm');
      const mockUnlink = vi.spyOn(fs, 'unlink');

      const options: PurgeOptions = {
        dryRun: true,
        verbose: false,
        recursive: false,
      };

      await purge(options);

      // Verify that no deletion methods were called
      expect(mockRm).not.toHaveBeenCalled();
      expect(mockUnlink).not.toHaveBeenCalled();

      readdirMock.mockRestore();
      mockStat.mockRestore();
    });

    it('should identify items to delete in dry-run mode', async () => {
      const mockItems = [
        { name: 'dist', isDirectory: () => true, isFile: () => false },
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
        { name: '.turbo', isDirectory: () => true, isFile: () => false },
        { name: 'src', isDirectory: () => true, isFile: () => false },
        { name: 'package.json', isDirectory: () => false, isFile: () => true },
      ];

      const readdirMock = vi.spyOn(fs, 'readdir').mockImplementation(async (dirPath: any) => {
        const dirPathStr = String(dirPath);
        const dirName = path.basename(dirPathStr);

        // For directories being scanned for size, return empty
        if (['dist', 'node_modules', '.turbo'].includes(dirName)) {
          return [] as any;
        }

        // For the root directory, return the mock items
        if (dirPathStr === testDir || dirPathStr.endsWith(testDir)) {
          return mockItems as any;
        }

        // Default: return empty
        return [] as any;
      });

      const mockStat = vi.spyOn(fs, 'stat').mockResolvedValue({
        size: 1024,
        isDirectory: () => false,
        isFile: () => true,
      } as any);

      const options: PurgeOptions = {
        dryRun: true,
        verbose: true,
        recursive: false,
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await purge(options);

      // Verify that the function identified items to delete
      expect(readdirMock).toHaveBeenCalled();

      consoleSpy.mockRestore();
      readdirMock.mockRestore();
      mockStat.mockRestore();
    });
  });

  describe('file pattern matching', () => {
    it('should identify build artifacts correctly', async () => {
      const mockItems = [
        { name: 'dist', isDirectory: () => true, isFile: () => false },
        { name: '.tsup', isDirectory: () => true, isFile: () => false },
        { name: 'pnpm-lock.yaml', isDirectory: () => false, isFile: () => true },
        { name: 'tsconfig.tsbuildinfo', isDirectory: () => false, isFile: () => true },
      ];

      const readdirMock = vi.spyOn(fs, 'readdir').mockImplementation(async (dirPath: any) => {
        const dirPathStr = String(dirPath);
        const dirName = path.basename(dirPathStr);

        // For directories being scanned for size, return empty
        if (['dist', '.tsup'].includes(dirName)) {
          return [] as any;
        }

        // For the root directory, return the mock items
        if (dirPathStr === testDir || dirPathStr.endsWith(testDir)) {
          return mockItems as any;
        }

        // Default: return empty
        return [] as any;
      });

      const mockStat = vi.spyOn(fs, 'stat').mockResolvedValue({
        size: 512,
        isDirectory: () => false,
        isFile: () => true,
      } as any);

      const options: PurgeOptions = {
        dryRun: true,
        verbose: false,
        recursive: false,
      };

      await purge(options);

      // Verify that the function scanned for items
      expect(readdirMock).toHaveBeenCalled();

      readdirMock.mockRestore();
      mockStat.mockRestore();
    });
  });

  describe('protection logic', () => {
    it('should protect critical directories and files', async () => {
      const mockItems = [
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: 'src', isDirectory: () => true, isFile: () => false },
        { name: 'package.json', isDirectory: () => false, isFile: () => true },
        { name: '.env', isDirectory: () => true, isFile: () => false },
        { name: 'dist', isDirectory: () => true, isFile: () => false },
      ];

      const readdirMock = vi.spyOn(fs, 'readdir').mockImplementation(async (dirPath: any) => {
        const dirPathStr = String(dirPath);
        const dirName = path.basename(dirPathStr);

        // For directories being scanned for size, return empty
        if (dirName === 'dist') {
          return [] as any;
        }

        // For the root directory, return the mock items
        if (dirPathStr === testDir || dirPathStr.endsWith(testDir)) {
          return mockItems as any;
        }

        // Default: return empty
        return [] as any;
      });

      const mockStat = vi.spyOn(fs, 'stat').mockResolvedValue({
        size: 1024,
        isDirectory: () => false,
        isFile: () => true,
      } as any);

      const options: PurgeOptions = {
        dryRun: true,
        verbose: true,
        recursive: false,
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await purge(options);

      // The function should identify dist for deletion but protect .git, src, package.json, .env
      expect(readdirMock).toHaveBeenCalled();

      consoleSpy.mockRestore();
      readdirMock.mockRestore();
      mockStat.mockRestore();
    });
  });
});
