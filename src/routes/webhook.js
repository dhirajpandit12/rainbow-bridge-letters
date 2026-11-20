const express = require('express');
const crypto = require('crypto');
const { isRainbowBridgeOrder, processRainbowBridgeOrder } = require('../services/rainbowLetter');
const { isSoulReadingOrder, processSoulReadingOrder } = require('../services/soulReading');
const { isSoulBlueprintOrder, processSoulBlueprintOrder } = require('../services/soulBlueprint');
const { isMonthlySubscriptionOrder, processSubscriptionOrder } = require('../services/soulSubscription');
const { isHealingJourneyOrder, handleHealingJourneyOrder } = require('../services/rainbowJourney');

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

  let recognized = false;

  if (isRainbowBridgeOrder(order)) {
    recognized = true;
    console.log(`[Webhook] Rainbow Bridge order received for ${email}`);
    processRainbowBridgeOrder(order).catch(err => {
      console.error(`[Rainbow] Processing failed for ${email}:`, err.message);
    });
  }

  // A single order can contain both a one-time reading and a monthly upsell. Handle each
  // independently. isSoulReadingOrder / processSoulReadingOrder ignore "monthly" line items,
  // and the subscription handler only touches "monthly" line items, so they never overlap.
  if (isMonthlySubscriptionOrder(order)) {
    recognized = true;
    console.log(`[Webhook] Monthly Soul Reading subscription order received for ${email}`);
    processSubscriptionOrder(order).catch(err => {
      console.error(`[Subscription] Processing failed for ${email}:`, err.message);
    });
  }

  if (isSoulReadingOrder(order)) {
    recognized = true;
    console.log(`[Webhook] Soul Reading order received for ${email}`);
    processSoulReadingOrder(order).catch(err => {
      console.error(`[SoulReading] Processing failed for ${email}:`, err.message);
    });
  }

  // Healing Journey (Rainbow Bridge subscription). A separate `if` so an order that also
  // contains a one-time RBL letter (order bump) still gets that letter generated above, while
  // this starts or advances the 6-letter journey.
  if (isHealingJourneyOrder(order)) {
    recognized = true;
    console.log(`[Webhook] Healing Journey order received for ${email}`);
    handleHealingJourneyOrder(order).catch(err => {
      console.error(`[Journey] Processing failed for ${email}:`, err.message);
    });
  }

  if (isSoulBlueprintOrder(order)) {
    recognized = true;
    console.log(`[Webhook] Soul Blueprint order received for ${email}`);
    processSoulBlueprintOrder(order).catch(err => {
      console.error(`[SoulBlueprint] Processing failed for ${email}:`, err.message);
    });
  }

  if (!recognized) {
    console.log(`[Webhook] Unknown product — skipping`);
  }

  return res.status(200).send('OK');
});

module.exports = router;
