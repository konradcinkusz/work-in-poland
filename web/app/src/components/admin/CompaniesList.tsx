'use client';

import { useEffect, useRef, useState } from 'react';

interface Company {
  id: string;
  name: string;
  city?: string;
  isVerified: boolean;
  website?: string;
}

interface CompaniesResponse {
  items: Company[];
  total: number;
  page: number;
  limit: number;
}

export default function CompaniesList() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [verified, setVerified] = useState('');
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

  const doFetch = async (pageNum: number = 1): Promise<{ data: CompaniesResponse } | { error: string }> => {
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: String(limit),
    });
    if (verified !== '') params.append('verified', verified);
    if (q) params.append('q', q);

    const res = await fetch(`/api/proxy/admin/companies?${params}`);
    if (!res.ok) {
      return { error: 'Nie udało się załadować firm' };
    }

    const data: CompaniesResponse = await res.json();
    return { data };
  };

  const fetchCompanies = async (pageNum: number = 1) => {
    const result = await doFetch(pageNum);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setCompanies(result.data.items);
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
          setCompanies(result.data.items);
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
  }, [verified, q, limit]);

  const handleVerify = async (companyId: string) => {
    setActionLoading(companyId);
    try {
      const res = await fetch(`/api/proxy/admin/companies/${companyId}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      if (!res.ok) {
        alert('Nie udało się zweryfikować firmę');
        return;
      }

      const updatedCompany = await res.json();
      setCompanies(companies.map((c) => (c.id === companyId ? updatedCompany : c)));
    } catch (err) {
      alert('Błąd przy weryfikowaniu firmy');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnverify = async (companyId: string) => {
    if (!confirm('Na pewno chcesz usunąć weryfikację?')) return;

    setActionLoading(companyId);
    try {
      const res = await fetch(`/api/proxy/admin/companies/${companyId}/unverify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      if (!res.ok) {
        alert('Nie udało się cofnąć weryfikacji');
        return;
      }

      const updatedCompany = await res.json();
      setCompanies(companies.map((c) => (c.id === companyId ? updatedCompany : c)));
    } catch (err) {
      alert('Błąd przy cofaniu weryfikacji');
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
              placeholder="Nazwa firmy..."
              style={{ padding: '0.5rem', width: '300px' }}
            />
          </label>
        </div>
        <div>
          <label>
            Weryfikacja:{' '}
            <select
              value={verified}
              onChange={(e) => setVerified(e.target.value)}
              style={{ padding: '0.5rem' }}
            >
              <option value="">Wszystkie</option>
              <option value="true">Zweryfikowane</option>
              <option value="false">Niezweryfikowane</option>
            </select>
          </label>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Nazwa</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Miasto</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>
                  <strong>{company.name}</strong>
                </td>
                <td style={{ padding: '0.5rem' }}>{company.city || '—'}</td>
                <td style={{ padding: '0.5rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: company.isVerified ? '#e8f5e9' : '#fff3e0',
                      color: company.isVerified ? '#2e7d32' : '#e65100',
                    }}
                  >
                    {company.isVerified ? '✓ Zweryfikowana' : 'Niezweryfikowana'}
                  </span>
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {company.isVerified ? (
                    <button
                      onClick={() => handleUnverify(company.id)}
                      disabled={actionLoading === company.id}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#ff9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: actionLoading === company.id ? 'default' : 'pointer',
                        opacity: actionLoading === company.id ? 0.6 : 1,
                        fontSize: '0.875rem',
                      }}
                    >
                      {actionLoading === company.id ? 'Przetwarzanie...' : 'Cofnij weryfikację'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleVerify(company.id)}
                      disabled={actionLoading === company.id}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: actionLoading === company.id ? 'default' : 'pointer',
                        opacity: actionLoading === company.id ? 0.6 : 1,
                        fontSize: '0.875rem',
                      }}
                    >
                      {actionLoading === company.id ? 'Przetwarzanie...' : 'Zweryfikuj'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button
          onClick={() => fetchCompanies(page - 1)}
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
          onClick={() => fetchCompanies(page + 1)}
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
