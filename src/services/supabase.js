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

module.exports = {
  saveOrderToQueue, getPendingOrders, markOrderProcessing, markOrderProcessed, markOrderFailed, saveGeneratedLetter,
  saveSoulReadingToQueue, getPendingSoulReadings, markSoulReadingProcessing, markSoulReadingProcessed, markSoulReadingFailed, saveGeneratedReading,
  saveSoulBlueprintToQueue, getPendingSoulBlueprints, markSoulBlueprintProcessing, markSoulBlueprintProcessed, markSoulBlueprintFailed, saveGeneratedBlueprint,
};
