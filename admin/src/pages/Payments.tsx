import { useState, useEffect } from 'react';
import { getPayments } from '../lib/api';

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

  const fetch = () => {
    setLoading(true);
    getPayments({ page })
      .then((res) => { setPayments(res.payments); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page]);

  const pages = Math.ceil(total / 20);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Payments ({total})</h2>

      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
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
                  <tr key={p.id} className="border-b border-gray-800 text-white hover:bg-gray-800">
                    <td className="py-3 px-2 text-gray-400 text-xs">{p.id.slice(0, 8)}…</td>
                    <td className="py-3 px-2">${(p.amount / 100).toFixed(2)}</td>
                    <td className="py-3 px-2">${(p.fee / 100).toFixed(2)}</td>
                    <td className="py-3 px-2">${((p.amount - p.fee) / 100).toFixed(2)}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${p.status === 'succeeded' ? 'bg-green-900 text-green-200' : p.status === 'failed' ? 'bg-red-900 text-red-200' : 'bg-yellow-900 text-yellow-200'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 max-w-[150px] truncate">{p.description || '—'}</td>
                    <td className="py-3 px-2 text-xs text-gray-400">{p.stripe_payment_intent_id?.slice(0, 12) || '—'}…</td>
                    <td className="py-3 px-2 text-gray-400">{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
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
