'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, clearToken } from '@/lib/auth';
import { fetchOrders, Order } from '@/lib/api';
import Sidebar from '@/app/components/Sidebar';

const PAGE_SIZE = 25;
const STATUS_FILTERS = ['all', 'completed', 'pending', 'processing', 'failed'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

function statusStyle(status: string) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100';
  if (status === 'pending') return 'bg-amber-50 text-amber-600 ring-1 ring-amber-100';
  if (status === 'processing') return 'bg-sky-50 text-sky-600 ring-1 ring-sky-100';
  return 'bg-red-50 text-red-600 ring-1 ring-red-100';
}

function statusBucket(status: string): StatusFilter {
  if (status === 'completed' || status === 'pending' || status === 'processing') return status;
  return 'failed';
}

function formatDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (date.toDateString() === now.toDateString()) return `Today, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  if (new Date(now.getTime() - 86400000).toDateString() === date.toDateString()) return 'Yesterday';
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

  const accentDot = tab === 'rainbow' ? 'bg-rose-500' : 'bg-violet-500';

  const stats = [
    { key: 'all' as const, label: 'Total orders', value: counts.all, accent: 'text-stone-900', ring: 'ring-stone-900' },
    { key: 'completed' as const, label: 'Completed', value: counts.completed, accent: 'text-emerald-600', ring: 'ring-emerald-500' },
    { key: 'pending' as const, label: 'Pending', value: counts.pending + counts.processing, accent: 'text-amber-600', ring: 'ring-amber-500' },
    { key: 'failed' as const, label: 'Failed', value: counts.failed, accent: 'text-red-500', ring: 'ring-red-500' },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar active={tab} onNavigate={setTab} />

      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-stone-200 px-4 sm:px-8 py-3 sm:py-4">
          {/* Desktop */}
          <div className="hidden lg:flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-stone-900">{tab === 'rainbow' ? 'Rainbow Bridge' : 'Soul Readings'}</h1>
              <p className="text-xs text-stone-400 mt-0.5">{current.length} total orders</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-72">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">⌕</span>
                <input
                  placeholder="Search pet, email, name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 bg-stone-50 focus:bg-white transition-colors"
                />
              </div>
              <button onClick={() => router.push('/orders/new')} className="shrink-0 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-sm font-semibold transition-colors">＋ New Reading</button>
            </div>
          </div>

          {/* Mobile */}
          <div className="lg:hidden">
            <div className="flex items-center justify-between mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Heal Your Inner Peace" className="h-7 w-auto" />
              <div className="flex items-center gap-2">
                <button onClick={() => router.push('/orders/new')} className="text-xs bg-stone-900 text-white px-3 py-1.5 rounded-lg font-medium">＋ New</button>
                <button onClick={() => { clearToken(); router.push('/'); }} className="text-xs text-stone-400 hover:text-stone-700 px-1 py-1">Sign out</button>
              </div>
            </div>
            {/* Segmented tabs */}
            <div className="flex bg-stone-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => setTab('rainbow')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'rainbow' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
              >
                🌈 Rainbow
              </button>
              <button
                onClick={() => setTab('soul')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'soul' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
              >
                ✨ Soul
              </button>
            </div>
          </div>
        </header>

        <div className="px-5 sm:px-8 py-6 max-w-6xl">
          {/* Mobile search */}
          <div className="relative sm:hidden mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">⌕</span>
            <input
              placeholder="Search pet, email, name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 bg-white"
            />
          </div>

          {/* Stat cards double as filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {stats.map(s => {
              const active = statusFilter === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className={`text-left bg-white rounded-xl border px-4 py-3.5 transition-all ${active ? `ring-2 ${s.ring} border-transparent shadow-sm` : 'border-stone-200 hover:border-stone-300 hover:shadow-sm'}`}
                >
                  <p className="text-[11px] uppercase tracking-wide text-stone-400 font-medium">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
                </button>
              );
            })}
          </div>

          {(search || statusFilter !== 'all') && !loading && (
            <p className="text-xs text-stone-400 mb-2">{filtered.length} matching order{filtered.length !== 1 ? 's' : ''}</p>
          )}

          {loading ? (
            <div className="text-center text-stone-400 py-24 text-sm">Loading orders…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-stone-400 py-24">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm">No orders found</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-100 text-stone-400 text-left text-[11px] uppercase tracking-wider">
                      <th className="px-5 py-3 font-semibold">Pet</th>
                      <th className="px-5 py-3 font-semibold">Owner</th>
                      <th className="px-5 py-3 font-semibold">Email</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((order, i) => (
                      <tr
                        key={order.id}
                        onClick={() => router.push(`/orders/${tab}/${order.id}`)}
                        className={`cursor-pointer hover:bg-stone-50 transition-colors ${i !== visible.length - 1 ? 'border-b border-stone-100' : ''}`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full ${accentDot} text-white text-xs flex items-center justify-center font-semibold shrink-0`}>
                              {initials(order.pet_name)}
                            </span>
                            <span className="font-semibold text-stone-800">{order.pet_name}</span>
                            {order.correction_note && (
                              <span title="Edited / corrected" className="text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-500 rounded font-medium ring-1 ring-sky-100">edited</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-stone-600">{order.owner_name}</td>
                        <td className="px-5 py-3 text-stone-500">{order.email}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle(order.status)}`}>{statusBucket(order.status)}</span>
                        </td>
                        <td className="px-5 py-3 text-stone-400 text-xs whitespace-nowrap">{formatDate(order.created_at)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-xs px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg font-medium">View →</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-2.5">
                {visible.map(order => (
                  <button
                    key={order.id}
                    onClick={() => router.push(`/orders/${tab}/${order.id}`)}
                    className="w-full bg-white rounded-xl border border-stone-200 px-4 py-3.5 text-left flex items-center gap-3 active:bg-stone-50 shadow-sm"
                  >
                    <span className={`w-10 h-10 rounded-full ${accentDot} text-white text-sm flex items-center justify-center font-semibold shrink-0`}>
                      {initials(order.pet_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-stone-800 text-sm truncate">{order.pet_name}</p>
                        {order.correction_note && <span className="text-[9px] px-1 py-0.5 bg-sky-50 text-sky-500 rounded font-medium shrink-0">edited</span>}
                      </div>
                      <p className="text-xs text-stone-400 truncate">{order.owner_name} · {order.email}</p>
                      <p className="text-[11px] text-stone-300 mt-0.5">{formatDate(order.created_at)}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusStyle(order.status)}`}>{statusBucket(order.status)}</span>
                  </button>
                ))}
              </div>

              {hasMore && <div ref={sentinelRef} className="text-center py-6 text-stone-400 text-sm">Loading more…</div>}
              {!hasMore && filtered.length > PAGE_SIZE && <p className="text-center text-stone-300 text-xs mt-4">All {filtered.length} orders shown</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
