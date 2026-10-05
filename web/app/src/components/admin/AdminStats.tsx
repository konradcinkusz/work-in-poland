'use client';

import { useEffect, useState } from 'react';

interface JobsStats {
  published: number;
  draft: number;
  closed: number;
}

interface CompaniesStats {
  unverified: number;
}

export default function AdminStats() {
  const [stats, setStats] = useState<{ jobs: JobsStats; companies: CompaniesStats } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [jobsRes, companiesRes] = await Promise.all([
          fetch('/api/proxy/admin/jobs?limit=1'),
          fetch('/api/proxy/admin/companies?verified=false&limit=1'),
        ]);

        if (!jobsRes.ok || !companiesRes.ok) {
          setError('Nie udało się załadować statystyk');
          return;
        }

        const jobsData = await jobsRes.json();
        const companiesData = await companiesRes.json();

        setStats({
          jobs: {
            published: jobsData.total || 0,
            draft: 0, // TODO: implement filters in API
            closed: 0,
          },
          companies: {
            unverified: companiesData.total || 0,
          },
        });
      } catch (err) {
        setError('Błąd przy ładowaniu statystyk');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <p>Ładowanie...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px' }}>
        <h3>Oferty opublikowane</h3>
        <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats?.jobs.published ?? 0}</p>
      </div>
      <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px' }}>
        <h3>Firmy niezweryfikowane</h3>
        <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats?.companies.unverified ?? 0}</p>
      </div>
    </div>
  );
}
