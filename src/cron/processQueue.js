const {
  getPendingOrders, markOrderProcessed, markOrderFailed,
  getPendingSoulReadings, markSoulReadingProcessed, markSoulReadingFailed,
} = require('../services/supabase');
const { generateLetter } = require('../services/rainbowLetter');
const { generatePdf } = require('../services/pdfGenerator');
const { generateSoulReading } = require('../services/soulReading');
const { generateSoulReadingPdf } = require('../services/soulReadingPdf');
const { sendRainbowBridgeEmail, sendSoulReadingEmail } = require('../services/email');

async function processRainbowOrders() {
  let orders;
  try {
    orders = await getPendingOrders();
  } catch (err) {
    console.error('[Cron] Failed to fetch Rainbow orders:', err.message);
    return;
  }

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

      console.log(`[Cron] Generating Rainbow letter for ${details.petName} (order ${order.shopify_order_id})`);
      const letterBody = await generateLetter(details);
      const pdfBuffer = await generatePdf({ calledYou: details.calledYou, letterBody, petName: details.petName });
      await sendRainbowBridgeEmail({ toEmail: order.email, ownerName: details.ownerName, petName: details.petName, pdfBuffer });
      await markOrderProcessed(order.id);
      console.log(`[Cron] Rainbow order ${order.shopify_order_id} completed`);
    } catch (err) {
      console.error(`[Cron] Rainbow order ${order.shopify_order_id} failed:`, err.message);
      await markOrderFailed(order.id, err.message.slice(0, 100));
    }
  }
}

async function processSoulReadingOrders() {
  let orders;
  try {
    orders = await getPendingSoulReadings();
  } catch (err) {
    console.error('[Cron] Failed to fetch Soul Reading orders:', err.message);
    return;
  }

  for (const order of orders) {
    try {
      const details = {
        petName: order.pet_name,
        ownerName: order.owner_name,
        petCallsYou: order.pet_calls_you,
        photoUrl: order.photo_url,
        species: order.species,
        lifeStage: order.life_stage,
        personality: order.personality,
        question: order.question,
      };

      console.log(`[Cron] Generating Soul Reading for ${details.petName} (order ${order.shopify_order_id})`);
      const paragraphs = await generateSoulReading(details);
      const pdfBuffer = await generateSoulReadingPdf({ calledYou: details.petCallsYou, petName: details.petName, paragraphs, photoUrl: details.photoUrl });
      await sendSoulReadingEmail({ toEmail: order.email, ownerName: details.ownerName, petName: details.petName, pdfBuffer });
      await markSoulReadingProcessed(order.id);
      console.log(`[Cron] Soul Reading order ${order.shopify_order_id} completed`);
    } catch (err) {
      console.error(`[Cron] Soul Reading order ${order.shopify_order_id} failed:`, err.message);
      await markSoulReadingFailed(order.id, err.message.slice(0, 100));
    }
  }
}

async function processQueue() {
  await processRainbowOrders();
  await processSoulReadingOrders();

  const rainbowCount = (await getPendingOrders().catch(() => [])).length;
  const soulCount = (await getPendingSoulReadings().catch(() => [])).length;
  if (rainbowCount === 0 && soulCount === 0) {
    console.log('[Cron] No orders due yet');
  }
}

function startQueueCron() {
  const intervalMs = process.env.INSTANT_SEND === 'true' ? 60 * 1000 : 15 * 60 * 1000;
  console.log(`[Cron] Queue processor started — checking every ${process.env.INSTANT_SEND === 'true' ? '1 minute' : '15 minutes'}`);
  processQueue();
  setInterval(processQueue, intervalMs);
}

module.exports = { startQueueCron };
