-- =====================================================================
-- Nysus — initial schema
-- =====================================================================
-- Tables: projects, clips, messages
-- Storage: clips bucket (authenticated read, service-role write)
-- RLS: all three tables key on auth.uid() = projects.user_id, either
--      directly or by joining through project_id.
-- =====================================================================

-- --- Extensions ---------------------------------------------------------
create extension if not exists "pgcrypto";

-- --- Tables ------------------------------------------------------------

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text,
  character_sheet jsonb not null default '{}'::jsonb,
  aesthetic_bible jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on projects (user_id);
create index if not exists projects_updated_at_idx on projects (updated_at desc);

create table if not exists clips (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  order_index int not null,
  prompt text not null,
  shot_metadata jsonb,
  seed_image_url text,
  seed_source text not null default 'none'
    check (seed_source in ('auto', 'manual_frame', 'upload', 'none')),
  video_url text,
  last_frame_url text,
  -- sampled frames are stored silently; never sent to Claude unless
  -- the user explicitly taps "Consult the chorus". See CRITIQUE_MODE.
  sampled_frames_urls text[] not null default '{}',
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'complete', 'failed')),
  replicate_prediction_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists clips_project_id_idx on clips (project_id);
create index if not exists clips_project_order_idx on clips (project_id, order_index);
create index if not exists clips_prediction_id_idx on clips (replicate_prediction_id)
  where replicate_prediction_id is not null;
create index if not exists clips_pending_idx on clips (status)
  where status in ('queued', 'processing');

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  attached_frame_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists messages_project_id_idx on messages (project_id, created_at);

-- --- updated_at auto-touch ---------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on projects;
create trigger projects_touch_updated_at
  before update on projects
  for each row
  execute function public.touch_updated_at();

-- --- Row Level Security ------------------------------------------------

alter table projects enable row level security;
alter table clips    enable row level security;
alter table messages enable row level security;

-- projects: owner has full access
drop policy if exists "projects owner select" on projects;
create policy "projects owner select" on projects
  for select using (auth.uid() = user_id);

drop policy if exists "projects owner insert" on projects;
create policy "projects owner insert" on projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "projects owner update" on projects;
create policy "projects owner update" on projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "projects owner delete" on projects;
create policy "projects owner delete" on projects
  for delete using (auth.uid() = user_id);

-- clips: owner via joined project
drop policy if exists "clips owner select" on clips;
create policy "clips owner select" on clips
  for select using (
    exists (
      select 1 from projects p
      where p.id = clips.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "clips owner insert" on clips;
create policy "clips owner insert" on clips
  for insert with check (
    exists (
      select 1 from projects p
      where p.id = clips.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "clips owner update" on clips;
create policy "clips owner update" on clips
  for update using (
    exists (
      select 1 from projects p
      where p.id = clips.project_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from projects p
      where p.id = clips.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "clips owner delete" on clips;
create policy "clips owner delete" on clips
  for delete using (
    exists (
      select 1 from projects p
      where p.id = clips.project_id and p.user_id = auth.uid()
    )
  );

-- messages: same pattern as clips
drop policy if exists "messages owner select" on messages;
create policy "messages owner select" on messages
  for select using (
    exists (
      select 1 from projects p
      where p.id = messages.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "messages owner insert" on messages;
create policy "messages owner insert" on messages
  for insert with check (
    exists (
      select 1 from projects p
      where p.id = messages.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "messages owner update" on messages;
create policy "messages owner update" on messages
  for update using (
    exists (
      select 1 from projects p
      where p.id = messages.project_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from projects p
      where p.id = messages.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "messages owner delete" on messages;
create policy "messages owner delete" on messages
  for delete using (
    exists (
      select 1 from projects p
      where p.id = messages.project_id and p.user_id = auth.uid()
    )
  );

-- --- Storage bucket: clips --------------------------------------------
-- Run this block in the Supabase SQL editor. If the bucket already
-- exists this is a no-op.

insert into storage.buckets (id, name, public)
values ('clips', 'clips', false)
on conflict (id) do nothing;

-- Storage RLS: authenticated read of bucket 'clips', writes are
-- service-role only (uploads happen server-side via the backend).
drop policy if exists "clips bucket read" on storage.objects;
create policy "clips bucket read" on storage.objects
  for select to authenticated
  using (bucket_id = 'clips');

-- No insert/update/delete policy for regular users — the service role
-- bypasses RLS, so server code using SUPABASE_SERVICE_ROLE_KEY can write.
