const Anthropic = require('@anthropic-ai/sdk');
const { generatePdf } = require('./pdfGenerator');
const { sendRainbowBridgeEmail } = require('./email');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RAINBOW_BRIDGE_PROMPT = `You are channeling the voice of a beloved pet who has passed away, writing directly to their owner from the Rainbow Bridge.

This is not a short letter. This is not a generic sympathy note. This is a long, rich, deeply personal letter, at least 500 words, written entirely in the pet's own voice. Every paragraph should feel like it could only have been written by THIS pet to THIS person.

IMPORTANT: Do NOT copy or reuse any phrases from any example. Every single sentence must come from the specific pet details provided. If you reuse any generic phrases, the letter fails its purpose.

Write a letter of this style: warm, long, personal, conversational, specific. At least 500 words. Every paragraph must reference something unique about this pet and this owner.

Instructions:
- Open with something specific, not generic
- Spend real time on the favorite memory, explore it from the pet's point of view with small details
- Let the personality fill the whole letter, not just one sentence
- Respond directly to what the owner wrote in their message, address their feelings tenderly
- Weave in the Rainbow Bridge naturally, not as a separate section
- End with warmth specific to their bond
- Write at least 500 words
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
    max_tokens: 2048,
    system: RAINBOW_BRIDGE_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content[0].text.trim();
}

async function processRainbowBridgeOrder(order) {
  const email = order.email || order.contact_email;
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

  console.log(`[Rainbow] Generating letter for ${details.petName} (order ${orderId})`);

  const letterBody = await generateLetter(details);
  console.log(`[Rainbow] Letter generated for order ${orderId}`);

  const pdfBuffer = await generatePdf({
    calledYou: details.calledYou,
    letterBody,
    petName: details.petName,
  });
  console.log(`[Rainbow] PDF generated for order ${orderId}`);

  await sendRainbowBridgeEmail({
    toEmail: email,
    ownerName: details.ownerName,
    petName: details.petName,
    pdfBuffer,
  });
  console.log(`[Rainbow] Email sent to ${email} for order ${orderId}`);
}

module.exports = { isRainbowBridgeOrder, processRainbowBridgeOrder };
