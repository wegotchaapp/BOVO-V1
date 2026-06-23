import { useState, useEffect } from 'react';
import { getAuditTrail } from '../lib/api';

export default function AuditLogPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    setLoading(true);
    getAuditTrail({ event_type: filter || undefined, page })
      .then((r) => { setEvents(r.events); setTotal(r.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page, filter]);

  const pages = Math.ceil(total / 50);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Audit Log ({total})</h2>

      <div className="mb-4">
        <input
          type="text" placeholder="Filter by event type (e.g. user.suspended)..."
          value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm w-full max-w-md focus:outline-none focus:border-indigo-500"
        />
      </div>

      {loading ? <div className="text-gray-400">Loading...</div> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-3 px-2">Action</th>
                  <th className="text-left py-3 px-2">Actor</th>
                  <th className="text-left py-3 px-2">Entity Type</th>
                  <th className="text-left py-3 px-2">Entity ID</th>
                  <th className="text-left py-3 px-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e: any) => (
                  <tr key={e.id} className="border-b border-gray-800 text-white hover:bg-gray-800">
                    <td className="py-3 px-2">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-200">{e.action || e.event_type}</span>
                    </td>
                    <td className="py-3 px-2 text-xs">{e.actor_id?.slice(0, 8) || 'system'}…</td>
                    <td className="py-3 px-2 text-xs text-gray-400">{e.entity_type}</td>
                    <td className="py-3 px-2 text-xs text-gray-400">{e.entity_id?.slice(0, 8) || '—'}…</td>
                    <td className="py-3 px-2 text-xs text-gray-400">{new Date(e.ts || e.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{p}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
