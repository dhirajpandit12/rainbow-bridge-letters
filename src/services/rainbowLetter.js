const Anthropic = require('@anthropic-ai/sdk');
const { generatePdf } = require('./pdfGenerator');
const { sendRainbowBridgeEmail } = require('./email');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RAINBOW_BRIDGE_PROMPT = `You are writing a deeply personal, emotional letter from a beloved pet who has passed away, written as if the pet is speaking directly to their owner from the Rainbow Bridge.

Write a heartfelt letter (300-400 words) from the pet's perspective with these elements:
1. A warm, loving opening continuing from the greeting
2. Reference their favorite memory together naturally
3. Mention their personality traits as the pet remembering them
4. Describe the Rainbow Bridge as a warm, peaceful place where they are running free
5. Reassure the owner they are okay and watching over them
6. Address the owner's message to the pet directly and gently
7. A gentle, loving goodbye with a promise to meet again

Tone: Warm, gentle, emotional, comforting, like the pet's actual voice. Not dramatic or overly poetic. Natural and personal.

Rules:
- Do NOT use em dashes (--) anywhere
- Do NOT start with "Dear [name]" as that is already printed on the letter
- Start the letter body directly, for example: "If I could reach you across the Rainbow Bridge..."
- Write in plain paragraphs, no bullet points, no headings
- Do NOT sign off or add the pet's name at the end — the signature is already printed on the letter separately
- Keep it personal to the specific details provided`;

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
    max_tokens: 1024,
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
