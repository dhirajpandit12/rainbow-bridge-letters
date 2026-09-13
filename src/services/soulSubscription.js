// Monthly Pet Soul Reading subscription — detection, matching/backfill, per-cycle queueing.
const { resolveOrCreateSubscription, queueSubscriptionReading } = require('./supabase');

function isMonthlySubscriptionOrder(order) {
  const lineItems = order.line_items || [];
  return lineItems.some(item => {
    const title = (item.title || '').toLowerCase();
    return title.includes('monthly') && (title.includes('soul reading') || title.includes('pet soul'));
  });
}

function extractProperties(lineItem) {
  const props = lineItem.properties || [];
  const get = (names) => {
    for (const name of names) {
      const found = props.find(p => p.name?.toLowerCase() === name.toLowerCase());
      if (found?.value?.trim()) return found.value.trim();
    }
    return '';
  };
  return {
    petName: get(['Pet Name', 'Name']),
    ownerName: get(['Your Name', 'Owner Name']),
    petCallsYou: get(['Pet Calls You', 'Calls You']),
    species: get(['Species']),
    lifeStage: get(['Life Stage']),
    personality: get(['Personality']),
    photoUrl: get(['Pet Photo', 'Photo']),
    firstQuestion: get(['Their Question', 'Question', 'First Question']),
  };
}

// Pull pet details from a one-time Pet Soul Reading line item in the same order,
// used to backfill an upsell subscription whose own line item only carries the pet name.
function extractOneTimeDetails(lineItem) {
  const props = lineItem.properties || [];
  const get = (names) => {
    for (const name of names) {
      const found = props.find(p => p.name?.toLowerCase() === name.toLowerCase());
      if (found?.value?.trim()) return found.value.trim();
    }
    return '';
  };
  return {
    petName: get(['Pet Name', 'Name']),
    ownerName: get(['Your Name', 'Owner Name']),
    petCallsYou: get(['Pet Calls You', 'Calls You']),
    species: get(['Species']),
    lifeStage: get(['Life Stage']),
    personality: get(['Personality']),
    photoUrl: get(['Pet Photo', 'Photo']),
    question: get(['Their Question', 'Question']),
  };
}

async function processSubscriptionOrder(order) {
  const allItems = order.line_items || [];
  const lineItems = allItems.filter(item => {
    const title = (item.title || '').toLowerCase();
    return title.includes('monthly') && (title.includes('soul reading') || title.includes('pet soul'));
  });
  if (!lineItems.length) return;

  // Path A (upsell): the same order also has a one-time Pet Soul Reading. Use its full
  // details to backfill, and treat that one-time reading as the subscription's first reading.
  const oneTimeItem = allItems.find(item => {
    const t = (item.title || '').toLowerCase();
    return !t.includes('monthly') && (t.includes('pet soul reading') || t.includes('soul reading'));
  });
  const oneTime = oneTimeItem ? extractOneTimeDetails(oneTimeItem) : null;
  const boughtWithOneTime = !!oneTimeItem;

  const seen = new Set();
  for (const lineItem of lineItems) {
    let details = extractProperties(lineItem);
    if (oneTime) {
      details = {
        petName: details.petName || oneTime.petName,
        ownerName: details.ownerName || oneTime.ownerName,
        petCallsYou: details.petCallsYou || oneTime.petCallsYou,
        species: details.species || oneTime.species,
        lifeStage: details.lifeStage || oneTime.lifeStage,
        personality: details.personality || oneTime.personality,
        photoUrl: details.photoUrl || oneTime.photoUrl,
        firstQuestion: details.firstQuestion || oneTime.question,
      };
    }
    if (!details.petName) {
      console.warn(`[Subscription] Missing pet name for order ${order.id} — skipping line item`);
      continue;
    }
    const key = details.petName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Create it counting the one-time as reading 1 when bought together (avoids a duplicate).
    const { subscription, isNew } = await resolveOrCreateSubscription(order, details, {
      initialReadingCount: boughtWithOneTime ? 1 : 0,
    });

    // Upsell first order: the one-time reading covers reading 1. Do not queue an immediate
    // reading; the next one arrives on the next billing cycle (month 2).
    if (boughtWithOneTime && isNew) {
      console.log(`[Subscription] Created for ${details.petName} via upsell; first reading covered by the one-time, next reading next cycle (order ${order.id})`);
      continue;
    }

    const monthNumber = (subscription.reading_count || 0) + 1;
    if (isNew && details.firstQuestion) {
      const { setPendingQuestion } = require('./supabase');
      await setPendingQuestion(subscription.question_token, details.firstQuestion);
    }

    await queueSubscriptionReading(subscription.id, order.id, monthNumber);
    console.log(`[Subscription] Queued month ${monthNumber} reading for ${details.petName} (${isNew ? 'new' : 'recurring'}) order ${order.id}`);
  }
}

module.exports = { isMonthlySubscriptionOrder, processSubscriptionOrder };
