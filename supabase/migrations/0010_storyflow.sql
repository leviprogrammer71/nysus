-- =====================================================================
-- Nysus — 0010 "The Procession"
-- =====================================================================
-- Lays the data spine for the StoryFlow build:
--   * projects.current_stage  — six-stage procession.
--   * clips.bible_overrides   — per-scene bible exclusions (jsonb).
--   * messages.scene_id       — scoping for per-scene chats.
--   * messages.chat_mode      — extended enum: concept|script|scene.
--                               Legacy ari/mae stay valid for old rows.
--   * generations             — single log of every Replicate prediction
--                               (image OR animation) for history strips.
--
-- Nothing here breaks existing rows; old chat_mode values keep working.
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
-- Per-scene exclusions:
--   { "disable_character_ids": [...], "disable_style": bool, "notes": "..." }

alter table clips
  add column if not exists bible_overrides jsonb not null default '{}'::jsonb;

-- --- messages.scene_id + extended chat_mode -----------------------------
-- 'concept' / 'script' / 'scene' join 'ari' / 'mae' so existing rows
-- aren't migrated. New rows pick the new enum values.

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
-- Every Replicate call recorded — image, animation, playground —
-- with prompt + input_params + output_url so the history strips can
-- reach back to any prior generation.

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

-- Inserts/updates always via service role from the API routes; no
-- end-user write policy.

-- --- aesthetic_bible jsonb keys (documented, not enforced) --------------
-- Storing these in the existing aesthetic_bible blob keeps the bible
-- hot-editable without future migrations:
--   claude_bluntness        int 1..5 (default 5)
--   claude_avoid_list       text[]
--   claude_genre_leanings   text
--   default_image_model     text  (lib/models.ts key)
--   default_animation_model text  (lib/models.ts key)
