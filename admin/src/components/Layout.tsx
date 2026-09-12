import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clearToken, getDashboard } from '../lib/api';

/**
 * Thin-stroke line icons, inline so the admin gains no icon dependency.
 * All share one 24px grid and 1.5 stroke so the set reads as a single family.
 */
const icon = (path: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-[18px] h-[18px] shrink-0"
    aria-hidden="true"
  >
    <path d={path} />
  </svg>
);

const I = {
  dashboard: icon('M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z'),
  trips: icon('M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm14 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM3 17V9l2-4h10l4 4h2v8'),
  bookings: icon('M8 2v4m8-4v4M3 10h18M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z'),
  users: icon('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87'),
  docs: icon('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M9 15h6'),
  earnings: icon('M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'),
  payments: icon('M2 9h20M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7Zm4 8h4'),
  subs: icon('M21 12a9 9 0 1 1-6.2-8.56M22 4l-10 10-3-3'),
  safety: icon('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z'),
  trust: icon('M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z'),
  compliance: icon('M7 11V7a5 5 0 0 1 10 0v4M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z'),
  audit: icon('M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4'),
  tickets: icon('M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Zm10-4v14'),
  agents: icon('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 3 2 2 3-3'),
  notifications: icon('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0'),
  config: icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.4 7.4 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2Z'),
  signout: icon('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9'),
};

type Item = { to: string; label: string; glyph: React.ReactNode; badge?: number };
type Group = { heading: string; items: Item[] };

export default function Layout() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<{
    tickets: number;
    payouts: number;
    incidents: number;
    docs: number;
  } | null>(null);

  // Live queue depth in the nav. This is what makes the sidebar a place someone
  // works from rather than a list they read. Failure is silent by design — a
  // missing badge must never take the whole shell down.
  useEffect(() => {
    let cancelled = false;
    getDashboard()
      .then((d) => {
        if (cancelled) return;
        setCounts({
          tickets: d?.supportTickets?.open ?? 0,
          payouts: d?.pendingPayouts ?? 0,
          incidents: d?.openIncidents ?? 0,
          docs: d?.vehiclesAwaitingReview ?? 0,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  const groups: Group[] = [
    { heading: 'Overview', items: [{ to: '/', label: 'Dashboard', glyph: I.dashboard }] },
    {
      heading: 'Marketplace',
      items: [
        { to: '/trips', label: 'Trips', glyph: I.trips },
        { to: '/bookings', label: 'Bookings', glyph: I.bookings },
      ],
    },
    {
      heading: 'People',
      items: [
        { to: '/users', label: 'Users', glyph: I.users },
        { to: '/driver-docs', label: 'Driver Docs', glyph: I.docs, badge: counts?.docs },
        { to: '/vehicle-review', label: 'Vehicle Review', glyph: I.docs },
        { to: '/identity-verifications', label: 'Identity Review', glyph: I.docs },
        { to: '/driver-earnings', label: 'Driver Earnings', glyph: I.earnings },
      ],
    },
    {
      heading: 'Money',
      items: [
        { to: '/payments', label: 'Payments', glyph: I.payments, badge: counts?.payouts },
        { to: '/subscriptions', label: 'Subscriptions', glyph: I.subs },
      ],
    },
    {
      heading: 'Trust & Safety',
      items: [
        { to: '/safety', label: 'Safety', glyph: I.safety, badge: counts?.incidents },
        { to: '/trust-safety', label: 'Trust & Safety', glyph: I.trust },
        { to: '/compliance-logs', label: 'Compliance Logs', glyph: I.compliance },
        { to: '/audit', label: 'Audit Log', glyph: I.audit },
      ],
    },
    {
      heading: 'Support',
      items: [
        { to: '/support-tickets', label: 'Support Tickets', glyph: I.tickets, badge: counts?.tickets },
        { to: '/agents', label: 'Support Agents', glyph: I.agents },
        { to: '/notifications', label: 'Notifications', glyph: I.notifications },
      ],
    },
    { heading: 'System', items: [{ to: '/config', label: 'System Config', glyph: I.config }] },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      isActive
        ? 'bg-inset text-gold font-semibold'
        : 'text-ink-soft hover:text-ink hover:bg-card'
    }`;

  return (
    <div className="flex h-screen bg-ground">
      <aside className="w-60 bg-card border-r border-border flex flex-col shrink-0">
        <div className="px-5 pt-5 pb-4">
          <h1 className="text-lg font-bold text-ink leading-none">Bovogo</h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            Admin
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-5">
          {groups.map((g) => (
            <div key={g.heading}>
              <p className="px-3 mb-1 text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                {g.heading}
              </p>
              <div className="space-y-0.5">
                {g.items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.to === '/'}
                    className={linkClass}
                  >
                    {it.glyph}
                    <span className="flex-1 truncate">{it.label}</span>
                    {!!it.badge && (
                      <span className="tabular shrink-0 min-w-[20px] text-center rounded-full bg-inset border border-border px-1.5 py-0.5 text-[11px] text-ink-soft">
                        {it.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-2 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-ink-soft hover:text-ink hover:bg-card transition-colors"
          >
            {I.signout}
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-ground p-6">
        <Outlet />
      </main>
    </div>
  );
}
