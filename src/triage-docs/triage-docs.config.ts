export const DEFAULT_SCAN_DIRS = [
  'docs/superpowers',
  'docs/superpowers/specs',
  'docs/superpowers/plans',
  'docs/planning',
  'docs/drafts',
  '.cursor/plans',
  '.claude/drafts',
];

export const SPECS_DIR = 'docs/specs';
export const DRAFTS_DIR = 'docs/drafts';

export const DOC_EXTENSIONS = new Set(['.md']);

export const SPEC_MARKERS = [
  '## Goal',
  '## Non-Goals',
  '## Decision Summary',
  '## Architecture',
  '## Migration Strategy',
  '**Status:**',
  '## Chosen approach',
  '## Rejected approach',
  '## Proposed Architecture',
];

export const DRAFTS_MARKERS = [
  '- [ ]',
  '- [x]',
  '## Checklist',
  '## TODO',
  '## Tasks',
  'manual checks',
  'Quick test',
];
