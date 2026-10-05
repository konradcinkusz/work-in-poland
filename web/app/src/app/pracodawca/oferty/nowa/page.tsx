import type { Metadata } from 'next';
import { JobForm } from '@/components/job-form';

export const metadata: Metadata = { title: 'Nowa oferta', description: 'Dodaj ofertę pracy z widełkami wynagrodzenia.', robots: { index: false } };

export default function NewJobPage() {
  return (
    <div className="space-y-6">
      <h1>Nowa oferta</h1>
      <JobForm jobId={null} />
    </div>
  );
}
