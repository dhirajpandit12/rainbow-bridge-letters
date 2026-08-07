'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setToken, getToken } from '@/lib/auth';
import { fetchOrders } from '@/lib/api';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (token) {
      fetchOrders(token, 'all')
        .then(() => router.push('/orders'))
        .catch(() => {});
    }
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await fetchOrders(password, 'all');
      setToken(password);
      router.push('/orders');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg === 'Unauthorized' ? 'Wrong password' : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🐾</div>
          <h1 className="text-xl font-bold text-stone-800">Heal Your Inner Peace</h1>
          <p className="text-sm text-stone-400 mt-0.5">Pet Readings Admin</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 bg-stone-50 focus:bg-white transition-colors"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
