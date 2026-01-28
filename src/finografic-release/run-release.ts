import { log } from 'utils/log.utils';
import { verifyGit } from './verify-git';

type ReleaseType = 'patch' | 'minor' | 'major';

export async function runRelease(argv: string[]): Promise<void> {
  try {
    const releaseType = parseReleaseType(argv);

    log.header(`finografic release (${releaseType})`);

    await verifyGit();

    log.info('git verification passed');
    log.info('release flow not yet complete');

    // next steps (coming soon):
    // await bumpVersion(releaseType);
    // await pushTags();
  } catch (error) {
    handleError(error);
  }
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function parseReleaseType(argv: string[]): ReleaseType {
  const [, , type] = argv;

  if (type !== 'patch' && type !== 'minor' && type !== 'major') {
    throw new Error(
      'invalid release type\n' +
        '→ expected one of: patch | minor | major\n' +
        '→ example: finografic-release patch',
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
