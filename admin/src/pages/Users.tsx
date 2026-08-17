import { useState, useEffect } from 'react';
import { getUsers, suspendUser, unsuspendUser, banUser } from '../lib/api';
import { ErrorNotice, EmptyState } from '../components/QueryState';
import ConfirmDialog, { type ConfirmRequest } from '../components/ConfirmDialog';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  is_suspended: boolean;
  is_banned: boolean;
  is_verified: boolean;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ConfirmRequest | null>(null);
  const limit = 20;

  const fetch = () => {
    setLoading(true);
    setError(null);
    getUsers({ search: search || undefined, role: role || undefined, page, limit })
      .then((res) => { setUsers(res.users); setTotal(res.total); })
      .catch((e: any) => setError(e?.response?.data?.message || e?.message || 'Could not load this data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page, role]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetch();
  };

  // Suspend and ban are audited. The reason is required by the dialog rather
  // than defaulted to "No reason", which is what the old prompt() did whenever
  // someone hit OK on an empty box.
  const handleSuspend = (u: User) =>
    setDialog({
      title: `Suspend ${u.name || u.email}?`,
      body: 'They keep their account but cannot book or post until reinstated.',
      confirmLabel: 'Suspend',
      tone: 'critical',
      field: { kind: 'reason', placeholder: 'Why are they being suspended?' },
      onConfirm: async (reason) => {
        await suspendUser(u.id, reason);
        fetch();
      },
    });

  const handleUnsuspend = (u: User) =>
    setDialog({
      title: `Unsuspend ${u.name || u.email}?`,
      body: 'They regain full access immediately.',
      confirmLabel: 'Unsuspend',
      onConfirm: async () => {
        await unsuspendUser(u.id);
        fetch();
      },
    });

  const handleBan = (u: User) =>
    setDialog({
      title: `Ban ${u.name || u.email}?`,
      body: 'This is the strongest action available and is written to the audit log.',
      confirmLabel: 'Ban',
      tone: 'critical',
      field: { kind: 'reason', placeholder: 'Why are they being banned?' },
      onConfirm: async (reason) => {
        await banUser(u.id, reason);
        fetch();
      },
    });

  const pages = Math.ceil(total / limit);

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink mb-6">Users ({total})</h2>

      <form onSubmit={handleSearch} className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search name, email, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-card border border-border rounded-lg px-4 py-2 text-ink text-sm focus:outline-none focus:border-gold"
        />
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="bg-card border border-border rounded-lg px-4 py-2 text-ink text-sm">
          <option value="">All roles</option>
          <option value="rider">Rider</option>
          <option value="driver">Driver</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="bg-gold text-ground px-4 py-2 rounded-lg text-sm hover:bg-gold/90">Search</button>
      </form>

      {loading ? (
        <div className="text-ink-soft">Loading...</div>
      ) : error ? (
        <ErrorNotice message={error} onRetry={fetch} />
      ) : users.length === 0 ? (
        <EmptyState title="No users match this search." body="Clear the search or pick a different role." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-soft border-b border-border">
                  <th className="text-left py-3 px-2">Name</th>
                  <th className="text-left py-3 px-2">Email</th>
                  <th className="text-left py-3 px-2">Phone</th>
                  <th className="text-left py-3 px-2">Role</th>
                  <th className="text-left py-3 px-2">Verified</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-left py-3 px-2">Joined</th>
                  <th className="text-left py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border text-ink hover:bg-card">
                    <td className="py-3 px-2">{u.name || '—'}</td>
                    <td className="py-3 px-2">{u.email || '—'}</td>
                    <td className="py-3 px-2">{u.phone || '—'}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-inset text-ink' : u.role === 'driver' ? 'bg-good/15 text-good' : 'bg-info/15 text-info'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 text-xs ${u.is_verified ? 'text-good' : 'text-ink-soft'}`}>
                        {u.is_verified ? '✅' : '⏳'} {u.is_verified ? 'Verified' : 'Unverified'}
                        {!u.is_verified && u.is_email_verified && !u.is_phone_verified && <span className="text-warning">(email only)</span>}
                        {!u.is_verified && !u.is_email_verified && u.is_phone_verified && <span className="text-warning">(phone only)</span>}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {u.is_banned ? <span className="text-critical">Banned</span> : u.is_suspended ? <span className="text-warning">Suspended</span> : <span className="text-good">Active</span>}
                    </td>
                    <td className="py-3 px-2 text-ink-soft">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1">
                        {u.is_suspended ? (
                          <button onClick={() => handleUnsuspend(u)} className="px-2 py-1 bg-good/20 text-good rounded text-xs hover:bg-good/30">Unsuspend</button>
                        ) : (
                          <button onClick={() => handleSuspend(u)} className="px-2 py-1 bg-warning/20 text-warning rounded text-xs hover:bg-warning/30">Suspend</button>
                        )}
                        {!u.is_banned && (
                          <button onClick={() => handleBan(u)} className="px-2 py-1 bg-critical/20 text-critical rounded text-xs hover:bg-critical/30">Ban</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-gold text-ground' : 'bg-card text-ink-soft hover:bg-inset'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
