const {
  getPendingOrders, markOrderProcessing, markOrderProcessed, markOrderFailed, saveGeneratedLetter,
  getPendingSoulReadings, markSoulReadingProcessing, markSoulReadingProcessed, markSoulReadingFailed, saveGeneratedReading,
  getPendingSoulBlueprints, markSoulBlueprintProcessing, markSoulBlueprintProcessed, markSoulBlueprintFailed, saveGeneratedBlueprint,
} = require('../services/supabase');
const { generateLetter } = require('../services/rainbowLetter');
const { generatePdf } = require('../services/pdfGenerator');
const { generateSoulReading } = require('../services/soulReading');
const { generateSoulReadingPdf } = require('../services/soulReadingPdf');
const { generateBlueprintReading, blueprintFacts } = require('../services/soulBlueprint');
const { generateSoulBlueprintPdf } = require('../services/soulBlueprintPdf');
const { sendRainbowBridgeEmail, sendSoulReadingEmail, sendSoulBlueprintEmail } = require('../services/email');

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
        photoUrl: order.photo_url,
      };

      await markOrderProcessing(order.id);
      console.log(`[Cron] Generating Rainbow letter for ${details.petName} (order ${order.shopify_order_id})`);

      let letterBody;
      const hasExistingLetter = order.generated_letter && order.generated_letter.trim();
      if (order.correction_note && hasExistingLetter) {
        letterBody = await generateLetter(details, order.correction_note, order.generated_letter);
      } else {
        letterBody = await generateLetter(details);
      }

      await saveGeneratedLetter(order.id, letterBody);
      const pdfBuffer = await generatePdf({ calledYou: details.calledYou, letterBody, petName: details.petName, photoUrl: details.photoUrl });
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

      await markSoulReadingProcessing(order.id);
      console.log(`[Cron] Generating Soul Reading for ${details.petName} (order ${order.shopify_order_id})`);

      let paragraphs;
      const hasExistingReading = order.generated_reading && order.generated_reading.PARA_ONE && order.generated_reading.PARA_ONE.trim();
      if (order.correction_note && hasExistingReading) {
        paragraphs = await generateSoulReading(details, order.correction_note, order.generated_reading);
      } else {
        paragraphs = await generateSoulReading(details);
      }

      await saveGeneratedReading(order.id, paragraphs);
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

async function processSoulBlueprintOrders() {
  let orders;
  try {
    orders = await getPendingSoulBlueprints();
  } catch (err) {
    console.error('[Cron] Failed to fetch Soul Blueprint orders:', err.message);
    return;
  }

  for (const order of orders) {
    try {
      const details = {
        firstName: order.first_name,
        birthDate: order.birth_date,
        birthPlace: order.birth_place,
        intention: order.intention,
      };

      await markSoulBlueprintProcessing(order.id);
      console.log(`[Cron] Generating Soul Blueprint for ${details.firstName} (order ${order.shopify_order_id})`);

      let reading, closing;
      if (order.generated_reading && order.generated_reading['Your Shape']) {
        reading = order.generated_reading;
        closing = order.generated_closing || '';
      } else {
        const facts = blueprintFacts(details.firstName, details.birthDate);
        const result = await generateBlueprintReading(details, facts);
        reading = result.reading;
        closing = result.closing;
        await saveGeneratedBlueprint(order.id, reading, closing);
      }

      const pdfBuffer = await generateSoulBlueprintPdf({ name: details.firstName, birth: details.birthDate, reading, closing, intention: details.intention });
      await sendSoulBlueprintEmail({ toEmail: order.email, firstName: details.firstName, pdfBuffer });
      await markSoulBlueprintProcessed(order.id);
      console.log(`[Cron] Soul Blueprint order ${order.shopify_order_id} completed`);
    } catch (err) {
      console.error(`[Cron] Soul Blueprint order ${order.shopify_order_id} failed:`, err.message);
      await markSoulBlueprintFailed(order.id, err.message.slice(0, 100));
    }
  }
}

async function processQueue() {
  await processRainbowOrders();
  await processSoulReadingOrders();
  await processSoulBlueprintOrders();

  const rainbowCount = (await getPendingOrders().catch(() => [])).length;
  const soulCount = (await getPendingSoulReadings().catch(() => [])).length;
  const blueprintCount = (await getPendingSoulBlueprints().catch(() => [])).length;
  if (rainbowCount === 0 && soulCount === 0 && blueprintCount === 0) {
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
