const { getPendingOrders, markOrderProcessed, markOrderFailed } = require('../services/supabase');
const { generateLetter } = require('../services/rainbowLetter');
const { generatePdf } = require('../services/pdfGenerator');
const { sendRainbowBridgeEmail } = require('../services/email');

async function processQueue() {
  let orders;
  try {
    orders = await getPendingOrders();
  } catch (err) {
    console.error('[Cron] Failed to fetch pending orders:', err.message);
    return;
  }

  if (orders.length === 0) return;

  console.log(`[Cron] Processing ${orders.length} pending order(s)`);

  for (const order of orders) {
    try {
      const details = {
        petName: order.pet_name,
        calledYou: order.called_you,
        petType: order.pet_type,
        ownerName: order.owner_name,
        personality: order.personality,
        favoriteMemory: order.favorite_memory,
        messageToPet: order.message_to_pet,
      };

      console.log(`[Cron] Generating letter for ${details.petName} (order ${order.shopify_order_id})`);
      const letterBody = await generateLetter(details);

      const pdfBuffer = await generatePdf({
        calledYou: details.calledYou,
        letterBody,
        petName: details.petName,
      });

      await sendRainbowBridgeEmail({
        toEmail: order.email,
        ownerName: details.ownerName,
        petName: details.petName,
        pdfBuffer,
      });

      await markOrderProcessed(order.id);
      console.log(`[Cron] Order ${order.shopify_order_id} completed — email sent to ${order.email}`);
    } catch (err) {
      console.error(`[Cron] Order ${order.shopify_order_id} failed:`, err.message);
      await markOrderFailed(order.id, err.message.slice(0, 100));
    }
  }
}

function startQueueCron() {
  console.log('[Cron] Queue processor started — checking every 15 minutes');
  processQueue();
  setInterval(processQueue, 15 * 60 * 1000);
}

module.exports = { startQueueCron };
