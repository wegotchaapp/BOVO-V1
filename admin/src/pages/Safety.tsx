import { useState, useEffect, useCallback } from 'react';
import { getSosAlerts, getIncidents } from '../lib/api';
import { ErrorNotice } from '../components/QueryState';

interface SosEvent {
  id: string;
  user_id: string;
  status: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
}

export default function SafetyPage() {
  const [sosAlerts, setSosAlerts] = useState<SosEvent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentPage, setIncidentPage] = useState(1);
  const [incidentFilter, setIncidentFilter] = useState('');
  const [totalIncidents, setTotalIncidents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Named so the error state has something to retry with.
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getSosAlerts(),
      getIncidents({ status: incidentFilter || undefined, page: incidentPage }),
    ])
      .then(([sos, inc]) => {
        setSosAlerts(sos);
        setIncidents(inc.incidents);
        setTotalIncidents(inc.total);
      })
      .catch((e: any) =>
        setError(e?.response?.data?.message || e?.message || 'Could not load safety data.'),
      )
      .finally(() => setLoading(false));
  }, [incidentPage, incidentFilter]);

  useEffect(load, [load]);

  const incPages = Math.ceil(totalIncidents / 20);

  if (loading) return <div className="text-ink-soft">Loading...</div>;
  if (error) return <ErrorNotice message={error} onRetry={load} />;

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink mb-6">Safety &amp; Moderation</h2>

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-ink mb-3">SOS Alerts ({sosAlerts.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-soft border-b border-border">
                <th className="text-left py-3 px-2">ID</th>
                <th className="text-left py-3 px-2">User ID</th>
                <th className="text-left py-3 px-2">Status</th>
                <th className="text-left py-3 px-2">Location</th>
                <th className="text-left py-3 px-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {sosAlerts.length === 0 && <tr><td colSpan={5} className="text-ink-soft py-4 text-center">No SOS alerts</td></tr>}
              {sosAlerts.map((s) => (
                <tr key={s.id} className="border-b border-border text-ink hover:bg-card">
                  <td className="py-3 px-2 text-xs text-ink-soft">{s.id.slice(0, 8)}…</td>
                  <td className="py-3 px-2 text-xs">{s.user_id?.slice(0, 8)}…</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${s.status === 'active' ? 'bg-critical/15 text-critical' : 'bg-inset text-ink'}`}>{s.status}</span>
                  </td>
                  <td className="py-3 px-2 text-xs">{s.latitude?.toFixed(4)}, {s.longitude?.toFixed(4)}</td>
                  <td className="py-3 px-2 text-ink-soft">{new Date(s.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-ink">Incidents ({totalIncidents})</h3>
          <select value={incidentFilter} onChange={(e) => { setIncidentFilter(e.target.value); setIncidentPage(1); }} className="bg-card border border-border rounded-lg px-4 py-2 text-ink text-sm">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="under_investigation">Under Investigation</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-soft border-b border-border">
                <th className="text-left py-3 px-2">Title</th>
                <th className="text-left py-3 px-2">Severity</th>
                <th className="text-left py-3 px-2">Status</th>
                <th className="text-left py-3 px-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 && <tr><td colSpan={4} className="text-ink-soft py-4 text-center">No incidents</td></tr>}
              {incidents.map((i) => (
                <tr key={i.id} className="border-b border-border text-ink hover:bg-card">
                  <td className="py-3 px-2 max-w-[200px] truncate">{i.title || '—'}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${i.severity === 'critical' ? 'bg-critical/15 text-critical' : i.severity === 'high' ? 'bg-warning/15 text-warning' : i.severity === 'medium' ? 'bg-warning/15 text-warning' : 'bg-inset text-ink'}`}>{i.severity}</span>
                  </td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${i.status === 'open' ? 'bg-critical/15 text-critical' : i.status === 'under_investigation' ? 'bg-warning/15 text-warning' : i.status === 'resolved' ? 'bg-good/15 text-good' : 'bg-inset text-ink'}`}>{i.status}</span>
                  </td>
                  <td className="py-3 px-2 text-ink-soft">{new Date(i.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {incPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: Math.min(incPages, 10) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setIncidentPage(p)} className={`px-3 py-1 rounded text-sm ${p === incidentPage ? 'bg-gold text-ground' : 'bg-card text-ink-soft hover:bg-inset'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
