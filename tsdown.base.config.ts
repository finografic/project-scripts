import type { UserConfig } from 'tsdown';

/**
 * Base tsdown configuration shared by all builds.
 *
 * Intentionally minimal: only invariants live here.
 */
export const tsdownBaseConfig: UserConfig = {
  platform: 'node',
  treeshake: true,
  shims: true,

  /**
   * Support both Node 22 and Node 24 consumers.
   * Do not raise until all downstream monorepos are upgraded.
   */
  target: 'node22',
};

// ======================================================================== //

/*
// NOTE: USAGE..

import { defineConfig } from "tsdown";
import { tsdownBaseConfig } from "./tsdown.base.config";

export default defineConfig([
  {
    ...tsdownBaseConfig,
    // CLI config
  },
  {
    ...tsdownBaseConfig,
    // library config
  },
]);

*/
