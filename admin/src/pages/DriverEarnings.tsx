import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { ErrorNotice } from '../components/QueryState';

export default function DriverEarningsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [driverId, setDriverId] = useState('');
  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Named so the error state has something to retry with.
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get('/admin/driver-trips/summary')
      .then((r) => setSummary(r.data))
      .catch((e: any) =>
        setError(e?.response?.data?.message || e?.message || 'Could not load the earnings summary.'),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const lookupDriver = async () => {
    if (!driverId) return;
    const r = await api.get(`/admin/driver-earnings/${driverId}`);
    setEarnings(r.data);
  };

  if (loading) return <div className="text-ink-soft">Loading...</div>;
  if (error) return <ErrorNotice message={error} onRetry={load} />;

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink mb-6">Driver Earnings</h2>

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-lg p-4">
            <p className="text-ink-soft text-xs uppercase tracking-wide">Total Trips</p>
            <p className="text-2xl font-bold text-ink mt-1">{summary.totalDriverTrips}</p>
          </div>
          <div className="bg-card rounded-lg p-4">
            <p className="text-ink-soft text-xs uppercase tracking-wide">Total Net Earnings</p>
            <p className="text-2xl font-bold text-good mt-1">${parseFloat(summary.totalEarnings).toFixed(2)}</p>
          </div>
          <div className="bg-card rounded-lg p-4">
            <p className="text-ink-soft text-xs uppercase tracking-wide">Recent Trips</p>
            <p className="text-2xl font-bold text-ink mt-1">{summary.recentTrips?.length || 0}</p>
          </div>
        </div>
      )}

      {summary?.recentTrips && summary.recentTrips.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-ink mb-3">Recent Completed Trips</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft border-b border-border">
                  <th className="text-left py-3 px-2">Driver</th>
                  <th className="text-left py-3 px-2">Route</th>
                  <th className="text-left py-3 px-2">Miles</th>
                  <th className="text-left py-3 px-2">Seats</th>
                  <th className="text-left py-3 px-2">Gross</th>
                  <th className="text-left py-3 px-2">Fee</th>
                  <th className="text-left py-3 px-2">Net</th>
                  <th className="text-left py-3 px-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentTrips.map((t: any) => (
                  <tr key={t.id} className="border-b border-border text-ink">
                    <td className="py-3 px-2 text-xs">{t.driver_id?.slice(0, 8)}...</td>
                    <td className="py-3 px-2">{t.from_city} → {t.to_city}</td>
                    <td className="py-3 px-2">{t.miles}</td>
                    <td className="py-3 px-2">{t.seats_booked}</td>
                    <td className="py-3 px-2">${parseFloat(t.gross_amount).toFixed(2)}</td>
                    <td className="py-3 px-2 text-critical">-${parseFloat(t.platform_fee).toFixed(2)}</td>
                    <td className="py-3 px-2 text-good">${parseFloat(t.net_amount).toFixed(2)}</td>
                    <td className="py-3 px-2 text-xs text-ink-soft">{new Date(t.completed_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg p-4">
        <h3 className="text-lg font-semibold text-ink mb-3">Driver Lookup</h3>
        <div className="flex gap-3">
          <input value={driverId} onChange={(e) => setDriverId(e.target.value)} placeholder="Enter driver user ID" className="bg-inset border border-border rounded-lg px-4 py-2 text-ink text-sm flex-1" />
          <button onClick={lookupDriver} className="px-4 py-2 bg-gold text-ground rounded-lg text-sm hover:bg-gold/90">Look Up</button>
        </div>
        {earnings && (
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="bg-inset rounded p-3">
              <p className="text-ink-soft text-xs">Trips</p>
              <p className="text-ink font-bold">{earnings.totalTrips}</p>
            </div>
            <div className="bg-inset rounded p-3">
              <p className="text-ink-soft text-xs">Gross</p>
              <p className="text-ink font-bold">${earnings.totalGross?.toFixed(2)}</p>
            </div>
            <div className="bg-inset rounded p-3">
              <p className="text-ink-soft text-xs">Fees</p>
              <p className="text-critical font-bold">-${earnings.totalFees?.toFixed(2)}</p>
            </div>
            <div className="bg-inset rounded p-3">
              <p className="text-ink-soft text-xs">Net</p>
              <p className="text-good font-bold">${earnings.totalNet?.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
