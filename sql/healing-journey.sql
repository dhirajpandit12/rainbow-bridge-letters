-- Healing Journey: 6 Letters From Your Pet in Heaven
-- Rainbow Bridge Letter subscription pipeline (Phase 1 schema).
-- Run this in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS guards).

-- One row per subscriber's 6-letter journey.
create table if not exists public.rainbow_journeys (
  id                   bigint generated always as identity primary key,
  first_order_id       text not null,
  email                text not null,
  shopify_customer_id  text,

  -- Pet / intake details (same shape as rainbow_orders).
  pet_name             text not null,
  owner_name           text,
  called_you           text default 'Mom',
  pet_type             text,
  personality          text,
  favorite_memory      text,
  message_to_pet       text,
  photo_url            text,

  -- Type A linkage: the original Rainbow Bridge Letter this journey continues.
  source_rbl_order_id  text,          -- rainbow_orders.shopify_order_id of "Letter 0"
  rbl_summary          text,          -- ~80-word summary of that original letter

  plan                 text not null default 'monthly',   -- monthly | prepay (monthly for now)
  buyer_type           text not null default 'B',         -- A (existing RBL) | B (fresh)
  match_method         text,                              -- order_id | customer | customer+petname | new

  status               text not null default 'active',
  -- active | paused | cancelled | completed | needs_review | needs_intake

  paid_cycles          int not null default 1,  -- cycle 1 paid at purchase
  letters_sent         int not null default 0,
  next_send_at         timestamptz,

  question_token       text unique,
  created_at           timestamptz not null default now(),
  completed_at         timestamptz
);

create index if not exists idx_rainbow_journeys_email  on public.rainbow_journeys (email);
create index if not exists idx_rainbow_journeys_status on public.rainbow_journeys (status);

-- Per-letter queue + archive. One row per letter (1..6) of a journey.
create table if not exists public.rainbow_journey_letters (
  id                 bigint generated always as identity primary key,
  journey_id         bigint not null references public.rainbow_journeys (id) on delete cascade,
  shopify_order_id   text,                 -- purchase or renewal order that triggered this letter
  letter_index       int not null,         -- 1..6
  theme              text,
  status             text not null default 'pending',  -- pending | processing | completed | failed: <reason>
  send_after         timestamptz not null default now(),
  generated_letter   text,
  summary            text,                 -- ~80-word recap, fed into the next letter's prompt
  processed_at       timestamptz,
  created_at         timestamptz not null default now(),

  -- A letter is never generated twice for the same journey.
  unique (journey_id, letter_index)
);

create index if not exists idx_rainbow_journey_letters_due
  on public.rainbow_journey_letters (status, send_after);
