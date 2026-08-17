import { useState, useEffect, useCallback } from 'react';
import { getConfig, updateConfig } from '../lib/api';
import { ErrorNotice } from '../components/QueryState';

const FIELDS = [
  { key: 'irs_mileage_rate', label: 'IRS Mileage Rate ($)', type: 'number', step: '0.01' },
  { key: 'platform_fee_percent', label: 'Platform Fee (%)', type: 'number', step: '0.1' },
  { key: 'min_trip_price', label: 'Min Trip Price ($)', type: 'number', step: '0.5' },
  { key: 'max_trip_distance_km', label: 'Max Trip Distance (km)', type: 'number', step: '10' },
  { key: 'free_trial_days', label: 'Free Trial Duration (days)', type: 'number', step: '1' },
  { key: 'sos_auto_escalate_minutes', label: 'SOS Auto-Escalate (min)', type: 'number', step: '1' },
  { key: 'max_active_bookings', label: 'Max Active Bookings', type: 'number', step: '1' },
];

export default function SystemConfigPage() {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Named so the error state has something to retry with.
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getConfig()
      .then(setConfig)
      .catch((e: any) =>
        setError(e?.response?.data?.message || e?.message || 'Could not load the configuration.'),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const result = await updateConfig(config);
      setConfig(result);
      setMsg('Saved successfully');
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Save failed');
    }
    setSaving(false);
  };

  if (loading) return <div className="text-ink-soft">Loading...</div>;
  if (error) return <ErrorNotice message={error} onRetry={load} />;

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink mb-6">System Configuration</h2>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${msg.includes('fail') ? 'bg-critical/15 text-critical' : 'bg-good/15 text-good'}`}>
          {msg}
        </div>
      )}

      <div className="bg-card rounded-lg border border-border p-6 max-w-lg">
        <div className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-sm text-ink-soft mb-1">{f.label}</label>
              <input
                type={f.type} step={f.step}
                value={config[f.key] ?? ''}
                onChange={(e) => setConfig({ ...config, [f.key]: parseFloat(e.target.value) || e.target.value })}
                className="w-full bg-inset border border-border rounded-lg px-4 py-2 text-ink text-sm focus:outline-none focus:border-gold"
              />
            </div>
          ))}
        </div>
        <button onClick={handleSave} disabled={saving} className="mt-6 bg-gold text-ground px-6 py-2 rounded-lg text-sm hover:bg-gold/90 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
