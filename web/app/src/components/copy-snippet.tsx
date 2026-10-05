'use client';

import { useState } from 'react';

export function CopySnippet({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-label={`Kopiuj: ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? 'Skopiowano' : 'Kopiuj'}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-sm text-slate-50"><code>{text}</code></pre>
    </div>
  );
}
