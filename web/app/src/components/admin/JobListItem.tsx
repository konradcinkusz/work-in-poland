'use client';

import { useState } from 'react';

interface Job {
  id: string;
  title: string;
  company: { name: string };
  status: string;
  isPromoted: boolean;
}

interface Props {
  job: Job;
  loading: boolean;
  onUnpublish: (reason: string) => void;
  onPromote: (days: number) => void;
}

export default function JobListItem({ job, loading, onUnpublish, onPromote }: Props) {
  const [showUnpublish, setShowUnpublish] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const [unpublishReason, setUnpublishReason] = useState('');
  const [promoteOldDays, setPromoteOldDays] = useState(1);

  const handleUnpublishSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unpublishReason.trim()) {
      alert('Podaj uzasadnienie wycofania');
      return;
    }
    if (unpublishReason.length > 500) {
      alert('Uzasadnienie nie może być dłuższe niż 500 znaków');
      return;
    }
    onUnpublish(unpublishReason);
    setShowUnpublish(false);
    setUnpublishReason('');
  };

  const handlePromoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoteOldDays < 1 || promoteOldDays > 90) {
      alert('Liczba dni musi być między 1 a 90');
      return;
    }
    onPromote(promoteOldDays);
    setShowPromote(false);
    setPromoteOldDays(1);
  };

  return (
    <>
      <tr style={{ borderBottom: '1px solid #eee' }}>
        <td style={{ padding: '0.5rem' }}>{job.title}</td>
        <td style={{ padding: '0.5rem' }}>{job.company.name}</td>
        <td style={{ padding: '0.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              backgroundColor:
                job.status === 'published'
                  ? '#e8f5e9'
                  : job.status === 'draft'
                    ? '#fff3e0'
                    : '#ffebee',
              color:
                job.status === 'published'
                  ? '#2e7d32'
                  : job.status === 'draft'
                    ? '#e65100'
                    : '#c62828',
            }}
          >
            {job.status === 'published' && 'Opublikowana'}
            {job.status === 'draft' && 'Robocza'}
            {job.status === 'closed' && 'Zamknięta'}
          </span>
        </td>
        <td style={{ padding: '0.5rem' }}>{job.isPromoted ? '✓' : '—'}</td>
        <td style={{ padding: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {job.status === 'published' && (
              <>
                <button
                  onClick={() => setShowUnpublish(true)}
                  disabled={loading}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#d32f2f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    fontSize: '0.875rem',
                  }}
                >
                  Wycofaj
                </button>
                <button
                  onClick={() => setShowPromote(true)}
                  disabled={loading}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    fontSize: '0.875rem',
                  }}
                >
                  Promuj
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {showUnpublish && (
        <tr>
          <td colSpan={5} style={{ padding: '1rem', backgroundColor: '#f5f5f5' }}>
            <form onSubmit={handleUnpublishSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Uzasadnienie wycofania (1–500 znaków):
                </label>
                <textarea
                  value={unpublishReason}
                  onChange={(e) => setUnpublishReason(e.target.value)}
                  maxLength={500}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                  autoFocus
                />
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  {unpublishReason.length}/500
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#d32f2f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Wycofywanie...' : 'Wycofaj'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUnpublish(false);
                    setUnpublishReason('');
                  }}
                  disabled={loading}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#999',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Anuluj
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}

      {showPromote && (
        <tr>
          <td colSpan={5} style={{ padding: '1rem', backgroundColor: '#f5f5f5' }}>
            <form onSubmit={handlePromoteSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Liczba dni promowania (1–90):
                </label>
                <input
                  type="number"
                  value={promoteOldDays}
                  onChange={(e) => setPromoteOldDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={90}
                  style={{
                    padding: '0.5rem',
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                  }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Promowanie...' : 'Promuj'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPromote(false);
                    setPromoteOldDays(1);
                  }}
                  disabled={loading}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#999',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Anuluj
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
