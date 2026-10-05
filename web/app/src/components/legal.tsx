'use client';

import { useMemo } from 'react';
import { renderMarkdown } from '@/lib/markdown';

interface LegalPageProps {
  title: string;
  version: string;
  markdown: string;
}

export function LegalPage({ title, version, markdown }: LegalPageProps) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);

  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <div role="note" className="alert alert-warn font-semibold">
        Wersja robocza — wymaga weryfikacji przez prawnika przed uruchomieniem produkcyjnym
      </div>
      <p className="text-sm text-slate-700">Wersja dokumentu: <strong data-testid="doc-version">{version}</strong></p>
      <div
        className="space-y-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-lg [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_table]:border-collapse [&_table]:w-full [&_thead]:bg-slate-100 [&_th]:border [&_th]:border-slate-300 [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-800"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
