import { useState, useEffect } from 'react';
import { getDriverDocs, verifyVehicle } from '../lib/api';
import { ErrorNotice } from '../components/QueryState';

export default function DriverDocsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const fetch = () => {
    setLoading(true);
    setError(null);
    getDriverDocs()
      .then(setData)
      .catch((e: any) =>
        setError(e?.response?.data?.message || e?.message || 'Could not load driver documents.'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const handleVerify = async (id: string, approved: boolean) => {
    await verifyVehicle(id, approved);
    setMsg(approved ? 'Vehicle verified' : 'Vehicle rejected');
    fetch();
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) return <div className="text-ink-soft">Loading...</div>;
  if (error) return <ErrorNotice message={error} onRetry={fetch} />;

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink mb-6">Driver Documents</h2>

      {msg && <div className="mb-4 px-4 py-2 bg-good/15 text-good rounded-lg text-sm">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-ink font-semibold mb-3">Vehicles ({data?.vehicles?.length || 0})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft border-b border-border">
                  <th className="text-left py-2 px-1">Owner</th>
                  <th className="text-left py-2 px-1">Make/Model</th>
                  <th className="text-left py-2 px-1">Year</th>
                  <th className="text-left py-2 px-1">Status</th>
                  <th className="text-left py-2 px-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.vehicles?.length === 0 && <tr><td colSpan={5} className="text-ink-soft py-4 text-center">No vehicles</td></tr>}
                {data?.vehicles?.map((v: any) => (
                  <tr key={v.id} className="border-b border-border text-ink">
                    <td className="py-2 px-1 text-xs">{v.user?.name || v.user_id?.slice(0, 8) || '—'}</td>
                    <td className="py-2 px-1 text-xs">{v.make || ''} {v.model || ''}</td>
                    <td className="py-2 px-1 text-xs">{v.year || '—'}</td>
                    <td className="py-2 px-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${(v as any).verification_status === 'verified' ? 'bg-good/15 text-good' : (v as any).verification_status === 'rejected' ? 'bg-critical/15 text-critical' : 'bg-warning/15 text-warning'}`}>{(v as any).verification_status || 'pending'}</span>
                    </td>
                    <td className="py-2 px-1">
                      <div className="flex gap-1">
                        <button onClick={() => handleVerify(v.id, true)} className="px-2 py-0.5 bg-good/20 text-good rounded text-xs hover:bg-good/30">Approve</button>
                        <button onClick={() => handleVerify(v.id, false)} className="px-2 py-0.5 bg-critical/20 text-critical rounded text-xs hover:bg-critical/30">Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-ink font-semibold mb-3">Verifications ({data?.verifications?.length || 0})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft border-b border-border">
                  <th className="text-left py-2 px-1">User</th>
                  <th className="text-left py-2 px-1">Provider</th>
                  <th className="text-left py-2 px-1">Status</th>
                  <th className="text-left py-2 px-1">Date</th>
                </tr>
              </thead>
              <tbody>
                {data?.verifications?.length === 0 && <tr><td colSpan={4} className="text-ink-soft py-4 text-center">No verifications</td></tr>}
                {data?.verifications?.map((v: any) => (
                  <tr key={v.id} className="border-b border-border text-ink">
                    <td className="py-2 px-1 text-xs">{v.user?.name || v.user_id?.slice(0, 8) || '—'}</td>
                    <td className="py-2 px-1 text-xs">{v.provider || '—'}</td>
                    <td className="py-2 px-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${v.status === 'verified' ? 'bg-good/15 text-good' : v.status === 'failed' ? 'bg-critical/15 text-critical' : 'bg-warning/15 text-warning'}`}>{v.status}</span>
                    </td>
                    <td className="py-2 px-1 text-xs text-ink-soft">{v.created_at ? new Date(v.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-ink font-semibold mb-3">Pending Background Checks ({data?.pendingBackgroundChecks?.length || 0})</h3>
          {data?.pendingBackgroundChecks?.map((u: any) => (
            <div key={u.id} className="text-ink text-sm py-1">{u.name || u.email} <span className="text-ink-soft">— {u.background_check_status}</span></div>
          ))}
          {!data?.pendingBackgroundChecks?.length && <div className="text-ink-soft text-sm">None pending</div>}
        </div>

        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-ink font-semibold mb-3">W-9 Not Filed ({data?.pendingW9?.length || 0})</h3>
          {data?.pendingW9?.map((u: any) => (
            <div key={u.id} className="text-ink text-sm py-1">{u.name || u.email}</div>
          ))}
          {!data?.pendingW9?.length && <div className="text-ink-soft text-sm">All filed</div>}
        </div>
      </div>
    </div>
  );
}
