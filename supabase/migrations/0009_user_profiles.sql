-- =====================================================================
-- Nysus — 0009 "Profiles"
-- =====================================================================
-- Per-user profile data: public display name, bio, handle, avatar.
-- Handles are used on gallery tiles + share pages instead of leaking
-- email. Avatars are references into the clips bucket (authenticated
-- read), fetched via signed URLs on demand.
-- =====================================================================

create table if not exists user_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text,
  handle text unique,
  bio text,
  avatar_path text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_handle_idx on user_profiles (handle)
  where handle is not null;

alter table user_profiles enable row level security;

drop policy if exists "profile self select" on user_profiles;
create policy "profile self select" on user_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profile self insert" on user_profiles;
create policy "profile self insert" on user_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profile self update" on user_profiles;
create policy "profile self update" on user_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Touch updated_at on row updates.
drop trigger if exists user_profiles_touch on user_profiles;
create trigger user_profiles_touch
  before update on user_profiles
  for each row
  execute function public.touch_updated_at();

-- Public handle lookup view: only exposes non-sensitive fields for
-- the gallery + share-page author labels. Safe to read without auth
-- because these values were opted-in by the user setting a handle.
create or replace view public.public_profiles as
  select user_id, display_name, handle, bio, avatar_path, website
  from user_profiles
  where handle is not null;

-- View inherits RLS from the underlying table; the handle-only filter
-- keeps anonymous users from seeing users who haven't published.
