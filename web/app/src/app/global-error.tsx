'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pl">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem 1rem', textAlign: 'center' }}>
        <h1>Coś poszło nie tak</h1>
        <p>Aplikacja napotkała nieoczekiwany błąd.</p>
        <button type="button" onClick={reset}>Spróbuj ponownie</button>
      </body>
    </html>
  );
}
