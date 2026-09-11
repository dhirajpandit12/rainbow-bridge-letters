const express = require('express');
const { unsubscribe } = require('../services/campaign');

const router = express.Router();

function page(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title></head>
  <body style="font-family:Georgia,serif;background:#fdf8f4;color:#3a2e2a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;">
    <div style="max-width:420px;text-align:center;padding:40px;">
      <div style="font-size:34px;">🐾</div>
      <h1 style="font-weight:normal;font-size:22px;margin:14px 0 8px;">${title}</h1>
      <p style="color:#5a4a42;font-size:15px;line-height:1.7;">${body}</p>
      <p style="color:#c47d7d;margin-top:24px;">Heal Your Inner Peace</p>
    </div>
  </body></html>`;
}

router.get('/unsub/:token', async (req, res) => {
  try {
    const ok = await unsubscribe(req.params.token);
    res.set('Content-Type', 'text/html');
    if (ok) return res.send(page('You have been unsubscribed', 'You will not receive any more emails about the monthly reading. Your past readings are unaffected.'));
    return res.status(404).send(page('Link not found', 'This unsubscribe link is not valid. If you keep receiving emails, just reply and let us know.'));
  } catch {
    res.set('Content-Type', 'text/html');
    res.status(500).send(page('Something went wrong', 'Please try again in a moment, or reply to the email to be removed.'));
  }
});

module.exports = router;
