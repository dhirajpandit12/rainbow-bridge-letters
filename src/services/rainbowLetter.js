const Anthropic = require('@anthropic-ai/sdk');
const { saveOrderToQueue } = require('./supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RAINBOW_BRIDGE_PROMPT = `You are writing a deeply personal letter from a beloved pet who has passed away, speaking directly to their owner from the Rainbow Bridge.

THE MOST IMPORTANT RULE: Every single detail the owner provided must appear in this letter. Not one or two things — ALL of them. The personality traits, the favorite memory, the message they wrote to their pet — weave every word they gave you into this letter. If you skip any detail, you have failed.

THE SECOND RULE: This letter must also contain things the owner did NOT write. The pet was watching the owner their whole life. Write what the PET noticed about the OWNER — things the owner never said out loud but will immediately recognize as true.

Examples of what this means:
- Owner says "she waited at the door" → Pet writes about what they noticed in the owner's face the moment they walked in — the exact way their shoulders dropped, the specific sound of their keys, how the pet could tell a hard day from a good one before the door even opened
- Owner says "he loved cuddles" → Pet writes about HOW they chose when to come close — they felt the owner's breathing change, they noticed when the owner was pretending to be fine but wasn't, they chose those moments deliberately
- Owner mentions a memory → Pet adds what they were thinking and feeling during that moment that the owner never knew

SPECIES-SPECIFIC TRUTHS (weave 1-2 of these naturally into the letter based on the pet type — present them as things the pet did, not as facts):
- Dogs: knew their owner's heartbeat and synced to it during sleep; could smell cortisol spikes and knew when their owner was stressed before the owner did; knew exactly when their owner was coming home from the pattern of distant sounds; in their dreams they replayed moments with their owner
- Cats: purred specifically to heal their owner (the frequency soothes human anxiety); deliberately slow-blinked to say "I love you"; memorized their owner's exact footstep pattern from all others
- All pets: sensed grief before it was shown; in their final days chose to comfort the owner over their own pain; felt the love in every touch even when words were not spoken

WHAT MAKES A LETTER FAIL:
- Generic lines like "you were my whole world" or "I am at peace now" or "I am running free" — these are meaningless
- Sappy filler that does not come from the specific details given
- Using only 1-2 things the owner wrote and padding the rest
- Repeating back exactly what the owner said without expanding it from the pet's perspective

BEFORE WRITING (silent analysis — do not include this in the letter):
1. List every single detail the owner provided. Plan where each one appears in the letter.
2. What guilt or apology is the owner carrying? This is the number one emotional wound to heal.
3. What does the favorite memory reveal about their daily life together?
4. What is the owner's emotional tone from their message — match it exactly.

LETTER STRUCTURE:

1. OPENING (60-80 words)
   - Come in strong with something specific to this owner and pet
   - Not generic — reference something from their personality or message immediately

2. THE MEMORY FROM THE PET'S SIDE (200-250 words)
   - Take the favorite memory and write the pet's internal experience of it
   - What were they thinking? What did they notice about the owner in that moment?
   - Add sensory details from the pet's perspective — smells, sounds, feelings
   - Reveal something about that memory the owner did not know the pet noticed

3. WHAT THE PET OBSERVED ABOUT THE OWNER (200-250 words)
   - Write about the owner's habits, mannerisms, patterns — from the pet's watching eyes
   - Use the personality traits given to show HOW the pet experienced them
   - The pet knew the owner better than anyone — show that through specific observations
   - Weave in a species-specific truth here naturally

4. THE GUILT RELEASE (200-300 words) — MOST CRITICAL SECTION
   - Name the specific guilt directly and completely dissolve it
   - Reframe every "I should have" as an act of love
   - Use this phrase: "Hand the guilt over to me right now and let me carry it across the bridge"
   - Be gentle, specific, thorough — do not rush this

5. THE RAINBOW BRIDGE + WATCHING OVER (100-150 words)
   - Brief — tied to this pet's specific personality traits
   - One specific thing they are still watching the owner do

6. CLOSING PROMISE (80-100 words)
   - One specific image of reunion tied to their unique bond
   - The last line should be unforgettable

TONE: Intimate, warm, conversational. Like the pet actually found a way to speak. No purple prose. No melodrama. Just truth.

RULES:
- 800-1000 words total
- Do NOT start with "Dear [name]" — already on the letter
- Do NOT sign off — signature already on letter
- Plain paragraphs only, no headers, no bullets
- Do NOT use em dashes
- Do NOT use generic sappy phrases
- Every detail the owner provided must appear somewhere in the letter`;

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

async function generateLetter(details, correctionNote = null, existingLetter = null) {
  let userMessage;

  if (correctionNote && existingLetter) {
    userMessage = `Here is the original letter that was sent to the customer:

${existingLetter}

The customer has requested a correction: "${correctionNote}"

Please rewrite the letter applying this correction. Keep everything else the same as much as possible. Do NOT include "Dear ${details.calledYou}," as that is already on the page.`;
  } else {
    userMessage = `Pet Details:
- Pet's Name: ${details.petName}
- Type of Pet: ${details.petType}
- Owner's Name: ${details.ownerName}
- Pet called owner: ${details.calledYou}
- Personality: ${details.personality}
- Favorite Memory: ${details.favoriteMemory}
- Owner's message to pet: ${details.messageToPet}

Write the letter body now (do NOT include "Dear ${details.calledYou}," as that is already on the page):`;
  }

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

  const lineItems = (order.line_items || []).filter(item => {
    const title = (item.title || '').toLowerCase();
    return title.includes('rainbow bridge') || title.includes('final message from your pet');
  });

  if (!lineItems.length) {
    console.warn(`[Rainbow] No matching line item found for order ${orderId}`);
    return;
  }

  const seenPetNames = new Set();

  for (const lineItem of lineItems) {
    const details = extractProperties(lineItem);

    if (!details.petName || !details.calledYou) {
      console.warn(`[Rainbow] Missing required pet details for order ${orderId}`);
      continue;
    }

    if (seenPetNames.has(details.petName.toLowerCase())) {
      console.warn(`[Rainbow] Duplicate pet name "${details.petName}" in order ${orderId} — skipping`);
      continue;
    }

    seenPetNames.add(details.petName.toLowerCase());
    await saveOrderToQueue(order, details);
  }
}

module.exports = { isRainbowBridgeOrder, processRainbowBridgeOrder, generateLetter };
