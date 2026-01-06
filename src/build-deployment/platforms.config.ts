import { arch as osArch, platform as osPlatform } from 'node:os';

export interface PlatformConfig {
  name: string;
  value: string;
  description: string;
  platform: 'windows' | 'linux' | 'macos' | 'universal';
  arch: 'x64' | 'arm64' | 'universal';
  standalone?: boolean;
  zip?: boolean;
  checked?: boolean;
}

// Detect host system for intelligent defaults
function getHostPlatform(): 'windows' | 'linux' | 'macos' | 'universal' {
  switch (osPlatform()) {
    case 'win32':
      return 'windows';
    case 'linux':
      return 'linux';
    case 'darwin':
      return 'macos';
    default:
      return 'universal';
  }
}

function getHostArch(): 'x64' | 'arm64' | 'universal' {
  const arch = osArch() as string;
  switch (arch) {
    case 'x64':
    case 'x86_64':
      return 'x64';
    case 'arm64':
    case 'aarch64':
      return 'arm64';
    default:
      return 'x64'; // Default fallback
  }
}

const hostPlatform = getHostPlatform();
const hostArch = getHostArch();

export const platformConfigs: PlatformConfig[] = [
  {
    name: `🍎 macOS (${hostArch}) - Recommended`,
    value: 'macos',
    description: 'macOS deployment with setup script and user guide',
    platform: 'macos',
    arch: hostArch,
    zip: true,
    checked: hostPlatform === 'macos', // Auto-select if running on macOS
  },
  {
    name: `🐧 Linux (${hostArch}) - Server Ready`,
    value: 'linux',
    description: 'Linux deployment with automatic package manager detection',
    platform: 'linux',
    arch: hostArch,
    zip: true,
    checked: hostPlatform === 'linux', // Auto-select if running on Linux
  },
  {
    name: '🪟 Windows (x64) - User Friendly',
    value: 'windows',
    description: 'Windows deployment with automatic Node.js installation',
    platform: 'windows',
    arch: 'x64', // Windows deployments typically use x64
    zip: true,
    checked: hostPlatform === 'windows', // Auto-select if running on Windows
  },
  {
    name: '🌍 Universal (Cross-Platform) - Maximum Compatibility',
    value: 'universal',
    description: 'Universal deployment that works on any platform',
    platform: 'universal',
    arch: 'universal',
    zip: true,
    checked: false,
  },
  {
    name: '📦 Standalone (Minimal) - Quick Deploy',
    value: 'standalone',
    description: 'Minimal standalone package without platform-specific scripts',
    platform: 'universal',
    arch: 'universal',
    standalone: true,
    zip: true,
    checked: false,
  },
];

export const deploymentOptions = [
  {
    name: 'Create ZIP archive',
    value: 'zip',
    checked: true,
  },
  {
    name: 'Include Node.js runtime (experimental)',
    value: 'includeNode',
    checked: false,
  },
];

// Default selection - prefer host platform, fallback to macOS
export const getDefaultPlatform = (): string => {
  const hostConfig = platformConfigs.find((config) => config.checked);
  return hostConfig?.value || 'macos'; // Fallback to macOS as requested
};

console.log(`🖥️  Host system detected: ${hostPlatform} (${hostArch})`);
