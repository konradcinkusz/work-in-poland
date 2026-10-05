import type { ReactNode } from 'react';

export function LegalPage({ title, version, children }: { title: string; version: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <div role="note" className="alert alert-warn font-semibold">
        Wersja robocza — wymaga weryfikacji przez prawnika przed uruchomieniem produkcyjnym
      </div>
      <h1>{title}</h1>
      <p className="text-sm text-slate-700">Wersja dokumentu: <strong data-testid="doc-version">{version}</strong></p>
      <div className="space-y-4 [&_h2]:mt-8 [&_h2]:text-xl [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">{children}</div>
    </article>
  );
}
