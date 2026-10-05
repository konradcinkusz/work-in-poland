/**
 * Calls to backend services (the API) from the server side. Implements the candidate ladder
 * of FRONTEND-BFF §5: try each candidate base URL in order; a 403 without a JSON body is an
 * ingress answering for the wrong service, so the next candidate is tried; 503 is returned
 * only when every candidate failed. A 3xx is a configuration bug and becomes a 502.
 */

export const UPSTREAM_TIMEOUT_MS = 30_000; // sized for a scale-to-zero cold start

export interface LadderInit extends Omit<RequestInit, 'redirect' | 'signal'> {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

let lastGood: string | undefined;

export function resetLadderMemory(): void {
  lastGood = undefined;
}

function problem(status: number, title: string, detail: string): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail }), {
    status,
    headers: { 'content-type': 'application/problem+json', 'cache-control': 'no-store' },
  });
}

function isJson(res: Response): boolean {
  return /json/i.test(res.headers.get('content-type') ?? '');
}

export async function fetchLadder(candidates: string[], pathAndQuery: string, init: LadderInit = {}): Promise<Response> {
  const { timeoutMs = UPSTREAM_TIMEOUT_MS, fetchImpl = fetch, ...rest } = init;
  const ordered = lastGood && candidates.includes(lastGood)
    ? [lastGood, ...candidates.filter((c) => c !== lastGood)]
    : candidates;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const failures: string[] = [];
  try {
    for (const base of ordered) {
      const url = `${base}${pathAndQuery}`;
      let res: Response;
      try {
        res = await fetchImpl(url, { ...rest, redirect: 'manual', signal: controller.signal });
      } catch (e) {
        if (controller.signal.aborted) {
          console.error(`[upstream] timeout after ${timeoutMs}ms calling ${url}`);
          return problem(504, 'Przekroczono czas oczekiwania', 'Usługa nie odpowiedziała na czas.');
        }
        failures.push(`${base}: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      if (res.status >= 300 && res.status < 400) {
        console.error(
          `[upstream] ${url} answered ${res.status} redirecting to ${res.headers.get('location') ?? '(no Location)'}; ` +
            'a redirect between services is a configuration bug',
        );
        return problem(502, 'Błąd konfiguracji', 'Usługa odpowiedziała przekierowaniem.');
      }
      if (res.status === 403 && !isJson(res)) {
        failures.push(`${base}: 403`);
        void res.body?.cancel().catch(() => undefined);
        continue;
      }
      lastGood = base;
      return res;
    }
    console.error(`[upstream] no candidate answered ${pathAndQuery}: ${failures.join('; ')}`);
    return problem(503, 'Usługa niedostępna', 'Nie udało się połączyć z usługą. Spróbuj ponownie za chwilę.');
  } finally {
    clearTimeout(timer);
  }
}
