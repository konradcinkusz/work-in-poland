import type { Problem } from './types';

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  problem: Problem | null;
  networkError: boolean;
}

/**
 * Browser -> BFF proxy -> API. The browser only ever talks to its own origin; the bearer is
 * injected server-side. A 401 means the session is gone: callers redirect to login.
 */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/proxy${path}`, {
      method: init.method ?? 'GET',
      headers: init.body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
    });
    let parsed: unknown = null;
    if (res.status !== 204) {
      try {
        parsed = await res.json();
      } catch {
        parsed = null;
      }
    }
    if (res.ok) return { ok: true, status: res.status, data: parsed as T, problem: null, networkError: false };
    return { ok: false, status: res.status, data: null, problem: (parsed as Problem) ?? null, networkError: false };
  } catch {
    return { ok: false, status: 0, data: null, problem: null, networkError: true };
  }
}

/** Posts JSON to one of the BFF's own `/api/auth/*` routes. */
export async function authApi(path: string, body?: unknown, method: 'GET' | 'POST' = 'POST'): Promise<{ status: number; data: Record<string, unknown> }> {
  try {
    const res = await fetch(`/api/auth/${path}`, {
      method,
      headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: { status: 'network_error' } };
  }
}

/** Maps a problem-details `errors` bag (field -> messages) to field -> first message. */
export function fieldErrors(problem: Problem | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(problem?.errors ?? {})) {
    if (messages[0]) out[field] = messages[0];
  }
  return out;
}
