import { useState, useEffect } from 'react';
import { getVehicleReviewQueue, reviewMobileVehicle } from '../lib/api';

/**
 * The queue that stands behind the promise Sailors are given — that somebody
 * looks at a vehicle before they ride in it. A Voyager cannot post an adventure
 * until a vehicle here is approved.
 *
 * This is the mobile fleet (`mobile_vehicles`), which is a different table from
 * the one Driver Documents works on.
 */

const PHOTO_SLOTS = ['front', 'rear', 'left', 'right', 'interior'] as const;

export default function VehicleReviewPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [status, setStatus] = useState('pending_review');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = (s = status) => {
    setLoading(true);
    getVehicleReviewQueue(s)
      .then((d) => setVehicles(d.vehicles ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(status); }, [status]);

  const decide = async (id: string, approved: boolean) => {
    const note = (notes[id] ?? '').trim();
    if (!approved && !note) {
      setMsg('A rejection needs a reason — the Voyager sees it.');
      setTimeout(() => setMsg(''), 4000);
      return;
    }
    setBusy(id);
    try {
      await reviewMobileVehicle(id, approved, note || undefined);
      setMsg(approved ? 'Vehicle approved — the Voyager can post now.' : 'Vehicle rejected.');
      setNotes((n) => ({ ...n, [id]: '' }));
      load(status);
    } catch (e: any) {
      setMsg(e?.response?.data?.message ?? 'Could not save that decision.');
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Vehicle Review</h2>
          <p className="text-sm text-gray-400 mt-1">
            A Voyager cannot post an adventure until their vehicle is approved here.
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="incomplete">Incomplete</option>
        </select>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2 bg-green-900/50 text-green-200 rounded-lg text-sm">{msg}</div>
      )}

      {loading ? (
        <div className="text-gray-400">Loading…</div>
      ) : vehicles.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
          Nothing {status.replace('_', ' ')}.
        </div>
      ) : (
        <div className="space-y-4">
          {vehicles.map((v) => (
            <div key={v.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-white font-semibold">
                    {v.color} {v.make} {v.model} · {v.year}
                  </div>
                  <div className="text-sm text-gray-400">
                    {v.ownerName ?? 'Unknown Voyager'}
                    {v.ownerEmail ? ` · ${v.ownerEmail}` : ''}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {v.licensePlate} ({v.state}) · VIN {v.vin} · {v.seatCount} seats · {v.doorCount} doors
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-xs bg-yellow-900 text-yellow-200">
                  {v.verificationStatus}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {PHOTO_SLOTS.map((slot) => (
                  <a
                    key={slot}
                    href={v.photos?.[slot] ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className={`text-xs px-2 py-1 rounded border ${
                      v.photos?.[slot]
                        ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
                        : 'border-gray-800 text-gray-600 pointer-events-none'
                    }`}
                  >
                    {slot}
                  </a>
                ))}
                {(['insurance', 'registration'] as const).map((doc) => (
                  <a
                    key={doc}
                    href={v[doc]?.url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className={`text-xs px-2 py-1 rounded border ${
                      v[doc]?.url
                        ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
                        : 'border-gray-800 text-gray-600 pointer-events-none'
                    }`}
                  >
                    {doc}
                    {v[doc]?.expiresAt ? ` · exp ${v[doc].expiresAt}` : ''}
                  </a>
                ))}
              </div>

              {v.verificationNote && (
                <div className="text-xs text-gray-400 mb-3">
                  Previous note: {v.verificationNote}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={notes[v.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [v.id]: e.target.value }))}
                  placeholder="Reason (required to reject — the Voyager sees this)"
                  className="flex-1 min-w-[220px] bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  disabled={busy === v.id}
                  onClick={() => decide(v.id, true)}
                  className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busy === v.id}
                  onClick={() => decide(v.id, false)}
                  className="px-4 py-2 rounded-lg bg-red-800 hover:bg-red-700 text-white text-sm disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
