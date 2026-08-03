const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { generateSoulReading } = require('../services/soulReading');
const { generateSoulReadingPdf } = require('../services/soulReadingPdf');
const { generateLetter } = require('../services/rainbowLetter');
const { generatePdf } = require('../services/pdfGenerator');
const { sendSoulReadingEmail, sendRainbowBridgeEmail } = require('../services/email');

const router = express.Router();

function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(authMiddleware);

router.get('/orders', async (req, res) => {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { type = 'all', status } = req.query;

    const results = {};

    if (type === 'all' || type === 'rainbow') {
      let q = supabase.from('rainbow_orders').select('id, pet_name, owner_name, email, status, shopify_order_id, correction_note, created_at').order('created_at', { ascending: false }).limit(50);
      if (status) q = q.eq('status', status);
      const { data } = await q;
      results.rainbow = data || [];
    }

    if (type === 'all' || type === 'soul') {
      let q = supabase.from('soul_reading_orders').select('id, pet_name, owner_name, email, status, shopify_order_id, correction_note, created_at').order('created_at', { ascending: false }).limit(50);
      if (status) q = q.eq('status', status);
      const { data } = await q;
      results.soul = data || [];
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/resend', async (req, res) => {
  const { type, orderId, correctionNote } = req.body;

  if (!type || !orderId || !correctionNote) {
    return res.status(400).json({ error: 'type, orderId, and correctionNote are required' });
  }

  res.json({ message: 'Correction queued, processing in background' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    if (type === 'soul') {
      const { data, error } = await supabase.from('soul_reading_orders').select('*').eq('id', orderId).single();
      if (error || !data) throw new Error(`Order not found`);
      if (!data.generated_reading || !data.generated_reading.PARA_ONE) throw new Error('No saved reading found');

      const details = {
        petName: data.pet_name, ownerName: data.owner_name, petCallsYou: data.pet_calls_you,
        photoUrl: data.photo_url, species: data.species, lifeStage: data.life_stage,
        personality: data.personality, question: data.question,
      };

      const paragraphs = await generateSoulReading(details, correctionNote, data.generated_reading);
      const pdfBuffer = await generateSoulReadingPdf({ calledYou: data.pet_calls_you, petName: data.pet_name, paragraphs, photoUrl: data.photo_url });
      await sendSoulReadingEmail({ toEmail: data.email, ownerName: data.owner_name, petName: data.pet_name, pdfBuffer });
      await supabase.from('soul_reading_orders').update({ generated_reading: paragraphs, correction_note: correctionNote }).eq('id', orderId);
      console.log(`[Admin] Soul Reading correction sent for order ${orderId}`);

    } else if (type === 'rainbow') {
      const { data, error } = await supabase.from('rainbow_orders').select('*').eq('id', orderId).single();
      if (error || !data) throw new Error(`Order not found`);
      if (!data.generated_letter || !data.generated_letter.trim()) throw new Error('No saved letter found');

      const details = {
        petName: data.pet_name, calledYou: data.called_you, petType: data.pet_type,
        ownerName: data.owner_name, personality: data.personality,
        favoriteMemory: data.favorite_memory, messageToPet: data.message_to_pet,
      };

      const letterBody = await generateLetter(details, correctionNote, data.generated_letter);
      const pdfBuffer = await generatePdf({ calledYou: data.called_you, letterBody, petName: data.pet_name });
      await sendRainbowBridgeEmail({ toEmail: data.email, ownerName: data.owner_name, petName: data.pet_name, pdfBuffer });
      await supabase.from('rainbow_orders').update({ generated_letter: letterBody, correction_note: correctionNote }).eq('id', orderId);
      console.log(`[Admin] Rainbow correction sent for order ${orderId}`);
    }
  } catch (err) {
    console.error(`[Admin] Correction failed for order ${orderId}:`, err.message);
  }
});

module.exports = router;
