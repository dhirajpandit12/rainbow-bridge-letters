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

async function processSubscriptionOrder(order) {
  const lineItems = (order.line_items || []).filter(item => {
    const title = (item.title || '').toLowerCase();
    return title.includes('monthly') && (title.includes('soul reading') || title.includes('pet soul'));
  });
  if (!lineItems.length) return;

  const seen = new Set();
  for (const lineItem of lineItems) {
    const details = extractProperties(lineItem);
    if (!details.petName) {
      console.warn(`[Subscription] Missing pet name for order ${order.id} — skipping line item`);
      continue;
    }
    const key = details.petName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Find or create the subscription (backfills pet details from past one-time orders).
    const { subscription, isNew } = await resolveOrCreateSubscription(order, details);

    // The month number for THIS reading = current count + 1 (1 = first reading).
    const monthNumber = (subscription.reading_count || 0) + 1;

    // On the very first reading, carry the customer's first question through the queue row
    // by stashing it as the subscription's pending_question so the cron uses it.
    if (isNew && details.firstQuestion) {
      const { setPendingQuestion } = require('./supabase');
      await setPendingQuestion(subscription.question_token, details.firstQuestion);
    }

    await queueSubscriptionReading(subscription.id, order.id, monthNumber);
    console.log(`[Subscription] Queued month ${monthNumber} reading for ${details.petName} (${isNew ? 'new' : 'recurring'}) order ${order.id}`);
  }
}

module.exports = { isMonthlySubscriptionOrder, processSubscriptionOrder };
