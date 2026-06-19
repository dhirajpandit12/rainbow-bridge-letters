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
    .eq('status', 'pending')
    .lte('send_after', new Date().toISOString())
    .limit(10);

  if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
  return data || [];
}

async function markOrderProcessed(id) {
  const { error } = await supabase
    .from('rainbow_orders')
    .update({ status: 'completed', processed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

async function markOrderFailed(id, reason) {
  const { error } = await supabase
    .from('rainbow_orders')
    .update({ status: `failed: ${reason}` })
    .eq('id', id);

  if (error) console.error(`[Queue] Could not mark order ${id} as failed:`, error.message);
}

module.exports = { saveOrderToQueue, getPendingOrders, markOrderProcessed, markOrderFailed };
