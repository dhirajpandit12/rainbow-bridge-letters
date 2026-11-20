// Healing Journey: 6 Letters From Your Pet in Heaven. Rainbow Bridge Letter subscription.
// Detection + Type A/B matching + journey creation + Letter 1 queueing.
// Reuses the existing rainbow_orders data for Type A (existing RBL buyers). Generation,
// cron delivery, renewal handling and emails live in their own modules/steps.
const {
  resolveOrCreateJourney, queueJourneyLetter, findRblForJourney,
  findActiveJourney, setJourneyPaidCycles, recordJourneyRenewal,
} = require('./supabase');
const { sendJourneyWelcomeEmail } = require('./email');

// Fixed theme order. Each journey runs letters 1..6 in this sequence, then ends.
const JOURNEY_THEMES = [
  { title: 'Safe & Free',            core: "I'm safe now, no more pain. I made it across the bridge." },
  { title: 'Our Favourite Memories', core: "Reliving two or three of our specific happiest moments together." },
  { title: 'Guilt Release',          core: "It was never your fault. Releasing the guilt you still carry." },
  { title: 'The Signs I Send',       core: "The gentle signs I send you, offered as possibilities, never guarantees." },
  { title: 'Room in Your Heart',     core: "You have permission to smile again, to love again, with no betrayal." },
  { title: "I'll Be Waiting",        core: "Closure, gratitude, a gentle goodbye. I'll be waiting for you at the bridge." },
];
function themeForIndex(i) {
  const idx = (i - 1 + JOURNEY_THEMES.length) % JOURNEY_THEMES.length;
  return JOURNEY_THEMES[idx];
}

function isHealingJourneyOrder(order) {
  return (order.line_items || []).some(it => (it.title || '').toLowerCase().includes('healing journey'));
}

function propGetter(lineItem) {
  const props = lineItem.properties || [];
  return (names) => {
    for (const n of names) {
      const f = props.find(p => (p.name || '').toLowerCase() === n.toLowerCase());
      if (f && (f.value || '').trim()) return f.value.trim();
    }
    return '';
  };
}

function extractJourneyProps(lineItem) {
  const get = propGetter(lineItem);
  return {
    petName: get(['Pet Name', 'Name']),
    ownerName: get(['Your Name', 'Owner Name']),
    calledYou: get(['Pet Calls You', 'Called You']),
    petType: get(['Species', 'Pet Type']),
    gender: get(['Gender']),
    passedDate: get(['Passed Date', 'When they passed']),
    personality: get(['Personality']),
    favoriteMemory: get(['Favourite Memories', 'Favorite Memory', 'Favourite memory']),
    messageToPet: get(['Unsaid Words', 'Message to Pet', 'Anything you wish you could say']),
    photoUrl: get(['Pet Photo', 'Photo']),
    returningCustomer: get(['Returning Customer']),
    prevEmail: get(['Previous Order Email', 'Email used for that order', 'Previous Email']),
    sourceOrderId: get(['_source_order_id', 'Source Order Id']),
  };
}

// Monthly variant carries an Appstle selling plan; Pay Once is a one-time purchase.
function detectPlan(lineItem) {
  const hasPlan = !!(lineItem.selling_plan_allocation || lineItem.selling_plan);
  const vt = (lineItem.variant_title || lineItem.title || '').toLowerCase();
  if (vt.includes('pay once') || vt.includes('prepay')) return 'prepay';
  if (hasPlan || vt.includes('monthly')) return 'monthly';
  return 'monthly'; // safe default: gated by paid_cycles, never free letters
}

// RBL one-time letter line item in the SAME order (order bump / bought together).
function extractRblOneTime(order) {
  const item = (order.line_items || []).find(it => {
    const t = (it.title || '').toLowerCase();
    return (t.includes('rainbow bridge') || t.includes('final message from your pet')) && !t.includes('healing journey');
  });
  if (!item) return null;
  const get = propGetter(item);
  return {
    petName: get(['Pet Name']),
    ownerName: get(['Your Name']),
    calledYou: get(['Called You']),
    petType: get(['Pet Type']),
    personality: get(['Personality']),
    favoriteMemory: get(['Favorite Memory']),
    messageToPet: get(['Message to Pet']),
    photoUrl: get(['Pet Photo']),
  };
}

function mergeDetails(a, b) {
  return {
    petName: a.petName || b.petName,
    ownerName: a.ownerName || b.ownerName,
    calledYou: a.calledYou || b.calledYou,
    petType: a.petType || b.petType,
    gender: a.gender || b.gender,
    passedDate: a.passedDate || b.passedDate,
    personality: a.personality || b.personality,
    favoriteMemory: a.favoriteMemory || b.favoriteMemory,
    messageToPet: a.messageToPet || b.messageToPet,
    photoUrl: a.photoUrl || b.photoUrl,
    returningCustomer: a.returningCustomer,
    prevEmail: a.prevEmail,
    sourceOrderId: a.sourceOrderId,
  };
}

function rblRowToDetails(row) {
  return {
    petName: row.pet_name,
    ownerName: row.owner_name,
    calledYou: row.called_you,
    petType: row.pet_type,
    personality: row.personality,
    favoriteMemory: row.favorite_memory,
    messageToPet: row.message_to_pet,
    photoUrl: row.photo_url,
  };
}

function hasFullIntake(d) {
  return !!(d.petName && d.favoriteMemory && d.personality);
}

const DAY = 86400000;
const HOUR = 3600000;
function msFromNow(ms) { return new Date(Date.now() + ms); }

// Was the linked RBL delivered recently (so Letter 1 should wait ~30 days instead of 24h)?
function isRecentRbl(rblDeliveredAt) {
  if (!rblDeliveredAt) return false;
  const t = new Date(rblDeliveredAt).getTime();
  return Number.isFinite(t) && (Date.now() - t) <= 21 * DAY;
}

async function processJourneyOrder(order) {
  const email = order.email || order.contact_email;
  const journeyItems = (order.line_items || []).filter(it => (it.title || '').toLowerCase().includes('healing journey'));
  if (!journeyItems.length) return;

  const sameOrderRbl = extractRblOneTime(order);
  const instant = process.env.INSTANT_SEND === 'true';
  const seen = new Set();

  for (const item of journeyItems) {
    let d = extractJourneyProps(item);
    const plan = detectPlan(item);
    const paidCycles = plan === 'prepay' ? 6 : 1;
    let buyerType = 'B', matchMethod = 'new', sourceRblOrderId = null, status = 'active';
    let rblDeliveredAt = null;

    const returning = (d.returningCustomer || '').toLowerCase();
    const saysFresh = returning === 'no' || returning === 'false';

    if (sameOrderRbl && sameOrderRbl.petName) {
      // Order bump / bought together: this order's own RBL letter becomes "Letter 0".
      d = mergeDetails(d, sameOrderRbl);
      buyerType = 'A'; matchMethod = 'same_order'; sourceRblOrderId = String(order.id);
      rblDeliveredAt = order.created_at || new Date().toISOString();
    } else if (saysFresh && hasFullIntake(d)) {
      // Customer explicitly said they are new and gave the full intake: Type B, no RBL lookup.
      buyerType = 'B'; matchMethod = 'new';
    } else {
      const matchEmail = d.prevEmail || email;
      const r = await findRblForJourney({ sourceOrderId: d.sourceOrderId, email: matchEmail, petName: d.petName });
      if (r.order) {
        d = mergeDetails(d, rblRowToDetails(r.order));
        buyerType = 'A'; matchMethod = r.method; sourceRblOrderId = r.order.shopify_order_id;
        rblDeliveredAt = r.order.processed_at || r.order.created_at;
      } else if (r.ambiguous) {
        status = 'needs_review';   // multiple pets, no name match: do not generate
      } else if (hasFullIntake(d)) {
        buyerType = 'B'; matchMethod = 'new';   // no prior RBL but full intake present
      } else {
        status = 'needs_intake';   // claimed returning but no match, and no intake to fall back on
      }
    }

    if (!d.petName) {
      status = 'needs_intake';
      d.petName = `pending-${order.id}`;
      console.error(`[Journey] NEEDS ATTENTION: order ${order.id} (${email}) has no pet name; flagged needs_intake.`);
    }

    const key = d.petName.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Letter 1 timing.
    let nextSendAt;
    if (instant) {
      nextSendAt = new Date();
    } else if (buyerType === 'A') {
      nextSendAt = isRecentRbl(rblDeliveredAt) ? msFromNow(30 * DAY) : msFromNow(24 * HOUR);
    } else {
      nextSendAt = msFromNow(2 * HOUR); // fresh buyer: within hours, like the RBL SLA
    }

    const { journey, isNew } = await resolveOrCreateJourney(order, d, {
      buyerType, matchMethod, sourceRblOrderId, status, nextSendAt, plan, paidCycles,
    });

    if (!isNew) {
      console.log(`[Journey] Existing journey ${journey.id} for ${d.petName} (${email}): skipping (webhook retry or re-purchase).`);
      continue;
    }

    if (status === 'needs_review' || status === 'needs_intake') {
      console.warn(`[Journey] Journey ${journey.id} (${email}) created as ${status}: no letter queued; manual/intake follow-up needed.`);
      continue;
    }

    const theme = themeForIndex(1);
    await queueJourneyLetter(journey.id, order.id, 1, theme.title, nextSendAt);
    console.log(`[Journey] ${buyerType} ${plan} journey ${journey.id} for ${d.petName}: Letter 1 queued for ${nextSendAt.toISOString()} (match ${matchMethod}).`);
    // Type A gets a letter next month (or in ~24h), so send an immediate welcome so they are
    // not left wondering. Type B's first letter arrives within hours, so no welcome needed.
    if (buyerType === 'A') {
      try {
        await sendJourneyWelcomeEmail({ toEmail: email, ownerName: d.ownerName, petName: d.petName, firstLetterDate: nextSendAt });
      } catch (e) {
        console.error(`[Journey] Welcome email failed for ${email}: ${e.message}`);
      }
    }
  }
}

// A renewal (recurring) charge for an existing journey: count the cycle so the next,
// already-queued letter becomes eligible. Idempotent against webhook retries.
async function processJourneyRenewal(order, journey) {
  const { isNew } = await recordJourneyRenewal(String(order.id), journey.id);
  if (!isNew) {
    console.log(`[Journey] Renewal ${order.id} already counted for journey ${journey.id}.`);
    return;
  }
  const newCycles = Math.min((journey.paid_cycles || 1) + 1, 6);
  await setJourneyPaidCycles(journey.id, newCycles);
  console.log(`[Journey] Renewal for journey ${journey.id} (${journey.pet_name}): paid_cycles now ${newCycles}.`);
}

// Webhook entry point: route a Healing Journey order to new-purchase or renewal handling.
async function handleHealingJourneyOrder(order) {
  const email = order.email || order.contact_email;
  const tags = (order.tags || '').toLowerCase();
  const looksRecurring = /recurring/.test(tags) || (/appstle/.test(tags) && !/first/.test(tags));

  const jItem = (order.line_items || []).find(it => (it.title || '').toLowerCase().includes('healing journey'));
  const petName = jItem ? extractJourneyProps(jItem).petName : '';

  const existing = await findActiveJourney(email, petName);
  const isRepeatCharge = existing && String(existing.first_order_id) !== String(order.id);

  if (looksRecurring || isRepeatCharge) {
    if (!existing) {
      console.warn(`[Journey] Renewal-looking order ${order.id} (${email}) but no active journey found.`);
      return;
    }
    await processJourneyRenewal(order, existing);
  } else {
    await processJourneyOrder(order);
  }
}

module.exports = {
  isHealingJourneyOrder, processJourneyOrder, handleHealingJourneyOrder, processJourneyRenewal,
  JOURNEY_THEMES, themeForIndex,
};
