const {
  getPendingOrders, markOrderProcessing, markOrderProcessed, markOrderFailed, saveGeneratedLetter,
  getPendingSoulReadings, markSoulReadingProcessing, markSoulReadingProcessed, markSoulReadingFailed, saveGeneratedReading,
  getPendingSoulBlueprints, markSoulBlueprintProcessing, markSoulBlueprintProcessed, markSoulBlueprintFailed, saveGeneratedBlueprint,
  getPendingSubscriptionReadings, markSubscriptionReadingProcessing, markSubscriptionReadingProcessed, markSubscriptionReadingFailed, advanceSubscription,
  getPendingJourneyLetters, markJourneyLetterProcessing, markJourneyLetterProcessed, markJourneyLetterFailed,
  advanceJourney, setJourneyStatus, saveJourneyRblSummary, getJourneyPriorSummaries, getRblLetterBody, queueJourneyLetter,
} = require('../services/supabase');
const { generateLetter, generateJourneyLetter, summarizeLetter } = require('../services/rainbowLetter');
const { themeForIndex } = require('../services/rainbowJourney');
const { generatePdf } = require('../services/pdfGenerator');
const { generateSoulReading, generateMonthlyReading, themeForMonth } = require('../services/soulReading');
const { generateSoulReadingPdf } = require('../services/soulReadingPdf');
const { generateBlueprintReading, blueprintFacts } = require('../services/soulBlueprint');
const { generateSoulBlueprintPdf } = require('../services/soulBlueprintPdf');
const { sendRainbowBridgeEmail, sendSoulReadingEmail, sendSoulBlueprintEmail, sendJourneyLetterEmail } = require('../services/email');

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

async function processSubscriptionReadings() {
  let jobs;
  try {
    jobs = await getPendingSubscriptionReadings();
  } catch (err) {
    console.error('[Cron] Failed to fetch subscription readings:', err.message);
    return;
  }

  for (const job of jobs) {
    const sub = job.soul_subscriptions;
    if (!sub) { await markSubscriptionReadingFailed(job.id, 'subscription missing'); continue; }
    try {
      const details = {
        petName: sub.pet_name, ownerName: sub.owner_name, petCallsYou: sub.pet_calls_you,
        photoUrl: sub.photo_url, species: sub.species, lifeStage: sub.life_stage, personality: sub.personality,
      };
      const monthNumber = job.month_number || (sub.reading_count || 0) + 1;
      const question = (sub.pending_question || '').trim();

      await markSubscriptionReadingProcessing(job.id);
      console.log(`[Cron] Generating month ${monthNumber} reading for ${details.petName} (${sub.email})`);

      let paragraphs;
      if (monthNumber === 1) {
        // First reading: full introductory soul reading, using their first question if given.
        paragraphs = await generateSoulReading({ ...details, question });
      } else {
        // Monthly check-in: their question if submitted, else the month's rotating theme.
        const theme = question ? null : themeForMonth(monthNumber);
        paragraphs = await generateMonthlyReading(details, { monthNumber, question: question || null, theme });
      }

      const askLink = process.env.DASHBOARD_URL ? `${process.env.DASHBOARD_URL}/ask/${sub.question_token}` : null;
      const pdfBuffer = await generateSoulReadingPdf({ calledYou: details.petCallsYou, petName: details.petName, paragraphs, photoUrl: details.photoUrl });
      await sendSoulReadingEmail({ toEmail: sub.email, ownerName: details.ownerName, petName: details.petName, pdfBuffer, askLink });

      await markSubscriptionReadingProcessed(job.id, paragraphs);
      await advanceSubscription(sub.id, monthNumber);
      console.log(`[Cron] Subscription month ${monthNumber} sent for ${details.petName}`);
    } catch (err) {
      console.error(`[Cron] Subscription reading ${job.id} failed:`, err.message);
      await markSubscriptionReadingFailed(job.id, err.message.slice(0, 100));
    }
  }
}

// Anniversary = within 3 days of the month/day the pet passed (any year).
function isNearAnniversary(passedDate) {
  if (!passedDate) return false;
  const d = new Date(passedDate);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  return Math.abs((thisYear.getTime() - now.getTime()) / 86400000) <= 3;
}

async function processJourneyLetters() {
  let jobs;
  try {
    jobs = await getPendingJourneyLetters();
  } catch (err) {
    console.error('[Cron] Failed to fetch journey letters:', err.message);
    return;
  }

  for (const job of jobs) {
    const journey = job.rainbow_journeys;
    if (!journey) { await markJourneyLetterFailed(job.id, 'journey missing'); continue; }
    const n = job.letter_index;
    try {
      if (n > 6) {
        await markJourneyLetterFailed(job.id, 'beyond letter 6');
        await setJourneyStatus(journey.id, 'completed');
        continue;
      }
      // Monthly gate: send letter n only once cycle n is paid. Prepay has paid_cycles = 6.
      if (journey.plan === 'monthly' && (journey.paid_cycles || 0) < n) {
        continue; // leave pending; a later run sends it once the renewal is charged
      }

      await markJourneyLetterProcessing(job.id);
      console.log(`[Cron] Generating Healing Journey letter ${n} for ${journey.pet_name} (${journey.email})`);

      const details = {
        petName: journey.pet_name, ownerName: journey.owner_name, calledYou: journey.called_you,
        petType: journey.pet_type, gender: journey.gender, passedDate: journey.passed_date,
        personality: journey.personality, favoriteMemory: journey.favorite_memory,
        messageToPet: journey.message_to_pet, photoUrl: journey.photo_url,
      };

      // Type A: lazily build the "Letter 0" summary from the original RBL letter, once.
      let rblSummary = journey.rbl_summary || '';
      if (!rblSummary && journey.buyer_type === 'A') {
        const body = await getRblLetterBody({ sourceOrderId: journey.source_rbl_order_id, email: journey.email, petName: journey.pet_name });
        if (body) {
          rblSummary = await summarizeLetter(body);
          if (rblSummary) await saveJourneyRblSummary(journey.id, rblSummary);
        }
      }

      const priorSummaries = await getJourneyPriorSummaries(journey.id);
      const base = themeForIndex(n);
      const theme = { title: job.theme || base.title, core: base.core };
      const anniversary = isNearAnniversary(journey.passed_date);

      const letterBody = await generateJourneyLetter(details, { letterIndex: n, theme, priorSummaries, rblSummary, anniversary });
      const summary = await summarizeLetter(letterBody);

      const pdfBuffer = await generatePdf({
        calledYou: details.calledYou, letterBody, petName: details.petName,
        photoUrl: details.photoUrl, letterLabel: `Letter ${n} of 6`,
      });
      await sendJourneyLetterEmail({ toEmail: journey.email, ownerName: details.ownerName, petName: details.petName, pdfBuffer, letterIndex: n });

      await markJourneyLetterProcessed(job.id, letterBody, summary);
      await advanceJourney(journey.id, n);

      // Queue the next letter for both plans. Monthly's paid_cycles gate holds it until the
      // renewal is charged; prepay (paid_cycles = 6) lets it flow on the monthly schedule.
      if (n < 6) {
        const nextIdx = n + 1;
        const delayMs = process.env.INSTANT_SEND === 'true' ? 0 : 30 * 86400000;
        await queueJourneyLetter(journey.id, job.shopify_order_id, nextIdx, themeForIndex(nextIdx).title, new Date(Date.now() + delayMs));
      }
      console.log(`[Cron] Healing Journey letter ${n} sent for ${journey.pet_name}${n >= 6 ? ' (journey completed)' : ''}`);
    } catch (err) {
      console.error(`[Cron] Journey letter ${job.id} failed:`, err.message);
      await markJourneyLetterFailed(job.id, err.message.slice(0, 100));
    }
  }
}

async function processQueue() {
  await processRainbowOrders();
  await processSoulReadingOrders();
  await processSoulBlueprintOrders();
  await processSubscriptionReadings();
  await processJourneyLetters();

  // Marketing drip: invite past customers to the monthly subscription (~50/day).
  // Only runs when explicitly turned on, so it never sends by accident.
  if (process.env.CAMPAIGN_ACTIVE === 'true') {
    try {
      const { sendDailyBatch } = require('../services/campaign');
      await sendDailyBatch();
    } catch (err) {
      console.error('[Campaign] Daily batch error:', err.message);
    }
  }

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
