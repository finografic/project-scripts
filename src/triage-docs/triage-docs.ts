import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { cancel, confirm, intro, isCancel, log, note, outro, select, spinner } from '@clack/prompts';
import type { DocFile } from './triage-docs.types';

import { isCliEntry } from 'utils/is-cli-entry';
import { pc } from 'utils/picocolors';

import {
  DEFAULT_SCAN_DIRS,
  DOC_EXTENSIONS,
  DRAFTS_DIR,
  DRAFTS_MARKERS,
  SPECS_DIR,
  SPEC_MARKERS,
} from './triage-docs.config';

/**
 * Count how many markers appear in the content, ignoring case. Documents are written by people, so a
 * marker cannot assume the casing it was declared with — `Manual checks` and `- [X]` are the same
 * signal as `manual checks` and `- [x]`.
 */
export function scoreMarkers(content: string, markers: string[]): number {
  const haystack = content.toLowerCase();
  return markers.filter((marker) => haystack.includes(marker.toLowerCase())).length;
}

export function suggestCategory(content: string): DocFile['suggestion'] {
  const specScore = scoreMarkers(content, SPEC_MARKERS);
  const draftScore = scoreMarkers(content, DRAFTS_MARKERS);

  if (specScore >= 2 && specScore > draftScore) return 'spec';
  if (draftScore >= 2 && draftScore > specScore) return 'draft';
  return 'unknown';
}

export async function findDocFiles(scanDirs: string[], cwd: string): Promise<DocFile[]> {
  const found: DocFile[] = [];

  for (const dir of scanDirs) {
    const absDir = resolve(cwd, dir);
    if (!existsSync(absDir)) continue;

    const dirStat = await stat(absDir);
    if (!dirStat.isDirectory()) continue;

    const entries = await readdir(absDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!DOC_EXTENSIONS.has(extname(entry.name))) continue;

      const absPath = join(absDir, entry.name);
      const content = await readFile(absPath, 'utf8');

      found.push({
        absolutePath: absPath,
        relativePath: relative(cwd, absPath),
        filename: entry.name,
        content,
        suggestion: suggestCategory(content),
      });
    }
  }

  return found;
}

function formatSuggestion(suggestion: DocFile['suggestion']): string {
  switch (suggestion) {
    case 'spec':
      return pc.cyan('spec');
    case 'draft':
      return pc.yellow('draft');
    case 'unknown':
      return pc.dim('unknown');
  }
}

function previewContent(content: string, maxLines: number = 6): string {
  const lines = content.split('\n').slice(0, maxLines);
  return lines.map((line) => pc.dim(`  │ ${line}`)).join('\n');
}

async function readProjectLabel(cwd: string): Promise<string> {
  try {
    const raw = await readFile(resolve(cwd, 'package.json'), 'utf8');
    const { name } = JSON.parse(raw) as { name?: string };
    return name ? `${name} · triage docs` : 'triage docs';
  } catch {
    return 'triage docs';
  }
}

function parseArgs(args: string[]): { root: string; extraDirs: string[] } {
  let root = process.cwd();
  const extraDirs: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--scan-dir=')) {
      extraDirs.push(arg.slice('--scan-dir='.length));
    } else if (arg.startsWith('--root=')) {
      root = resolve(arg.slice('--root='.length));
    }
  }

  return { root, extraDirs };
}

export async function triageDocs(args = process.argv.slice(2)): Promise<void> {
  const { root: cwd, extraDirs } = parseArgs(args);
  const scanDirs = [...DEFAULT_SCAN_DIRS, ...extraDirs];

  intro(pc.bgCyan(pc.black(` ${await readProjectLabel(cwd)} `)));

  const spin = spinner();
  spin.start('Scanning for planning artifacts...');

  const docs = await findDocFiles(scanDirs, cwd);

  if (docs.length === 0) {
    spin.stop('No documents found in scan directories');
    outro(pc.dim('Nothing to triage'));
    return;
  }

  spin.stop(`Found ${docs.length} document${docs.length === 1 ? '' : 's'}`);

  await mkdir(resolve(cwd, SPECS_DIR), { recursive: true });
  await mkdir(resolve(cwd, DRAFTS_DIR), { recursive: true });

  let movedToSpecs = 0;
  let movedToDrafts = 0;
  let discarded = 0;
  let skipped = 0;

  for (const doc of docs) {
    log.info(`${pc.bold(doc.relativePath)} ${pc.dim('·')} suggestion: ${formatSuggestion(doc.suggestion)}`);

    console.log(previewContent(doc.content));
    console.log();

    const action = await select({
      message: `What to do with ${doc.filename}?`,
      options: [
        {
          value: 'spec',
          label: `Move to ${SPECS_DIR}/`,
          hint: doc.suggestion === 'spec' ? 'suggested' : undefined,
        },
        {
          value: 'draft',
          label: `Move to ${DRAFTS_DIR}/ (gitignored)`,
          hint: doc.suggestion === 'draft' ? 'suggested' : undefined,
        },
        { value: 'discard', label: 'Delete' },
        { value: 'skip', label: 'Leave in place' },
      ],
    });

    if (isCancel(action)) {
      cancel('Operation cancelled');
      return;
    }

    switch (action) {
      case 'spec': {
        const dest = resolve(cwd, SPECS_DIR, doc.filename);
        await copyFile(doc.absolutePath, dest);
        await rm(doc.absolutePath);
        movedToSpecs++;
        log.success(pc.green(`→ ${SPECS_DIR}/${doc.filename}`));
        break;
      }
      case 'draft': {
        const dest = resolve(cwd, DRAFTS_DIR, doc.filename);
        await copyFile(doc.absolutePath, dest);
        await rm(doc.absolutePath);
        movedToDrafts++;
        log.success(pc.yellow(`→ ${DRAFTS_DIR}/${doc.filename}`));
        break;
      }
      case 'discard': {
        const shouldDelete = await confirm({
          message: `Delete ${doc.filename}? This cannot be undone.`,
          initialValue: false,
        });

        if (isCancel(shouldDelete)) {
          cancel('Operation cancelled');
          return;
        }

        if (!shouldDelete) {
          skipped++;
          break;
        }

        await rm(doc.absolutePath);
        discarded++;
        log.warn(pc.dim(`Deleted ${doc.filename}`));
        break;
      }
      case 'skip': {
        skipped++;
        break;
      }
    }
  }

  for (const dir of scanDirs) {
    const absDir = resolve(cwd, dir);
    if (!existsSync(absDir)) continue;

    try {
      const entries = await readdir(absDir);
      if (entries.length === 0) {
        await rm(absDir, { recursive: true });
        log.info(pc.dim(`Removed empty directory: ${dir}`));
      }
    } catch {
      // Directory may have already been removed by parent cleanup.
    }
  }

  note(
    [
      movedToSpecs > 0 ? `${pc.cyan(`${movedToSpecs}`)} → ${SPECS_DIR}/` : null,
      movedToDrafts > 0 ? `${pc.yellow(`${movedToDrafts}`)} → ${DRAFTS_DIR}/` : null,
      discarded > 0 ? `${pc.red(`${discarded}`)} deleted` : null,
      skipped > 0 ? `${pc.dim(`${skipped}`)} skipped` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    'Triage complete',
  );

  outro(pc.green('Done'));
}

if (isCliEntry(import.meta.url)) {
  triageDocs().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export default triageDocs;
