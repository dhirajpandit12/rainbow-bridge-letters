const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function saveOrderToQueue(order, details) {
  const minHours = process.env.INSTANT_SEND === 'true' ? 0 : 1;
  const maxHours = process.env.INSTANT_SEND === 'true' ? 0 : 8;
  const hours = minHours + Math.random() * (maxHours - minHours);
  const sendAfter = new Date(Date.now() + hours * 60 * 60 * 1000);

  const { error } = await supabase.from('rainbow_orders').insert({
    shopify_order_id: String(order.id),
    email: order.email || order.contact_email,
    pet_name: details.petName,
    called_you: details.calledYou,
    pet_type: details.petType,
    owner_name: details.ownerName,
    personality: details.personality,
    favorite_memory: details.favoriteMemory,
    message_to_pet: details.messageToPet,
    photo_url: details.photoUrl,
    status: 'pending',
    send_after: sendAfter.toISOString(),
  });

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  console.log(`[Queue] Order ${order.id} saved — will send in ~${hours.toFixed(1)} hours`);
}

async function getPendingOrders() {
  const { data, error } = await supabase
    .from('rainbow_orders')
    .select('*')
    .in('status', ['pending', 'processing'])
    .lte('send_after', new Date().toISOString())
    .limit(10);

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  return data || [];
}

async function markOrderProcessing(id) {
  const { error } = await supabase
    .from('rainbow_orders')
    .update({ status: 'processing' })
    .eq('id', id);

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

async function markOrderProcessed(id) {
  const { error } = await supabase
    .from('rainbow_orders')
    .update({ status: 'completed', processed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

async function saveGeneratedLetter(id, letterBody) {
  const { error } = await supabase
    .from('rainbow_orders')
    .update({ generated_letter: letterBody })
    .eq('id', id);

  if (error) console.error(`[Queue] Could not save generated letter for ${id}:`, error.message);
}

async function markOrderFailed(id, reason) {
  const { error } = await supabase
    .from('rainbow_orders')
    .update({ status: `failed: ${reason}` })
    .eq('id', id);

  if (error) console.error(`[Queue] Could not mark order ${id} as failed:`, error.message);
}

async function saveSoulReadingToQueue(order, details) {
  const minHours = process.env.INSTANT_SEND === 'true' ? 0 : 1;
  const maxHours = process.env.INSTANT_SEND === 'true' ? 0 : 8;
  const hours = minHours + Math.random() * (maxHours - minHours);
  const sendAfter = new Date(Date.now() + hours * 60 * 60 * 1000);

  const { error } = await supabase.from('soul_reading_orders').insert({
    shopify_order_id: String(order.id),
    email: order.email || order.contact_email,
    pet_name: details.petName,
    owner_name: details.ownerName,
    pet_calls_you: details.petCallsYou,
    photo_url: details.photoUrl,
    species: details.species,
    life_stage: details.lifeStage,
    personality: details.personality,
    question: details.question,
    status: 'pending',
    send_after: sendAfter.toISOString(),
  });

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  console.log(`[Queue] Soul Reading order ${order.id} saved — will send in ~${hours.toFixed(1)} hours`);
}

async function getPendingSoulReadings() {
  const { data, error } = await supabase
    .from('soul_reading_orders')
    .select('*')
    .in('status', ['pending', 'processing'])
    .lte('send_after', new Date().toISOString())
    .limit(10);

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  return data || [];
}

async function markSoulReadingProcessing(id) {
  const { error } = await supabase
    .from('soul_reading_orders')
    .update({ status: 'processing' })
    .eq('id', id);

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

async function markSoulReadingProcessed(id) {
  const { error } = await supabase
    .from('soul_reading_orders')
    .update({ status: 'completed', processed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

async function saveGeneratedReading(id, paragraphs) {
  const { error } = await supabase
    .from('soul_reading_orders')
    .update({ generated_reading: paragraphs })
    .eq('id', id);

  if (error) throw new Error(`Could not save generated reading: ${error.message}`);
}

async function markSoulReadingFailed(id, reason) {
  const { error } = await supabase
    .from('soul_reading_orders')
    .update({ status: `failed: ${reason}` })
    .eq('id', id);

  if (error) console.error(`[Queue] Could not mark soul reading ${id} as failed:`, error.message);
}

async function saveSoulBlueprintToQueue(order, details) {
  const minHours = process.env.INSTANT_SEND === 'true' ? 0 : 6;
  const maxHours = process.env.INSTANT_SEND === 'true' ? 0 : 12;
  const hours = minHours + Math.random() * (maxHours - minHours);
  const sendAfter = new Date(Date.now() + hours * 60 * 60 * 1000);

  const { error } = await supabase.from('soul_blueprint_orders').insert({
    shopify_order_id: String(order.id),
    email: order.email || order.contact_email,
    first_name: details.firstName,
    birth_date: details.birthDate,
    birth_place: details.birthPlace || null,
    intention: details.intention || null,
    status: 'pending',
    send_after: sendAfter.toISOString(),
  });

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  console.log(`[Queue] Soul Blueprint order ${order.id} saved — will send in ~${hours.toFixed(1)} hours`);
}

async function getPendingSoulBlueprints() {
  const { data, error } = await supabase
    .from('soul_blueprint_orders')
    .select('*')
    .in('status', ['pending', 'processing'])
    .lte('send_after', new Date().toISOString())
    .limit(10);

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  return data || [];
}

async function markSoulBlueprintProcessing(id) {
  const { error } = await supabase.from('soul_blueprint_orders').update({ status: 'processing' }).eq('id', id);
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

async function markSoulBlueprintProcessed(id) {
  const { error } = await supabase.from('soul_blueprint_orders').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

async function markSoulBlueprintFailed(id, reason) {
  const { error } = await supabase.from('soul_blueprint_orders').update({ status: `failed: ${reason}` }).eq('id', id);
  if (error) console.error(`[Queue] Could not mark soul blueprint ${id} as failed:`, error.message);
}

async function saveGeneratedBlueprint(id, reading, closing) {
  const { error } = await supabase.from('soul_blueprint_orders').update({ generated_reading: reading, generated_closing: closing }).eq('id', id);
  if (error) throw new Error(`Could not save generated blueprint: ${error.message}`);
}

// ── Monthly Soul Reading subscriptions ──────────────────────────────────────

const crypto = require('crypto');

// Find an existing subscription for this email + pet (case-insensitive), or create one,
// backfilling missing pet details from the customer's past one-time Soul Reading order.
async function resolveOrCreateSubscription(order, details) {
  const email = order.email || order.contact_email;
  const petLower = details.petName.trim().toLowerCase();

  const { data: existingSubs } = await supabase
    .from('soul_subscriptions')
    .select('*')
    .eq('email', email);
  const found = (existingSubs || []).find(s => (s.pet_name || '').trim().toLowerCase() === petLower);
  if (found) return { subscription: found, isNew: false };

  // Backfill from the most recent matching one-time reading order.
  const { data: pastOrders } = await supabase
    .from('soul_reading_orders')
    .select('owner_name, pet_calls_you, species, life_stage, personality, photo_url, pet_name')
    .eq('email', email)
    .order('created_at', { ascending: false });
  const past = (pastOrders || []).find(o => (o.pet_name || '').trim().toLowerCase() === petLower)
    || (pastOrders || [])[0] || {};

  const row = {
    first_order_id: String(order.id),
    email,
    pet_name: details.petName.trim(),
    owner_name: details.ownerName || past.owner_name || null,
    pet_calls_you: details.petCallsYou || past.pet_calls_you || 'Mom',
    species: details.species || past.species || null,
    life_stage: details.lifeStage || past.life_stage || null,
    personality: details.personality || past.personality || null,
    photo_url: details.photoUrl || past.photo_url || null,
    reading_count: 0,
    question_token: crypto.randomBytes(12).toString('hex'),
    status: 'active',
  };
  const { data: created, error } = await supabase.from('soul_subscriptions').insert(row).select('*').single();
  if (error) throw new Error(`Subscription insert failed: ${error.message}`);
  return { subscription: created, isNew: true };
}

async function queueSubscriptionReading(subscriptionId, shopifyOrderId, monthNumber) {
  const minHours = process.env.INSTANT_SEND === 'true' ? 0 : 1;
  const maxHours = process.env.INSTANT_SEND === 'true' ? 0 : 6;
  const hours = minHours + Math.random() * (maxHours - minHours);
  const sendAfter = new Date(Date.now() + hours * 3600 * 1000);

  const { error } = await supabase.from('soul_subscription_orders').insert({
    shopify_order_id: String(shopifyOrderId),
    subscription_id: subscriptionId,
    month_number: monthNumber,
    status: 'pending',
    send_after: sendAfter.toISOString(),
  });
  // Duplicate shopify_order_id (webhook retry) → unique violation, safe to ignore.
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(`Sub queue failed: ${error.message}`);
}

async function getPendingSubscriptionReadings() {
  const { data, error } = await supabase
    .from('soul_subscription_orders')
    .select('*, soul_subscriptions(*)')
    .in('status', ['pending', 'processing'])
    .lte('send_after', new Date().toISOString())
    .limit(10);
  if (error) throw new Error(`Sub fetch failed: ${error.message}`);
  return data || [];
}

async function markSubscriptionReadingProcessing(id) {
  await supabase.from('soul_subscription_orders').update({ status: 'processing' }).eq('id', id);
}

async function markSubscriptionReadingProcessed(id, reading) {
  await supabase.from('soul_subscription_orders').update({ status: 'completed', processed_at: new Date().toISOString(), generated_reading: reading }).eq('id', id);
}

async function markSubscriptionReadingFailed(id, reason) {
  await supabase.from('soul_subscription_orders').update({ status: `failed: ${reason}` }).eq('id', id);
}

// After a monthly reading is sent: bump the count, stamp the time, clear the used question.
async function advanceSubscription(subscriptionId, newCount) {
  await supabase.from('soul_subscriptions')
    .update({ reading_count: newCount, last_reading_at: new Date().toISOString(), pending_question: null })
    .eq('id', subscriptionId);
}

async function getSubscriptionByToken(token) {
  const { data } = await supabase.from('soul_subscriptions').select('id, pet_name, status').eq('question_token', token).maybeSingle();
  return data;
}

async function setPendingQuestion(token, question) {
  const { error } = await supabase.from('soul_subscriptions').update({ pending_question: question }).eq('question_token', token);
  if (error) throw new Error(`Could not save question: ${error.message}`);
}

module.exports = {
  saveOrderToQueue, getPendingOrders, markOrderProcessing, markOrderProcessed, markOrderFailed, saveGeneratedLetter,
  saveSoulReadingToQueue, getPendingSoulReadings, markSoulReadingProcessing, markSoulReadingProcessed, markSoulReadingFailed, saveGeneratedReading,
  saveSoulBlueprintToQueue, getPendingSoulBlueprints, markSoulBlueprintProcessing, markSoulBlueprintProcessed, markSoulBlueprintFailed, saveGeneratedBlueprint,
  resolveOrCreateSubscription, queueSubscriptionReading, getPendingSubscriptionReadings,
  markSubscriptionReadingProcessing, markSubscriptionReadingProcessed, markSubscriptionReadingFailed,
  advanceSubscription, getSubscriptionByToken, setPendingQuestion,
};
