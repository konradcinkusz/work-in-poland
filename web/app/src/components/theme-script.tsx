import { headers } from 'next/headers';

/**
 * Inject theme script in head with CSP nonce. This runs before first paint to avoid
 * a flash when the page respects prefers-color-scheme but localStorage has a different theme.
 * Script reads localStorage (with try/catch for unavailability) and sets data-theme on html.
 */
export async function ThemeScript() {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce');

  const script = `
(function() {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {
    // localStorage may be unavailable; prefers-color-scheme is the fallback.
  }
})();
`.trim();

  return (
    <script nonce={nonce || undefined} suppressHydrationWarning>
      {script}
    </script>
  );
}
