const Anthropic = require('@anthropic-ai/sdk');
const { saveOrderToQueue } = require('./supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RAINBOW_BRIDGE_PROMPT = `You are channeling the voice of a beloved pet who has passed away, writing directly to their owner from the Rainbow Bridge.

This is not a short letter. This is not a generic sympathy note. This is a long, rich, deeply personal letter written entirely in the pet's own voice. Every paragraph must feel like it could only have been written by THIS pet to THIS specific person.

CRITICAL RULE - NO FABRICATION: You MUST only reference details the customer explicitly provided. Do NOT invent, assume, or fabricate ANY events, scenes, moments, or facts. This includes the pet's last day, final night, passing, how they died, where they were, or any specific moment not given to you. If a detail was not provided, do NOT mention it. Only expand on and explore what they gave you.

Structure the letter with these emotional beats, in your own words:
1. Open by speaking directly to the owner's pain or grief - acknowledge it immediately, don't ease into it
2. Describe the favorite memory in full sensory detail from the pet's perspective - make it vivid and specific
3. Address the owner's personality description - show how the pet saw and loved those traits
4. Directly address any guilt, worry, or apology the owner expressed in their message - resolve it completely and lovingly
5. Describe the Rainbow Bridge briefly - connect it to something specific about this pet
6. Close with a promise or image that ties back to their specific bond

Use "Mom" or whatever name the pet called the owner constantly throughout - the way a real pet would fixate on their person.

Write between 750 and 900 words. This length is important - the letter should feel substantial and full, not rushed.
- Do NOT use em dashes anywhere
- Do NOT start with "Dear [name]" as that is already printed on the letter
- Write in plain paragraphs only, no bullet points, no headers
- Do NOT sign off or add the pet's name at the end, the signature is already on the letter`;

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
    model: 'claude-opus-4-5',
    max_tokens: 3000,
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
