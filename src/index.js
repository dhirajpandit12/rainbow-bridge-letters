const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const webhookRouter = require('./routes/webhook');

const app = express();
const PORT = process.env.PORT || 3002;

app.use('/webhook/order-paid', express.raw({ type: 'application/json' }), webhookRouter);

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
});
