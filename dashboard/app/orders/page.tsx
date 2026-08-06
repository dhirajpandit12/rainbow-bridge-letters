'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, clearToken } from '@/lib/auth';
import { fetchOrders, Order } from '@/lib/api';

const PAGE_SIZE = 25;
const STATUS_FILTERS = ['all', 'completed', 'pending', 'processing', 'failed'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

function statusColor(status: string) {
  if (status === 'completed') return 'bg-green-100 text-green-700';
  if (status === 'pending') return 'bg-amber-100 text-amber-700';
  if (status === 'processing') return 'bg-blue-100 text-blue-700';
  return 'bg-red-100 text-red-700';
}

function statusBucket(status: string): StatusFilter {
  if (status === 'completed' || status === 'pending' || status === 'processing') return status;
  return 'failed';
}

function formatDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const sameDay = date.toDateString() === now.toDateString();
  const yest = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();
  if (sameDay) return `Today, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  if (yest) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name: string) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

export default function OrdersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'rainbow' | 'soul'>('rainbow');
  const [orders, setOrders] = useState<{ rainbow: Order[]; soul: Order[] }>({ rainbow: [], soul: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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
  useEffect(() => { setPage(1); }, [tab, search, statusFilter]);

  const current = tab === 'rainbow' ? orders.rainbow : orders.soul;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: current.length, completed: 0, pending: 0, processing: 0, failed: 0 };
    current.forEach(o => { c[statusBucket(o.status)]++; });
    return c;
  }, [current]);

  const filtered = current.filter(o => {
    if (statusFilter !== 'all') {
      const b = statusBucket(o.status);
      const match = statusFilter === 'pending' ? (b === 'pending' || b === 'processing') : b === statusFilter;
      if (!match) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return o.pet_name.toLowerCase().includes(q) || o.email.toLowerCase().includes(q) || o.owner_name.toLowerCase().includes(q);
  });

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setPage(p => p + 1);
    }, { threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, visible.length]);

  const accentDot = tab === 'rainbow' ? 'bg-rose-400' : 'bg-violet-400';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-stone-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌈</span>
          <h1 className="text-base font-semibold text-stone-800">Rainbow Bridge Admin</h1>
        </div>
        <button onClick={() => { clearToken(); router.push('/'); }} className="text-xs text-stone-400 hover:text-stone-700">Sign out</button>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Product tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('rainbow')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'rainbow' ? 'bg-rose-500 text-white shadow-sm' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}
          >
            🌈 Rainbow Bridge <span className="opacity-70">{orders.rainbow.length}</span>
          </button>
          <button
            onClick={() => setTab('soul')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'soul' ? 'bg-violet-500 text-white shadow-sm' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'}`}
          >
            ✨ Soul Readings <span className="opacity-70">{orders.soul.length}</span>
          </button>
        </div>

        {/* Stat cards double as filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          {([
            { key: 'all', label: 'Total', value: counts.all, tint: 'text-stone-800', ring: 'ring-stone-800' },
            { key: 'completed', label: 'Completed', value: counts.completed, tint: 'text-green-600', ring: 'ring-green-500' },
            { key: 'pending', label: 'Pending', value: counts.pending + counts.processing, tint: 'text-amber-600', ring: 'ring-amber-500' },
            { key: 'failed', label: 'Failed', value: counts.failed, tint: 'text-red-500', ring: 'ring-red-500' },
          ] as const).map(s => {
            const active = statusFilter === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`text-left bg-white rounded-xl border px-4 py-3 transition-all ${active ? `ring-2 ${s.ring} border-transparent` : 'border-stone-200 hover:border-stone-300'}`}
              >
                <p className="text-[11px] uppercase tracking-wide text-stone-400">{s.label}</p>
                <p className={`text-2xl font-semibold mt-0.5 ${s.tint}`}>{s.value}</p>
              </button>
            );
          })}
        </div>

        {/* Search + processing note */}
        <div className="flex items-center gap-3 mb-4">
          {counts.processing > 0 && statusFilter !== 'pending' && (
            <button onClick={() => setStatusFilter('pending')} className="text-xs text-blue-500 hover:underline shrink-0">
              {counts.processing} processing
            </button>
          )}
          <div className="relative w-full lg:max-w-xs lg:ml-auto">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">⌕</span>
            <input
              placeholder="Search pet, email, name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center text-stone-400 py-24">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-stone-400 py-24">
            <p className="text-4xl mb-2">🔍</p>
            <p>No orders found</p>
          </div>
        ) : (
          <>
            {/* Result count */}
            {(search || statusFilter !== 'all') && (
              <p className="text-xs text-stone-400 mb-2">
                {filtered.length} matching order{filtered.length !== 1 ? 's' : ''}
              </p>
            )}

            {/* Desktop table */}
            <div className="hidden sm:block bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50/60 border-b border-stone-100 text-stone-400 text-left text-xs uppercase tracking-wide">
                    <th className="px-5 py-2.5 font-medium">Pet</th>
                    <th className="px-5 py-2.5 font-medium">Owner</th>
                    <th className="px-5 py-2.5 font-medium">Email</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 font-medium">Date</th>
                    <th className="px-5 py-2.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order, i) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/orders/${tab}/${order.id}`)}
                      className={`cursor-pointer border-b border-stone-100 hover:bg-stone-50 transition-colors ${i === visible.length - 1 && !hasMore ? 'border-b-0' : ''}`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-7 h-7 rounded-full ${accentDot} text-white text-xs flex items-center justify-center font-medium shrink-0`}>
                            {initials(order.pet_name)}
                          </span>
                          <span className="font-medium text-stone-800">{order.pet_name}</span>
                          {order.correction_note && (
                            <span title="Has correction note" className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded font-medium">edited</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-stone-600">{order.owner_name}</td>
                      <td className="px-5 py-3 text-stone-500">{order.email}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(order.status)}`}>{statusBucket(order.status)}</span>
                      </td>
                      <td className="px-5 py-3 text-stone-500 text-xs">{formatDate(order.created_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg font-medium">View →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {visible.map(order => (
                <button
                  key={order.id}
                  onClick={() => router.push(`/orders/${tab}/${order.id}`)}
                  className="w-full bg-white rounded-xl border border-stone-200 px-4 py-3 text-left flex items-center gap-3 active:bg-stone-50"
                >
                  <span className={`w-9 h-9 rounded-full ${accentDot} text-white text-sm flex items-center justify-center font-medium shrink-0`}>
                    {initials(order.pet_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-800 text-sm truncate">{order.pet_name}</p>
                    <p className="text-xs text-stone-400 truncate">{order.owner_name} · {order.email}</p>
                    <p className="text-xs text-stone-300 mt-0.5">{formatDate(order.created_at)}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColor(order.status)}`}>{statusBucket(order.status)}</span>
                </button>
              ))}
            </div>

            {hasMore && <div ref={sentinelRef} className="text-center py-6 text-stone-400 text-sm">Loading more...</div>}
            {!hasMore && filtered.length > PAGE_SIZE && <p className="text-center text-stone-300 text-xs mt-4">All {filtered.length} orders shown</p>}
          </>
        )}
      </div>
    </div>
  );
}
