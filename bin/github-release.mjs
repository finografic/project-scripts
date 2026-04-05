#!/usr/bin/env node
import { access } from 'fs/promises';
import { execa } from 'execa';

// #region src/utils/log.utils.ts
const log = {
  header(message) {
    console.log(`\n${message}\n`);
  },
  step(message) {
    console.log(`→ ${message}`);
  },
  info(message) {
    console.log(`ℹ ${message}`);
  },
  success(message) {
    console.log(`✔ ${message}`);
  },
  error(message) {
    console.error(`✖ ${message}`);
  },
};

// #endregion
// #region src/utils/cli.utils.ts
async function exec(command) {
  try {
    const result = await execa(command, {
      shell: true,
      stdio: 'pipe',
    });
    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('failed to execute command');
  }
}

// #endregion
// #region src/github-release/github-release.constants.ts
/**
 * Default configuration and constants for the github-release workflow.
 *
 * This file intentionally contains only static values
 * (no logic, no environment resolution).
 */
const DEFAULT_RELEASE_BRANCH = 'master';
/**
 * Artifacts that must exist before a release can proceed.
 * Used by workspace verification.
 */
const REQUIRED_BUILD_ARTIFACTS = ['bin/github-release.mjs'];

// #endregion
// #region src/github-release/verify-git.ts
async function verifyGit() {
  log.step('verifying git state');
  await assertGitRepo();
  await assertNotDetachedHead();
  await assertCleanWorkingTree();
  await assertOnReleaseBranch();
  await assertUpstreamExists();
  await assertNoUnpushedCommits();
  log.success('git state verified');
}
async function assertGitRepo() {
  try {
    await exec('git rev-parse --is-inside-work-tree');
  } catch {
    throw new Error('not inside a git repository');
  }
}
async function assertNotDetachedHead() {
  try {
    await exec('git symbolic-ref --quiet HEAD');
  } catch {
    throw new Error('detached HEAD detected\n→ checkout a branch before running a release');
  }
}
async function assertCleanWorkingTree() {
  const { stdout } = await exec('git status --porcelain');
  if (stdout.trim().length > 0) {
    throw new Error('working tree is not clean\n→ commit or stash your changes before releasing');
  }
}
async function assertOnReleaseBranch() {
  const { stdout } = await exec('git branch --show-current');
  const branch = stdout.trim();
  if (branch !== DEFAULT_RELEASE_BRANCH) {
    throw new Error(
      `not on release branch (${DEFAULT_RELEASE_BRANCH})\n→ current branch: ${branch}`,
    );
  }
}
async function assertUpstreamExists() {
  try {
    await exec('git rev-parse --abbrev-ref --symbolic-full-name @{u}');
  } catch {
    throw new Error(
      'no upstream branch configured\n→ run: git push --set-upstream origin <branch>',
    );
  }
}
async function assertNoUnpushedCommits() {
  const { stdout } = await exec('git rev-list --count @{u}..HEAD');
  const count = Number(stdout.trim());
  if (Number.isNaN(count)) throw new Error('failed to determine unpushed commit count');
  if (count > 0) throw new Error('unpushed commits detected\n→ run: git push');
}

// #endregion
// #region src/github-release/verify-workspace.ts
/**
 * Verifies that the current workspace is in a valid state
 * to perform a GitHub release.
 *
 * This check is intentionally conservative and side-effect free.
 */
async function verifyWorkspace() {
  log.step('verifying workspace state');
  await assertRequiredArtifactsExist();
  log.success('workspace verified');
}
async function assertRequiredArtifactsExist() {
  try {
    await Promise.all(REQUIRED_BUILD_ARTIFACTS.map((file) => access(file)));
  } catch {
    throw new Error('required build artifacts are missing\n→ run the build before releasing');
  }
}

// #endregion
// #region src/github-release/github-release.ts
/**
 * Entry point for the github-release CLI.
 */
async function githubRelease(argv) {
  try {
    const releaseType = parseReleaseType(argv);
    log.header(`github release (${releaseType})`);
    await verifyWorkspace();
    await verifyGit();
    log.info('release flow not yet complete');
  } catch (error) {
    handleError(error);
  }
}
function parseReleaseType(argv) {
  const [, , type] = argv;
  if (type !== 'patch' && type !== 'minor' && type !== 'major') {
    throw new Error(
      'invalid release type\n→ expected one of: patch | minor | major\n→ example: github-release patch',
    );
  }
  return type;
}
function handleError(error) {
  if (error instanceof Error) log.error(error.message);
  else log.error('unknown error occurred');
  process.exit(1);
}

// #endregion
export { githubRelease };
