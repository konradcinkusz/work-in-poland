import type { Metadata } from 'next';
import { JobForm } from '@/components/job-form';

export const metadata: Metadata = { title: 'Edycja oferty', description: 'Edytuj ofertę pracy.', robots: { index: false } };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <h1>Edycja oferty</h1>
      <JobForm jobId={id} />
    </div>
  );
}
