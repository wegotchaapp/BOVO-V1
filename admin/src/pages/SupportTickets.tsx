import { useState, useEffect, useRef } from 'react';
import { getSupportTickets, getSupportTicket, updateTicketStatus, getTicketMessages, addTicketMessage } from '../lib/api';

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const fetch = () => {
    setLoading(true);
    getSupportTickets({ status: status || undefined, page })
      .then((r) => { setTickets(r.tickets); setTotal(r.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page, status]);

  useEffect(() => {
    if (messagesEnd.current) messagesEnd.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pages = Math.ceil(total / 20);

  const handleStatus = async (id: string, newStatus: string) => {
    await updateTicketStatus(id, newStatus);
    setMsg(`Status updated to ${newStatus}`);
    fetch();
    if (detail?.id === id) {
      const r = await getSupportTicket(id);
      setDetail(r);
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const loadDetail = async (id: string) => {
    const r = await getSupportTicket(id);
    setDetail(r);
    const msgs = await getTicketMessages(id);
    setMessages(msgs);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !detail) return;
    const saved = await addTicketMessage(detail.id, {
      body: replyText,
      author_type: 'agent',
      author_name: 'Admin',
      internal: replyInternal,
    });
    setMessages([...messages, saved]);
    setReplyText('');
    if (detail.status === 'open') {
      await updateTicketStatus(detail.id, 'pending');
      setDetail({ ...detail, status: 'pending' });
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Support Tickets ({total})</h2>
      {msg && <div className="mb-4 px-4 py-2 bg-green-900/50 text-green-200 rounded-lg text-sm">{msg}</div>}

      <div className="mb-4 flex gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          {loading ? <div className="text-gray-400">Loading...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-3 px-2">Subject</th>
                    <th className="text-left py-3 px-2">Requester</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-left py-3 px-2">Priority</th>
                    <th className="text-left py-3 px-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t: any) => (
                    <tr key={t.id} onClick={() => loadDetail(t.id)} className={`border-b border-gray-800 text-white hover:bg-gray-800 cursor-pointer ${detail?.id === t.id ? 'bg-gray-750' : ''}`}>
                      <td className="py-3 px-2">{t.subject}</td>
                      <td className="py-3 px-2 text-gray-400">{t.requester_name}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'open' ? 'bg-green-900 text-green-200' : t.status === 'pending' ? 'bg-yellow-900 text-yellow-200' : 'bg-gray-700 text-gray-200'}`}>{t.status}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${t.priority === 'urgent' ? 'bg-red-900 text-red-200' : t.priority === 'high' ? 'bg-orange-900 text-orange-200' : t.priority === 'normal' ? 'bg-blue-900 text-blue-200' : 'bg-gray-700 text-gray-200'}`}>{t.priority}</span>
                      </td>
                      <td className="py-3 px-2 text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {tickets.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-500">No tickets found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{p}</button>
              ))}
            </div>
          )}
        </div>

        {detail && (
          <div className="w-2/5 min-w-[400px] bg-gray-800 rounded-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-white text-lg">{detail.subject}</h3>
                  <p className="text-xs text-gray-400 mt-1">{detail.requester_name} ({detail.requester_role})</p>
                </div>
                <button onClick={() => { setDetail(null); setMessages([]); }} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => handleStatus(detail.id, 'resolved')} className="px-3 py-1 bg-green-700 text-white rounded text-xs hover:bg-green-600">Resolve</button>
                <button onClick={() => handleStatus(detail.id, 'open')} className="px-3 py-1 bg-blue-700 text-white rounded text-xs hover:bg-blue-600">Reopen</button>
                <span className={`ml-auto px-2 py-1 rounded text-xs ${detail.status === 'open' ? 'bg-green-900 text-green-200' : detail.status === 'pending' ? 'bg-yellow-900 text-yellow-200' : 'bg-gray-700 text-gray-200'}`}>{detail.status}</span>
              </div>
              <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                {detail.requester_email && <p>Email: {detail.requester_email}</p>}
                {detail.requester_phone && <p>Phone: {detail.requester_phone}</p>}
                {detail.trip_id && <p>Trip: {detail.trip_origin} → {detail.trip_destination}</p>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
              {messages.map((m: any) => (
                <div key={m.id} className={`flex ${m.author_type === 'agent' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                    m.internal ? 'bg-yellow-900/40 border border-yellow-700/50 text-yellow-200' :
                    m.author_type === 'agent' ? 'bg-indigo-700 text-white' :
                    m.author_type === 'system' ? 'bg-gray-700 text-gray-300 italic' :
                    'bg-gray-700 text-white'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">{m.author_name}</span>
                      {m.internal && <span className="text-xs bg-yellow-700 px-1.5 py-0.5 rounded">internal</span>}
                      <span className="text-xs text-gray-400 ml-auto">{new Date(m.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEnd} />
            </div>

            <div className="p-4 border-t border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 text-xs text-gray-400">
                  <input type="checkbox" checked={replyInternal} onChange={(e) => setReplyInternal(e.target.checked)} className="rounded border-gray-600" />
                  Internal note (agent-only)
                </label>
              </div>
              <div className="flex gap-2">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type your reply..." rows={2} className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm resize-none" />
                <button onClick={sendReply} disabled={!replyText.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500 disabled:opacity-50 self-end">Send</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
