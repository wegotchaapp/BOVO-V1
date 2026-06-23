import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function ComplianceLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [rule, setRule] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    setLoading(true);
    api.get('/admin/compliance-logs', { params: { rule: rule || undefined, user_id: userId || undefined } })
      .then((r) => setLogs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [rule]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Compliance Logs</h2>

      <div className="mb-4 flex gap-3">
        <select value={rule} onChange={(e) => setRule(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
          <option value="">All rules</option>
          <option value="CCPA_TEXAS_DELETION">CCPA/Texas Deletion</option>
          <option value="FCRA_ADVERSE_ACTION">FCRA Adverse Action</option>
          <option value="DATA_RETENTION">Data Retention</option>
          <option value="BIOMETRIC_CONSENT">Biometric Consent</option>
        </select>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Filter by user ID" className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm flex-1" />
        <button onClick={fetch} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500">Filter</button>
      </div>

      {loading ? <div className="text-gray-400">Loading...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-3 px-2">User ID</th>
                <th className="text-left py-3 px-2">Rule</th>
                <th className="text-left py-3 px-2">Action</th>
                <th className="text-left py-3 px-2">Details</th>
                <th className="text-left py-3 px-2">Triggered At</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id} className="border-b border-gray-800 text-white hover:bg-gray-800">
                  <td className="py-3 px-2 text-xs font-mono">{l.user_id?.slice(0, 12)}...</td>
                  <td className="py-3 px-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-purple-900 text-purple-200">{l.rule}</span>
                  </td>
                  <td className="py-3 px-2">{l.action}</td>
                  <td className="py-3 px-2 text-gray-400 text-xs max-w-xs truncate">{l.details || '—'}</td>
                  <td className="py-3 px-2 text-xs text-gray-400">{new Date(l.triggered_at).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-500">No compliance logs found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
