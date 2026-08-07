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
      let q = supabase.from('rainbow_orders').select('id, pet_name, owner_name, email, status, shopify_order_id, correction_note, created_at').order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data } = await q;
      results.rainbow = data || [];
    }

    if (type === 'all' || type === 'soul') {
      let q = supabase.from('soul_reading_orders').select('id, pet_name, owner_name, email, status, shopify_order_id, correction_note, created_at').order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data } = await q;
      results.soul = data || [];
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders/:type/:id', async (req, res) => {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { type, id } = req.params;
    const table = type === 'rainbow' ? 'rainbow_orders' : 'soul_reading_orders';
    const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
    if (error || !data) return res.status(404).json({ error: 'Order not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/create', async (req, res) => {
  const { type, details } = req.body;

  if (!type || !details || !details.email || !details.petName) {
    return res.status(400).json({ error: 'type, email and petName are required' });
  }

  res.json({ message: 'Reading queued, generating and sending in background' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const manualId = `MANUAL-${Date.now()}`;
  const now = new Date().toISOString();

  try {
    if (type === 'soul') {
      const { data: inserted, error: insErr } = await supabase.from('soul_reading_orders').insert({
        shopify_order_id: manualId,
        email: details.email,
        pet_name: details.petName,
        owner_name: details.ownerName,
        pet_calls_you: details.petCallsYou,
        photo_url: details.photoUrl,
        species: details.species,
        life_stage: details.lifeStage,
        personality: details.personality,
        question: details.question,
        status: 'processing',
        send_after: now,
      }).select('id').single();
      if (insErr) throw new Error(`Insert failed: ${insErr.message}`);

      const paragraphs = await generateSoulReading({
        petName: details.petName, ownerName: details.ownerName, petCallsYou: details.petCallsYou,
        photoUrl: details.photoUrl, species: details.species, lifeStage: details.lifeStage,
        personality: details.personality, question: details.question,
      });
      const pdfBuffer = await generateSoulReadingPdf({ calledYou: details.petCallsYou, petName: details.petName, paragraphs, photoUrl: details.photoUrl });
      await sendSoulReadingEmail({ toEmail: details.email, ownerName: details.ownerName, petName: details.petName, pdfBuffer });
      await supabase.from('soul_reading_orders').update({ generated_reading: paragraphs, status: 'completed', processed_at: new Date().toISOString() }).eq('id', inserted.id);
      console.log(`[Admin] Manual Soul Reading created + sent for ${details.email}`);

    } else if (type === 'rainbow') {
      const { data: inserted, error: insErr } = await supabase.from('rainbow_orders').insert({
        shopify_order_id: manualId,
        email: details.email,
        pet_name: details.petName,
        called_you: details.calledYou,
        pet_type: details.petType,
        owner_name: details.ownerName,
        personality: details.personality,
        favorite_memory: details.favoriteMemory,
        message_to_pet: details.messageToPet,
        photo_url: details.photoUrl,
        status: 'processing',
        send_after: now,
      }).select('id').single();
      if (insErr) throw new Error(`Insert failed: ${insErr.message}`);

      const letterBody = await generateLetter({
        petName: details.petName, calledYou: details.calledYou, petType: details.petType,
        ownerName: details.ownerName, personality: details.personality,
        favoriteMemory: details.favoriteMemory, messageToPet: details.messageToPet,
        photoUrl: details.photoUrl,
      });
      const pdfBuffer = await generatePdf({ calledYou: details.calledYou, letterBody, petName: details.petName, photoUrl: details.photoUrl });
      await sendRainbowBridgeEmail({ toEmail: details.email, ownerName: details.ownerName, petName: details.petName, pdfBuffer });
      await supabase.from('rainbow_orders').update({ generated_letter: letterBody, status: 'completed', processed_at: new Date().toISOString() }).eq('id', inserted.id);
      console.log(`[Admin] Manual Rainbow letter created + sent for ${details.email}`);
    }
  } catch (err) {
    console.error(`[Admin] Manual create failed for ${details.email}:`, err.message);
    await supabase.from(type === 'soul' ? 'soul_reading_orders' : 'rainbow_orders')
      .update({ status: `failed: ${err.message}` }).eq('shopify_order_id', manualId);
  }
});

router.post('/resend', async (req, res) => {
  const { type, orderId, correctionNote, fresh, overrideEmail } = req.body;

  if (!type || !orderId) {
    return res.status(400).json({ error: 'type and orderId are required' });
  }

  const isFresh = fresh === true;
  const isCorrection = !isFresh && !!(correctionNote && correctionNote.trim());
  res.json({ message: isFresh ? 'Fresh generation queued' : isCorrection ? 'Correction queued' : 'Resend queued' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    if (type === 'soul') {
      const { data, error } = await supabase.from('soul_reading_orders').select('*').eq('id', orderId).single();
      if (error || !data) throw new Error(`Order not found`);
      if (!isFresh && !data.generated_reading?.PARA_ONE) throw new Error('No saved reading found');

      let paragraphs = data.generated_reading;

      if (isFresh || isCorrection) {
        const details = {
          petName: data.pet_name, ownerName: data.owner_name, petCallsYou: data.pet_calls_you,
          photoUrl: data.photo_url, species: data.species, lifeStage: data.life_stage,
          personality: data.personality, question: data.question,
        };
        paragraphs = isFresh
          ? await generateSoulReading(details)
          : await generateSoulReading(details, correctionNote, data.generated_reading);
        await supabase.from('soul_reading_orders').update({ generated_reading: paragraphs, correction_note: correctionNote || null }).eq('id', orderId);
      }

      const toEmail = (overrideEmail && overrideEmail.trim()) ? overrideEmail.trim() : data.email;
      if (overrideEmail && overrideEmail.trim()) {
        await supabase.from('soul_reading_orders').update({ email: toEmail }).eq('id', orderId);
      }
      const pdfBuffer = await generateSoulReadingPdf({ calledYou: data.pet_calls_you, petName: data.pet_name, paragraphs, photoUrl: data.photo_url });
      await sendSoulReadingEmail({ toEmail, ownerName: data.owner_name, petName: data.pet_name, pdfBuffer });
      await supabase.from('soul_reading_orders').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', orderId);
      console.log(`[Admin] Soul Reading ${isFresh ? 'freshly generated' : isCorrection ? 'corrected' : 'resent'} for order ${orderId} to ${toEmail}`);

    } else if (type === 'rainbow') {
      const { data, error } = await supabase.from('rainbow_orders').select('*').eq('id', orderId).single();
      if (error || !data) throw new Error(`Order not found`);
      if (!isFresh && (!data.generated_letter || !data.generated_letter.trim())) throw new Error('No saved letter found');

      let letterBody = data.generated_letter;

      if (isFresh || isCorrection) {
        const details = {
          petName: data.pet_name, calledYou: data.called_you, petType: data.pet_type,
          ownerName: data.owner_name, personality: data.personality,
          favoriteMemory: data.favorite_memory, messageToPet: data.message_to_pet,
          photoUrl: data.photo_url,
        };
        letterBody = isFresh
          ? await generateLetter(details)
          : await generateLetter(details, correctionNote, data.generated_letter);
        await supabase.from('rainbow_orders').update({ generated_letter: letterBody, correction_note: correctionNote || null }).eq('id', orderId);
      }

      const toEmail = (overrideEmail && overrideEmail.trim()) ? overrideEmail.trim() : data.email;
      if (overrideEmail && overrideEmail.trim()) {
        await supabase.from('rainbow_orders').update({ email: toEmail }).eq('id', orderId);
      }
      const pdfBuffer = await generatePdf({ calledYou: data.called_you, letterBody, petName: data.pet_name, photoUrl: data.photo_url });
      await sendRainbowBridgeEmail({ toEmail, ownerName: data.owner_name, petName: data.pet_name, pdfBuffer });
      await supabase.from('rainbow_orders').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', orderId);
      console.log(`[Admin] Rainbow ${isFresh ? 'freshly generated' : isCorrection ? 'corrected' : 'resent'} for order ${orderId} to ${toEmail}`);
    }
  } catch (err) {
    console.error(`[Admin] Resend failed for order ${orderId}:`, err.message);
  }
});

module.exports = router;
