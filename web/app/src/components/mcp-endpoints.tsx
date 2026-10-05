'use client';

import { useEffect, useState } from 'react';
import { getRuntimeConfig } from '@/lib/config-client';
import { CopySnippet } from './copy-snippet';

/**
 * URLs and snippets built from the runtime config (`PUBLIC_API_URL` via GET /api/config). The server
 * renders with the value it read from its environment; the client then confirms it through the config module.
 */
export function McpEndpoints({ initialApiUrl }: { initialApiUrl: string }) {
  const [apiUrl, setApiUrl] = useState(initialApiUrl);
  useEffect(() => {
    let alive = true;
    getRuntimeConfig().then((c) => {
      if (alive && c.publicApiUrl) setApiUrl(c.publicApiUrl);
    });
    return () => { alive = false; };
  }, []);

  const open = `${apiUrl}/mcp`;
  const account = `${apiUrl}/mcp/account`;
  const cursor = JSON.stringify({ mcpServers: { 'work-in-poland': { url: open } } }, null, 2);

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <dt className="font-semibold">Publiczny (tylko odczyt)</dt>
          <dd className="mt-1 break-all font-mono text-sm" data-testid="mcp-open-url">{open}</dd>
          <dd className="mt-2 text-sm text-slate-700">Bez logowania. Szukanie ofert, firm, benchmarki wynagrodzeń.</dd>
        </div>
        <div className="card">
          <dt className="font-semibold">Konto (OAuth)</dt>
          <dd className="mt-1 break-all font-mono text-sm" data-testid="mcp-account-url">{account}</dd>
          <dd className="mt-2 text-sm text-slate-700">Wymaga zalogowania przez OAuth. Tracker aplikacji i narzędzia pracodawcy.</dd>
        </div>
      </dl>
      <CopySnippet label="Claude Code — endpoint publiczny" text={`claude mcp add --transport http work-in-poland ${open}`} />
      <CopySnippet label="Claude Code — endpoint konta (OAuth)" text={`claude mcp add --transport http work-in-poland-account ${account}`} />
      <CopySnippet label="Cursor — plik mcp.json" text={cursor} />
      <div className="card">
        <p className="font-semibold">Claude Desktop i Claude.ai</p>
        <p className="mt-1 text-sm text-slate-700">
          Ustawienia → Connectors → „Add custom connector”, a w polu adresu wklej <code className="rounded bg-slate-100 px-1">{open}</code>.
        </p>
      </div>
    </div>
  );
}
