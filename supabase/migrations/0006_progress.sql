-- =====================================================================
-- Nysus — 0006 "Progress"
-- =====================================================================
-- Gamification scaffolding:
--   * user_progress     — XP, level, streak, aggregate counters.
--   * user_achievements — slug + awarded_at per user (earned stamps).
--   * gallery_likes     — user+project unique likes on public entries.
-- Run after 0005_elevations.sql.
-- =====================================================================

-- --- user_progress ------------------------------------------------------

create table if not exists user_progress (
  user_id uuid primary key references auth.users on delete cascade,
  xp int not null default 0,
  level int not null default 1,
  streak_days int not null default 0,
  last_ship_date date,
  total_scenes int not null default 0,
  total_stitches int not null default 0,
  total_shares int not null default 0,
  total_remixes_received int not null default 0,
  used_seedance boolean not null default false,
  used_kling boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table user_progress enable row level security;

drop policy if exists "progress owner select" on user_progress;
create policy "progress owner select" on user_progress
  for select using (auth.uid() = user_id);

-- --- user_achievements --------------------------------------------------

create table if not exists user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  slug text not null,
  awarded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists user_achievements_uniq
  on user_achievements (user_id, slug);
create index if not exists user_achievements_user_idx
  on user_achievements (user_id);

alter table user_achievements enable row level security;

drop policy if exists "achievements owner select" on user_achievements;
create policy "achievements owner select" on user_achievements
  for select using (auth.uid() = user_id);

-- --- gallery_likes ------------------------------------------------------

create table if not exists gallery_likes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists gallery_likes_uniq
  on gallery_likes (project_id, user_id);
create index if not exists gallery_likes_project_idx
  on gallery_likes (project_id);

alter table gallery_likes enable row level security;

-- Public read count is done via service role in the gallery loader,
-- so we only give owners + likers select on their own rows.
drop policy if exists "likes owner select" on gallery_likes;
create policy "likes owner select" on gallery_likes
  for select using (auth.uid() = user_id);

drop policy if exists "likes self insert" on gallery_likes;
create policy "likes self insert" on gallery_likes
  for insert with check (auth.uid() = user_id);

drop policy if exists "likes self delete" on gallery_likes;
create policy "likes self delete" on gallery_likes
  for delete using (auth.uid() = user_id);
