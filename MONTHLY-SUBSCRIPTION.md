# Monthly Pet Soul Reading — Subscription

A recurring version of the Pet Soul Reading. Every month the owner of a **living** pet
gets a fresh reading. It runs on the same backend as the one-time products (Shopify
webhook → Claude → PDF → Resend → cron queue).

Billing is handled by **Seal Subscriptions**; each billing cycle Seal creates a normal
Shopify order, which fires the `orders/paid` webhook we already listen to.

---

## How it works (flow)

1. Customer subscribes on the **"Pet Soul Reading - Monthly"** product page.
2. First order → we create a subscription record and generate **Reading 1** (full reading,
   using their first question if given).
3. Each following month → Seal creates a new order → cron generates that month's reading:
   - If the customer submitted a **question** for the month → the reading centres on it.
   - If not → the reading uses that month's **rotating theme** (so it is always fresh).
4. Every reading email contains a link: **"Ask [Pet] a question"** → a page where they type
   next month's question. It is stored and used on the next cycle.

### Existing customers (no re-entering details)
When someone subscribes, we match by **email + pet name** to their past one-time
`soul_reading_orders` and **backfill** the pet details (species, life stage, personality,
photo). So you can email past buyers "join the monthly plan" and they only need to give the
pet name — we already have the rest. New customers can fill the details on the form.

---

## Files

| File | Role |
|------|------|
| `src/services/soulSubscription.js` | Detect subscription orders, extract fields, resolve/create subscription, queue each cycle |
| `src/services/soulReading.js` | `generateMonthlyReading()` + `themeForMonth()` (monthly check-in prompt, 5 paragraphs) |
| `src/services/supabase.js` | Subscription DB ops (resolve/create, queue, advance, question token) |
| `src/routes/subscription.js` | Public endpoints for the monthly-question link |
| `src/routes/webhook.js` | Routes "Monthly" orders to the subscription handler |
| `src/cron/processQueue.js` | `processSubscriptionReadings()` — generates + emails each due reading |
| `src/services/email.js` | `sendSoulReadingEmail()` now takes `askLink` (shows the ask-a-question block) |
| `dashboard/app/ask/[token]/page.tsx` | Public page where the customer submits their monthly question |

---

## Database (run once in Supabase → SQL Editor)

```sql
create table if not exists soul_subscriptions (
  id uuid primary key default gen_random_uuid(),
  first_order_id text,
  email text not null,
  pet_name text not null,
  owner_name text,
  pet_calls_you text,
  species text,
  life_stage text,
  personality text,
  photo_url text,
  reading_count int not null default 0,
  pending_question text,
  question_token text unique,
  status text not null default 'active',
  created_at timestamptz default now(),
  last_reading_at timestamptz
);

create table if not exists soul_subscription_orders (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text unique,
  subscription_id uuid references soul_subscriptions(id),
  month_number int,
  status text not null default 'pending',
  send_after timestamptz default now(),
  created_at timestamptz default now(),
  processed_at timestamptz,
  generated_reading jsonb
);
```

- `soul_subscriptions` — one row per subscribing pet. Holds resolved pet details,
  `reading_count`, `pending_question`, and a random `question_token` for the ask-link.
- `soul_subscription_orders` — one row per billing cycle (deduped by `shopify_order_id`,
  so Shopify webhook retries never double-send).

---

## Env vars (Render)

| Var | Value | Why |
|-----|-------|-----|
| `DASHBOARD_URL` | your Vercel dashboard URL, e.g. `https://xyz.vercel.app` | Builds the "Ask a question" link in the email. Without it, the link is simply hidden. |
| `ADMIN_BCC_EMAIL` | `healyourinnerpeace12@gmail.com` | A copy of every email (already used by all products). |
| `INSTANT_SEND` | `true` only for testing | Sends immediately instead of the normal delay. Remove/false in production. |

Delay: monthly readings queue with a 1–6 hour send delay (feels prepared, not instant).

---

## Shopify / Seal setup

1. Create the product **"Pet Soul Reading - Monthly"** and attach a **Seal Subscriptions**
   monthly plan. (Detection matches any product whose title contains "monthly" + "soul
   reading" / "pet soul".)
2. Line-item property fields:
   - **Pet Name** — required (used to match the pet)
   - Species, Life Stage, Personality, Pet Photo — optional (backfilled for existing
     customers)
   - First Question — optional
3. No new webhook needed — the existing `orders/paid` webhook handles it.

---

## The monthly question (A + B combined)

- **Default (A):** rotating theme each month, fully automatic. Themes cycle through:
  emotional weather, the bond, what they want more of, a worry to ease, their favourite
  part of life, how they've changed, what they notice about you, their playful side.
- **Optional (B):** the owner clicks the email link → `/ask/[token]` → submits a question →
  stored as `pending_question` → used on the next cycle, then cleared.

So engaged customers get a personal answer; everyone else still gets a fresh reading.

---

## Testing / go-live checklist

1. Run the two `create table` statements above.
2. Set `DASHBOARD_URL` on Render.
3. Build the Shopify product with Seal + the fields above.
4. Do **one real test subscription**, then confirm the Seal order structure (recurring
   orders carry the line-item properties and fire `orders/paid`). Adjust detection if Seal
   uses a different marker.
5. To force an instant test run, set `INSTANT_SEND=true` temporarily.

---

## Notes / limits

- First-vs-recurring is decided by whether a `soul_subscriptions` row already exists for
  that email + pet (not by a Seal flag), so it is robust to Seal's internal format.
- Cancellations: set the subscription row `status` to something other than `active` (Seal
  cancel handling can be wired later via a `subscription/cancelled` webhook if needed).
- One customer with two pets = two subscription rows (email + pet name distinguishes them).
```
