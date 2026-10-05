import type { ReactNode } from 'react';

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-center text-3xl">{title}</h1>
      <div className="card space-y-4">{children}</div>
    </div>
  );
}

export function Alert({ kind, children }: { kind: 'error' | 'info' | 'success' | 'warn'; children: ReactNode }) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`alert alert-${kind}`}>
      {children}
    </div>
  );
}

export function messageFor(data: Record<string, unknown>): string {
  switch (data.status) {
    case 'rate_limited':
      return typeof data.retryAfter === 'number'
        ? `Zbyt wiele prób, spróbuj za chwilę (za ok. ${data.retryAfter} s).`
        : 'Zbyt wiele prób, spróbuj za chwilę.';
    case 'unavailable':
    case 'network_error':
      return 'Usługa jest chwilowo niedostępna. Spróbuj ponownie za chwilę.';
    default:
      return 'Coś poszło nie tak. Spróbuj ponownie.';
  }
}
