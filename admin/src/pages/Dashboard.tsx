import { useState, useEffect } from 'react';
import { getDashboard } from '../lib/api';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading...</div>;

  const cards = [
    { label: 'Total Users', value: data?.totalUsers, color: 'bg-blue-500' },
    { label: 'Drivers', value: data?.totalDrivers, color: 'bg-green-500' },
    { label: 'New Today', value: data?.usersToday, color: 'bg-cyan-500' },
    { label: 'New/Month', value: data?.newUsersThisMonth, color: 'bg-teal-500' },
    { label: 'Active 7d', value: data?.activeUsers, color: 'bg-violet-500' },
    { label: 'Active Trips', value: data?.activeTrips, color: 'bg-yellow-500' },
    { label: 'Active Bookings', value: data?.activeBookings, color: 'bg-purple-500' },
    { label: 'Trips Today', value: data?.tripsToday, color: 'bg-pink-400' },
    { label: 'Trips/Month', value: data?.tripsThisMonth, color: 'bg-pink-500' },
    { label: 'Revenue/Month', value: data?.revenueThisMonth ? `$${Number(data.revenueThisMonth).toFixed(2)}` : '$0', color: 'bg-emerald-500' },
    { label: 'Pending Payouts', value: data?.pendingPayouts, color: 'bg-orange-500' },
    { label: 'Open Incidents', value: data?.openIncidents, color: 'bg-red-500' },
    { label: 'Open Tickets', value: data?.supportTickets?.open, color: 'bg-yellow-500' },
    { label: 'Pending Tickets', value: data?.supportTickets?.pending, color: 'bg-orange-400' },
    { label: 'Resolved Today', value: data?.supportTickets?.resolvedToday, color: 'bg-emerald-400' },
    { label: 'Total Tickets', value: data?.supportTickets?.total, color: 'bg-blue-400' },
    { label: 'Active Agents', value: data?.supportTickets?.activeAgents, color: 'bg-purple-400' },
  ];

  const maxTrip = Math.max(...(data?.tripsTrend?.map((t: any) => t.count) || [1]), 1);
  const maxRev = Math.max(...(data?.revenueTrend?.map((t: any) => Number(t.amount)) || [1]), 1);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${c.color}`} />
              <span className="text-gray-400 text-xs">{c.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{c.value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-white font-semibold mb-3">Trips (7 days)</h3>
          <div className="flex items-end gap-2 h-32">
            {(data?.tripsTrend || []).map((d: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-400">{d.count}</span>
                <div className="w-full bg-indigo-500 rounded-t" style={{ height: `${(d.count / maxTrip) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }} />
                <span className="text-[10px] text-gray-500">{new Date(d.date).getDate()}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-white font-semibold mb-3">Revenue (7 days)</h3>
          <div className="flex items-end gap-2 h-32">
            {(data?.revenueTrend || []).map((d: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-400">${Number(d.amount).toFixed(0)}</span>
                <div className="w-full bg-emerald-500 rounded-t" style={{ height: `${(Number(d.amount) / maxRev) * 100}%`, minHeight: Number(d.amount) > 0 ? '4px' : '0' }} />
                <span className="text-[10px] text-gray-500">{new Date(d.date).getDate()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
