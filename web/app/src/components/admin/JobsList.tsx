'use client';

import { useEffect, useRef, useState } from 'react';
import JobListItem from './JobListItem';

interface Job {
  id: string;
  title: string;
  company: { name: string };
  status: string;
  publishedAt?: string;
  isPromoted: boolean;
  salaries: Array<{ min: number; max: number; currency: string }>;
}

interface JobsResponse {
  items: Job[];
  total: number;
  page: number;
  limit: number;
}

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const doFetch = async (pageNum: number = 1): Promise<{ data: JobsResponse } | { error: string }> => {
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(limit),
    });
    if (status) params.append('status', status);
    if (q) params.append('q', q);

    const res = await fetch(`/api/proxy/admin/jobs?${params}`);
    if (!res.ok) {
      return { error: 'Nie udało się załadować ofert' };
    }

    const data: JobsResponse = await res.json();
    return { data };
  };

  const fetchJobs = async (pageNum: number = 1) => {
    const result = await doFetch(pageNum);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setJobs(result.data.items);
    setTotal(result.data.total);
    setPage(result.data.page);
  };

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await doFetch(1);
      if (!ignore && isMountedRef.current) {
        if ('error' in result) {
          setError(result.error);
        } else {
          setJobs(result.data.items);
          setTotal(result.data.total);
          setPage(result.data.page);
        }
        setLoading(false);
      }
    };
    void load();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q, limit]);

  const handleUnpublish = async (jobId: string, reason: string) => {
    setActionLoading(jobId);
    try {
      const res = await fetch(`/api/proxy/admin/jobs/${jobId}/unpublish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || 'Nie udało się wycofać ofertę';
        alert(msg);
        return;
      }

      setJobs(jobs.filter((j) => j.id !== jobId));
    } catch (err) {
      alert('Błąd przy wycofywaniu oferty');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromote = async (jobId: string, days: number) => {
    setActionLoading(jobId);
    try {
      const res = await fetch(`/api/proxy/admin/jobs/${jobId}/promote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ days }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || 'Nie udało się promować ofertę';
        alert(msg);
        return;
      }

      const updatedJob = await res.json();
      setJobs(jobs.map((j) => (j.id === jobId ? updatedJob : j)));
    } catch (err) {
      alert('Błąd przy promowaniu oferty');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <p>Ładowanie...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Szukaj:{' '}
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tytuł, firma..."
              style={{ padding: '0.5rem', width: '300px' }}
            />
          </label>
        </div>
        <div>
          <label>
            Status:{' '}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ padding: '0.5rem' }}
            >
              <option value="">Wszystkie</option>
              <option value="published">Opublikowane</option>
              <option value="draft">Robocze</option>
              <option value="closed">Zamknięte</option>
            </select>
          </label>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Tytuł</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Firma</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Promowana</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <JobListItem
                key={job.id}
                job={job}
                loading={actionLoading === job.id}
                onUnpublish={(reason) => handleUnpublish(job.id, reason)}
                onPromote={(days) => handlePromote(job.id, days)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button
          onClick={() => fetchJobs(page - 1)}
          disabled={page === 1}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: page === 1 ? '#ccc' : '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: page === 1 ? 'default' : 'pointer',
          }}
        >
          Poprzednia
        </button>
        <span>
          Strona {page} z {Math.ceil(total / limit)}
        </span>
        <button
          onClick={() => fetchJobs(page + 1)}
          disabled={page * limit >= total}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: page * limit >= total ? '#ccc' : '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: page * limit >= total ? 'default' : 'pointer',
          }}
        >
          Następna
        </button>
      </div>
    </div>
  );
}
