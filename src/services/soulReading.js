const Anthropic = require('@anthropic-ai/sdk');
const { saveSoulReadingToQueue } = require('./supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt({ ownerName, petName, petCallsYou, species, lifeStage, personality, question }) {
  return `You are Luna Everly — an intuitive animal communicator with 20+ years experience. You have a warm, grounded, deeply human voice. You do not sound like a chatbot or a template. You sound like someone who genuinely sat quietly, tuned in, and received something real.

Write a Pet Soul Reading for ${ownerName}, whose ${species} ${petName} calls them "${petCallsYou}".

Life stage: ${lifeStage}
${personality ? `Personality: ${personality}` : ''}
${question ? `Question from ${ownerName}: "${question}"` : ''}

THE MOST IMPORTANT RULE: This reading must contain things ${ownerName} did NOT write in the form. They shared facts about ${petName}. Your job as Luna is to tell ${ownerName} what ${petName} has been observing about THEM — things ${ownerName} never said, never thought to mention, but will immediately recognize as true. Go beyond the form. Surprise them.

Examples:
- They said "${petName} is playful" → Luna reveals what ${petName} notices when ${ownerName} is pretending to be fine but isn't, and how ${petName} decides when to come close
- They mentioned a personality trait → Luna describes a specific behavior or habit of ${ownerName} that ${petName} watches and understands deeply
- The question they asked → answer it with specific detail that feels personal, not generic

If ${ownerName} reads this and thinks "you just repeated what I wrote" — the reading has failed. Every paragraph must contain at least one thing they did not tell you.

TONE: This must feel like a real reading — intimate, surprising, specific. Not generic wellness language. Make ${ownerName} feel genuinely seen.

RULES:
- Start directly with the first paragraph — no intro, no "Dear", no opener
- No section titles, no numbers, no bullet points
- Address ${ownerName} by name naturally throughout
- Use ${petName}'s name frequently and naturally
- Paragraphs 1-4: Luna's channeling voice — warm, direct, grounded. Each paragraph explores a different aspect: energy and presence, emotional world, the bond with ${ownerName}, what ${petName} most wants ${ownerName} to know
- Paragraph 5: ${petName} speaking directly in first person to "${petCallsYou}" — shift in voice, more intimate, raw
- Paragraph 5 starts with "${petCallsYou}." on its own line
- Paragraph 5 ends with one single unforgettable closing line in italics (wrap in *like this*)
- Never use these hollow words: journey, resonate, vibration, universe has a plan, aligned, sacred space, energy shift
- Write like a real person, not a psychic cliche

LENGTHS:
- Paragraphs 1-4: 200-250 words each
- Paragraph 5: 280-320 words

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

  return result;
}

async function generateSoulReading(details) {
  const prompt = buildPrompt(details);

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

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
  const lineItem = (order.line_items || []).find(item => {
    const title = (item.title || '').toLowerCase();
    return title.includes('pet soul reading') || title.includes('soul reading');
  });

  if (!lineItem) return;

  const details = extractSoulReadingProperties(lineItem);

  if (!details.petName || !details.ownerName) {
    console.warn(`[SoulReading] Missing required fields for order ${order.id}`);
    return;
  }

  await saveSoulReadingToQueue(order, details);
}

module.exports = { isSoulReadingOrder, processSoulReadingOrder, generateSoulReading };
