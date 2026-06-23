import { useState, useEffect } from 'react';
import { getSupportAgents, createSupportAgent, toggleSupportAgent } from '../lib/api';

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' });

  const fetch = () => {
    setLoading(true);
    getSupportAgents().then(setAgents).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) { setMsg('All fields required'); setTimeout(() => setMsg(''), 3000); return; }
    try {
      await createSupportAgent(form);
      setMsg('Agent created');
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'agent' });
      fetch();
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Failed to create agent');
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleToggle = async (id: string, active: boolean) => {
    await toggleSupportAgent(id, active);
    setMsg(active ? 'Agent enabled' : 'Agent disabled');
    fetch();
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Support Agents ({agents.length})</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500">
          {showForm ? 'Cancel' : '+ Add Agent'}
        </button>
      </div>

      {msg && <div className="mb-4 px-4 py-2 bg-green-900/50 text-green-200 rounded-lg text-sm">{msg}</div>}

      {showForm && (
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-4 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" type="password" className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm">
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button onClick={handleCreate} className="mt-3 px-4 py-2 bg-green-700 text-white rounded text-sm hover:bg-green-600">Create Agent</button>
        </div>
      )}

      {loading ? <div className="text-gray-400">Loading...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-3 px-2">Name</th>
                <th className="text-left py-3 px-2">Email</th>
                <th className="text-left py-3 px-2">Role</th>
                <th className="text-left py-3 px-2">Created</th>
                <th className="text-left py-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a: any) => (
                <tr key={a.id} className="border-b border-gray-800 text-white hover:bg-gray-800">
                  <td className="py-3 px-2">{a.name}</td>
                  <td className="py-3 px-2 text-gray-400">{a.email}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${a.role === 'admin' ? 'bg-purple-900 text-purple-200' : 'bg-blue-900 text-blue-200'}`}>{a.role}</span>
                  </td>
                  <td className="py-3 px-2 text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="py-3 px-2 flex gap-2">
                    <button onClick={() => handleToggle(a.id, true)} className="px-2 py-1 bg-green-700 text-white rounded text-xs hover:bg-green-600">Enable</button>
                    <button onClick={() => handleToggle(a.id, false)} className="px-2 py-1 bg-red-700 text-white rounded text-xs hover:bg-red-600">Disable</button>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-500">No agents found. Create one to get started.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
