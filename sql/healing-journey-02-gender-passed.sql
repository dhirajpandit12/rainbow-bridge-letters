-- Healing Journey, migration 02: capture Gender (pronouns) and Passed Date (anniversary line).
-- The product intake form collects both. Run in the Supabase SQL editor. Safe to re-run.

alter table public.rainbow_journeys
  add column if not exists gender      text,
  add column if not exists passed_date text;
