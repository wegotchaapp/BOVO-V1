import { useState, useEffect } from 'react';
import { getDriverDocs, verifyVehicle } from '../lib/api';

export default function DriverDocsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const fetch = () => {
    setLoading(true);
    getDriverDocs().then(setData).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const handleVerify = async (id: string, approved: boolean) => {
    await verifyVehicle(id, approved);
    setMsg(approved ? 'Vehicle verified' : 'Vehicle rejected');
    fetch();
    setTimeout(() => setMsg(''), 3000);
  };

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Driver Documents</h2>

      {msg && <div className="mb-4 px-4 py-2 bg-green-900/50 text-green-200 rounded-lg text-sm">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-white font-semibold mb-3">Vehicles ({data?.vehicles?.length || 0})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 px-1">Owner</th>
                  <th className="text-left py-2 px-1">Make/Model</th>
                  <th className="text-left py-2 px-1">Year</th>
                  <th className="text-left py-2 px-1">Status</th>
                  <th className="text-left py-2 px-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.vehicles?.length === 0 && <tr><td colSpan={5} className="text-gray-500 py-4 text-center">No vehicles</td></tr>}
                {data?.vehicles?.map((v: any) => (
                  <tr key={v.id} className="border-b border-gray-800 text-white">
                    <td className="py-2 px-1 text-xs">{v.user?.name || v.user_id?.slice(0, 8) || '—'}</td>
                    <td className="py-2 px-1 text-xs">{v.make || ''} {v.model || ''}</td>
                    <td className="py-2 px-1 text-xs">{v.year || '—'}</td>
                    <td className="py-2 px-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${(v as any).verification_status === 'verified' ? 'bg-green-900 text-green-200' : (v as any).verification_status === 'rejected' ? 'bg-red-900 text-red-200' : 'bg-yellow-900 text-yellow-200'}`}>{(v as any).verification_status || 'pending'}</span>
                    </td>
                    <td className="py-2 px-1">
                      <div className="flex gap-1">
                        <button onClick={() => handleVerify(v.id, true)} className="px-2 py-0.5 bg-green-700 text-white rounded text-xs hover:bg-green-600">Approve</button>
                        <button onClick={() => handleVerify(v.id, false)} className="px-2 py-0.5 bg-red-700 text-white rounded text-xs hover:bg-red-600">Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-white font-semibold mb-3">Verifications ({data?.verifications?.length || 0})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 px-1">User</th>
                  <th className="text-left py-2 px-1">Provider</th>
                  <th className="text-left py-2 px-1">Status</th>
                  <th className="text-left py-2 px-1">Date</th>
                </tr>
              </thead>
              <tbody>
                {data?.verifications?.length === 0 && <tr><td colSpan={4} className="text-gray-500 py-4 text-center">No verifications</td></tr>}
                {data?.verifications?.map((v: any) => (
                  <tr key={v.id} className="border-b border-gray-800 text-white">
                    <td className="py-2 px-1 text-xs">{v.user?.name || v.user_id?.slice(0, 8) || '—'}</td>
                    <td className="py-2 px-1 text-xs">{v.provider || '—'}</td>
                    <td className="py-2 px-1">
                      <span className={`px-2 py-0.5 rounded text-xs ${v.status === 'verified' ? 'bg-green-900 text-green-200' : v.status === 'failed' ? 'bg-red-900 text-red-200' : 'bg-yellow-900 text-yellow-200'}`}>{v.status}</span>
                    </td>
                    <td className="py-2 px-1 text-xs text-gray-400">{v.created_at ? new Date(v.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-white font-semibold mb-3">Pending Background Checks ({data?.pendingBackgroundChecks?.length || 0})</h3>
          {data?.pendingBackgroundChecks?.map((u: any) => (
            <div key={u.id} className="text-white text-sm py-1">{u.name || u.email} <span className="text-gray-400">— {u.background_check_status}</span></div>
          ))}
          {!data?.pendingBackgroundChecks?.length && <div className="text-gray-500 text-sm">None pending</div>}
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-white font-semibold mb-3">W-9 Not Filed ({data?.pendingW9?.length || 0})</h3>
          {data?.pendingW9?.map((u: any) => (
            <div key={u.id} className="text-white text-sm py-1">{u.name || u.email}</div>
          ))}
          {!data?.pendingW9?.length && <div className="text-gray-500 text-sm">All filed</div>}
        </div>
      </div>
    </div>
  );
}
