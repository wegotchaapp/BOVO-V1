import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage, login } from '../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Login failed. Check credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ground flex items-center justify-center p-4">
      <div className="bg-card rounded-xl p-8 w-full max-w-sm border border-border">
        <h1 className="text-2xl font-bold text-ink text-center mb-2">Bovogo Admin</h1>
        <p className="text-ink-soft text-sm text-center mb-6">Sign in to manage your platform</p>

        {error && (
          <div className="bg-critical/15 border border-critical/40 text-critical px-4 py-2 rounded-lg text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-ink-soft mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-inset border border-border rounded-lg px-4 py-2 text-ink text-sm focus:outline-none focus:border-gold"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-ink-soft mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-inset border border-border rounded-lg px-4 py-2 text-ink text-sm focus:outline-none focus:border-gold"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-ground py-2 rounded-lg text-sm font-medium hover:bg-gold/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
