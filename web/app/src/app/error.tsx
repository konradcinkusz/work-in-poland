'use client';

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-12 text-center" role="alert">
      <h1>Coś poszło nie tak</h1>
      <p className="mt-3 text-slate-700">Nie udało się wyświetlić tej strony. Spróbuj ponownie za chwilę.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-6">Spróbuj ponownie</button>
    </div>
  );
}
