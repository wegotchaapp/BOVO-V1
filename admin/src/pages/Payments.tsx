import { useState, useEffect, useCallback } from 'react';
import { getPayments, getErrorMessage } from '../lib/api';
import { ErrorNotice, EmptyState } from '../components/QueryState';

interface Payment {
  id: string;
  amount: number;
  fee: number;
  status: string;
  stripe_payment_intent_id: string;
  description: string;
  created_at: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);
    getPayments({ page })
      .then((res) => { setPayments(res.payments); setTotal(res.total); })
      .catch((e: unknown) => setError(getErrorMessage(e, 'Could not load this data.')))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetch, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetch]);

  const pages = Math.ceil(total / 20);

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink mb-6">Payments ({total})</h2>

      {loading ? (
        <div className="text-ink-soft">Loading...</div>
      ) : error ? (
        <ErrorNotice message={error} onRetry={fetch} />
      ) : payments.length === 0 ? (
        <EmptyState title="No payments yet." body="They appear here as trips complete." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft border-b border-border">
                  <th className="text-left py-3 px-2">ID</th>
                  <th className="text-left py-3 px-2">Amount</th>
                  <th className="text-left py-3 px-2">Fee</th>
                  <th className="text-left py-3 px-2">Net</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-left py-3 px-2">Description</th>
                  <th className="text-left py-3 px-2">Stripe ID</th>
                  <th className="text-left py-3 px-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border text-ink hover:bg-card">
                    <td className="py-3 px-2 text-ink-soft text-xs">{p.id.slice(0, 8)}…</td>
                    <td className="py-3 px-2">${(p.amount / 100).toFixed(2)}</td>
                    <td className="py-3 px-2">${(p.fee / 100).toFixed(2)}</td>
                    <td className="py-3 px-2">${((p.amount - p.fee) / 100).toFixed(2)}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${p.status === 'succeeded' ? 'bg-good/15 text-good' : p.status === 'failed' ? 'bg-critical/15 text-critical' : 'bg-warning/15 text-warning'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 max-w-[150px] truncate">{p.description || '—'}</td>
                    <td className="py-3 px-2 text-xs text-ink-soft">{p.stripe_payment_intent_id?.slice(0, 12) || '—'}…</td>
                    <td className="py-3 px-2 text-ink-soft">{new Date(p.created_at).toLocaleDateString()}</td>
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
