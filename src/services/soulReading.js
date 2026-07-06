const Anthropic = require('@anthropic-ai/sdk');
const { saveSoulReadingToQueue } = require('./supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt({ ownerName, petName, petCallsYou, species, lifeStage, personality, question }) {
  return `You are Luna Everly — an intuitive animal communicator with 20+ years experience.

Write a Pet Soul Reading for ${ownerName}, whose ${species} ${petName} calls them "${petCallsYou}".

Life stage: ${lifeStage}
${personality ? `Personality: ${personality}` : ''}
${question ? `Question from ${ownerName}: "${question}"` : ''}

RULES:
- Start directly with the first paragraph — no intro, no "Dear", no opener
- No section titles, no numbers
- Address ${ownerName} by name naturally at least 3 times
- Use ${petName}'s name frequently
- Paragraphs 1-4: Luna channeling voice
- Paragraph 5: ${petName} speaking directly in first person to "${petCallsYou}"
- Paragraph 5 starts with "${petCallsYou}." on its own line
- Paragraph 5 ends with one single unforgettable closing line in italics (wrap in *like this*)
- Never use: journey, resonate, vibration, universe has a plan
- Each paragraph 130-170 words

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
    petName: get("Pet's Name"),
    ownerName: get('Your Name'),
    petCallsYou: get('Your Pet Calls You'),
    photoUrl: get("Upload Pet's Photo"),
    species: get('Species'),
    lifeStage: get('Life Stage'),
    personality: get('Their Personality'),
    question: get('One Question For Your Pet'),
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
