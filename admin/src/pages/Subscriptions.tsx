import { useState, useEffect } from 'react';
import { getSubscriptions, overrideTrial } from '../lib/api';

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tier, setTier] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const fetch = () => {
    setLoading(true);
    getSubscriptions({ tier: tier || undefined, page })
      .then((r) => { setSubs(r.subscriptions); setTotal(r.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page, tier]);

  const handleOverride = async (userId: string) => {
    const days = prompt('Extend trial by how many days?', '7');
    if (!days) return;
    await overrideTrial(userId, parseInt(days));
    setMsg(`Trial extended by ${days} days`);
    fetch();
    setTimeout(() => setMsg(''), 3000);
  };

  const pages = Math.ceil(total / 20);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Subscriptions ({total})</h2>

      {msg && <div className="mb-4 px-4 py-2 bg-green-900/50 text-green-200 rounded-lg text-sm">{msg}</div>}

      <div className="mb-4">
        <select value={tier} onChange={(e) => { setTier(e.target.value); setPage(1); }} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
          <option value="">All tiers</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {loading ? <div className="text-gray-400">Loading...</div> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-3 px-2">Name</th>
                  <th className="text-left py-3 px-2">Email</th>
                  <th className="text-left py-3 px-2">Tier</th>
                  <th className="text-left py-3 px-2">Trial Ends</th>
                  <th className="text-left py-3 px-2">Joined</th>
                  <th className="text-left py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-800 text-white hover:bg-gray-800">
                    <td className="py-3 px-2">{s.name || '—'}</td>
                    <td className="py-3 px-2 text-gray-400">{s.email}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${s.subscription_tier === 'pro' ? 'bg-purple-900 text-purple-200' : s.subscription_tier === 'enterprise' ? 'bg-yellow-900 text-yellow-200' : 'bg-gray-700 text-gray-200'}`}>{s.subscription_tier}</span>
                    </td>
                    <td className="py-3 px-2 text-xs text-gray-400">{s.trial_ended_at ? new Date(s.trial_ended_at).toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-2 text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-2">
                      <button onClick={() => handleOverride(s.id)} className="px-2 py-1 bg-indigo-700 text-white rounded text-xs hover:bg-indigo-600">Extend Trial</button>
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
