'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client-api';
import { loginUrl } from '@/lib/redirect';
import { useSession } from './session';

/** "Zapisz w trackerze": needs a login; anonymous visitors are sent to sign-in and come back here. */
export function SaveJobButton({ jobId, slug }: { jobId: string; slug: string }) {
  const { session } = useSession();
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const onClick = async () => {
    if (session.status === 'anonymous') {
      router.push(loginUrl(`/oferty/${slug}`));
      return;
    }
    setState('saving');
    const res = await api(`/tracker/${jobId}`, { method: 'PUT', body: { status: 'saved', notes: '' } });
    if (res.status === 401) {
      router.push(loginUrl(`/oferty/${slug}`));
      return;
    }
    setState(res.ok ? 'saved' : 'error');
  };

  return (
    <div>
      <button type="button" onClick={onClick} disabled={state === 'saving'} className="btn btn-secondary">
        Zapisz w trackerze
      </button>
      <p role="status" className="mt-1 text-sm">
        {state === 'saved' && <span className="text-green-800">Zapisano. <a href="/konto">Zobacz w Moim koncie</a>.</span>}
        {state === 'error' && <span className="text-red-800">Nie udało się zapisać oferty.</span>}
      </p>
    </div>
  );
}
