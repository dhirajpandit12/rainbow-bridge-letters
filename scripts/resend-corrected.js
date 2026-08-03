const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const { generateSoulReading } = require('../src/services/soulReading');
const { generateSoulReadingPdf } = require('../src/services/soulReadingPdf');
const { generateLetter } = require('../src/services/rainbowLetter');
const { generatePdf } = require('../src/services/pdfGenerator');
const { sendSoulReadingEmail, sendRainbowBridgeEmail } = require('../src/services/email');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function resendCorrected(type, orderId, correctionNote) {
  if (type === 'soul') {
    const { data, error } = await supabase
      .from('soul_reading_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !data) throw new Error(`Order not found: ${error?.message}`);

    if (!data.generated_reading || !data.generated_reading.PARA_ONE) {
      throw new Error('No saved reading found for this order. Cannot apply correction.');
    }

    console.log(`[Resend] Applying correction to Soul Reading for ${data.pet_name}...`);
    console.log(`[Resend] Correction: "${correctionNote}"`);

    const details = {
      petName: data.pet_name,
      ownerName: data.owner_name,
      petCallsYou: data.pet_calls_you,
      photoUrl: data.photo_url,
      species: data.species,
      lifeStage: data.life_stage,
      personality: data.personality,
      question: data.question,
    };

    const paragraphs = await generateSoulReading(details, correctionNote, data.generated_reading);
    console.log('[Resend] Corrected reading generated.');

    const pdfBuffer = await generateSoulReadingPdf({
      calledYou: data.pet_calls_you,
      petName: data.pet_name,
      paragraphs,
      photoUrl: data.photo_url,
    });
    console.log('[Resend] PDF generated.');

    await sendSoulReadingEmail({
      toEmail: data.email,
      ownerName: data.owner_name,
      petName: data.pet_name,
      pdfBuffer,
    });
    console.log(`[Resend] Corrected Soul Reading sent to ${data.email}`);

    await supabase
      .from('soul_reading_orders')
      .update({ generated_reading: paragraphs, correction_note: correctionNote })
      .eq('id', orderId);

    console.log('[Resend] Done.');

  } else if (type === 'rainbow') {
    const { data, error } = await supabase
      .from('rainbow_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !data) throw new Error(`Order not found: ${error?.message}`);

    if (!data.generated_letter || !data.generated_letter.trim()) {
      throw new Error('No saved letter found for this order. Cannot apply correction.');
    }

    console.log(`[Resend] Applying correction to Rainbow Bridge letter for ${data.pet_name}...`);
    console.log(`[Resend] Correction: "${correctionNote}"`);

    const details = {
      petName: data.pet_name,
      calledYou: data.called_you,
      petType: data.pet_type,
      ownerName: data.owner_name,
      personality: data.personality,
      favoriteMemory: data.favorite_memory,
      messageToPet: data.message_to_pet,
    };

    const letterBody = await generateLetter(details, correctionNote, data.generated_letter);
    console.log('[Resend] Corrected letter generated.');

    const pdfBuffer = await generatePdf({
      calledYou: data.called_you,
      letterBody,
      petName: data.pet_name,
    });
    console.log('[Resend] PDF generated.');

    await sendRainbowBridgeEmail({
      toEmail: data.email,
      ownerName: data.owner_name,
      petName: data.pet_name,
      pdfBuffer,
    });
    console.log(`[Resend] Corrected letter sent to ${data.email}`);

    await supabase
      .from('rainbow_orders')
      .update({ generated_letter: letterBody, correction_note: correctionNote })
      .eq('id', orderId);

    console.log('[Resend] Done.');
  } else {
    throw new Error('type must be "soul" or "rainbow"');
  }
}

const [,, type, orderId, ...noteParts] = process.argv;
const correctionNote = noteParts.join(' ');

if (!type || !orderId || !correctionNote) {
  console.log('Usage: IS_LOCAL=true node scripts/resend-corrected.js <soul|rainbow> <order_id> <correction note>');
  console.log('Example: IS_LOCAL=true node scripts/resend-corrected.js soul 123 "Harold was adopted in December, not born then"');
  process.exit(1);
}

resendCorrected(type, orderId, correctionNote).catch(err => {
  console.error('[Resend] Failed:', err.message);
  process.exit(1);
});
