'use client';

import { useState } from 'react';

interface ReportJobButtonProps {
  slug: string;
}

type ReportReason = 'illegal' | 'discrimination' | 'scam' | 'misleading' | 'other';

const REASON_LABELS: Record<ReportReason, string> = {
  illegal: 'Treść bezprawna',
  discrimination: 'Dyskryminacja',
  scam: 'Oszustwo',
  misleading: 'Wprowadzająca w błąd',
  other: 'Inne',
};

export function ReportJobButton({ slug }: ReportJobButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reason, setReason] = useState<ReportReason>('other');
  const [details, setDetails] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const body: {
        reason: ReportReason;
        details?: string;
        contactEmail?: string;
      } = { reason };
      if (details.trim()) body.details = details.trim();
      if (contactEmail.trim()) body.contactEmail = contactEmail.trim();

      const res = await fetch(`/api/proxy/api/v1/jobs/${slug}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Błąd ${res.status}`);
      }

      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setReason('other');
        setDetails('');
        setContactEmail('');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-slate-600 hover:text-slate-900 underline"
      >
        Zgłoś ofertę
      </button>
    );
  }

  return (
    <>
      {/* Dialog backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={() => !isSubmitting && setIsOpen(false)}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold text-lg">Zgłoś ofertę pracy</h2>
          </div>

          <div className="px-6 py-4">
            {submitted ? (
              <div className="text-center py-6">
                <div className="text-green-600 text-3xl mb-2">✓</div>
                <p className="text-slate-700">Dziękujemy za zgłoszenie!</p>
                <p className="text-sm text-slate-600 mt-1">Przeanalizujemy Twoją opinię.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="reason" className="block text-sm font-medium mb-1">
                    Powód zgłoszenia *
                  </label>
                  <select
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value as ReportReason)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    disabled={isSubmitting}
                  >
                    {(Object.entries(REASON_LABELS) as [ReportReason, string][]).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="details" className="block text-sm font-medium mb-1">
                    Dodatkowe szczegóły (opcjonalnie)
                  </label>
                  <textarea
                    id="details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
                    placeholder="Opisz problem..."
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    rows={3}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {details.length}/1000 znaków
                  </p>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    E-mail do kontaktu (opcjonalnie)
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="twój@email.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Podaj e-mail, jeśli chcesz, aby skontaktowali się z Tobą w sprawie zgłoszenia.
                  </p>
                </div>

                {error && (
                  <div className="rounded bg-red-50 border border-red-200 p-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Wysyłanie...' : 'Zgłoś'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
