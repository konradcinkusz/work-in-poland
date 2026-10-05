import { renderMarkdown } from '@/lib/markdown';

/** Renders employer markdown. The renderer has raw HTML disabled and restricts link schemes (see lib/markdown.ts). */
export function Markdown({ source }: { source: string }) {
  return <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
