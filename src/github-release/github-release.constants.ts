/**
 * Default configuration and constants for the github-release workflow.
 *
 * This file intentionally contains only static values
 * (no logic, no environment resolution).
 */
export const DEFAULT_RELEASE_BRANCH = 'master';

export const GITHUB_RELEASE_BIN = 'github-release';

/**
 * Artifacts that must exist before a release can proceed.
 * Used by workspace verification.
 */
export const REQUIRED_BUILD_ARTIFACTS = [
  'bin/github-release.mjs',
] as const;
