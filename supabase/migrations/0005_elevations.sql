-- =====================================================================
-- Nysus — 0005 "Elevations"
-- =====================================================================
-- Adds the backing columns + tables for the elevations rollout:
--   * narration_audio_url / captions_srt / still_approved on clips
--   * draft_mode flag on projects (as a real column, not a jsonb toggle)
--   * share_token + share_enabled on projects
--   * user_budget_overrides — per-day Stripe-backed cap bumps
--   * push_subscriptions    — web-push endpoints per user
-- Also: a public view of projects-by-share-token for the /share/[token]
-- route, so the service role doesn't have to bypass RLS manually.
-- Run after 0004_openai_provider.sql.
-- =====================================================================

-- --- clips ---------------------------------------------------------------

alter table clips
  add column if not exists narration_audio_url text,
  add column if not exists captions_srt text,
  add column if not exists still_approved boolean not null default false,
  -- Track the last render we baked narration for so the stitcher can
  -- know whether the cached mix is stale.
  add column if not exists narration_model text;

-- --- projects ------------------------------------------------------------

alter table projects
  add column if not exists draft_mode boolean not null default false,
  add column if not exists share_token text unique,
  add column if not exists share_enabled boolean not null default false;

create index if not exists projects_share_token_idx on projects (share_token)
  where share_token is not null and share_enabled = true;

-- --- user_budget_overrides ---------------------------------------------
-- Stripe-backed top-ups live here. A row like:
--   (user_id=X, day='2026-04-22', extra_cents=1000, stripe_session=...)
-- bumps maxDailyCents by 1000 (=$10) for that UTC day for that user.
-- We don't mutate the env-based cap; we add to it. Same pattern for
-- monthly rollovers if you want later (just add a different `scope`).

create table if not exists user_budget_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  scope text not null default 'day' check (scope in ('day', 'month')),
  -- Period identifier. For 'day' this is YYYY-MM-DD in UTC;
  -- for 'month' this is YYYY-MM.
  period text not null,
  extra_cents int not null check (extra_cents >= 0),
  stripe_session_id text,
  stripe_payment_intent_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_budget_overrides_user_period_idx
  on user_budget_overrides (user_id, scope, period);
create unique index if not exists user_budget_overrides_session_uniq
  on user_budget_overrides (stripe_session_id)
  where stripe_session_id is not null;

alter table user_budget_overrides enable row level security;

drop policy if exists "budget_overrides owner select" on user_budget_overrides;
create policy "budget_overrides owner select" on user_budget_overrides
  for select using (auth.uid() = user_id);

-- Inserts happen server-side via the service role (Stripe webhook) so
-- no end-user insert policy.

-- --- push_subscriptions --------------------------------------------------

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index if not exists push_subscriptions_endpoint_uniq
  on push_subscriptions (endpoint);
create index if not exists push_subscriptions_user_id_idx
  on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subs owner select" on push_subscriptions;
create policy "push_subs owner select" on push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_subs owner insert" on push_subscriptions;
create policy "push_subs owner insert" on push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_subs owner delete" on push_subscriptions;
create policy "push_subs owner delete" on push_subscriptions
  for delete using (auth.uid() = user_id);
