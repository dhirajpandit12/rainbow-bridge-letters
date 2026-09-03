// Public endpoints for the monthly-question link in each subscription reading email.
const express = require('express');
const { getSubscriptionByToken, setPendingQuestion } = require('../services/supabase');

const router = express.Router();

// Fetch the pet name for display on the /ask page.
router.get('/:token', async (req, res) => {
  try {
    const sub = await getSubscriptionByToken(req.params.token);
    if (!sub || sub.status !== 'active') return res.status(404).json({ error: 'Not found' });
    res.json({ petName: sub.pet_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save the owner's question for next month's reading.
router.post('/:token/question', async (req, res) => {
  try {
    const sub = await getSubscriptionByToken(req.params.token);
    if (!sub || sub.status !== 'active') return res.status(404).json({ error: 'Not found' });
    const question = (req.body?.question || '').trim();
    if (!question) return res.status(400).json({ error: 'Question is required' });
    if (question.length > 800) return res.status(400).json({ error: 'Question is too long' });
    await setPendingQuestion(req.params.token, question);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
