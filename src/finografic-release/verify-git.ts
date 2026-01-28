import { exec } from 'utils/cli.utils';
import { log } from 'utils/log.utils';
import { DEFAULT_RELEASE_BRANCH } from './defaults.constants';

export async function verifyGit(): Promise<void> {
  log.step('verifying git state');

  // 1. inside a git repo
  await assertGitRepo();

  // 2. not detached HEAD
  await assertNotDetachedHead();

  // 3. clean working tree
  await assertCleanWorkingTree();

  // 4. correct branch
  await assertOnReleaseBranch();

  // 5. upstream configured
  await assertUpstreamExists();

  // 6. no unpushed commits
  await assertNoUnpushedCommits();

  log.success('git state verified');
}

/* -------------------------------------------------------------------------- */
/* assertions                                                                 */
/* -------------------------------------------------------------------------- */

async function assertGitRepo(): Promise<void> {
  try {
    await exec('git rev-parse --is-inside-work-tree');
  } catch {
    throw new Error('not inside a git repository');
  }
}

async function assertNotDetachedHead(): Promise<void> {
  try {
    await exec('git symbolic-ref --quiet HEAD');
  } catch {
    throw new Error(
      'detached HEAD detected\n' +
        '→ checkout a branch before running a release',
    );
  }
}

async function assertCleanWorkingTree(): Promise<void> {
  const { stdout } = await exec('git status --porcelain');

  if (stdout.trim().length > 0) {
    throw new Error(
      'working tree is not clean\n' +
        '→ commit or stash your changes before releasing',
    );
  }
}

async function assertOnReleaseBranch(): Promise<void> {
  const { stdout } = await exec('git branch --show-current');
  const branch = stdout.trim();

  if (branch !== DEFAULT_RELEASE_BRANCH) {
    throw new Error(
      `not on release branch (${DEFAULT_RELEASE_BRANCH})\n` +
        `→ current branch: ${branch}`,
    );
  }
}

async function assertUpstreamExists(): Promise<void> {
  try {
    await exec('git rev-parse --abbrev-ref --symbolic-full-name @{u}');
  } catch {
    throw new Error(
      'no upstream branch configured\n' +
        '→ run: git push --set-upstream origin <branch>',
    );
  }
}

async function assertNoUnpushedCommits(): Promise<void> {
  const { stdout } = await exec('git rev-list --count @{u}..HEAD');
  const count = Number(stdout.trim());

  if (Number.isNaN(count)) {
    throw new Error('failed to determine unpushed commit count');
  }

  if (count > 0) {
    throw new Error(
      'unpushed commits detected\n' +
        '→ run: git push',
    );
  }
}
