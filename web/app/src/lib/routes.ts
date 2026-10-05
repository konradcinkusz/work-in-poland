/**
 * Explicit public-route list for the edge gate. Everything NOT listed requires a verified session
 * (default deny). `/api/*` is public to the gate because the BFF routes enforce auth themselves
 * (the proxy injects the bearer; the API is the real boundary). The OAuth callback, verify and
 * reset pages are public so they keep their query strings (no bounce through the login redirect).
 */
const PUBLIC_EXACT = new Set([
  '/', '/wynagrodzenia', '/logowanie', '/rejestracja', '/reset-hasla', '/reset-password', '/verify-email',
  '/oauth/callback', '/regulamin', '/polityka-prywatnosci', '/cookies', '/mcp', '/healthz', '/sitemap.xml', '/robots.txt',
]);
const PUBLIC_PREFIXES = ['/oferty/', '/firmy/', '/api/', '/_next/'];

export function isPublicPath(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PUBLIC_EXACT.has(p) || PUBLIC_PREFIXES.some((prefix) => p.startsWith(prefix));
}
