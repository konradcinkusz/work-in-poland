import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRefreshState } from '@/lib/session';
import { resetLadderMemory } from '@/lib/upstream';
import { GET, POST } from './[...path]/route';

const mkJwt = (exp: number) => `x.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.y`;
const fresh = () => mkJwt(Math.floor(Date.now() / 1000) + 600);

type Seen = { url: string; auth: string | null; method: string; body: string | null };
let seen: Seen[];

function backend(handler: (s: Seen) => Response) {
  seen = [];
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const s: Seen = {
      url: String(url), auth: new Headers(init?.headers).get('authorization'), method: init?.method ?? 'GET',
      body: init?.body ? (typeof init.body === 'string' ? init.body : new TextDecoder().decode(init.body as ArrayBuffer)) : null,
    };
    seen.push(s);
    return handler(s);
  }));
}
const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const req = (path: string, init: { method?: string; body?: string; cookie?: string } = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { method: init.method ?? 'GET', body: init.body, headers: { cookie: init.cookie ?? '', 'content-type': 'application/json' } });

beforeEach(() => {
  resetRefreshState();
  resetLadderMemory();
  vi.stubEnv('API_BASE_URL', 'http://api.test');
  vi.stubEnv('AUTH_BASE_URL', 'http://auth.test');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('catch-all proxy', () => {
  it('maps /api/proxy/<x> to API /api/v1/<x> keeping the query, and injects the bearer from the cookie', async () => {
    backend(() => Response.json({ items: [] }));
    const at = fresh();
    const res = await GET(req('/api/proxy/tracker?status=saved', { cookie: `wip_at=${at}; wip_rt=RT` }), ctx('tracker'));
    expect(res.status).toBe(200);
    expect(seen[0]).toMatchObject({ url: 'http://api.test/api/v1/tracker?status=saved', auth: `Bearer ${at}` });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('forwards method and JSON body', async () => {
    backend(() => Response.json({ ok: true }));
    await POST(req('/api/proxy/employer/jobs', { method: 'POST', body: '{"title":"x"}', cookie: `wip_at=${fresh()}` }), ctx('employer', 'jobs'));
    expect(seen[0]).toMatchObject({ method: 'POST', body: '{"title":"x"}' });
  });

  it('passes API status and problem+json body through', async () => {
    backend(() => new Response(JSON.stringify({ errors: { salaries: ['Widełki są wymagane.'] } }), { status: 400, headers: { 'content-type': 'application/problem+json' } }));
    const res = await POST(req('/api/proxy/employer/jobs', { method: 'POST', body: '{}', cookie: `wip_at=${fresh()}` }), ctx('employer', 'jobs'));
    expect(res.status).toBe(400);
    expect((await res.json()).errors.salaries[0]).toBe('Widełki są wymagane.');
  });

  it('refreshes an expired token before calling the API and stores the new pair', async () => {
    const newAt = fresh();
    backend((s) => (s.url.includes('auth.test') ? Response.json({ accessToken: newAt, refreshToken: 'RT2', expiresIn: 900 }) : Response.json({})));
    const res = await GET(req('/api/proxy/tracker', { cookie: `wip_at=${mkJwt(1)}; wip_rt=RT1` }), ctx('tracker'));
    expect(seen[0]?.url).toBe('http://auth.test/api/v1/auth/refresh');
    expect(seen[1]?.auth).toBe(`Bearer ${newAt}`);
    expect(res.headers.getSetCookie().join(';')).toContain('wip_rt=RT2');
  });

  it('when the refresh fails the user is signed out: no bearer, cookies cleared', async () => {
    backend((s) => (s.url.includes('auth.test') ? Response.json({ error: 'x' }, { status: 401 }) : new Response(null, { status: 401 })));
    const res = await GET(req('/api/proxy/tracker', { cookie: `wip_at=${mkJwt(1)}; wip_rt=dead` }), ctx('tracker'));
    expect(res.status).toBe(401);
    expect(seen.at(-1)?.auth).toBeNull();
    expect(res.headers.getSetCookie().filter((c) => c.includes('Max-Age=0')).length).toBe(2);
  });

  it('serves anonymous public reads without a bearer', async () => {
    backend(() => Response.json({ publishedJobs: 1, companies: 1 }));
    expect((await GET(req('/api/proxy/stats'), ctx('stats'))).status).toBe(200);
    expect(seen[0]?.auth).toBeNull();
  });

  it('refuses dot-segments', async () => {
    backend(() => Response.json({}));
    expect((await GET(req('/api/proxy/x'), ctx('..', 'admin'))).status).toBe(400);
    expect(seen).toHaveLength(0);
  });

  it('walks the ladder: 403 from the first candidate -> next; all failing -> 503', async () => {
    vi.stubEnv('API_BASE_URL', 'http://one.test');
    vi.stubEnv('services__api__http__0', 'http://two.test');
    backend((s) => (s.url.startsWith('http://one.test') ? new Response('nope', { status: 403 }) : s.url.startsWith('http://two.test') ? Response.json({ ok: 1 }) : new Response('x', { status: 403 })));
    expect((await GET(req('/api/proxy/stats'), ctx('stats'))).status).toBe(200);
    resetLadderMemory();
    backend(() => new Response('nope', { status: 403 }));
    expect((await GET(req('/api/proxy/stats'), ctx('stats'))).status).toBe(503);
  });
});
