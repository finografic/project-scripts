export interface DocFile {
  absolutePath: string;
  relativePath: string;
  filename: string;
  content: string;
  suggestion: 'spec' | 'draft' | 'unknown';
}
