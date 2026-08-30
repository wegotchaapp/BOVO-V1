import { useState, useEffect, useCallback } from 'react';
import { getAuditTrail, getErrorMessage } from '../lib/api';
import { ErrorNotice, EmptyState } from '../components/QueryState';

interface AuditEvent {
  id: string;
  action?: string;
  event_type?: string;
  actor_id?: string;
  entity_type?: string;
  entity_id?: string;
  ts?: string;
  created_at?: string;
}

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : '—');

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);
    getAuditTrail({ event_type: filter || undefined, page })
      .then((r) => { setEvents(r.events); setTotal(r.total); })
      .catch((e: unknown) => setError(getErrorMessage(e, 'Could not load this data.')))
      .finally(() => setLoading(false));
  }, [filter, page]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetch, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetch]);

  const pages = Math.ceil(total / 50);

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink mb-6">Audit Log ({total})</h2>

      <div className="mb-4">
        <input
          type="text" placeholder="Filter by event type (e.g. user.suspended)..."
          value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          className="bg-card border border-border rounded-lg px-4 py-2 text-ink text-sm w-full max-w-md focus:outline-none focus:border-gold"
        />
      </div>

      {loading ? <div className="text-ink-soft">Loading...</div> : error ? (
        <ErrorNotice message={error} onRetry={fetch} />
      ) : events.length === 0 ? (
        <EmptyState title="Nothing logged for this filter." body="Try a different action type, or clear the filter." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft border-b border-border">
                  <th className="text-left py-3 px-2">Action</th>
                  <th className="text-left py-3 px-2">Actor</th>
                  <th className="text-left py-3 px-2">Entity Type</th>
                  <th className="text-left py-3 px-2">Entity ID</th>
                  <th className="text-left py-3 px-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-border text-ink hover:bg-card">
                    <td className="py-3 px-2">
                      <span className="px-2 py-0.5 rounded text-xs bg-inset text-ink">{e.action || e.event_type}</span>
                    </td>
                    <td className="py-3 px-2 text-xs">{e.actor_id?.slice(0, 8) || 'system'}…</td>
                    <td className="py-3 px-2 text-xs text-ink-soft">{e.entity_type}</td>
                    <td className="py-3 px-2 text-xs text-ink-soft">{e.entity_id?.slice(0, 8) || '—'}…</td>
                    <td className="py-3 px-2 text-xs text-ink-soft">{formatDateTime(e.ts ?? e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-gold text-ground' : 'bg-card text-ink-soft hover:bg-inset'}`}>{p}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
