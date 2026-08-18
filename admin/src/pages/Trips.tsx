import { useState, useEffect } from 'react';
import { getTrips } from '../lib/api';
import { ErrorNotice, EmptyState } from '../components/QueryState';

interface Trip {
  id: string;
  status: string;
  origin_metro: string;
  dest_metro: string;
  departure_date: string;
  departure_time: string;
  seats_available: number;
  per_seat_price: number;
  driver: { name: string; email: string };
  created_at: string;
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetch = () => {
    setLoading(true);
    setError('');
    getTrips({ status: status || undefined, page })
      .then((res) => { setTrips(res.trips || []); setTotal(res.total || 0); })
      .catch((e) => { setError(e?.response?.data?.message || e?.message || 'Failed to load trips'); console.error(e); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page, status]);

  const pages = Math.ceil(total / 20);

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink mb-6">Trips ({total})</h2>

      <div className="mb-4">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="bg-card border border-border rounded-lg px-4 py-2 text-ink text-sm">
          <option value="">All statuses</option>
          <option value="posted">Posted</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="text-ink-soft">Loading...</div>
      ) : error ? (
        <ErrorNotice message={error} onRetry={fetch} />
      ) : trips.length === 0 ? (
        <EmptyState title="No trips match these filters." body="Widen the status filter to see more." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft border-b border-border">
                  <th className="text-left py-3 px-2">Driver</th>
                  <th className="text-left py-3 px-2">From</th>
                  <th className="text-left py-3 px-2">To</th>
                  <th className="text-left py-3 px-2">Departure</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-left py-3 px-2">Seats</th>
                  <th className="text-left py-3 px-2">Price</th>
                  <th className="text-left py-3 px-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => (
                  <tr key={t.id} className="border-b border-border text-ink hover:bg-card">
                    <td className="py-3 px-2">{t.driver?.name || '—'}</td>
                    <td className="py-3 px-2 max-w-[120px] truncate">{t.origin_metro || '—'}</td>
                    <td className="py-3 px-2 max-w-[120px] truncate">{t.dest_metro || '—'}</td>
                    <td className="py-3 px-2">{t.departure_date ? `${t.departure_date} ${t.departure_time || ''}` : '—'}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'posted' || t.status === 'booked' ? 'bg-good/15 text-good' : t.status === 'in_progress' || t.status === 'en_route' ? 'bg-gold/15 text-gold' : t.status === 'completed' ? 'bg-info/15 text-info' : t.status === 'cancelled' ? 'bg-critical/15 text-critical' : 'bg-inset text-ink'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-2">{t.seats_available}</td>
                    <td className="py-3 px-2">${Number(t.per_seat_price).toFixed(2)}</td>
                    <td className="py-3 px-2 text-ink-soft">{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-gold text-ground' : 'bg-card text-ink-soft hover:bg-inset'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
