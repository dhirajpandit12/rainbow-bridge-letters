'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export default function AskPage() {
  const token = useParams().token as string;
  const [petName, setPetName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/subscription/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setPetName(d.petName))
      .catch(() => setNotFound(true));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setSending(true); setError('');
    try {
      const res = await fetch(`${API_URL}/subscription/${token}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Could not save');
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fdf8f4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Georgia, serif' }}>
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #f0d5c8', boxShadow: '0 8px 30px rgba(0,0,0,0.05)', padding: '40px 34px', maxWidth: 460, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 34 }}>🐾</div>
          <p style={{ color: '#c47d7d', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', margin: '10px 0 0', fontFamily: 'Arial, sans-serif' }}>A message to Luna</p>
        </div>

        {notFound ? (
          <p style={{ color: '#a08070', textAlign: 'center', fontSize: 15 }}>This link is no longer active. If you have a question, just reply to your reading email.</p>
        ) : sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, color: '#4a9d6e' }}>✓</div>
            <h1 style={{ color: '#3a2e2a', fontSize: 22, fontWeight: 'normal', margin: '10px 0 8px' }}>Your question is with Luna</h1>
            <p style={{ color: '#5a4a42', fontSize: 15, lineHeight: 1.7 }}>
              {petName ? `Luna will centre ${petName}'s next reading on what you asked.` : 'Luna will centre your next reading on what you asked.'} It arrives with your next monthly reading. 💛
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1 style={{ color: '#3a2e2a', fontSize: 22, fontWeight: 'normal', margin: '0 0 8px', textAlign: 'center' }}>
              {petName ? `Ask ${petName} anything` : 'Ask your pet anything'}
            </h1>
            <p style={{ color: '#a08070', fontSize: 14, lineHeight: 1.6, textAlign: 'center', margin: '0 0 20px' }}>
              Whatever is on your heart this month. Luna will tune into {petName || 'your pet'} and centre their next reading on it.
            </p>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder={`e.g. Are you happy? Is there anything you need more of? How are you feeling lately?`}
              rows={5}
              maxLength={800}
              style={{ width: '100%', padding: '14px', border: '1px solid #e6cbbe', borderRadius: 12, fontSize: 15, fontFamily: 'Georgia, serif', color: '#3a2e2a', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
            {error && <p style={{ color: '#c0392b', fontSize: 14, margin: '10px 0 0' }}>{error}</p>}
            <button
              type="submit"
              disabled={sending || !question.trim()}
              style={{ width: '100%', marginTop: 16, padding: '14px', background: question.trim() ? '#c47d7d' : '#e6cbbe', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 'bold', letterSpacing: 1, cursor: question.trim() ? 'pointer' : 'default', fontFamily: 'Arial, sans-serif' }}
            >
              {sending ? 'Sending…' : 'Send to Luna'}
            </button>
          </form>
        )}

        <p style={{ color: '#c0a898', fontSize: 12, textAlign: 'center', margin: '24px 0 0', fontFamily: 'Georgia, serif' }}>Heal Your Inner Peace</p>
      </div>
    </div>
  );
}
