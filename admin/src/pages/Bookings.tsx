import { useState, useEffect } from 'react';
import { getBookings } from '../lib/api';

interface Booking {
  id: string;
  status: string;
  seats_booked: number;
  total_price: number;
  pickup_location: string;
  trip: { origin_location: string; destination_location: string };
  rider: { name: string; email: string };
  created_at: string;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    setLoading(true);
    getBookings({ status: status || undefined, page })
      .then((res) => { setBookings(res.bookings); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [page, status]);

  const pages = Math.ceil(total / 20);

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Bookings ({total})</h2>

      <div className="mb-4">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="en_route">En Route</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-3 px-2">Rider</th>
                  <th className="text-left py-3 px-2">From</th>
                  <th className="text-left py-3 px-2">To</th>
                  <th className="text-left py-3 px-2">Seats</th>
                  <th className="text-left py-3 px-2">Total</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-left py-3 px-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-gray-800 text-white hover:bg-gray-800">
                    <td className="py-3 px-2">{b.rider?.name || '—'}</td>
                    <td className="py-3 px-2 max-w-[120px] truncate">{b.pickup_location || b.trip?.origin_location || '—'}</td>
                    <td className="py-3 px-2 max-w-[120px] truncate">{b.trip?.destination_location || '—'}</td>
                    <td className="py-3 px-2">{b.seats_booked}</td>
                    <td className="py-3 px-2">${b.total_price?.toFixed(2)}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        b.status === 'confirmed' ? 'bg-green-900 text-green-200' :
                        b.status === 'en_route' ? 'bg-blue-900 text-blue-200' :
                        b.status === 'completed' ? 'bg-emerald-900 text-emerald-200' :
                        b.status === 'cancelled' ? 'bg-red-900 text-red-200' :
                        'bg-yellow-900 text-yellow-200'
                      }`}>{b.status}</span>
                    </td>
                    <td className="py-3 px-2 text-gray-400">{new Date(b.created_at).toLocaleDateString()}</td>
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
