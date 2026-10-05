'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type SessionState =
  /** Not known yet. Treated OPTIMISTICALLY by the UI: no "log in" flash for a signed-in user. */
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; email: string | null; roles: string[]; requiresConsent: boolean; emailConfirmed: boolean; hasPassword: boolean };

interface Ctx {
  session: SessionState;
  refresh: () => Promise<SessionState>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Ctx | null>(null);

/**
 * Presentation state only. This hook is optimistic while loading and is NOT an authorization
 * boundary: the edge gate protects pages and the API enforces every permission.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });

  const refresh = useCallback(async (): Promise<SessionState> => {
    let next: SessionState;
    try {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
      const data = (await res.json()) as { authenticated?: boolean; email?: string | null; roles?: string[]; requiresConsent?: boolean; emailConfirmed?: boolean; hasPassword?: boolean };
      next = data.authenticated
        ? { status: 'authenticated', email: data.email ?? null, roles: data.roles ?? [], requiresConsent: !!data.requiresConsent, emailConfirmed: data.emailConfirmed !== false, hasPassword: data.hasPassword !== false }
        : { status: 'anonymous' };
    } catch {
      next = { status: 'anonymous' };
    }
    setSession(next);
    return next;
  }, []);

  useEffect(() => {
    // Rehydrate once on load; client JS cannot read the httpOnly cookies.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    setSession({ status: 'anonymous' });
  }, []);

  const value = useMemo(() => ({ session, refresh, signOut }), [session, refresh, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
