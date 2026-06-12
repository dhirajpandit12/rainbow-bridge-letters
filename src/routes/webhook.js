const express = require('express');
const crypto = require('crypto');
const { isRainbowBridgeOrder, processRainbowBridgeOrder } = require('../services/rainbowLetter');

const router = express.Router();

function verifyShopifyHmac(rawBody, hmacHeader) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  const digestBuf = Buffer.from(digest);
  const hmacBuf = Buffer.from(hmacHeader);
  if (digestBuf.length !== hmacBuf.length) return false;
  return crypto.timingSafeEqual(digestBuf, hmacBuf);
}

router.post('/', async (req, res) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const rawBody = req.body;

  if (!hmacHeader) {
    console.warn('[Webhook] Missing HMAC header — ignoring');
    return res.status(200).send('OK');
  }

  if (!verifyShopifyHmac(rawBody, hmacHeader)) {
    console.warn('[Webhook] HMAC verification failed — ignoring');
    return res.status(200).send('OK');
  }

  let order;
  try {
    order = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    console.error('[Webhook] Failed to parse body:', err.message);
    return res.status(200).send('OK');
  }

  const email = order.email || order.contact_email;
  if (!email) {
    console.warn('[Webhook] No email found in order — ignoring');
    return res.status(200).send('OK');
  }

  if (!isRainbowBridgeOrder(order)) {
    console.log(`[Webhook] Not a Rainbow Bridge order — skipping`);
    return res.status(200).send('OK');
  }

  console.log(`[Webhook] Rainbow Bridge order received for ${email}`);

  processRainbowBridgeOrder(order).catch(err => {
    console.error(`[Rainbow] Processing failed for ${email}:`, err.message);
  });

  return res.status(200).send('OK');
});

module.exports = router;
