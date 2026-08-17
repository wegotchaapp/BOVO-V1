import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../lib/api';

type Trend = { date: string; count?: number; amount?: number | string };

interface DashboardData {
  totalUsers: number;
  totalDrivers: number;
  usersToday: number;
  newUsersThisMonth: number;
  activeUsers: number;
  activeTrips: number;
  activeBookings: number;
  bookingsToday: number;
  tripsToday: number;
  tripsThisMonth: number;
  revenueThisMonth: number | string;
  pendingPayouts: number;
  openIncidents: number;
  vehiclesAwaitingReview: number;
  deltas: {
    bookingsToday: number | null;
    revenueThisMonth: number | null;
    incidentsOpenedToday: number;
  };
  supportTickets: {
    open: number;
    pending: number;
    resolvedToday: number;
    total: number;
    activeAgents: number;
  };
  tripsTrend: Trend[];
  revenueTrend: Trend[];
}

const money = (v: number | string | undefined) =>
  v == null ? '—' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const num = (v: number | undefined) => (v == null ? '—' : v.toLocaleString('en-US'));

/** Period-over-period delta. Null means the previous period was zero — say so
 *  rather than rendering a meaningless +100%. */
function Delta({ pct, suffix }: { pct: number | null; suffix: string }) {
  if (pct == null) {
    return <span className="text-ink-soft">no prior period</span>;
  }
  const up = pct >= 0;
  return (
    <span className={up ? 'text-good' : 'text-critical'}>
      {up ? '▲' : '▼'} {Math.abs(pct)}% {suffix}
    </span>
  );
}

function Hero({
  label,
  value,
  children,
  critical,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
  critical?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-ink-soft">{label}</p>
      {/* Proportional figures here on purpose — tabular-nums reads loose at display size. */}
      <p className={`mt-2 text-3xl font-bold ${critical ? 'text-critical' : 'text-ink'}`}>
        {value}
      </p>
      <p className="mt-1 text-xs">{children ?? <span className="text-ink-soft">—</span>}</p>
    </div>
  );
}

/** Single-series bar chart. One colour, no legend — the title names the series.
 *  Only the tallest bar is labelled; the rest would be noise. */
function BarChart({
  title,
  data,
  format,
}: {
  title: string;
  data: { label: string; value: number }[];
  format: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <div className="relative mt-6 h-36">
        {/* Hairline gridlines, solid — dashed reads as a threshold it isn't. */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-grid" />
          ))}
        </div>
        <div className="relative h-full flex items-end gap-[2px]">
          {data.map((d, i) => (
            <div key={i} className="flex-1 h-full flex flex-col justify-end items-center">
              {d === peak && d.value > 0 && (
                <span className="tabular mb-1 text-[11px] text-ink-soft">
                  {format(d.value)}
                </span>
              )}
              <div
                className="w-full bg-series-1 rounded-t"
                style={{
                  height: `${(d.value / max) * 100}%`,
                  minHeight: d.value > 0 ? 3 : 0,
                }}
                title={`${d.label}: ${format(d.value)}`}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-[2px]">
        {data.map((d, i) => (
          <span key={i} className="tabular flex-1 text-center text-[11px] text-ink-soft">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getDashboard()
      .then(setData)
      .catch((e) => setError(e?.message || 'Could not reach the server.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  // A failed fetch must never look like "no data".
  if (error && !data) {
    return (
      <div className="max-w-md">
        <h2 className="text-2xl font-bold text-ink">Dashboard</h2>
        <div className="mt-6 bg-card border border-border rounded-lg p-5">
          <p className="text-critical font-semibold">The dashboard didn’t load.</p>
          <p className="mt-1 text-sm text-ink-soft">{error}</p>
          <button
            onClick={load}
            className="mt-4 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ground"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <p className="text-ink-soft">Loading…</p>;
  }

  const queues = [
    { label: 'Pending payouts', count: data.pendingPayouts, to: '/payments' },
    { label: 'Open tickets', count: data.supportTickets.open, to: '/support-tickets' },
    { label: 'Tickets pending', count: data.supportTickets.pending, to: '/support-tickets' },
    { label: 'Vehicles awaiting review', count: data.vehiclesAwaitingReview, to: '/driver-docs' },
  ];

  const totals = [
    ['Total users', num(data.totalUsers)],
    ['Total drivers', num(data.totalDrivers)],
    ['New this month', num(data.newUsersThisMonth)],
    ['New today', num(data.usersToday)],
    ['Active last 7 days', num(data.activeUsers)],
    ['Active bookings', num(data.activeBookings)],
    ['Trips today', num(data.tripsToday)],
    ['Trips this month', num(data.tripsThisMonth)],
    ['Total tickets', num(data.supportTickets.total)],
    ['Resolved today', num(data.supportTickets.resolvedToday)],
    ['Active agents', num(data.supportTickets.activeAgents)],
  ];

  const day = (iso: string) => String(new Date(iso).getDate());

  return (
    // On refetch hold the previous render at reduced opacity rather than
    // flashing a skeleton, which would jump the layout on every reload.
    <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <h2 className="text-2xl font-bold text-ink mb-6">Dashboard</h2>

      {/* Tier 1 — is the marketplace alive today? */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Hero label="Active Trips" value={num(data.activeTrips)}>
          <span className="text-ink-soft">{num(data.tripsToday)} posted today</span>
        </Hero>
        <Hero label="Bookings Today" value={num(data.bookingsToday)}>
          <Delta pct={data.deltas.bookingsToday} suffix="vs yesterday" />
        </Hero>
        <Hero label="Revenue This Month" value={money(data.revenueThisMonth)}>
          <Delta pct={data.deltas.revenueThisMonth} suffix="vs last month" />
        </Hero>
        <Hero label="Open Incidents" value={num(data.openIncidents)} critical={data.openIncidents > 0}>
          {data.deltas.incidentsOpenedToday > 0 ? (
            <span className="text-critical">
              ⚠ {data.deltas.incidentsOpenedToday} opened today
            </span>
          ) : (
            <span className="text-ink-soft">none opened today</span>
          )}
        </Hero>
      </div>

      {/* Tier 2 — numbers that should be going down. A queue is a to-do, not a stat. */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-lg overflow-hidden self-start">
          <h3 className="text-[15px] font-semibold text-ink px-5 py-4 border-b border-border">
            Needs attention
          </h3>
          {queues.map((q) => (
            <Link
              key={q.label}
              to={q.to}
              className="flex items-center justify-between px-5 py-3 border-b border-border last:border-b-0 hover:bg-inset transition-colors group"
            >
              <span className="text-sm text-ink-soft group-hover:text-ink">{q.label}</span>
              <span className="flex items-center gap-2">
                <span
                  className={`tabular text-sm font-semibold ${
                    q.count > 0 ? 'text-warning' : 'text-ink-soft'
                  }`}
                >
                  {q.count}
                </span>
                <span className="text-ink-soft">›</span>
              </span>
            </Link>
          ))}
        </div>

        {/* Tier 3 — two separate single-series plots. Never a dual axis. */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <BarChart
            title="Trips (7 days)"
            data={(data.tripsTrend || []).map((d) => ({
              label: day(d.date),
              value: Number(d.count) || 0,
            }))}
            format={(n) => String(n)}
          />
          <BarChart
            title="Revenue (7 days)"
            data={(data.revenueTrend || []).map((d) => ({
              label: day(d.date),
              value: Number(d.amount) || 0,
            }))}
            format={(n) => money(n)}
          />
        </div>
      </div>

      {/* Cumulative context, deliberately demoted. */}
      <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
        <h3 className="text-[15px] font-semibold text-ink px-5 py-4 border-b border-border">
          Totals
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {totals.map(([label, value], i) => (
                <tr
                  key={label}
                  className={i % 2 ? 'bg-inset' : ''}
                >
                  <td className="px-5 py-2 text-ink-soft">{label}</td>
                  <td className="tabular px-5 py-2 text-right text-ink">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
