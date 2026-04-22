-- =====================================================================
-- Nysus — usage tracking + budget caps
-- =====================================================================
-- Records every paid call (Replicate Seedance, OpenRouter chat, vision
-- critique) so the app can enforce daily + monthly spend caps and
-- surface a real usage dashboard.
--
-- Run this AFTER 0001_init.sql in the same Supabase SQL editor.
-- =====================================================================

create table if not exists usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  project_id uuid references projects on delete set null,
  provider text not null check (provider in ('replicate', 'openrouter')),
  action text not null check (action in ('generate', 'regenerate', 'chat', 'critique')),
  cost_usd_cents int not null default 0,
  tokens_in int,
  tokens_out int,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_user_time_idx    on usage (user_id, created_at desc);
create index if not exists usage_project_time_idx on usage (project_id, created_at desc);
create index if not exists usage_provider_time_idx on usage (provider, created_at desc);

-- RLS: the owner can read their own usage rows; writes are service-role only.
alter table usage enable row level security;

drop policy if exists "usage owner select" on usage;
create policy "usage owner select" on usage
  for select using (auth.uid() = user_id);

-- No insert / update / delete policies for regular users — the service
-- role bypasses RLS and is the only code path that records usage.
