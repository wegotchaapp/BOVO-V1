import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clearToken } from '../lib/api';

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => { clearToken(); navigate('/login'); };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <div className="flex h-screen bg-gray-900">
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-700">
          <h1 className="text-xl font-bold text-white">Bovogo Admin</h1>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <NavLink to="/" end className={linkClass}><span>📊</span> Dashboard</NavLink>
          <NavLink to="/users" className={linkClass}><span>👥</span> Users</NavLink>
          <NavLink to="/trips" className={linkClass}><span>🚗</span> Trips</NavLink>
          <NavLink to="/bookings" className={linkClass}><span>📅</span> Bookings</NavLink>
          <NavLink to="/payments" className={linkClass}><span>💰</span> Payments</NavLink>
          <NavLink to="/safety" className={linkClass}><span>🛡️</span> Safety</NavLink>
          <NavLink to="/audit" className={linkClass}><span>📋</span> Audit Log</NavLink>
          <NavLink to="/config" className={linkClass}><span>⚙️</span> System Config</NavLink>
          <NavLink to="/trust-safety" className={linkClass}><span>⚠️</span> Trust & Safety</NavLink>
          <NavLink to="/driver-docs" className={linkClass}><span>📄</span> Driver Docs</NavLink>
          <NavLink to="/vehicle-review" className={linkClass}><span>🚗</span> Vehicle Review</NavLink>
          <NavLink to="/notifications" className={linkClass}><span>🔔</span> Notifications</NavLink>
          <NavLink to="/subscriptions" className={linkClass}><span>💳</span> Subscriptions</NavLink>
          <NavLink to="/support-tickets" className={linkClass}><span>🎫</span> Support Tickets</NavLink>
          <NavLink to="/driver-earnings" className={linkClass}><span>💵</span> Driver Earnings</NavLink>
          <NavLink to="/compliance-logs" className={linkClass}><span>🔒</span> Compliance Logs</NavLink>
          <NavLink to="/agents" className={linkClass}><span>👤</span> Support Agents</NavLink>
        </nav>
        <div className="p-3 border-t border-gray-700">
          <button onClick={handleLogout} className="w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-lg transition-colors">Sign Out</button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gray-900 p-6">
        <Outlet />
      </main>
    </div>
  );
}
