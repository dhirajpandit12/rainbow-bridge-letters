// One-time drip campaign: invite past Soul Reading customers to the monthly subscription.
// Sends ~50/day via Resend, with a per-recipient unsubscribe link. Opt-in via CAMPAIGN_ACTIVE.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { sendSubscriptionInviteEmail } = require('./email');

const DAILY_LIMIT = Number(process.env.CAMPAIGN_DAILY_LIMIT || 50);
const BASE_URL = process.env.BACKEND_URL || 'https://rainbow-bridge-letters.onrender.com';

function sb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}
const unsubUrl = (token) => `${BASE_URL}/campaign/unsub/${token}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Build the recipient list from past one-time Soul Reading orders (deduped by email).
async function populateCampaign() {
  const supabase = sb();
  const { data: orders } = await supabase
    .from('soul_reading_orders')
    .select('email, owner_name, pet_name, created_at')
    .order('created_at', { ascending: false });

  const byEmail = new Map();
  for (const o of orders || []) {
    const email = (o.email || '').trim().toLowerCase();
    if (!email || byEmail.has(email)) continue; // keep most recent per email
    byEmail.set(email, {
      email,
      first_name: (o.owner_name || '').trim().split(/\s+/)[0] || null,
      pet_name: (o.pet_name || '').trim() || null,
      status: 'pending',
      unsub_token: crypto.randomBytes(12).toString('hex'),
    });
  }

  const rows = [...byEmail.values()];
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    // Ignore rows whose email already exists (unique constraint) so this is re-runnable.
    const { error, count } = await supabase.from('subscription_campaign').upsert(chunk, { onConflict: 'email', ignoreDuplicates: true, count: 'exact' });
    if (error) throw new Error(`populate failed: ${error.message}`);
    inserted += count || 0;
  }
  return { total: rows.length, inserted };
}

// Send up to DAILY_LIMIT invites per UTC day.
async function sendDailyBatch() {
  const supabase = sb();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count: sentToday } = await supabase
    .from('subscription_campaign')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', startOfDay.toISOString());

  const remaining = DAILY_LIMIT - (sentToday || 0);
  if (remaining <= 0) return { sent: 0, note: 'daily limit reached' };

  const { data: batch } = await supabase
    .from('subscription_campaign')
    .select('*')
    .eq('status', 'pending')
    .limit(remaining);

  let sent = 0;
  for (const row of batch || []) {
    try {
      await sendSubscriptionInviteEmail({
        toEmail: row.email, firstName: row.first_name, petName: row.pet_name, unsubUrl: unsubUrl(row.unsub_token),
      });
      await supabase.from('subscription_campaign').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', row.id);
      sent++;
      await sleep(600); // gentle throttle
    } catch (err) {
      console.error(`[Campaign] Failed for ${row.email}:`, err.message);
      await supabase.from('subscription_campaign').update({ status: `failed: ${err.message.slice(0, 80)}` }).eq('id', row.id);
    }
  }
  if (sent) console.log(`[Campaign] Sent ${sent} invites today (${(sentToday || 0) + sent}/${DAILY_LIMIT})`);
  return { sent };
}

async function unsubscribe(token) {
  const supabase = sb();
  const { data } = await supabase.from('subscription_campaign').select('id').eq('unsub_token', token).maybeSingle();
  if (!data) return false;
  await supabase.from('subscription_campaign').update({ status: 'unsubscribed' }).eq('id', data.id);
  return true;
}

// Preview: send a single invite anywhere without touching the campaign table.
async function sendTest(toEmail) {
  await sendSubscriptionInviteEmail({
    toEmail, firstName: 'Dhiraj', petName: 'Finn', unsubUrl: unsubUrl('PREVIEW'),
  });
}

module.exports = { populateCampaign, sendDailyBatch, unsubscribe, sendTest };
