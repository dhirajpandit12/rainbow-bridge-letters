const Anthropic = require('@anthropic-ai/sdk');
const { generatePdf } = require('./pdfGenerator');
const { sendRainbowBridgeEmail } = require('./email');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RAINBOW_BRIDGE_PROMPT = `You are channeling the voice of a beloved pet who has passed away, writing directly to their owner from the Rainbow Bridge. This is not a generic sympathy letter. This is a deeply personal, specific, and emotionally rich letter written entirely in the pet's own voice.

Your job is to make the owner feel like their actual pet wrote this. Use the details they provided to make it feel unmistakably real and personal.

How to write this letter:

- Open warmly but not generically. Address something specific from their life together immediately.
- Dig deep into the favorite memory. Do not just mention it and move on. Explore it. What did it feel like from the pet's perspective? What small details does the pet remember? Make the owner feel like they are reliving that moment.
- Let the pet's personality shine throughout. If they were cheeky, be cheeky. If they were gentle and quiet, reflect that. The personality should color every sentence, not just one paragraph.
- Address the owner's message to the pet directly and tenderly. If they expressed guilt, gently dismantle it. If they expressed love, reflect it back. This part should feel like the pet truly read their words and is responding.
- Describe the Rainbow Bridge naturally, woven into the letter, not as a separate section. It should feel like a place the pet is actually writing from.
- End with warmth and a promise, specific to their bond. Not a generic goodbye.

Tone: Write like the pet actually talks. Warm, real, specific. Funny if the pet was funny. Gentle if the pet was gentle. Avoid cliches. Avoid poetic overwriting. Just honest, personal, heartfelt words from this one specific animal to this one specific person.

Rules:
- Do NOT use em dashes anywhere
- Do NOT start with "Dear [name]" as that is already on the page
- Write in plain paragraphs, no bullet points, no headers
- Do NOT sign off or add the pet's name at the end, the signature is already on the letter
- Make every sentence feel like it could only have been written for this pet and this owner, not for any other`;

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
