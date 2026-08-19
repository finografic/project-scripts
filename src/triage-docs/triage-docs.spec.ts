import { describe, expect, it, vi } from 'vitest';

import { scoreMarkers, suggestCategory } from './triage-docs';
import { DRAFTS_MARKERS, SPEC_MARKERS } from './triage-docs.config';

vi.mock('utils/is-cli-entry', () => ({
  isCliEntry: () => false,
}));

vi.mock('utils/picocolors', () => ({
  pc: {
    bgCyan: (str: string) => str,
    black: (str: string) => str,
    bold: (str: string) => str,
    cyan: (str: string) => str,
    dim: (str: string) => str,
    green: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
  },
}));

describe('triage-docs', () => {
  describe('scoreMarkers', () => {
    it('counts markers present in the content', () => {
      expect(scoreMarkers('## Goal\n## Architecture\n## Tasks', SPEC_MARKERS)).toBe(2);
    });
  });

  describe('suggestCategory', () => {
    it('suggests spec when spec markers win', () => {
      expect(suggestCategory('## Goal\n## Architecture\n## Migration Strategy')).toBe('spec');
    });

    it('suggests draft when draft markers win', () => {
      expect(suggestCategory('- [ ] first\n- [x] second\n## TODO')).toBe('draft');
    });

    it('returns unknown when spec and draft scores tie', () => {
      const content = `${SPEC_MARKERS[0]}\n${SPEC_MARKERS[1]}\n${DRAFTS_MARKERS[0]}\n${DRAFTS_MARKERS[1]}`;

      expect(suggestCategory(content)).toBe('unknown');
    });
  });
});
