import { useState, useEffect } from 'react';
import { getSubscriptions, overrideTrial } from '../lib/api';
import { ErrorNotice, EmptyState } from '../components/QueryState';
import ConfirmDialog, { type ConfirmRequest } from '../components/ConfirmDialog';

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tier, setTier] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [dialog, setDialog] = useState<ConfirmRequest | null>(null);

  const fetch = () => {
    setLoading(true);
    setError(null);
    getSubscriptions({ tier: tier || undefined, page })
      .then((r) => { setSubs(r.subscriptions); setTotal(r.total); })
      .catch((e: any) => setError(e?.response?.data?.message || e?.message || 'Could not load this data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page, tier]);

  // The old prompt() passed its raw string to parseInt, so any non-numeric
  // entry sent NaN to the API. The dialog now rejects anything that isn't a
  // whole number in range before the request is made.
  const handleOverride = (userId: string) =>
    setDialog({
      title: 'Extend trial',
      body: 'Adds days to this member’s current trial period.',
      confirmLabel: 'Extend trial',
      field: { kind: 'number', label: 'Days to add', defaultValue: '7', min: 1, max: 365 },
      onConfirm: async (days) => {
        await overrideTrial(userId, Number(days));
        setMsg(`Trial extended by ${days} days`);
        fetch();
        setTimeout(() => setMsg(''), 3000);
      },
    });

  const pages = Math.ceil(total / 20);

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink mb-6">Subscriptions ({total})</h2>

      {msg && <div className="mb-4 px-4 py-2 bg-good/15 text-good rounded-lg text-sm">{msg}</div>}

      <div className="mb-4">
        <select value={tier} onChange={(e) => { setTier(e.target.value); setPage(1); }} className="bg-card border border-border rounded-lg px-4 py-2 text-ink text-sm">
          <option value="">All tiers</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {loading ? <div className="text-ink-soft">Loading...</div> : error ? (
        <ErrorNotice message={error} onRetry={fetch} />
      ) : subs.length === 0 ? (
        <EmptyState title="No subscriptions in this tier." body="Try another tier." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft border-b border-border">
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
                  <tr key={s.id} className="border-b border-border text-ink hover:bg-card">
                    <td className="py-3 px-2">{s.name || '—'}</td>
                    <td className="py-3 px-2 text-ink-soft">{s.email}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${s.subscription_tier === 'pro' ? 'bg-inset text-ink' : s.subscription_tier === 'enterprise' ? 'bg-warning/15 text-warning' : 'bg-inset text-ink'}`}>{s.subscription_tier}</span>
                    </td>
                    <td className="py-3 px-2 text-xs text-ink-soft">{s.trial_ended_at ? new Date(s.trial_ended_at).toLocaleDateString() : '—'}</td>
                    <td className="py-3 px-2 text-xs text-ink-soft">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-2">
                      <button onClick={() => handleOverride(s.id)} className="px-2 py-1 bg-gold text-ground rounded text-xs hover:bg-gold/90">Extend Trial</button>
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

      <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
