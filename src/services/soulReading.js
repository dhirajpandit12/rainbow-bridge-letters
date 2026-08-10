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
- Inventing any concrete fact ${ownerName} did not give (a car, driving, a job, a home, other pets, routines) — this is the worst failure and makes them feel you made it all up
- Vague or dodged answers to the question they asked — if they asked something specific, answer it specifically and directly
- Just repeating ${ownerName}'s own details back without revealing anything new — if they think "you only told me what I already told you", it has failed
- Generic spiritual language: "your bond is special", "they feel your love", "they are happy"
- Filler paragraphs that could apply to any pet and any owner

If ${ownerName} reads this and thinks "you just repeated what I wrote" — the reading has failed. Every paragraph must contain at least one thing they did not tell you.

TONE: Intimate, surprising, specific. Not generic wellness language. Make ${ownerName} feel genuinely seen. Write like a real person, not a psychic cliche.

RULES:
- Paragraph 1 must open with: "When I connected with ${petName}'s energy, ${ownerName},"
- No section titles, no numbers, no bullet points
- Address ${ownerName} by name naturally throughout paragraphs 1-4
- Use ${petName}'s name frequently
- Paragraphs 1-4: Luna's channeling voice — warm, direct, grounded. Each explores a different aspect: energy and presence, emotional world, the bond with ${ownerName}, what ${petName} most wants ${ownerName} to know
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
        { type: 'text', text: `This is a photo of ${details.petName}. Notice their real appearance (coat color or markings, the look in their eyes, ears, expression) and weave 1-2 specific visual details naturally into the reading so it feels unmistakably about THIS pet. Do not describe the photo or say "in the photo".\n\n${prompt}` },
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

function isSoulReadingOrder(order) {
  const lineItems = order.line_items || [];
  return lineItems.some(item => {
    const title = (item.title || '').toLowerCase();
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

    if (seenPetNames.has(details.petName.toLowerCase())) {
      console.warn(`[SoulReading] Duplicate pet name "${details.petName}" in order ${order.id} — skipping`);
      continue;
    }

    seenPetNames.add(details.petName.toLowerCase());
    await saveSoulReadingToQueue(order, details);
  }
}

module.exports = { isSoulReadingOrder, processSoulReadingOrder, generateSoulReading };
