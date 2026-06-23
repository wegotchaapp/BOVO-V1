import { useState, useEffect } from 'react';
import { getModerationQueue, getReportDetail } from '../lib/api';

export default function TrustSafetyPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    setLoading(true);
    getModerationQueue({ page })
      .then((r) => { setReports(r.reports || []); setTotal(r.total || 0); })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page]);

  const handleView = async (id: string) => {
    try { const r = await getReportDetail(id); setSelected(r); } catch { setSelected({ id, error: 'Could not load detail' }); }
  };

  const pages = Math.ceil(total / 50);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Trust &amp; Safety</h2>

      {selected ? (
        <div>
          <button onClick={() => setSelected(null)} className="text-indigo-400 text-sm mb-4 hover:underline">&larr; Back to queue</button>
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
            <pre className="text-gray-300 text-sm whitespace-pre-wrap">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      ) : loading ? <div className="text-gray-400">Loading...</div> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-3 px-2">ID</th>
                  <th className="text-left py-3 px-2">Reporter</th>
                  <th className="text-left py-3 px-2">Subject</th>
                  <th className="text-left py-3 px-2">Reason</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-left py-3 px-2">Date</th>
                  <th className="text-left py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 && <tr><td colSpan={7} className="text-gray-500 py-4 text-center">No reports in queue</td></tr>}
                {reports.map((r: any) => (
                  <tr key={r.id} className="border-b border-gray-800 text-white hover:bg-gray-800">
                    <td className="py-3 px-2 text-xs text-gray-400">{r.id?.slice(0, 8)}…</td>
                    <td className="py-3 px-2 text-xs">{r.reporter_id?.slice(0, 8) || '—'}…</td>
                    <td className="py-3 px-2 text-xs">{r.subject_user_id?.slice(0, 8) || '—'}…</td>
                    <td className="py-3 px-2 text-xs max-w-[150px] truncate">{r.reason || r.report_type || '—'}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'open' ? 'bg-red-900 text-red-200' : r.status === 'under_review' ? 'bg-yellow-900 text-yellow-200' : 'bg-green-900 text-green-200'}`}>{r.status}</span>
                    </td>
                    <td className="py-3 px-2 text-xs text-gray-400">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-2">
                      <button onClick={() => handleView(r.id)} className="px-2 py-1 bg-indigo-700 text-white rounded text-xs hover:bg-indigo-600">View</button>
                    </td>
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
