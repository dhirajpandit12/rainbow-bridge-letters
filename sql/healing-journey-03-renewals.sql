-- Healing Journey, migration 03: idempotent record of renewal charges.
-- Each Appstle renewal order is recorded once here so a webhook retry never double counts
-- paid_cycles. Run in the Supabase SQL editor. Safe to re-run.

create table if not exists public.rainbow_journey_renewals (
  order_id    text primary key,                         -- Shopify renewal order id
  journey_id  bigint not null references public.rainbow_journeys (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists idx_rainbow_journey_renewals_journey
  on public.rainbow_journey_renewals (journey_id);
