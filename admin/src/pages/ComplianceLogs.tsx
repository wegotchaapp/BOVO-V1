import { useState, useEffect, useCallback } from 'react';
import api, { getErrorMessage } from '../lib/api';
import { ErrorNotice, EmptyState } from '../components/QueryState';

interface ComplianceLog {
  id: string;
  user_id?: string;
  rule: string;
  action: string;
  details?: string;
  triggered_at: string;
}

export default function ComplianceLogsPage() {
  const [logs, setLogs] = useState<ComplianceLog[]>([]);
  const [rule, setRule] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/admin/compliance-logs', { params: { rule: rule || undefined, user_id: userId || undefined } })
      .then((r) => setLogs(r.data))
      .catch((e: unknown) => setError(getErrorMessage(e, 'Could not load this data.')))
      .finally(() => setLoading(false));
  }, [rule, userId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetch, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetch]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink mb-6">Compliance Logs</h2>

      <div className="mb-4 flex gap-3">
        <select value={rule} onChange={(e) => setRule(e.target.value)} className="bg-card border border-border rounded-lg px-4 py-2 text-ink text-sm">
          <option value="">All rules</option>
          <option value="CCPA_TEXAS_DELETION">CCPA/Texas Deletion</option>
          <option value="FCRA_ADVERSE_ACTION">FCRA Adverse Action</option>
          <option value="DATA_RETENTION">Data Retention</option>
          <option value="BIOMETRIC_CONSENT">Biometric Consent</option>
        </select>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Filter by user ID" className="bg-card border border-border rounded-lg px-4 py-2 text-ink text-sm flex-1" />
        <button onClick={fetch} className="px-4 py-2 bg-gold text-ground rounded-lg text-sm hover:bg-gold/90">Filter</button>
      </div>

      {loading ? <div className="text-ink-soft">Loading...</div> : error ? (
        <ErrorNotice message={error} onRetry={fetch} />
      ) : logs.length === 0 ? (
        <EmptyState title="No compliance events recorded." body="Events appear here as checks run." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-soft border-b border-border">
                <th className="text-left py-3 px-2">User ID</th>
                <th className="text-left py-3 px-2">Rule</th>
                <th className="text-left py-3 px-2">Action</th>
                <th className="text-left py-3 px-2">Details</th>
                <th className="text-left py-3 px-2">Triggered At</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border text-ink hover:bg-card">
                  <td className="py-3 px-2 text-xs font-mono">{l.user_id?.slice(0, 12)}...</td>
                  <td className="py-3 px-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-inset text-ink">{l.rule}</span>
                  </td>
                  <td className="py-3 px-2">{l.action}</td>
                  <td className="py-3 px-2 text-ink-soft text-xs max-w-xs truncate">{l.details || '—'}</td>
                  <td className="py-3 px-2 text-xs text-ink-soft">{new Date(l.triggered_at).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-ink-soft">No compliance logs found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
