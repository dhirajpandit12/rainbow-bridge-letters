'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getToken, clearToken } from '@/lib/auth';
import { fetchOrderById, resendOrder, Order } from '@/lib/api';

const PARA_KEYS = ['PARA_ONE', 'PARA_TWO', 'PARA_THREE', 'PARA_FOUR', 'PARA_FIVE', 'PARA_SIX'];
const PARA_LABELS: Record<string, string> = {
  PARA_ONE: 'Opening', PARA_TWO: 'Memory / Connection', PARA_THREE: 'What I Observed',
  PARA_FOUR: 'Deeper Message', PARA_FIVE: 'Answer to Question', PARA_SIX: 'Closing',
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

// Render text, converting *emphasis* markers into italic spans
function renderText(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="text-stone-800 font-medium not-italic bg-rose-50 px-1 rounded">{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-stone-400 text-[11px] uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-stone-800 text-sm leading-snug">{value}</dd>
    </div>
  );
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const type = params.type as 'rainbow' | 'soul';
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [correctionNote, setCorrectionNote] = useState('');
  const [emailOverride, setEmailOverride] = useState('');
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [freshing, setFreshing] = useState(false);
  const [sent, setSent] = useState<'correction' | 'resend' | 'fresh' | null>(null);
  const [error, setError] = useState('');
  const [showReading, setShowReading] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { router.push('/'); return; }
    try {
      const data = await fetchOrderById(token, type, id);
      setOrder(data);
      if (data.correction_note) setCorrectionNote(data.correction_note);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'Unauthorized') { clearToken(); router.push('/'); }
      else router.push('/orders');
    } finally {
      setLoading(false);
    }
  }, [router, type, id]);

  useEffect(() => { load(); }, [load]);

  const busy = sending || resending || freshing;

  async function handleResend() {
    const token = getToken();
    if (!token || !order) return;
    setSending(true); setError(''); setSent(null);
    try {
      await resendOrder(token, type, order.id, correctionNote, false, emailOverride || undefined);
      setSent('correction');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to resend');
    } finally {
      setSending(false);
    }
  }

  async function handleResendOnly() {
    const token = getToken();
    if (!token || !order) return;
    setResending(true); setError(''); setSent(null);
    try {
      await resendOrder(token, type, order.id, '', false, emailOverride || undefined);
      setSent('resend');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to resend');
    } finally {
      setResending(false);
    }
  }

  async function handleFresh() {
    const token = getToken();
    if (!token || !order) return;
    setFreshing(true); setError(''); setSent(null);
    try {
      await resendOrder(token, type, order.id, '', true, emailOverride || undefined);
      setSent('fresh');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setFreshing(false);
    }
  }

  const hasContent = type === 'rainbow'
    ? !!order?.generated_letter?.trim()
    : !!(order?.generated_reading && Object.values(order.generated_reading).some(v => v?.trim()));

  const accentBg = type === 'rainbow' ? 'bg-rose-100' : 'bg-violet-100';
  const accentLabel = type === 'rainbow' ? 'text-rose-400' : 'text-violet-400';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-stone-400 text-sm">Loading order...</div>
  );
  if (!order) return null;

  const emailChanged = emailOverride.trim() && emailOverride.trim() !== order.email;

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-stone-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/orders')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-500 text-lg leading-none">←</button>
        <span className="text-xl">{type === 'rainbow' ? '🌈' : '✨'}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-stone-800 truncate">{order.pet_name}</h1>
          <p className="text-xs text-stone-400 truncate">{type === 'rainbow' ? 'Rainbow Bridge' : 'Soul Reading'} · {order.email}</p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(order.status)}`}>{order.status}</span>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 lg:grid lg:grid-cols-[300px_1fr] lg:gap-6">

        {/* ── Sidebar ── */}
        <aside className="space-y-4 mb-4 lg:mb-0 lg:sticky lg:top-20 lg:self-start">
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            {order.photo_url && type === 'soul' && (
              <img src={order.photo_url} alt={order.pet_name} className="w-full aspect-square object-cover" />
            )}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-full ${accentBg} flex items-center justify-center text-sm`}>
                  🐾
                </div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm leading-none">{order.pet_name}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{order.owner_name}</p>
                </div>
              </div>
              <dl className="space-y-2.5 pt-2 border-t border-stone-100">
                {type === 'rainbow' ? (
                  <>
                    <InfoRow label="Species" value={order.pet_type} />
                    <InfoRow label="Called You" value={order.called_you} />
                    <InfoRow label="Personality" value={order.personality} />
                    <InfoRow label="Favorite Memory" value={order.favorite_memory} />
                    <InfoRow label="Message to Pet" value={order.message_to_pet} />
                  </>
                ) : (
                  <>
                    <InfoRow label="Species" value={order.species} />
                    <InfoRow label="Life Stage" value={order.life_stage} />
                    <InfoRow label="Calls You" value={order.pet_calls_you} />
                    <InfoRow label="Personality" value={order.personality} />
                    <InfoRow label="Question" value={order.question} />
                  </>
                )}
              </dl>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <dl className="space-y-2.5">
              <InfoRow label="Email" value={order.email} />
              <InfoRow label="Ordered" value={formatDate(order.created_at)} />
              <div>
                <dt className="text-stone-400 text-[11px] uppercase tracking-wide mb-0.5">Shopify ID</dt>
                <dd className="text-stone-500 font-mono text-xs">{order.shopify_order_id}</dd>
              </div>
            </dl>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="space-y-4">
          {/* Generated content */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <button
              onClick={() => setShowReading(v => !v)}
              disabled={!hasContent}
              className="w-full flex items-center justify-between px-5 py-4 text-left disabled:cursor-default hover:bg-stone-50 disabled:hover:bg-white transition-colors"
            >
              <div>
                <h2 className="text-sm font-semibold text-stone-700">
                  {type === 'rainbow' ? 'Generated Letter' : 'Generated Reading'}
                </h2>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  {hasContent ? (showReading ? 'Tap to hide' : 'Tap to preview emailed content') : 'Nothing generated yet'}
                </p>
              </div>
              {hasContent && (
                <span className={`text-stone-400 text-lg transition-transform ${showReading ? 'rotate-180' : ''}`}>⌄</span>
              )}
            </button>

            {hasContent && showReading && (
              <div className="px-5 pb-5 border-t border-stone-100 pt-4">
                {type === 'rainbow' ? (
                  <div className="font-serif text-[15px] text-stone-700 leading-[1.85] whitespace-pre-wrap max-w-prose">
                    {order.generated_letter?.split('\n\n').filter(p => p.trim()).map((para, i) => (
                      <p key={i} className="mb-4">{renderText(para.trim())}</p>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {PARA_KEYS.map(key => {
                      const text = order.generated_reading?.[key];
                      if (!text?.trim()) return null;
                      return (
                        <div key={key} className="relative pl-4 border-l-2 border-stone-100">
                          <p className={`text-[10px] font-semibold ${accentLabel} uppercase tracking-wider mb-1.5`}>{PARA_LABELS[key]}</p>
                          <p className="text-[15px] text-stone-700 leading-[1.8]">{renderText(text)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Send To */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-1">Send To</h2>
            <p className="text-xs text-stone-400 mb-3">Leave blank to use the original email, or enter a different address to override.</p>
            <input
              type="email"
              placeholder={order.email}
              value={emailOverride}
              onChange={e => setEmailOverride(e.target.value)}
              className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 text-stone-700 ${emailChanged ? 'border-amber-300 focus:ring-amber-300 bg-amber-50/40' : 'border-stone-200 focus:ring-rose-300'}`}
            />
            {emailChanged && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <span>⚠</span> Will send to <strong>{emailOverride.trim()}</strong> and update the database.
              </p>
            )}
          </div>

          {/* Correction */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 mb-1">Correction Note <span className="font-normal text-stone-400">(optional)</span></h2>
            <p className="text-xs text-stone-400 mb-3">Describe what to improve. Used only by &quot;Regenerate &amp; Resend&quot;.</p>
            <textarea
              value={correctionNote}
              onChange={e => setCorrectionNote(e.target.value)}
              placeholder="e.g. Make it warmer. Mention the beach memory more specifically. Keep it shorter."
              rows={3}
              className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none text-stone-700"
            />
          </div>
        </main>
      </div>

      {/* ── Sticky action bar ── */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          {error && <p className="text-red-500 text-sm mb-2 text-center sm:text-left">{error}</p>}
          {sent === 'correction' && <p className="text-green-600 text-sm mb-2 text-center sm:text-left">✓ Correction queued — regenerated email arriving in ~60 seconds.</p>}
          {sent === 'resend' && <p className="text-green-600 text-sm mb-2 text-center sm:text-left">✓ Same content resent — arriving in ~60 seconds.</p>}
          {sent === 'fresh' && <p className="text-green-600 text-sm mb-2 text-center sm:text-left">✓ Fresh generation queued — new email arriving in ~60 seconds.</p>}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:justify-end">
            <button
              onClick={handleResendOnly}
              disabled={busy || !hasContent}
              className="px-3 sm:px-5 py-2.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 disabled:opacity-40 rounded-xl text-xs sm:text-sm font-medium transition-colors"
            >
              {resending ? 'Sending…' : 'Resend as-is'}
            </button>
            <button
              onClick={handleFresh}
              disabled={busy}
              className="px-3 sm:px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 rounded-xl text-xs sm:text-sm font-medium transition-colors"
            >
              {freshing ? 'Generating…' : 'Generate Fresh'}
            </button>
            <button
              onClick={handleResend}
              disabled={busy || !correctionNote.trim() || !hasContent}
              className="px-3 sm:px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 rounded-xl text-xs sm:text-sm font-medium transition-colors"
            >
              {sending ? 'Sending…' : 'Regenerate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
