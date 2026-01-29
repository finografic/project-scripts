import { log } from 'utils/log.utils';
import { verifyGit } from './verify-git';
import { verifyWorkspace } from './verify-workspace';

type ReleaseType = 'patch' | 'minor' | 'major';

/**
 * Entry point for the github-release CLI.
 */
export async function githubRelease(argv: string[]): Promise<void> {
  try {
    const releaseType = parseReleaseType(argv);

    log.header(`github release (${releaseType})`);

    await verifyWorkspace();
    await verifyGit();

    log.info('release flow not yet complete');

    // next:
    // await bumpVersion(releaseType);
    // await pushTags();
  } catch (error) {
    handleError(error);
  }
}

/* -------------------------------------------------------------------------- */

function parseReleaseType(argv: string[]): ReleaseType {
  const [, , type] = argv;

  if (type !== 'patch' && type !== 'minor' && type !== 'major') {
    throw new Error(
      'invalid release type\n'
        + '→ expected one of: patch | minor | major\n'
        + '→ example: github-release patch',
    );
  }

  return type;
}

function handleError(error: unknown): never {
  if (error instanceof Error) {
    log.error(error.message);
  } else {
    log.error('unknown error occurred');
  }

  process.exit(1);
}
