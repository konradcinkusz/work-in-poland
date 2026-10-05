import { readFileSync } from 'fs';
import { resolve } from 'path';

const LEGAL_CONTENT_DIR = resolve(process.cwd(), 'content/legal');

/**
 * Load legal document content from markdown file.
 * Returns the raw markdown; the caller should render it with renderMarkdown().
 */
export function loadLegalContent(docName: 'terms' | 'privacy' | 'cookies'): string {
  const path = resolve(LEGAL_CONTENT_DIR, `${docName}.pl.md`);
  try {
    return readFileSync(path, 'utf-8');
  } catch (err) {
    console.error(`Failed to load legal document ${docName}:`, err);
    // Return a fallback message if the file is missing (should not happen in production)
    return `# ${docName}\n\n[Document not found]`;
  }
}
