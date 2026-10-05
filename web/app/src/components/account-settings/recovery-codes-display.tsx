'use client';

import { useState, FormEvent } from 'react';

interface Props {
  codes: string[];
  onSaved: () => void;
}

export function RecoveryCodesDisplay({ codes, onSaved }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [codesShown, setCodesShown] = useState(false);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      alert('Potwierdź, że zapisałeś kody odzyskiwania');
      return;
    }
    setCodesShown(true);
    onSaved();
  };

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
      <h3 className="font-semibold text-amber-900">Kody odzyskiwania</h3>
      <p className="mt-2 text-sm text-amber-800">
        Jeśli utracisz dostęp do aplikacji autentykacyjnej, możesz użyć tych kodów do zalogowania się. <strong>Każdy kod można użyć tylko raz.</strong>
      </p>

      {!codesShown ? (
        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm">
                <strong>Potwierdzam, że zapisałem kody odzyskiwania w bezpiecznym miejscu.</strong> Kody będą pokazane tylko teraz.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!confirmed}
            className="rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Zapisz i kontynuuj
          </button>
        </form>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="space-y-2 rounded bg-white p-4 font-mono text-sm">
            {codes.map((code, i) => (
              <div key={i} className="border-b border-slate-200 py-1 last:border-b-0">
                {code}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(codes.join('\n'));
                alert('Kody skopiowane do schowka');
              }}
              className="flex-1 rounded bg-slate-200 px-4 py-2 hover:bg-slate-300"
            >
              Kopiuj
            </button>
            <button
              type="button"
              onClick={() => {
                const text = codes.join('\n');
                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'recovery-codes.txt';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex-1 rounded bg-slate-200 px-4 py-2 hover:bg-slate-300"
            >
              Pobierz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
