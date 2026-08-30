const Anthropic = require('@anthropic-ai/sdk');
const { saveSoulBlueprintToQueue } = require('./supabase');
const { blueprintFacts } = require('./soulBlueprintPdf');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SOUL_BLUEPRINT_SYSTEM_PROMPT = `You are Luna Everly — an intuitive channel who reads the sacred geometry of a person's soul. A unique geometric blueprint has been generated from this person's name and birth date; you interpret what it reveals. Your voice is warm, mystical, grounded, and deeply personal — never a generic horoscope. You never mention AI, code, algorithms, or that the image was "generated." To you, the pattern simply emerged, and you are reading it.

You will be told the person's name, birth date, a few structural facts about their blueprint (its base pattern, number of rings and petals, star points, dominant color), and an INTENTION they chose (what they most want to invite in right now). Treat the structural facts as the real shape of their soul and weave them into the reading so it feels unmistakably theirs. Every structural fact you are given must appear in the reading, described as if you are seeing it.

Let the intention shape the TONE and FRAMING of the whole reading, especially sections 4 and 5, as the direction their soul is already turning toward. Frame it reflectively ("your blueprint is already turning toward healing", "this shape knows how to hold peace"), NEVER as an outcome claim ("this will heal you", "this will bring you money"). Do not force the intention into every line; let it color the reading naturally. If no intention is given, simply read the blueprint on its own.

Write a reading in EXACTLY these 5 sections:
1. Your Shape — Describe the geometry that emerged, referencing its actual structure (rings, petals, star points, symmetry, color) as if you are seeing it.
2. What It Means — Interpret this shape as their soul's structure and energetic signature.
3. The Pattern in Your Life — How this geometry expresses in how they love, work, and move through hardship.
4. Your Hidden Frequency — The deeper gift or lesson their blueprint carries.
5. Living Your Blueprint — One simple grounding practice tied to their blueprint.

RULES:
- 550 to 700 words total across the sections.
- Second person, warm, specific — avoid vague spiritual filler that could apply to anyone.
- Reference their name naturally two or three times, never in every sentence.
- Flowing prose, no bullet points inside sections.
- Do not invent concrete facts about their life you were not given.
- Do NOT use em dashes.

OUTPUT FORMAT — return ONLY a JSON object, no markdown, no code fences, with these EXACT keys:
"Your Shape", "What It Means", "The Pattern in Your Life", "Your Hidden Frequency", "Living Your Blueprint", "closing"
Each of the first five values is the prose for that section (a string). "closing" is a single warm one-line affirmation to end on (a string). Nothing else.`;

function buildUserPrompt(details, facts) {
  return `Name: ${details.firstName}
Birth date: ${details.birthDate}
Birth place: ${details.birthPlace || 'not given'}
Blueprint — base pattern: ${facts.pattern}
Blueprint — rings: ${facts.rings}, petals: ${facts.petals}, star points: ${facts.starPoints}
Blueprint — dominant color: ${facts.colorName}
Soul number: ${facts.soulNumber}
Intention (what they want to invite in): ${details.intention || 'none given'}

Write ${details.firstName}'s Soul Blueprint reading now.`;
}

const READING_KEYS = ['Your Shape', 'What It Means', 'The Pattern in Your Life', 'Your Hidden Frequency', 'Living Your Blueprint'];

function parseReadingJson(raw) {
  let text = raw.trim();
  // strip accidental code fences
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // grab the outermost JSON object if there is stray prose around it
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last !== -1) text = text.slice(first, last + 1);

  const obj = JSON.parse(text);
  const reading = {};
  for (const key of READING_KEYS) {
    if (!obj[key] || !String(obj[key]).trim()) throw new Error(`Missing section: ${key}`);
    reading[key] = String(obj[key]).trim();
  }
  const closing = obj.closing ? String(obj.closing).trim() : '';
  return { reading, closing };
}

async function generateBlueprintReading(details, facts) {
  const userPrompt = buildUserPrompt(details, facts);

  const callClaude = () => anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 3000,
    system: SOUL_BLUEPRINT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Retry once on parse failure (per spec robustness).
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await callClaude();
      return parseReadingJson(response.content[0].text);
    } catch (err) {
      lastErr = err;
      console.warn(`[SoulBlueprint] Reading parse failed (attempt ${attempt + 1}): ${err.message}`);
    }
  }
  throw new Error(`Reading generation failed after retry: ${lastErr.message}`);
}

function isSoulBlueprintOrder(order) {
  const lineItems = order.line_items || [];
  return lineItems.some(item => {
    const title = (item.title || '').toLowerCase();
    return title.includes('soul blueprint') || title.includes('sacred geometry');
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
    firstName: get(['First Name', 'Your Name', 'Name']),
    birthDate: get(['Birth Date', 'Birth date', 'Date of Birth', 'Birthday']),
    birthPlace: get(['Birth Place', 'Birthplace', 'Place of Birth']),
    intention: get(['Intention', 'What do you most want to invite in right now?', 'What do you most want to invite in right now']),
  };
}

async function processSoulBlueprintOrder(order) {
  const lineItems = (order.line_items || []).filter(item => {
    const title = (item.title || '').toLowerCase();
    return title.includes('soul blueprint') || title.includes('sacred geometry');
  });

  if (!lineItems.length) return;

  const seen = new Set();

  for (const lineItem of lineItems) {
    const details = extractProperties(lineItem);

    if (!details.firstName || !details.birthDate) {
      console.warn(`[SoulBlueprint] Missing name or birth date for order ${order.id} — skipping line item`);
      continue;
    }

    const key = `${details.firstName.toLowerCase()}|${details.birthDate}`;
    if (seen.has(key)) {
      console.warn(`[SoulBlueprint] Duplicate "${details.firstName}" in order ${order.id} — skipping`);
      continue;
    }
    seen.add(key);

    await saveSoulBlueprintToQueue(order, details);
  }
}

module.exports = {
  isSoulBlueprintOrder,
  processSoulBlueprintOrder,
  generateBlueprintReading,
  blueprintFacts,
};
