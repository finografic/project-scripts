import { access } from 'fs/promises';

import { log } from 'utils/log.utils';
import { REQUIRED_BUILD_ARTIFACTS } from './github-release.constants';

/**
 * Verifies that the current workspace is in a valid state
 * to perform a GitHub release.
 *
 * This check is intentionally conservative and side-effect free.
 */
export async function verifyWorkspace(): Promise<void> {
  log.step('verifying workspace state');

  await assertRequiredArtifactsExist();

  log.success('workspace verified');
}

async function assertRequiredArtifactsExist(): Promise<void> {
  try {
    await Promise.all(
      REQUIRED_BUILD_ARTIFACTS.map((file) => access(file)),
    );
  } catch {
    throw new Error(
      'required build artifacts are missing\n'
        + '→ run the build before releasing',
    );
  }
}
