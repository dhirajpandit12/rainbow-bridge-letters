const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const webhookRouter = require('./routes/webhook');
const adminRouter = require('./routes/admin');
const subscriptionRouter = require('./routes/subscription');
const { startQueueCron } = require('./cron/processQueue');

const app = express();
const PORT = process.env.PORT || 3002;

const cors = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
};

app.use('/admin', cors);
app.use('/subscription', cors);

app.use('/webhook/order-paid', express.raw({ type: 'application/json' }), webhookRouter);
app.use('/admin', express.json(), adminRouter);
app.use('/subscription', express.json(), subscriptionRouter);

app.get('/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  env: {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    resend: !!process.env.RESEND_API_KEY,
    shopifySecret: !!process.env.SHOPIFY_WEBHOOK_SECRET,
  },
}));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`Rainbow Bridge Backend running on http://localhost:${PORT}`);
  console.log(`   Anthropic Key: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'MISSING'}`);
  console.log(`   Resend Key:    ${process.env.RESEND_API_KEY ? 'set' : 'MISSING'}`);
  console.log(`   Webhook Secret: ${process.env.SHOPIFY_WEBHOOK_SECRET ? 'set' : 'MISSING'}`);
  console.log(`   Supabase:       ${process.env.SUPABASE_URL ? 'set' : 'MISSING'}`);
  startQueueCron();
});
