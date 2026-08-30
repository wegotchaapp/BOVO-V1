import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupportTickets, getSupportTicket, updateTicketStatus, getTicketMessages, addTicketMessage, getErrorMessage } from '../lib/api';
import { ErrorNotice, EmptyState } from '../components/QueryState';

interface SupportTicket {
  id: string;
  subject: string;
  requester_name: string;
  requester_role: string;
  requester_email?: string;
  requester_phone?: string;
  trip_id?: string;
  trip_origin?: string;
  trip_destination?: string;
  status: string;
  priority: string;
  created_at: string;
}

interface TicketMessage {
  id: string;
  author_type: string;
  author_name: string;
  internal: boolean;
  created_at: string;
  body: string;
}

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [detail, setDetail] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);
    getSupportTickets({ status: status || undefined, page })
      .then((r) => { setTickets(r.tickets); setTotal(r.total); })
      .catch((e: unknown) => setError(getErrorMessage(e, 'Could not load this data.')))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetch, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetch]);

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
      <h2 className="text-2xl font-bold text-ink mb-6">Support Tickets ({total})</h2>
      {msg && <div className="mb-4 px-4 py-2 bg-good/15 text-good rounded-lg text-sm">{msg}</div>}

      <div className="mb-4 flex gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="bg-card border border-border rounded-lg px-4 py-2 text-ink text-sm">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          {loading ? <div className="text-ink-soft">Loading...</div> : error ? (
            <ErrorNotice message={error} onRetry={fetch} />
          ) : tickets.length === 0 ? (
            <EmptyState title="No tickets match this status." body="Switch the status filter to see others." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ink-soft border-b border-border">
                    <th className="text-left py-3 px-2">Subject</th>
                    <th className="text-left py-3 px-2">Requester</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-left py-3 px-2">Priority</th>
                    <th className="text-left py-3 px-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} onClick={() => loadDetail(t.id)} className={`border-b border-border text-ink hover:bg-card cursor-pointer ${detail?.id === t.id ? 'bg-card' : ''}`}>
                      <td className="py-3 px-2">{t.subject}</td>
                      <td className="py-3 px-2 text-ink-soft">{t.requester_name}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${t.status === 'open' ? 'bg-good/15 text-good' : t.status === 'pending' ? 'bg-warning/15 text-warning' : 'bg-inset text-ink'}`}>{t.status}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${t.priority === 'urgent' ? 'bg-critical/15 text-critical' : t.priority === 'high' ? 'bg-warning/15 text-warning' : t.priority === 'normal' ? 'bg-info/15 text-info' : 'bg-inset text-ink'}`}>{t.priority}</span>
                      </td>
                      <td className="py-3 px-2 text-xs text-ink-soft">{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {tickets.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-ink-soft">No tickets found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-gold text-ground' : 'bg-card text-ink-soft hover:bg-inset'}`}>{p}</button>
              ))}
            </div>
          )}
        </div>

        {detail && (
          <div className="w-2/5 min-w-[400px] bg-card rounded-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-ink text-lg">{detail.subject}</h3>
                  <p className="text-xs text-ink-soft mt-1">{detail.requester_name} ({detail.requester_role})</p>
                </div>
                <button onClick={() => { setDetail(null); setMessages([]); }} className="text-ink-soft hover:text-ink text-xl leading-none">&times;</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => handleStatus(detail.id, 'resolved')} className="px-3 py-1 bg-good/20 text-good rounded text-xs hover:bg-good/30">Resolve</button>
                <button onClick={() => handleStatus(detail.id, 'open')} className="px-3 py-1 bg-info/20 text-info rounded text-xs hover:bg-info/30">Reopen</button>
                <span className={`ml-auto px-2 py-1 rounded text-xs ${detail.status === 'open' ? 'bg-good/15 text-good' : detail.status === 'pending' ? 'bg-warning/15 text-warning' : 'bg-inset text-ink'}`}>{detail.status}</span>
              </div>
              <div className="text-xs text-ink-soft mt-2 space-y-0.5">
                {detail.requester_email && <p>Email: {detail.requester_email}</p>}
                {detail.requester_phone && <p>Phone: {detail.requester_phone}</p>}
                {detail.trip_id && <p>Trip: {detail.trip_origin} → {detail.trip_destination}</p>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.author_type === 'agent' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                    m.internal ? 'bg-warning/15 border border-warning/40 text-warning' :
                    m.author_type === 'agent' ? 'bg-gold text-ground' :
                    m.author_type === 'system' ? 'bg-inset text-ink italic' :
                    'bg-inset text-ink'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">{m.author_name}</span>
                      {m.internal && <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">internal</span>}
                      <span className="text-xs text-ink-soft ml-auto">{new Date(m.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEnd} />
            </div>

            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-2 mb-2">
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  <input type="checkbox" checked={replyInternal} onChange={(e) => setReplyInternal(e.target.checked)} className="rounded border-border" />
                  Internal note (agent-only)
                </label>
              </div>
              <div className="flex gap-2">
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type your reply..." rows={2} className="flex-1 bg-inset border border-border rounded-lg px-3 py-2 text-ink text-sm resize-none" />
                <button onClick={sendReply} disabled={!replyText.trim()} className="px-4 py-2 bg-gold text-ground rounded-lg text-sm hover:bg-gold/90 disabled:opacity-50 self-end">Send</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
