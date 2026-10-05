import Link from 'next/link';

export function Pagination({ page, total, limit, hrefFor }: { page: number; total: number; limit: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginacja" className="mt-6 flex items-center justify-between gap-4">
      {page > 1 ? <Link href={hrefFor(page - 1)} rel="prev" className="btn btn-secondary">Poprzednia</Link> : <span />}
      <span className="text-sm text-slate-700" aria-live="polite">Strona {page} z {pages}</span>
      {page < pages ? <Link href={hrefFor(page + 1)} rel="next" className="btn btn-secondary">Następna</Link> : <span />}
    </nav>
  );
}
