/** Response headers set on every response. The CSP lives in `buildCsp` (it carries a nonce). */
export function securityHeaders(isProd: boolean): { key: string; value: string }[] {
  const headers = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
  if (isProd) {
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' });
  }
  return headers;
}

/**
 * Content-Security-Policy with a per-request nonce for scripts. `unsafe-eval` is only allowed
 * outside production (React dev tooling needs it). No third-party origins: no CDN scripts,
 * fonts or analytics. Images may be any https origin because company logos are employer-supplied.
 */
export function buildCsp(nonce: string, isProd: boolean): string {
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (!isProd) script.push("'unsafe-eval'");
  const directives = [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    isProd ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  if (isProd) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}
