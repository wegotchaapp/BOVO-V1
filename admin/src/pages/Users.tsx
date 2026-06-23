import { useState, useEffect } from 'react';
import { getUsers, suspendUser, unsuspendUser, banUser } from '../lib/api';

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
  const limit = 20;

  const fetch = () => {
    setLoading(true);
    getUsers({ search: search || undefined, role: role || undefined, page, limit })
      .then((res) => { setUsers(res.users); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page, role]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetch();
  };

  const handleSuspend = async (id: string) => {
    const reason = prompt('Reason for suspension:');
    if (reason === null) return;
    await suspendUser(id, reason || 'No reason');
    fetch();
  };

  const handleUnsuspend = async (id: string) => {
    if (!confirm('Unsuspend this user?')) return;
    await unsuspendUser(id);
    fetch();
  };

  const handleBan = async (id: string) => {
    const reason = prompt('Reason for ban:');
    if (reason === null) return;
    await banUser(id, reason || 'No reason');
    fetch();
  };

  const pages = Math.ceil(total / limit);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Users ({total})</h2>

      <form onSubmit={handleSearch} className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search name, email, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
          <option value="">All roles</option>
          <option value="rider">Rider</option>
          <option value="driver">Driver</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">Search</button>
      </form>

      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
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
                  <tr key={u.id} className="border-b border-gray-800 text-white hover:bg-gray-800">
                    <td className="py-3 px-2">{u.name || '—'}</td>
                    <td className="py-3 px-2">{u.email || '—'}</td>
                    <td className="py-3 px-2">{u.phone || '—'}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-purple-900 text-purple-200' : u.role === 'driver' ? 'bg-green-900 text-green-200' : 'bg-blue-900 text-blue-200'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1 text-xs ${u.is_verified ? 'text-green-400' : 'text-gray-500'}`}>
                        {u.is_verified ? '✅' : '⏳'} {u.is_verified ? 'Verified' : 'Unverified'}
                        {!u.is_verified && u.is_email_verified && !u.is_phone_verified && <span className="text-yellow-400">(email only)</span>}
                        {!u.is_verified && !u.is_email_verified && u.is_phone_verified && <span className="text-yellow-400">(phone only)</span>}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {u.is_banned ? <span className="text-red-400">Banned</span> : u.is_suspended ? <span className="text-yellow-400">Suspended</span> : <span className="text-green-400">Active</span>}
                    </td>
                    <td className="py-3 px-2 text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1">
                        {u.is_suspended ? (
                          <button onClick={() => handleUnsuspend(u.id)} className="px-2 py-1 bg-green-700 text-white rounded text-xs hover:bg-green-600">Unsuspend</button>
                        ) : (
                          <button onClick={() => handleSuspend(u.id)} className="px-2 py-1 bg-yellow-700 text-white rounded text-xs hover:bg-yellow-600">Suspend</button>
                        )}
                        {!u.is_banned && (
                          <button onClick={() => handleBan(u.id)} className="px-2 py-1 bg-red-700 text-white rounded text-xs hover:bg-red-600">Ban</button>
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
                <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
