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

function statusStyle(status: string) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100';
  if (status === 'pending') return 'bg-amber-50 text-amber-600 ring-1 ring-amber-100';
  if (status === 'processing') return 'bg-sky-50 text-sky-600 ring-1 ring-sky-100';
  return 'bg-red-50 text-red-600 ring-1 ring-red-100';
}

function renderText(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) =>
    part.startsWith('*') && part.endsWith('*')
      ? <em key={i} className="not-italic font-medium text-stone-900 bg-amber-50 px-1 rounded">{part.slice(1, -1)}</em>
      : <span key={i}>{part}</span>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-stone-400 text-[10px] uppercase tracking-wider font-medium mb-0.5">{label}</dt>
      <dd className="text-stone-700 text-sm leading-snug">{value}</dd>
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

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await fetchOrderById(token, type, id);
      setOrder(data);
    } catch { /* ignore */ }
  }, [type, id]);

  useEffect(() => { load(); }, [load]);

  const busy = sending || resending || freshing;

  function scheduleRefresh() {
    setTimeout(() => { refresh(); }, 65000);
  }

  async function handleResend() {
    const token = getToken();
    if (!token || !order) return;
    setSending(true); setError(''); setSent(null);
    try {
      await resendOrder(token, type, order.id, correctionNote, false, emailOverride || undefined);
      setSent('correction'); scheduleRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to resend');
    } finally { setSending(false); }
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
    } finally { setResending(false); }
  }

  async function handleFresh() {
    const token = getToken();
    if (!token || !order) return;
    setFreshing(true); setError(''); setSent(null);
    try {
      await resendOrder(token, type, order.id, '', true, emailOverride || undefined);
      setSent('fresh'); scheduleRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
    } finally { setFreshing(false); }
  }

  const hasContent = type === 'rainbow'
    ? !!order?.generated_letter?.trim()
    : !!(order?.generated_reading && Object.values(order.generated_reading).some(v => v?.trim()));

  const accentSolid = type === 'rainbow' ? 'bg-rose-500' : 'bg-violet-500';
  const accentLabel = type === 'rainbow' ? 'text-rose-400' : 'text-violet-400';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-stone-400 text-sm">Loading order…</div>
  );
  if (!order) return null;

  const emailChanged = emailOverride.trim() && emailOverride.trim() !== order.email;
  const isFailed = !['completed', 'pending', 'processing'].includes(order.status);
  const failReason = isFailed ? order.status.replace(/^failed:\s*/i, '') : '';
  const initial = (order.pet_name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-stone-200 px-4 sm:px-6 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/orders')} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-500 text-lg">←</button>
        <span className={`w-9 h-9 rounded-full ${accentSolid} text-white text-sm flex items-center justify-center font-semibold shrink-0`}>{initial}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-stone-900 truncate">{order.pet_name}</h1>
          <p className="text-xs text-stone-400 truncate">{type === 'rainbow' ? 'Rainbow Bridge' : 'Soul Reading'} · {order.owner_name}</p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle(order.status)}`}>{isFailed ? 'failed' : order.status}</span>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:grid lg:grid-cols-[320px_1fr] lg:gap-6">

        {/* Sidebar */}
        <aside className="space-y-4 mb-4 lg:mb-0 lg:sticky lg:top-20 lg:self-start">
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
            {order.photo_url && (
              <img src={order.photo_url} alt={order.pet_name} className="w-full aspect-square object-cover" />
            )}
            <div className="p-5">
              <p className="text-xs font-semibold text-stone-700 mb-3 uppercase tracking-wide">Pet Details</p>
              <dl className="space-y-3">
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

          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
            <dl className="space-y-3">
              <InfoRow label="Email" value={order.email} />
              <InfoRow label="Ordered" value={formatDate(order.created_at)} />
              <div>
                <dt className="text-stone-400 text-[10px] uppercase tracking-wider font-medium mb-0.5">Shopify ID</dt>
                <dd className="text-stone-500 font-mono text-xs">{order.shopify_order_id}</dd>
              </div>
            </dl>
          </div>
        </aside>

        {/* Main content */}
        <main className="space-y-4">
          {/* Failed banner */}
          {isFailed && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-semibold text-red-700">This order failed to send</p>
                <p className="text-xs text-red-500 mt-1 break-words">{failReason || 'Unknown error'}</p>
                <p className="text-xs text-red-400 mt-2">Use &quot;Generate Fresh&quot; below to retry.</p>
              </div>
            </div>
          )}

          {/* Generated content (collapsible) */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
            <button
              onClick={() => setShowReading(v => !v)}
              disabled={!hasContent}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50 disabled:hover:bg-white transition-colors"
            >
              <div>
                <h2 className="text-sm font-semibold text-stone-800">
                  {type === 'rainbow' ? 'Generated Letter' : 'Generated Reading'}
                </h2>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  {hasContent ? (showReading ? 'Tap to hide' : 'Tap to preview the emailed content') : 'Nothing generated yet'}
                </p>
              </div>
              {hasContent && <span className={`text-stone-400 text-lg transition-transform ${showReading ? 'rotate-180' : ''}`}>⌄</span>}
            </button>

            {hasContent && showReading && (
              <div className="px-5 pb-5 border-t border-stone-100 pt-5">
                {type === 'rainbow' ? (
                  <div className="text-[15px] text-stone-700 leading-[1.85] max-w-prose" style={{ fontFamily: 'Georgia, serif' }}>
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
                          <p className="text-[15px] text-stone-700 leading-[1.8]" style={{ fontFamily: 'Georgia, serif' }}>{renderText(text)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Send To */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
            <label className="text-sm font-semibold text-stone-800">Send To</label>
            <p className="text-xs text-stone-400 mt-0.5 mb-3">Leave blank to use the original email, or override with a different address.</p>
            <input
              type="email"
              placeholder={order.email}
              value={emailOverride}
              onChange={e => setEmailOverride(e.target.value)}
              className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 text-stone-700 transition-colors ${emailChanged ? 'border-amber-300 focus:ring-amber-200 bg-amber-50/40' : 'border-stone-200 focus:ring-stone-300 bg-stone-50 focus:bg-white'}`}
            />
            {emailChanged && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <span>⚠</span> Will send to <strong>{emailOverride.trim()}</strong> and update the database.
              </p>
            )}
          </div>

          {/* Correction */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
            <label className="text-sm font-semibold text-stone-800">Correction Note <span className="font-normal text-stone-400">(optional)</span></label>
            <p className="text-xs text-stone-400 mt-0.5 mb-3">Describe what to improve. Used only by &quot;Regenerate&quot;.</p>
            <textarea
              value={correctionNote}
              onChange={e => setCorrectionNote(e.target.value)}
              placeholder="e.g. Make it warmer. Mention the beach memory more specifically. Keep it shorter."
              rows={3}
              className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none text-stone-700 bg-stone-50 focus:bg-white transition-colors"
            />
          </div>
        </main>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-stone-200 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
          {error && <p className="text-red-500 text-sm mb-2 text-center sm:text-left">{error}</p>}
          {sent === 'correction' && <p className="text-emerald-600 text-sm mb-2 text-center sm:text-left">✓ Correction queued — email in ~60s, preview will auto-update.</p>}
          {sent === 'resend' && <p className="text-emerald-600 text-sm mb-2 text-center sm:text-left">✓ Same content resent — arriving in ~60 seconds.</p>}
          {sent === 'fresh' && <p className="text-emerald-600 text-sm mb-2 text-center sm:text-left">✓ Fresh generation queued — email in ~60s, preview will auto-update.</p>}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:justify-end">
            <button
              onClick={handleResendOnly}
              disabled={busy || !hasContent}
              className="px-3 sm:px-5 py-2.5 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 disabled:opacity-40 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
            >
              {resending ? 'Sending…' : 'Resend as-is'}
            </button>
            <button
              onClick={handleFresh}
              disabled={busy}
              className="px-3 sm:px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm"
            >
              {freshing ? 'Generating…' : 'Generate Fresh'}
            </button>
            <button
              onClick={handleResend}
              disabled={busy || !correctionNote.trim() || !hasContent}
              className="px-3 sm:px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm"
            >
              {sending ? 'Sending…' : 'Regenerate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
