'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getToken, clearToken } from '@/lib/auth';
import { fetchOrders, resendOrder, Order } from '@/lib/api';

const PARA_KEYS = ['PARA_ONE', 'PARA_TWO', 'PARA_THREE', 'PARA_FOUR', 'PARA_FIVE', 'PARA_SIX'];
const PARA_LABELS: Record<string, string> = {
  PARA_ONE: 'Opening',
  PARA_TWO: 'Memory / Connection',
  PARA_THREE: 'What I Observed',
  PARA_FOUR: 'Deeper Message',
  PARA_FIVE: 'Answer to Question',
  PARA_SIX: 'Closing',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusColor(status: string) {
  if (status === 'completed') return 'bg-green-100 text-green-700';
  if (status === 'pending') return 'bg-amber-100 text-amber-700';
  if (status === 'processing') return 'bg-blue-100 text-blue-700';
  return 'bg-red-100 text-red-700';
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const type = params.type as 'rainbow' | 'soul';
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [correctionNote, setCorrectionNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/'); return; }
    try {
      const data = await fetchOrders(token);
      const list = type === 'rainbow' ? data.rainbow : data.soul;
      const found = list.find(o => o.id === id);
      if (!found) { router.push('/orders'); return; }
      setOrder(found);
      if (found.correction_note) setCorrectionNote(found.correction_note);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'Unauthorized') { clearToken(); router.push('/'); }
    } finally {
      setLoading(false);
    }
  }, [router, type, id]);

  useEffect(() => { load(); }, [load]);

  async function handleResend() {
    const token = getToken();
    if (!token || !order) return;
    setSending(true);
    setError('');
    setSent(false);
    try {
      await resendOrder(token, type, order.id, correctionNote);
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to resend');
    } finally {
      setSending(false);
    }
  }

  const hasContent = type === 'rainbow'
    ? !!order?.generated_letter?.trim()
    : !!(order?.generated_reading && Object.values(order.generated_reading).some(v => v?.trim()));

  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-400">Loading...</div>;
  if (!order) return null;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/orders')} className="text-stone-400 hover:text-stone-700 transition-colors text-lg">←</button>
        <span className="text-2xl">{type === 'rainbow' ? '🌈' : '✨'}</span>
        <div>
          <h1 className="text-lg font-semibold text-stone-800">{order.pet_name}</h1>
          <p className="text-xs text-stone-400">{type === 'rainbow' ? 'Rainbow Bridge' : 'Soul Reading'} · {order.email}</p>
        </div>
        <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(order.status)}`}>{order.status}</span>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-3 gap-6">

        {/* Left: Order info */}
        <div className="col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-4">Order Details</h2>
            <dl className="space-y-2.5 text-sm">
              <div><dt className="text-stone-400 text-xs">Pet Name</dt><dd className="text-stone-800 font-medium">{order.pet_name}</dd></div>
              <div><dt className="text-stone-400 text-xs">Owner</dt><dd className="text-stone-800">{order.owner_name}</dd></div>
              <div><dt className="text-stone-400 text-xs">Email</dt><dd className="text-stone-800 break-all">{order.email}</dd></div>
              <div><dt className="text-stone-400 text-xs">Date</dt><dd className="text-stone-800">{formatDate(order.created_at)}</dd></div>
              {order.shopify_order_id && <div><dt className="text-stone-400 text-xs">Shopify ID</dt><dd className="text-stone-600 font-mono text-xs">{order.shopify_order_id}</dd></div>}
            </dl>
          </div>

          {type === 'rainbow' && (
            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <h2 className="text-sm font-semibold text-stone-700 mb-4">Pet Info</h2>
              <dl className="space-y-2.5 text-sm">
                {order.pet_type && <div><dt className="text-stone-400 text-xs">Species</dt><dd className="text-stone-800">{order.pet_type}</dd></div>}
                {order.called_you && <div><dt className="text-stone-400 text-xs">Called You</dt><dd className="text-stone-800">{order.called_you}</dd></div>}
                {order.personality && <div><dt className="text-stone-400 text-xs">Personality</dt><dd className="text-stone-800">{order.personality}</dd></div>}
                {order.favorite_memory && <div><dt className="text-stone-400 text-xs">Favorite Memory</dt><dd className="text-stone-800">{order.favorite_memory}</dd></div>}
                {order.message_to_pet && <div><dt className="text-stone-400 text-xs">Message to Pet</dt><dd className="text-stone-800">{order.message_to_pet}</dd></div>}
              </dl>
            </div>
          )}

          {type === 'soul' && (
            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <h2 className="text-sm font-semibold text-stone-700 mb-4">Pet Info</h2>
              <dl className="space-y-2.5 text-sm">
                {order.species && <div><dt className="text-stone-400 text-xs">Species</dt><dd className="text-stone-800">{order.species}</dd></div>}
                {order.life_stage && <div><dt className="text-stone-400 text-xs">Life Stage</dt><dd className="text-stone-800">{order.life_stage}</dd></div>}
                {order.pet_calls_you && <div><dt className="text-stone-400 text-xs">Calls You</dt><dd className="text-stone-800">{order.pet_calls_you}</dd></div>}
                {order.personality && <div><dt className="text-stone-400 text-xs">Personality</dt><dd className="text-stone-800">{order.personality}</dd></div>}
                {order.question && <div><dt className="text-stone-400 text-xs">Question</dt><dd className="text-stone-800">{order.question}</dd></div>}
                {order.photo_url && (
                  <div>
                    <dt className="text-stone-400 text-xs mb-1">Photo</dt>
                    <img src={order.photo_url} alt={order.pet_name} className="w-full rounded-lg object-cover aspect-square" />
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Right: Content + Resend */}
        <div className="col-span-2 space-y-4">

          {/* Generated content */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h2 className="text-sm font-semibold text-stone-700 mb-4">
              {type === 'rainbow' ? 'Generated Letter' : 'Generated Reading'}
            </h2>

            {!hasContent ? (
              <p className="text-stone-400 text-sm italic">No content generated yet. Order is still pending or failed.</p>
            ) : type === 'rainbow' ? (
              <div className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap font-serif">
                {order.generated_letter}
              </div>
            ) : (
              <div className="space-y-4">
                {PARA_KEYS.map(key => {
                  const text = order.generated_reading?.[key];
                  if (!text?.trim()) return null;
                  return (
                    <div key={key}>
                      <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">{PARA_LABELS[key] || key}</p>
                      <p className="text-sm text-stone-700 leading-relaxed">{text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Correction + Resend */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h2 className="text-sm font-semibold text-stone-700 mb-1">Correction Note</h2>
            <p className="text-xs text-stone-400 mb-3">Describe what needs to be improved. The AI will regenerate using this feedback.</p>
            <textarea
              value={correctionNote}
              onChange={e => setCorrectionNote(e.target.value)}
              placeholder="e.g. Make it more emotional. Mention the beach memory more specifically. The letter feels generic."
              rows={4}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none text-stone-700"
            />

            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            {sent && (
              <p className="text-green-600 text-sm mt-2 flex items-center gap-1.5">
                <span>✓</span> Correction queued. New email will be sent in a moment.
              </p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleResend}
                disabled={sending || !correctionNote.trim() || !hasContent}
                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {sending ? 'Sending...' : 'Regenerate & Resend'}
              </button>
              {!hasContent && (
                <p className="text-xs text-stone-400">Generate a reading first before sending corrections.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
