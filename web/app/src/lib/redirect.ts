/**
 * Accepts only same-origin relative paths for `?redirect=`; anything else (absolute URLs,
 * protocol-relative `//host`, backslashes, control chars) falls back, so the login redirect
 * cannot become an open redirect.
 */
export function safeRedirect(value: string | null | undefined, fallback = '/konto'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

export function loginUrl(redirect: string): string {
  return `/logowanie?redirect=${encodeURIComponent(redirect)}`;
}
