import { useState, useEffect, useCallback } from 'react';
import { getErrorMessage, getVehicleReviewQueue, reviewMobileVehicle } from '../lib/api';

/**
 * The queue that stands behind the promise Sailors are given — that somebody
 * looks at a vehicle before they ride in it. A Voyager cannot post an adventure
 * until a vehicle here is approved.
 *
 * This is the mobile fleet (`mobile_vehicles`), which is a different table from
 * the one Driver Documents works on.
 */

const PHOTO_SLOTS = ['front', 'rear', 'left', 'right', 'interior'] as const;

type PhotoSlot = typeof PHOTO_SLOTS[number];

interface VehicleDocument {
  url?: string;
  expiresAt?: string;
}

interface ReviewVehicle {
  id: string;
  color?: string;
  make?: string;
  model?: string;
  year?: number;
  ownerName?: string;
  ownerEmail?: string;
  licensePlate?: string;
  state?: string;
  vin?: string;
  seatCount?: number;
  doorCount?: number;
  verificationStatus?: string;
  verificationNote?: string;
  photos?: Partial<Record<PhotoSlot, string>>;
  insurance?: VehicleDocument;
  registration?: VehicleDocument;
}

export default function VehicleReviewPage() {
  const [vehicles, setVehicles] = useState<ReviewVehicle[]>([]);
  const [status, setStatus] = useState('pending_review');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback((s = status) => {
    setLoading(true);
    getVehicleReviewQueue(s)
      .then((d) => setVehicles(d.vehicles ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(load, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

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
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, 'Could not save that decision.'));
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-ink">Vehicle Review</h2>
          <p className="text-sm text-ink-soft mt-1">
            A Voyager cannot post an adventure until their vehicle is approved here.
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-inset border border-border text-ink rounded-lg px-3 py-2 text-sm"
        >
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="incomplete">Incomplete</option>
        </select>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2 bg-good/15 text-good rounded-lg text-sm">{msg}</div>
      )}

      {loading ? (
        <div className="text-ink-soft">Loading…</div>
      ) : vehicles.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-ink-soft">
          Nothing {status.replace('_', ' ')}.
        </div>
      ) : (
        <div className="space-y-4">
          {vehicles.map((v) => (
            <div key={v.id} className="bg-card rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-ink font-semibold">
                    {v.color} {v.make} {v.model} · {v.year}
                  </div>
                  <div className="text-sm text-ink-soft">
                    {v.ownerName ?? 'Unknown Voyager'}
                    {v.ownerEmail ? ` · ${v.ownerEmail}` : ''}
                  </div>
                  <div className="text-xs text-ink-soft mt-1">
                    {v.licensePlate} ({v.state}) · VIN {v.vin} · {v.seatCount} seats · {v.doorCount} doors
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-xs bg-warning/15 text-warning">
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
                        ? 'border-border text-ink hover:bg-inset'
                        : 'border-border/40 text-ink-faint pointer-events-none'
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
                        ? 'border-border text-ink hover:bg-inset'
                        : 'border-border/40 text-ink-faint pointer-events-none'
                    }`}
                  >
                    {doc}
                    {v[doc]?.expiresAt ? ` · exp ${v[doc].expiresAt}` : ''}
                  </a>
                ))}
              </div>

              {v.verificationNote && (
                <div className="text-xs text-ink-soft mb-3">
                  Previous note: {v.verificationNote}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={notes[v.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [v.id]: e.target.value }))}
                  placeholder="Reason (required to reject — the Voyager sees this)"
                  className="flex-1 min-w-[220px] bg-inset border border-border text-ink rounded-lg px-3 py-2 text-sm"
                />
                <button
                  disabled={busy === v.id}
                  onClick={() => decide(v.id, true)}
                  className="px-4 py-2 rounded-lg bg-good hover:bg-good/85 text-ground font-medium text-sm disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={busy === v.id}
                  onClick={() => decide(v.id, false)}
                  className="px-4 py-2 rounded-lg bg-critical hover:bg-critical/85 text-ground font-medium text-sm disabled:opacity-50"
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
