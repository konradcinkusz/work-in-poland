import type { Metadata } from 'next';
import { EmployerDashboard } from '@/components/employer-dashboard';

export const metadata: Metadata = { title: 'Panel pracodawcy', description: 'Zarządzaj firmami i ofertami pracy.', robots: { index: false } };

export default function EmployerPage() {
  return (
    <div className="space-y-6">
      <h1>Panel pracodawcy</h1>
      <EmployerDashboard />
    </div>
  );
}
