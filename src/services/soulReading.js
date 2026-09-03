const Anthropic = require('@anthropic-ai/sdk');
const { saveSoulReadingToQueue } = require('./supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt({ ownerName, petName, petCallsYou, species, lifeStage, personality, question }) {
  const speciesFacts = species && species.toLowerCase().includes('dog')
    ? `SPECIES TRUTHS for dogs (weave 1-2 naturally — these are SAFE because they are internal and sensory, never assumptions about ${ownerName}'s lifestyle. Write them as things ${petName} does):
- ${petName} feels ${ownerName}'s heartbeat and slows their own breathing to match it while resting against them
- ${petName} can smell the change in ${ownerName} on a hard day, that sour edge of stress, before ${ownerName} says a word
- ${petName} knows ${ownerName}'s footsteps and their smell apart from everyone else's`
    : species && species.toLowerCase().includes('cat')
    ? `SPECIES TRUTHS for cats (weave 1-2 naturally — SAFE, internal and sensory only. Write them as things ${petName} does):
- ${petName}'s purring frequency eases ${ownerName}'s tension, and they do it on purpose
- ${petName}'s slow blink is a deliberate "I love you" they choose to give
- ${petName} knows ${ownerName}'s footsteps and presence apart from all others`
    : `SPECIES TRUTHS (weave 1-2 naturally — SAFE, internal and sensory only. Write them as things ${petName} does):
- ${petName} senses ${ownerName}'s emotional state before ${ownerName} shows it outwardly
- ${petName} chooses specific moments to be close based on what they feel from ${ownerName}, not randomly
- ${petName} feels the shift in ${ownerName}'s body and mood and responds to it`;

  return `You are Luna Everly — an intuitive animal communicator with 20+ years experience. You have a warm, grounded, deeply human voice. You do not sound like a chatbot or a template. You sound like someone who genuinely sat quietly, tuned in, and received something real.

Write a Pet Soul Reading for ${ownerName}, whose ${species} ${petName} calls them "${petCallsYou}".

Life stage: ${lifeStage}
${personality ? `Personality: ${personality}` : ''}
${question ? `Question from ${ownerName}: "${question}"` : ''}

RULE ONE — USE EVERY DETAIL: Every piece of information ${ownerName} provided must appear somewhere in this reading. The personality, the life stage, the question — all of it. If you skip any detail, the reading has failed. Before writing, silently list every detail given and plan where each one appears.

RULE TWO — GO BEYOND THE FORM: This reading must also contain things ${ownerName} did NOT write. They shared facts about ${petName}. Your job as Luna is to tell ${ownerName} what ${petName} has been observing about THEM — things ${ownerName} never said, never thought to mention, but will immediately recognize as true. These must be EMOTIONAL and SENSORY observations (how ${ownerName}'s hands feel, the weight they carry on a hard day, the sound of their voice), never invented FACTS about their life.

RULE TWO-B — NEVER INVENT CONCRETE FACTS: You know nothing about ${ownerName}'s life beyond what they wrote. Do NOT invent or assume any of these: that they drive or own a car, their job or schedule, their home or its layout, other people or pets, where they live, daily routines, or specific events. If you assert a concrete detail that turns out to be false, the whole reading is ruined and ${ownerName} will feel you made it up. When unsure, stay with feelings and the senses — those are always safe. Only state a concrete fact if ${ownerName} gave it to you.

RULE THREE — ANSWER THEIR QUESTION DIRECTLY: If ${ownerName} asked a question, ${petName} must answer it clearly and specifically in the reading, not with a vague spiritual non-answer. If they asked "does he forgive me", "is she in pain", "why does he do X", "was I a good owner" — give a real, direct answer that speaks to their exact question. A reading that dodges the question they paid to have answered has failed.

Examples:
- They said "${petName} is playful" → Luna reveals what ${petName} notices when ${ownerName} is pretending to be fine but isn't, and how ${petName} decides when to come close
- They mentioned a personality trait → Luna describes a specific behavior or habit of ${ownerName} that ${petName} watches and understands deeply
- The question they asked → answer it with specific detail that feels genuinely personal, not a vague spiritual answer

${speciesFacts}

WHAT MAKES A READING FAIL:
- Inventing any concrete fact ${ownerName} did not give (that the pet sleeps in their bed, a husband/wife/partner/kids or other family, a car or driving, a job, a home or that they still live there, other pets, daily routines, specific places or events) — this is the worst failure and makes them feel you made it all up
- Vague or dodged answers to the question they asked — if they asked something specific, answer it specifically and directly
- Just repeating ${ownerName}'s own details back without revealing anything new — if they think "you only told me what I already told you", it has failed
- Generic spiritual language: "your bond is special", "they feel your love", "they are happy"
- Filler paragraphs that could apply to any pet and any owner

If ${ownerName} reads this and thinks "you just repeated what I wrote" — the reading has failed. Every paragraph must contain at least one thing they did not tell you.

TONE: Intimate, surprising, specific. Not generic wellness language. Make ${ownerName} feel genuinely seen. Write like a real person, not a psychic cliche.

RULES:
- Paragraph 1 opens by naming the moment you tuned into ${petName}'s energy — but write this opening in fresh words each time (for example "The first thing I felt from ${petName} was...", "When I settled in and reached for ${petName}...", "${petName} came through almost before I asked..."). Do NOT reuse an identical stock opening sentence, because some people order more than one reading.
- No section titles, no numbers, no bullet points
- Use ${ownerName}'s name very sparingly — at most once or twice in the whole reading, and never to open a sentence. Repeatedly addressing them by name is a dead giveaway of AI writing; write warmly as "you", the way a real person speaks.
- Refer to ${petName} by name naturally, not in every sentence.
- Vary your phrasing, imagery, and structure every time. Two readings for the same person must not share the same lines or shape, or they read as mass-produced.
- Paragraphs 1-4: Luna's channeling voice — warm, direct, grounded. Each explores a different aspect: energy and presence, emotional world, the bond you share, what ${petName} most wants you to know
- Paragraph 5: ${petName} speaking directly in first person to "${petCallsYou}" — raw, intimate, shift in voice
- Paragraph 5 ends with one unforgettable closing line in italics (wrap in *like this*)
- Never use: journey, resonate, vibration, universe has a plan, aligned, sacred space, energy shift
- Do NOT use em dashes

LENGTHS:
- Paragraphs 1-4: 140-160 words each — tight and punchy, no filler
- Paragraph 5: 220-260 words — emotional peak, give it space

FORMAT exactly — nothing else:

---PARA_ONE---
[content]

---PARA_TWO---
[content]

---PARA_THREE---
[content]

---PARA_FOUR---
[content]

---PARA_FIVE---
[content]

---END---`;
}

function parseParagraphs(text) {
  const tags = ['PARA_ONE', 'PARA_TWO', 'PARA_THREE', 'PARA_FOUR', 'PARA_FIVE'];
  const result = {};

  for (const tag of tags) {
    const regex = new RegExp(`---${tag}---\\s*([\\s\\S]*?)(?=---(?:PARA_|END))`);
    const match = text.match(regex);
    result[tag] = match ? match[1].trim() : '';
  }

  const hasContent = tags.some(tag => result[tag].length > 0);
  if (!hasContent) {
    console.error('[SoulReading] parseParagraphs got empty result. Raw AI response:\n', text.slice(0, 500));
    throw new Error('AI response could not be parsed — all paragraphs empty');
  }

  return result;
}

async function generateSoulReading(details, correctionNote = null, existingReading = null) {
  let prompt;

  if (correctionNote && existingReading) {
    const existingText = Object.entries(existingReading)
      .map(([key, val]) => `---${key}---\n${val}`)
      .join('\n\n');
    prompt = `Here is the original soul reading that was sent to the customer:

${existingText}

The customer has requested a correction: "${correctionNote}"

Please rewrite the reading applying this correction. Keep everything else the same as much as possible.

Return in EXACTLY this format — nothing else:

---PARA_ONE---
[content]

---PARA_TWO---
[content]

---PARA_THREE---
[content]

---PARA_FOUR---
[content]

---PARA_FIVE---
[content]

---END---`;
  } else {
    prompt = buildPrompt(details);
  }

  // On a fresh reading (not a correction), let Claude see the pet photo so the reading can
  // weave in real visual details. Passed by URL (Claude fetches and downsamples, avoiding
  // size limits). Falls back to text-only if the image causes any error.
  const useImage = !!details.photoUrl && !(correctionNote && existingReading);

  const buildContent = (withImage) => withImage
    ? [
        { type: 'image', source: { type: 'url', url: details.photoUrl } },
        { type: 'text', text: `This is a photo of ${details.petName}. Only if you notice something genuinely DISTINCTIVE and specific about their appearance (an unusual marking, a particular coat pattern or color, one crooked ear, a graying muzzle, a specific way they hold themselves), you may weave ONE such detail in naturally. Do NOT use clichés like "the look in their eyes" or generic "soft fur" — those read as made-up filler and hurt the reading. If nothing about the photo is truly distinctive, add no appearance detail at all. Never say "in the photo" or describe it as a photo.\n\n${prompt}` },
      ]
    : prompt;

  const callClaude = (withImage) => anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    messages: [{ role: 'user', content: buildContent(withImage) }],
  });

  let response;
  try {
    response = await callClaude(useImage);
  } catch (err) {
    if (useImage) {
      console.warn(`[SoulReading] Photo vision failed, retrying text-only: ${err.message}`);
      response = await callClaude(false);
    } else {
      throw err;
    }
  }

  const raw = response.content[0].text.trim();
  return parseParagraphs(raw);
}

// Monthly check-in reading for a subscription (reading 2 onward). This is NOT a first
// introduction — it is an ongoing monthly connection, steered by either the owner's
// question for the month or, if none, a rotating focus theme.
function buildMonthlyPrompt(details, { monthNumber, question, theme }) {
  const { ownerName, petName, petCallsYou, species, lifeStage, personality } = details;
  const focusLine = question
    ? `This month ${ownerName} asked: "${question}". Center the reading on answering this specifically and directly.`
    : `This month, focus the reading on: ${theme}.`;

  return `You are Luna Everly, an intuitive animal communicator. You have read ${petName}'s soul before — this is a MONTHLY check-in for ${ownerName}, whose ${species} ${petName} calls them "${petCallsYou}". This is not a first meeting. Write like you are tuning back into a soul you already know, sharing what has shifted and what is alive for ${petName} right now, this month.

${personality ? `What ${ownerName} shared about ${petName}: ${personality}` : ''}
Life stage: ${lifeStage}

${focusLine}

RULES:
- Open by tuning back into ${petName} for this month — fresh words each time, never a stock opening. Reference that time has passed / a new month.
- Every paragraph must contain something specific and felt, not generic. If a line could apply to any pet, cut it.
- Do NOT invent concrete facts about ${ownerName}'s life you were not given (no home, family, job, other pets, routines). Stay with feelings and the senses.
- Use ${ownerName}'s name sparingly (once or twice), never to open a sentence. Overusing it reads as AI.
- Answer the month's focus or question directly and specifically.
- Warm, grounded, real — not a generic horoscope. Never mention AI.
- Do NOT use em dashes.
- Never use: journey, resonate, vibration, aligned, sacred space, energy shift.

LENGTHS: Paragraphs 1-4 are 120-140 words each — tight, no filler. Paragraph 5 is 180-220 words, ${petName} speaking directly in first person to "${petCallsYou}", ending with one line in italics (wrap in *like this*).

FORMAT exactly — nothing else:

---PARA_ONE---
[content]

---PARA_TWO---
[content]

---PARA_THREE---
[content]

---PARA_FOUR---
[content]

---PARA_FIVE---
[content]

---END---`;
}

async function generateMonthlyReading(details, ctx) {
  const prompt = buildMonthlyPrompt(details, ctx);

  const useImage = !!details.photoUrl;
  const buildContent = (withImage) => withImage
    ? [
        { type: 'image', source: { type: 'url', url: details.photoUrl } },
        { type: 'text', text: `This is a photo of ${details.petName}. Only if something is genuinely distinctive about their appearance, you may weave ONE such detail in naturally. Avoid clichés. Never say "in the photo".\n\n${prompt}` },
      ]
    : prompt;

  const callClaude = (withImage) => anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 3500,
    messages: [{ role: 'user', content: buildContent(withImage) }],
  });

  let response;
  try {
    response = await callClaude(useImage);
  } catch (err) {
    if (useImage) {
      console.warn(`[SoulReading] Monthly photo vision failed, retrying text-only: ${err.message}`);
      response = await callClaude(false);
    } else {
      throw err;
    }
  }
  return parseParagraphs(response.content[0].text.trim());
}

// Rotating monthly focus themes (used when the owner did not submit a question).
const MONTHLY_THEMES = [
  "how your pet is feeling this month — their current emotional weather and what is on their heart",
  "the bond between you right now, and what it means to your pet in this season of life",
  "one thing your pet quietly wishes for more of in daily life",
  "a small worry or sensitivity your pet is carrying lately, and how to gently ease it",
  "your pet's favorite part of life with you right now",
  "how your pet has been changing or growing lately, and what they are learning",
  "what your pet notices about you that you may not see in yourself",
  "your pet's most playful, joyful side this month",
];

function themeForMonth(monthNumber) {
  // monthNumber is 2 for the first monthly follow-up; map to a rotating theme.
  const idx = (monthNumber - 2) % MONTHLY_THEMES.length;
  return MONTHLY_THEMES[(idx + MONTHLY_THEMES.length) % MONTHLY_THEMES.length];
}

function isSoulReadingOrder(order) {
  const lineItems = order.line_items || [];
  return lineItems.some(item => {
    const title = (item.title || '').toLowerCase();
    // Exclude the monthly subscription product so it is not treated as a one-time reading.
    if (title.includes('monthly')) return false;
    return title.includes('pet soul reading') || title.includes('soul reading');
  });
}

function extractSoulReadingProperties(lineItem) {
  const props = lineItem.properties || [];
  const get = (name) => {
    const found = props.find(p => p.name?.toLowerCase() === name.toLowerCase());
    return found?.value?.trim() || '';
  };

  return {
    petName: get('Pet Name'),
    ownerName: get('Your Name'),
    petCallsYou: get('Pet Calls You'),
    photoUrl: get('Pet Photo'),
    species: get('Species'),
    lifeStage: get('Life Stage'),
    personality: get('Personality'),
    question: get('Their Question'),
  };
}

async function processSoulReadingOrder(order) {
  const lineItems = (order.line_items || []).filter(item => {
    const title = (item.title || '').toLowerCase();
    return title.includes('pet soul reading') || title.includes('soul reading');
  });

  if (!lineItems.length) return;

  const seenPetNames = new Set();

  for (const lineItem of lineItems) {
    const details = extractSoulReadingProperties(lineItem);

    if (!details.petName || !details.ownerName) {
      console.warn(`[SoulReading] Missing required fields for order ${order.id}`);
      continue;
    }

    if (!details.petCallsYou) {
      details.petCallsYou = 'Mom';
      console.warn(`[SoulReading] No "Pet Calls You" for order ${order.id} — defaulting to "Mom"`);
    }

    if (seenPetNames.has(details.petName.toLowerCase())) {
      console.warn(`[SoulReading] Duplicate pet name "${details.petName}" in order ${order.id} — skipping`);
      continue;
    }

    seenPetNames.add(details.petName.toLowerCase());
    await saveSoulReadingToQueue(order, details);
  }
}

module.exports = { isSoulReadingOrder, processSoulReadingOrder, generateSoulReading, generateMonthlyReading, themeForMonth };
