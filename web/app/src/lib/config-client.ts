/** Client-safe runtime config from `GET /api/config` (addresses and flags only). */
export interface RuntimeConfig {
  publicApiUrl: string;
  siteUrl: string;
}

const FALLBACK: RuntimeConfig = { publicApiUrl: '', siteUrl: '' };

let cached: Promise<RuntimeConfig> | null = null;

/**
 * Fetches the runtime config once; concurrent callers share the in-flight promise. On the server
 * (SSR) it resolves to an empty fallback — server components read the environment directly.
 */
export function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (typeof window === 'undefined') return Promise.resolve(FALLBACK);
  if (!cached) {
    cached = fetch('/api/config')
      .then((r) => (r.ok ? (r.json() as Promise<RuntimeConfig>) : FALLBACK))
      .catch(() => FALLBACK)
      .then((cfg) => {
        if (cfg === FALLBACK) cached = null; // do not cache a failure
        return cfg;
      });
  }
  return cached;
}

export function resetRuntimeConfigCache(): void {
  cached = null;
}
