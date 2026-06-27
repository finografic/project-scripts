import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Whether this module is the process entry point (e.g. `node bin/foo.mjs`).
 * Resolves symlinks so pnpm `.bin` shims and hoisted paths match `import.meta.url`.
 *
 * @param metaUrl - Pass `import.meta.url` from the CLI entry module.
 */
export function isCliEntry(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  try {
    const modulePath = realpathSync(fileURLToPath(metaUrl));
    const entryPath = realpathSync(path.resolve(entry));
    return modulePath === entryPath;
  } catch {
    return false;
  }
}
