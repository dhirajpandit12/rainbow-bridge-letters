'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getToken, clearToken } from '@/lib/auth';
import { fetchOrders, resendOrder, Order } from '@/lib/api';

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

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-stone-400 text-xs mb-0.5">{label}</dt>
      <dd className="text-stone-800 text-sm">{value}</dd>
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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-400">Loading...</div>;
  if (!order) return null;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/orders')} className="text-stone-400 hover:text-stone-700 text-xl leading-none">←</button>
        <span className="text-xl">{type === 'rainbow' ? '🌈' : '✨'}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-stone-800 truncate">{order.pet_name}</h1>
          <p className="text-xs text-stone-400 truncate">{type === 'rainbow' ? 'Rainbow Bridge' : 'Soul Reading'} · {order.email}</p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(order.status)}`}>{order.status}</span>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">

        {/* Order info + Pet info */}
        <div className="space-y-4 lg:col-span-1">
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Order Details</h2>
            <dl className="space-y-2">
              <InfoRow label="Pet Name" value={order.pet_name} />
              <InfoRow label="Owner" value={order.owner_name} />
              <InfoRow label="Email" value={order.email} />
              <InfoRow label="Date" value={formatDate(order.created_at)} />
              {order.shopify_order_id && (
                <div>
                  <dt className="text-stone-400 text-xs mb-0.5">Shopify ID</dt>
                  <dd className="text-stone-500 font-mono text-xs">{order.shopify_order_id}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Pet Info</h2>
            <dl className="space-y-2">
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
                  {order.photo_url && (
                    <div>
                      <dt className="text-stone-400 text-xs mb-1">Photo</dt>
                      <img src={order.photo_url} alt={order.pet_name} className="w-full rounded-xl object-cover aspect-square" />
                    </div>
                  )}
                </>
              )}
            </dl>
          </div>
        </div>

        {/* Generated content + Correction */}
        <div className="space-y-4 lg:col-span-2">
          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">
              {type === 'rainbow' ? 'Generated Letter' : 'Generated Reading'}
            </h2>
            {!hasContent ? (
              <p className="text-stone-400 text-sm italic">No content generated yet.</p>
            ) : type === 'rainbow' ? (
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap font-serif">{order.generated_letter}</p>
            ) : (
              <div className="space-y-4">
                {PARA_KEYS.map(key => {
                  const text = order.generated_reading?.[key];
                  if (!text?.trim()) return null;
                  return (
                    <div key={key}>
                      <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">{PARA_LABELS[key]}</p>
                      <p className="text-sm text-stone-700 leading-relaxed">{text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <h2 className="text-sm font-semibold text-stone-700 mb-1">Send To</h2>
            <p className="text-xs text-stone-400 mb-2">Leave blank to use original email. Enter a different email to override.</p>
            <input
              type="email"
              placeholder={order.email}
              value={emailOverride}
              onChange={e => setEmailOverride(e.target.value)}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 text-stone-700"
            />
            {emailOverride && emailOverride !== order.email && (
              <p className="text-xs text-amber-600 mt-1.5">Will send to <strong>{emailOverride}</strong> and update in database.</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 p-4">
            <h2 className="text-sm font-semibold text-stone-700 mb-1">Correction Note</h2>
            <p className="text-xs text-stone-400 mb-3">Describe what needs to be improved. The AI will regenerate and resend within ~60 seconds.</p>
            <textarea
              value={correctionNote}
              onChange={e => setCorrectionNote(e.target.value)}
              placeholder="e.g. Make it more emotional. Mention the beach memory more specifically."
              rows={4}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none text-stone-700"
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            {sent === 'correction' && <p className="text-green-600 text-sm mt-2">✓ Correction queued. Regenerated email arriving in ~60 seconds.</p>}
            {sent === 'resend' && <p className="text-green-600 text-sm mt-2">✓ Same email resent. Arriving in ~60 seconds.</p>}
            {sent === 'fresh' && <p className="text-green-600 text-sm mt-2">✓ Fresh generation queued. New email arriving in ~60 seconds.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleResendOnly}
                disabled={resending || sending || freshing || !hasContent}
                className="px-5 py-2.5 bg-stone-600 hover:bg-stone-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {resending ? 'Sending...' : 'Resend as-is'}
              </button>
              <button
                onClick={handleFresh}
                disabled={freshing || sending || resending}
                className="px-5 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {freshing ? 'Generating...' : 'Generate Fresh'}
              </button>
              <button
                onClick={handleResend}
                disabled={sending || resending || freshing || !correctionNote.trim() || !hasContent}
                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {sending ? 'Sending...' : 'Regenerate & Resend'}
              </button>
            </div>
            {!hasContent && <p className="text-xs text-stone-400 mt-2">No content yet — use "Generate Fresh" to create one.</p>}
          </div>
        </div>

      </div>
    </div>
  );
}
