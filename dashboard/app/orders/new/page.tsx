'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, clearToken } from '@/lib/auth';
import { createReading, CreateDetails } from '@/lib/api';

type Field = { key: keyof CreateDetails; label: string; type?: 'text' | 'email' | 'textarea'; required?: boolean; placeholder?: string; hint?: string };

const RAINBOW_FIELDS: Field[] = [
  { key: 'email', label: 'Customer Email', type: 'email', required: true },
  { key: 'petName', label: 'Pet Name', required: true },
  { key: 'ownerName', label: 'Owner Name', required: true },
  { key: 'petType', label: 'Pet Type', placeholder: 'Dog, Cat...' },
  { key: 'calledYou', label: 'Pet Called You', placeholder: 'Mom, Dad, Mama...' },
  { key: 'personality', label: 'Personality', type: 'textarea' },
  { key: 'favoriteMemory', label: 'Favorite Memory', type: 'textarea' },
  { key: 'messageToPet', label: 'Message to Pet', type: 'textarea' },
];

const SOUL_FIELDS: Field[] = [
  { key: 'email', label: 'Customer Email', type: 'email', required: true },
  { key: 'petName', label: 'Pet Name', required: true },
  { key: 'ownerName', label: 'Owner Name', required: true },
  { key: 'petCallsYou', label: 'Pet Calls You', placeholder: 'Mom, Dad, Human...' },
  { key: 'photoUrl', label: 'Pet Photo URL', hint: 'Upload to Shopify files and paste the image URL' },
  { key: 'species', label: 'Species', placeholder: 'Dog, Cat...' },
  { key: 'lifeStage', label: 'Life Stage', placeholder: 'Baby, Young, Adult, Senior' },
  { key: 'personality', label: 'Personality', type: 'textarea' },
  { key: 'question', label: 'Their Question', type: 'textarea' },
];

export default function NewReadingPage() {
  const router = useRouter();
  const [type, setType] = useState<'rainbow' | 'soul'>('rainbow');
  const [form, setForm] = useState<CreateDetails>({ email: '', petName: '', ownerName: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const fields = type === 'rainbow' ? RAINBOW_FIELDS : SOUL_FIELDS;

  function update(key: keyof CreateDetails, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function switchType(t: 'rainbow' | 'soul') {
    setType(t);
    setSent(false); setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) { router.push('/'); return; }
    if (!form.email.trim() || !form.petName.trim() || !form.ownerName.trim()) {
      setError('Email, pet name and owner name are required.');
      return;
    }
    setSending(true); setError(''); setSent(false);
    try {
      await createReading(token, type, form);
      setSent(true);
      setForm({ email: '', petName: '', ownerName: '' });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Unauthorized') { clearToken(); router.push('/'); return; }
      setError(err instanceof Error ? err.message : 'Failed to create reading');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-stone-200 px-4 sm:px-6 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/orders')} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-500 text-lg">←</button>
        <div>
          <h1 className="text-base font-bold text-stone-900">New Reading</h1>
          <p className="text-xs text-stone-400">Manually create and send a reading</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Product picker */}
        <div className="flex bg-stone-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => switchType('rainbow')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${type === 'rainbow' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
          >
            🌈 Rainbow Bridge
          </button>
          <button
            onClick={() => switchType('soul')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${type === 'soul' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
          >
            ✨ Soul Reading
          </button>
        </div>

        {sent ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
            <p className="text-3xl mb-2">✓</p>
            <p className="text-sm font-semibold text-emerald-700">Reading queued!</p>
            <p className="text-xs text-emerald-600 mt-1">The email will arrive in ~60 seconds. The order now appears in the list.</p>
            <div className="flex gap-2 justify-center mt-4">
              <button onClick={() => setSent(false)} className="px-4 py-2 bg-white border border-stone-300 text-stone-700 rounded-xl text-sm font-medium">Create another</button>
              <button onClick={() => router.push('/orders')} className="px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium">Back to orders</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4 shadow-sm">
            {fields.map(f => (
              <div key={f.key}>
                <label className="text-sm font-medium text-stone-700">
                  {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {f.hint && <p className="text-[11px] text-stone-400 mt-0.5">{f.hint}</p>}
                {f.type === 'textarea' ? (
                  <textarea
                    value={(form[f.key] as string) || ''}
                    onChange={e => update(f.key, e.target.value)}
                    rows={3}
                    placeholder={f.placeholder}
                    className="mt-1 w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none bg-stone-50 focus:bg-white transition-colors text-stone-700"
                  />
                ) : (
                  <input
                    type={f.type || 'text'}
                    value={(form[f.key] as string) || ''}
                    onChange={e => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="mt-1 w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 bg-stone-50 focus:bg-white transition-colors text-stone-700"
                  />
                )}
              </div>
            ))}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={sending}
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {sending ? 'Generating & sending…' : `Generate & Send ${type === 'rainbow' ? 'Letter' : 'Reading'}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
