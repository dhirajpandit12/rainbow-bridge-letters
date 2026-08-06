'use client';
import { useRouter } from 'next/navigation';
import { clearToken } from '@/lib/auth';

export default function Sidebar({ active, onNavigate }: { active?: 'rainbow' | 'soul'; onNavigate?: (t: 'rainbow' | 'soul') => void }) {
  const router = useRouter();

  function go(tab: 'rainbow' | 'soul') {
    if (onNavigate) onNavigate(tab);
    else router.push(`/orders?tab=${tab}`);
  }

  const items = [
    { key: 'rainbow' as const, label: 'Rainbow Bridge', icon: '🌈' },
    { key: 'soul' as const, label: 'Soul Readings', icon: '✨' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-stone-200 bg-white h-screen sticky top-0">
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-stone-100">
        <span className="text-2xl">🌈</span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-stone-800">Rainbow Bridge</p>
          <p className="text-[11px] text-stone-400">Admin Panel</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 text-[10px] uppercase tracking-wider text-stone-400 font-medium mb-2">Products</p>
        {items.map(it => (
          <button
            key={it.key}
            onClick={() => go(it.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active === it.key ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <span className="text-base">{it.icon}</span>
            {it.label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-stone-100">
        <button
          onClick={() => { clearToken(); router.push('/'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-500 hover:bg-stone-100 transition-colors"
        >
          <span className="text-base">⎋</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
