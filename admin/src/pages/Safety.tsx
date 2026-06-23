import { useState, useEffect } from 'react';
import { getSosAlerts, getIncidents } from '../lib/api';

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

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getSosAlerts(),
      getIncidents({ status: incidentFilter || undefined, page: incidentPage }),
    ])
      .then(([sos, inc]) => {
        setSosAlerts(sos);
        setIncidents(inc.incidents);
        setTotalIncidents(inc.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [incidentPage, incidentFilter]);

  const incPages = Math.ceil(totalIncidents / 20);

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Safety &amp; Moderation</h2>

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-3">SOS Alerts ({sosAlerts.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-3 px-2">ID</th>
                <th className="text-left py-3 px-2">User ID</th>
                <th className="text-left py-3 px-2">Status</th>
                <th className="text-left py-3 px-2">Location</th>
                <th className="text-left py-3 px-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {sosAlerts.length === 0 && <tr><td colSpan={5} className="text-gray-500 py-4 text-center">No SOS alerts</td></tr>}
              {sosAlerts.map((s) => (
                <tr key={s.id} className="border-b border-gray-800 text-white hover:bg-gray-800">
                  <td className="py-3 px-2 text-xs text-gray-400">{s.id.slice(0, 8)}…</td>
                  <td className="py-3 px-2 text-xs">{s.user_id?.slice(0, 8)}…</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${s.status === 'active' ? 'bg-red-900 text-red-200' : 'bg-gray-700 text-gray-200'}`}>{s.status}</span>
                  </td>
                  <td className="py-3 px-2 text-xs">{s.latitude?.toFixed(4)}, {s.longitude?.toFixed(4)}</td>
                  <td className="py-3 px-2 text-gray-400">{new Date(s.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Incidents ({totalIncidents})</h3>
          <select value={incidentFilter} onChange={(e) => { setIncidentFilter(e.target.value); setIncidentPage(1); }} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
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
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-3 px-2">Title</th>
                <th className="text-left py-3 px-2">Severity</th>
                <th className="text-left py-3 px-2">Status</th>
                <th className="text-left py-3 px-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 && <tr><td colSpan={4} className="text-gray-500 py-4 text-center">No incidents</td></tr>}
              {incidents.map((i) => (
                <tr key={i.id} className="border-b border-gray-800 text-white hover:bg-gray-800">
                  <td className="py-3 px-2 max-w-[200px] truncate">{i.title || '—'}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${i.severity === 'critical' ? 'bg-red-900 text-red-200' : i.severity === 'high' ? 'bg-orange-900 text-orange-200' : i.severity === 'medium' ? 'bg-yellow-900 text-yellow-200' : 'bg-gray-700 text-gray-200'}`}>{i.severity}</span>
                  </td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${i.status === 'open' ? 'bg-red-900 text-red-200' : i.status === 'under_investigation' ? 'bg-yellow-900 text-yellow-200' : i.status === 'resolved' ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-200'}`}>{i.status}</span>
                  </td>
                  <td className="py-3 px-2 text-gray-400">{new Date(i.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {incPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: Math.min(incPages, 10) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setIncidentPage(p)} className={`px-3 py-1 rounded text-sm ${p === incidentPage ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
