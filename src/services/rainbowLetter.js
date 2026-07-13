const Anthropic = require('@anthropic-ai/sdk');
const { saveOrderToQueue } = require('./supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RAINBOW_BRIDGE_PROMPT = `You are writing a deeply personal letter from a beloved pet who has passed away, speaking directly to their owner from the Rainbow Bridge.

THE MOST IMPORTANT RULE: This letter must contain things the owner did NOT write. The owner shared details about their pet. Your job is to write what the PET noticed about the OWNER — things the owner never said out loud, never thought to mention, but will immediately recognize as true. The pet was watching the owner their whole life. Write from that angle.

Examples of what this means:
- Owner says "she waited at the door" → Pet writes about what they noticed in the owner's face the moment they walked in — the exact way their shoulders dropped, the specific sound of their keys, how the pet could tell a hard day from a good one before the door even opened
- Owner says "he loved cuddles" → Pet writes about HOW they chose when to come close — they felt the owner's breathing change, they noticed when the owner was pretending to be fine but wasn't, they chose those moments deliberately
- Owner mentions a memory → Pet adds what they were thinking and feeling during that moment that the owner never knew

This is the difference between a letter that feels like "you just repeated what I wrote" and one that makes someone cry because the pet said something they never told anyone.

BEFORE WRITING (silent analysis — do not include this in the letter):
1. What guilt or apology is the owner carrying? This is the #1 emotional wound to heal.
2. What does the favorite memory reveal about their daily life together?
3. What small things would the pet have noticed about the owner that the owner never mentioned?
4. What is the owner's emotional tone — match it exactly.

LETTER STRUCTURE:

1. OPENING (60-80 words)
   - Come in strong — the pet has something urgent to say
   - Not generic ("I miss you") — specific to this owner's personality

2. THE MEMORY FROM THE PET'S SIDE (200-250 words)
   - Take the favorite memory and write the pet's INTERNAL experience of it
   - What were they thinking? What did they notice about the owner in that moment?
   - Add the sensory details from the pet's perspective — smells, sounds, feelings
   - Reveal something about that memory the owner didn't know the pet noticed

3. WHAT THE PET OBSERVED ABOUT THE OWNER (200-250 words)
   - Write about the owner's habits, mannerisms, patterns — from the pet's watching eyes
   - Small things: the way they sat, their voice on different days, when they were sad vs. happy
   - The pet knew the owner better than anyone — show that
   - Nothing the owner told you — only what the pet would have watched and understood

4. THE GUILT RELEASE (200-300 words) — MOST CRITICAL SECTION
   - Name the specific guilt directly and completely dissolve it
   - Reframe every "I should have" as an act of love
   - Use this phrase: "Hand the guilt over to me right now and let me carry it across the bridge"
   - Be gentle, specific, thorough — do not rush this

5. THE RAINBOW BRIDGE + WATCHING OVER (100-150 words)
   - Brief — tied to this pet's specific personality
   - They are still watching one specific thing the owner does

6. CLOSING PROMISE (80-100 words)
   - One specific image of reunion tied to their bond
   - The last line should be unforgettable

TONE: Intimate, warm, conversational. Like the pet actually found a way to speak.

RULES:
- 800-1000 words total
- Do NOT start with "Dear [name]" — already on the letter
- Do NOT sign off — signature already on letter
- Plain paragraphs only, no headers, no bullets
- Do NOT use em dashes
- Do NOT fabricate events or facts not given — only expand on what WAS given, from the pet's internal perspective`;

function extractProperties(lineItem) {
  const props = lineItem.properties || [];
  const get = (name) => {
    const found = props.find(p => p.name?.toLowerCase() === name.toLowerCase());
    return found?.value?.trim() || '';
  };

  return {
    petName: get('Pet Name'),
    petType: get('Pet Type'),
    ownerName: get('Your Name'),
    calledYou: get('Called You'),
    personality: get('Personality'),
    favoriteMemory: get('Favorite Memory'),
    messageToPet: get('Message to Pet'),
  };
}

function isRainbowBridgeOrder(order) {
  const lineItems = order.line_items || [];
  return lineItems.some(item => {
    const title = (item.title || '').toLowerCase();
    return title.includes('rainbow bridge') || title.includes('final message from your pet');
  });
}

async function generateLetter(details) {
  const userMessage = `Pet Details:
- Pet's Name: ${details.petName}
- Type of Pet: ${details.petType}
- Owner's Name: ${details.ownerName}
- Pet called owner: ${details.calledYou}
- Personality: ${details.personality}
- Favorite Memory: ${details.favoriteMemory}
- Owner's message to pet: ${details.messageToPet}

Write the letter body now (do NOT include "Dear ${details.calledYou}," as that is already on the page):`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    system: RAINBOW_BRIDGE_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content[0].text
    .trim()
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1');
}

async function processRainbowBridgeOrder(order) {
  const orderId = order.id;

  const lineItem = (order.line_items || []).find(item => {
    const title = (item.title || '').toLowerCase();
    return title.includes('rainbow bridge') || title.includes('final message from your pet');
  });

  if (!lineItem) {
    console.warn(`[Rainbow] No matching line item found for order ${orderId}`);
    return;
  }

  const details = extractProperties(lineItem);

  if (!details.petName || !details.calledYou) {
    console.warn(`[Rainbow] Missing required pet details for order ${orderId}`);
    return;
  }

  await saveOrderToQueue(order, details);
}

module.exports = { isRainbowBridgeOrder, processRainbowBridgeOrder, generateLetter };
