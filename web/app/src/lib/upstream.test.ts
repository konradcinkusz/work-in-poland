import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiCandidates } from './env';
import { fetchLadder, resetLadderMemory } from './upstream';

const env = process.env as Record<string, string | undefined>;
beforeEach(() => resetLadderMemory());

function ladder(responses: Record<string, Response | Error>) {
  const seen: string[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
    seen.push(String(url));
    const base = Object.keys(responses).find((b) => String(url).startsWith(b));
    const r = base ? responses[base] : new Error('ECONNREFUSED');
    if (r instanceof Error) throw r;
    return r!.clone();
  }) as unknown as typeof fetch;
  return { seen, fetchImpl };
}

describe('candidate ladder', () => {
  it('falls through 403 (wrong ingress) to the next candidate', async () => {
    const { seen, fetchImpl } = ladder({ 'http://a': new Response('forbidden', { status: 403 }), 'http://b': Response.json({ ok: 1 }) });
    const res = await fetchLadder(['http://a', 'http://b'], '/api/v1/stats', { fetchImpl });
    expect(res.status).toBe(200);
    expect(seen).toEqual(['http://a/api/v1/stats', 'http://b/api/v1/stats']);
  });

  it('falls through connection errors', async () => {
    const { fetchImpl } = ladder({ 'http://a': new Error('ECONNREFUSED'), 'http://b': Response.json({ ok: 1 }) });
    expect((await fetchLadder(['http://a', 'http://b'], '/x', { fetchImpl })).status).toBe(200);
  });

  it('returns 503 only when every candidate failed', async () => {
    const { fetchImpl } = ladder({ 'http://a': new Response('', { status: 403 }), 'http://b': new Error('down') });
    const res = await fetchLadder(['http://a', 'http://b'], '/x', { fetchImpl });
    expect(res.status).toBe(503);
    expect(res.headers.get('content-type')).toContain('problem+json');
  });

  it('passes a JSON 403 from the API through (it is the API answering, not an ingress)', async () => {
    const { fetchImpl } = ladder({ 'http://a': Response.json({ title: 'Forbidden' }, { status: 403 }), 'http://b': Response.json({}) });
    expect((await fetchLadder(['http://a', 'http://b'], '/x', { fetchImpl })).status).toBe(403);
  });

  it('passes 401/404/400 through without trying further candidates', async () => {
    for (const status of [400, 401, 404, 409]) {
      resetLadderMemory();
      const { seen, fetchImpl } = ladder({ 'http://a': new Response('', { status }), 'http://b': Response.json({}) });
      expect((await fetchLadder(['http://a', 'http://b'], '/x', { fetchImpl })).status).toBe(status);
      expect(seen).toHaveLength(1);
    }
  });

  it('turns a 3xx into 502 and logs both URLs', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { fetchImpl } = ladder({ 'http://a': new Response(null, { status: 302, headers: { location: 'https://elsewhere/x' } }) });
    const res = await fetchLadder(['http://a'], '/x', { fetchImpl });
    expect(res.status).toBe(502);
    expect(log.mock.calls[0]?.[0]).toContain('http://a/x');
    expect(log.mock.calls[0]?.[0]).toContain('https://elsewhere/x');
    log.mockRestore();
  });

  it('maps a timeout to 504', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchImpl = vi.fn((_u: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch;
    const res = await fetchLadder(['http://a'], '/x', { fetchImpl, timeoutMs: 20 });
    expect(res.status).toBe(504);
    log.mockRestore();
  });

  it('remembers the last good candidate', async () => {
    const { seen, fetchImpl } = ladder({ 'http://a': new Error('down'), 'http://b': Response.json({}) });
    await fetchLadder(['http://a', 'http://b'], '/1', { fetchImpl });
    seen.length = 0;
    await fetchLadder(['http://a', 'http://b'], '/2', { fetchImpl });
    expect(seen).toEqual(['http://b/2']);
  });
});

describe('apiCandidates', () => {
  it('orders explicit env, Aspire discovery, internal DNS, localhost and de-duplicates', () => {
    env.API_BASE_URL = 'http://explicit:1/';
    env.services__api__https__0 = 'https://disco:2';
    env.services__api__http__0 = 'http://disco:3';
    expect(apiCandidates()).toEqual(['http://explicit:1', 'https://disco:2', 'http://disco:3', 'http://api:8080', 'http://localhost:8080']);
    delete env.API_BASE_URL;
    delete env.services__api__https__0;
    delete env.services__api__http__0;
    expect(apiCandidates()).toEqual(['http://api:8080', 'http://localhost:8080']);
  });
});
