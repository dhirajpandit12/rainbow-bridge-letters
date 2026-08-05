'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, clearToken } from '@/lib/auth';
import { fetchOrders, Order } from '@/lib/api';

const PAGE_SIZE = 25;

function statusColor(status: string) {
  if (status === 'completed') return 'bg-green-100 text-green-700';
  if (status === 'pending') return 'bg-amber-100 text-amber-700';
  if (status === 'processing') return 'bg-blue-100 text-blue-700';
  return 'bg-red-100 text-red-700';
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function OrdersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'rainbow' | 'soul'>('rainbow');
  const [orders, setOrders] = useState<{ rainbow: Order[]; soul: Order[] }>({ rainbow: [], soul: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/'); return; }
    try {
      const data = await fetchOrders(token);
      setOrders(data);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'Unauthorized') { clearToken(); router.push('/'); }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  // Reset page when tab or search changes
  useEffect(() => { setPage(1); }, [tab, search]);

  const filtered = (tab === 'rainbow' ? orders.rainbow : orders.soul).filter(o =>
    !search ||
    o.pet_name.toLowerCase().includes(search.toLowerCase()) ||
    o.email.toLowerCase().includes(search.toLowerCase()) ||
    o.owner_name.toLowerCase().includes(search.toLowerCase())
  );

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setPage(p => p + 1);
    }, { threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, visible.length]);

  function handleLogout() {
    clearToken();
    router.push('/');
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌈</span>
          <h1 className="text-lg font-semibold text-stone-800">Rainbow Bridge Admin</h1>
        </div>
        <button onClick={handleLogout} className="text-sm text-stone-500 hover:text-stone-800 transition-colors">Sign out</button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('rainbow')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${tab === 'rainbow' ? 'bg-rose-500 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}
            >
              Rainbow Bridge
              <span className="ml-2 text-xs opacity-70">({orders.rainbow.length})</span>
            </button>
            <button
              onClick={() => setTab('soul')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${tab === 'soul' ? 'bg-violet-500 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}
            >
              Soul Readings
              <span className="ml-2 text-xs opacity-70">({orders.soul.length})</span>
            </button>
          </div>
          <input
            placeholder="Search pet, email, name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 w-64"
          />
        </div>

        {loading ? (
          <div className="text-center text-stone-400 py-20">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-stone-400 py-20">No orders found</div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-stone-500 text-left">
                    <th className="px-5 py-3 font-medium">Pet</th>
                    <th className="px-5 py-3 font-medium">Owner</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order, i) => (
                    <tr
                      key={order.id}
                      className={`border-b border-stone-100 hover:bg-stone-50 transition-colors ${i === visible.length - 1 && !hasMore ? 'border-b-0' : ''}`}
                    >
                      <td className="px-5 py-3 font-medium text-stone-800">{order.pet_name}</td>
                      <td className="px-5 py-3 text-stone-600">{order.owner_name}</td>
                      <td className="px-5 py-3 text-stone-500">{order.email}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-stone-500 text-xs">{formatDate(order.created_at)}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => router.push(`/orders/${tab}/${order.id}`)}
                          className="text-xs px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div ref={sentinelRef} className="text-center py-6 text-stone-400 text-sm">
                Loading more...
              </div>
            )}

            {!hasMore && filtered.length > PAGE_SIZE && (
              <p className="text-center text-stone-400 text-xs mt-4">
                All {filtered.length} orders shown
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
