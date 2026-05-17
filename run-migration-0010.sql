-- =====================================================================
-- Apply migration 0010 (StoryFlow) to production Supabase
-- =====================================================================
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- It's the exact contents of supabase/migrations/0010_storyflow.sql.
-- Every statement uses IF NOT EXISTS / IF EXISTS, so re-running is safe.
--
-- After this runs, the /projects/[id] page will stop crashing because
-- the columns it selects (current_stage, bible_overrides, scene_id)
-- will finally exist in your live database.
-- =====================================================================

-- --- projects.current_stage ----------------------------------------------

alter table projects
  add column if not exists current_stage text not null default 'concept'
    check (current_stage in (
      'concept', 'script', 'scenes', 'image', 'animate', 'stitch'
    ));

create index if not exists projects_current_stage_idx
  on projects (current_stage);

-- --- clips.bible_overrides ----------------------------------------------

alter table clips
  add column if not exists bible_overrides jsonb not null default '{}'::jsonb;

-- --- messages.scene_id + extended chat_mode -----------------------------

alter table messages drop constraint if exists messages_chat_mode_check;
alter table messages
  add constraint messages_chat_mode_check
  check (chat_mode in ('ari', 'mae', 'concept', 'script', 'scene'));

alter table messages
  add column if not exists scene_id uuid references clips(id) on delete cascade;

create index if not exists messages_scene_id_idx
  on messages (scene_id, created_at)
  where scene_id is not null;

-- --- generations log ----------------------------------------------------

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid references projects on delete cascade,
  scene_id uuid references clips on delete cascade,
  kind text not null check (kind in ('image', 'animation')),
  model_id text not null,
  replicate_prediction_id text,
  prompt text not null,
  input_params jsonb not null default '{}'::jsonb,
  output_url text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'failed', 'canceled')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists generations_user_idx on generations (user_id, created_at desc);
create index if not exists generations_project_idx on generations (project_id, created_at desc)
  where project_id is not null;
create index if not exists generations_scene_idx on generations (scene_id, created_at desc)
  where scene_id is not null;
create index if not exists generations_prediction_uniq
  on generations (replicate_prediction_id)
  where replicate_prediction_id is not null;

alter table generations enable row level security;

drop policy if exists "generations owner select" on generations;
create policy "generations owner select" on generations
  for select using (auth.uid() = user_id);

-- --- Verify the columns now exist ---------------------------------------

select 'projects.current_stage' as check, exists (
  select 1 from information_schema.columns
  where table_name = 'projects' and column_name = 'current_stage'
) as ok
union all
select 'clips.bible_overrides', exists (
  select 1 from information_schema.columns
  where table_name = 'clips' and column_name = 'bible_overrides'
)
union all
select 'messages.scene_id', exists (
  select 1 from information_schema.columns
  where table_name = 'messages' and column_name = 'scene_id'
)
union all
select 'generations table', exists (
  select 1 from information_schema.tables
  where table_name = 'generations'
);
