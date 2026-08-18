import { useState, useEffect } from 'react';
import { getModerationQueue, getReportDetail } from '../lib/api';
import { ErrorNotice, EmptyState } from '../components/QueryState';

export default function TrustSafetyPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = () => {
    setLoading(true);
    setError(null);
    getModerationQueue({ page })
      .then((r) => { setReports(r.reports || []); setTotal(r.total || 0); })
      .catch((e: any) => setError(e?.response?.data?.message || e?.message || 'Could not load this data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page]);

  const handleView = async (id: string) => {
    try { const r = await getReportDetail(id); setSelected(r); } catch { setSelected({ id, error: 'Could not load detail' }); }
  };

  const pages = Math.ceil(total / 50);

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink mb-6">Trust &amp; Safety</h2>

      {selected ? (
        <div>
          <button onClick={() => setSelected(null)} className="text-gold text-sm mb-4 hover:underline">&larr; Back to queue</button>
          <div className="bg-card rounded-lg border border-border p-5">
            <pre className="text-ink text-sm whitespace-pre-wrap">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      ) : loading ? <div className="text-ink-soft">Loading...</div> : error ? (
        <ErrorNotice message={error} onRetry={fetch} />
      ) : reports.length === 0 ? (
        <EmptyState title="No reports to review." body="Nothing needs a decision right now." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft border-b border-border">
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
                {reports.length === 0 && <tr><td colSpan={7} className="text-ink-soft py-4 text-center">No reports in queue</td></tr>}
                {reports.map((r: any) => (
                  <tr key={r.id} className="border-b border-border text-ink hover:bg-card">
                    <td className="py-3 px-2 text-xs text-ink-soft">{r.id?.slice(0, 8)}…</td>
                    <td className="py-3 px-2 text-xs">{r.reporter_id?.slice(0, 8) || '—'}…</td>
                    <td className="py-3 px-2 text-xs">{r.subject_user_id?.slice(0, 8) || '—'}…</td>
                    <td className="py-3 px-2 text-xs max-w-[150px] truncate">{r.reason || r.report_type || '—'}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'open' ? 'bg-critical/15 text-critical' : r.status === 'under_review' ? 'bg-warning/15 text-warning' : 'bg-good/15 text-good'}`}>{r.status}</span>
                    </td>
                    <td className="py-3 px-2 text-xs text-ink-soft">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-2">
                      <button onClick={() => handleView(r.id)} className="px-2 py-1 bg-gold text-ground rounded text-xs hover:bg-gold/90">View</button>
                    </td>
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
