import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function DriverEarningsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [driverId, setDriverId] = useState('');
  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/driver-trips/summary')
      .then((r) => setSummary(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const lookupDriver = async () => {
    if (!driverId) return;
    const r = await api.get(`/admin/driver-earnings/${driverId}`);
    setEarnings(r.data);
  };

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Driver Earnings</h2>

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide">Total Trips</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.totalDriverTrips}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide">Total Net Earnings</p>
            <p className="text-2xl font-bold text-green-400 mt-1">${parseFloat(summary.totalEarnings).toFixed(2)}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide">Recent Trips</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.recentTrips?.length || 0}</p>
          </div>
        </div>
      )}

      {summary?.recentTrips && summary.recentTrips.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-3">Recent Completed Trips</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
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
                  <tr key={t.id} className="border-b border-gray-800 text-white">
                    <td className="py-3 px-2 text-xs">{t.driver_id?.slice(0, 8)}...</td>
                    <td className="py-3 px-2">{t.from_city} → {t.to_city}</td>
                    <td className="py-3 px-2">{t.miles}</td>
                    <td className="py-3 px-2">{t.seats_booked}</td>
                    <td className="py-3 px-2">${parseFloat(t.gross_amount).toFixed(2)}</td>
                    <td className="py-3 px-2 text-red-400">-${parseFloat(t.platform_fee).toFixed(2)}</td>
                    <td className="py-3 px-2 text-green-400">${parseFloat(t.net_amount).toFixed(2)}</td>
                    <td className="py-3 px-2 text-xs text-gray-400">{new Date(t.completed_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Driver Lookup</h3>
        <div className="flex gap-3">
          <input value={driverId} onChange={(e) => setDriverId(e.target.value)} placeholder="Enter driver user ID" className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm flex-1" />
          <button onClick={lookupDriver} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500">Look Up</button>
        </div>
        {earnings && (
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="bg-gray-700 rounded p-3">
              <p className="text-gray-400 text-xs">Trips</p>
              <p className="text-white font-bold">{earnings.totalTrips}</p>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <p className="text-gray-400 text-xs">Gross</p>
              <p className="text-white font-bold">${earnings.totalGross?.toFixed(2)}</p>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <p className="text-gray-400 text-xs">Fees</p>
              <p className="text-red-400 font-bold">-${earnings.totalFees?.toFixed(2)}</p>
            </div>
            <div className="bg-gray-700 rounded p-3">
              <p className="text-gray-400 text-xs">Net</p>
              <p className="text-green-400 font-bold">${earnings.totalNet?.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
