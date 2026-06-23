import { useState } from 'react';
import { broadcastNotification } from '../lib/api';

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [role, setRole] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) { setError('Title and body are required'); return; }
    setSending(true); setError(''); setResult(null);
    try {
      const r = await broadcastNotification(title, body, role || undefined);
      setResult(r);
      setTitle(''); setBody('');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to send');
    }
    setSending(false);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Broadcast Notification</h2>

      {error && <div className="mb-4 px-4 py-2 bg-red-900/50 text-red-200 rounded-lg text-sm">{error}</div>}
      {result && <div className="mb-4 px-4 py-2 bg-green-900/50 text-green-200 rounded-lg text-sm">Sent to {result.recipientCount} users</div>}

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="e.g. System Update" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Body</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Message content..." />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Target Role (optional)</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm">
              <option value="">All users</option>
              <option value="rider">Riders only</option>
              <option value="driver">Drivers only</option>
              <option value="admin">Admins only</option>
            </select>
          </div>
        </div>
        <button onClick={handleSend} disabled={sending} className="mt-6 bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
          {sending ? 'Sending...' : 'Send Broadcast'}
        </button>
      </div>
    </div>
  );
}
