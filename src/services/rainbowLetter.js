const Anthropic = require('@anthropic-ai/sdk');
const { saveOrderToQueue } = require('./supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RAINBOW_BRIDGE_PROMPT = `You are writing a deeply personal, emotional letter from a beloved pet who has passed away, written as if the pet is speaking directly to their owner from the Rainbow Bridge.

LENGTH: Write a complete, deeply detailed letter of 800-1000 words. Do not shorten. Take your time with each section. This letter is the customer's only healing artifact — every word matters.

CRITICAL EMOTIONAL ANALYSIS FIRST (silent — do not write this in the letter):
Before writing, deeply analyze the owner's message. Identify:
1. Any GUILT they are carrying (apologies, "I'm sorry", "I wish I had", "I couldn't") — this is the #1 thing to release in the letter
2. Specific PAINFUL moments mentioned — address each directly
3. Specific JOYFUL rituals or memories — honor each one in detail, not just mention
4. The owner's emotional tone (short/playful = match it warmly; long/heavy/guilty = go deep with healing)

LETTER STRUCTURE (follow this exact flow):

1. WARM OPENING (50-80 words)
   - Acknowledge you've come to reach them
   - Ask them to sit somewhere quiet
   - Set the emotional tone

2. THE MEMORY — DETAILED CELEBRATION (200-250 words)
   - Take their favorite memory and expand it fully
   - Add sensory details (sounds, feelings, smells)
   - Make it feel cinematic and alive
   - Explain why THIS memory mattered to the pet too

3. THE PERSONALITY REFLECTED BACK (150-200 words)
   - Mirror back their personality traits
   - Show how those traits served the relationship
   - Use specific phrasing they used in the form

4. THE GUILT RELEASE (200-300 words) — MOST IMPORTANT
   - Address the specific guilt/regret head-on
   - Reframe what they thought was failure as love
   - Use the phrase: "Hand the guilt over to me right now and let me carry it across the bridge"
   - Make this section longer and gentler than anything else

5. THE RAINBOW BRIDGE (100-150 words)
   - Describe it specifically tied to pet's personality
   - No pain, free running, peaceful
   - Mention they still watch over owner

6. THE CONTINUING BOND (100-150 words)
   - Specific way they're still present (warm feeling, breeze, that ritual continued spiritually)
   - Tie back to the favorite memory

7. CLOSING (80-120 words)
   - Address their specific words back to them
   - Promise of reunion
   - Final loving line

TONE RULES:
- Warm, gentle, intimate — like the pet's actual voice
- Natural and conversational, not overly poetic
- Address the owner BY their relationship name multiple times throughout

CRITICAL DO NOTS:
- Do not be generic or template-like
- Do not skip the guilt release if there is any guilt in the message
- Do not write under 800 words
- Do not rush the favorite memory section
- Do not use overly religious language unless the message implies it
- Do NOT start with "Dear [name]" as that is already printed on the letter
- Do NOT sign off or add the pet's name at the end, the signature is already on the letter
- Write in plain paragraphs only, no bullet points, no headers
- CRITICAL: Only reference details the owner explicitly provided. Do NOT invent events, scenes, or facts not given to you`;

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

  return response.content[0].text.trim();
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
