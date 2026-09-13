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

    // Path A (bought with a one-time): the one-time reading is the intro (reading 1), so this
    // subscription starts at count 1 and its first delivered reading is a themed monthly
    // (month 2 style), which reads completely differently from the intro. No duplicate.
    // Path B (direct): starts at 0, so its first reading is the full intro, using their question.
    const { subscription, isNew } = await resolveOrCreateSubscription(order, details, {
      initialReadingCount: boughtWithOneTime ? 1 : 0,
    });

    const monthNumber = (subscription.reading_count || 0) + 1;

    // Carry the customer's question only into a direct subscription's intro reading. For an
    // upsell, the one-time reading already answered it, so the monthly stays theme-led.
    if (isNew && !boughtWithOneTime && details.firstQuestion) {
      const { setPendingQuestion } = require('./supabase');
      await setPendingQuestion(subscription.question_token, details.firstQuestion);
    }

    await queueSubscriptionReading(subscription.id, order.id, monthNumber);
    const kind = boughtWithOneTime && isNew ? 'themed (with one-time intro)' : isNew ? 'intro' : 'recurring';
    console.log(`[Subscription] Queued month ${monthNumber} ${kind} reading for ${details.petName}, order ${order.id}`);
  }
}

module.exports = { isMonthlySubscriptionOrder, processSubscriptionOrder };
