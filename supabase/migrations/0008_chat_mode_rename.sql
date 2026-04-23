-- =====================================================================
-- Nysus — 0008 rename messages.mode -> messages.chat_mode
-- =====================================================================
-- Postgres's ordered-set aggregate mode() collides with a bare column
-- named `mode` in some query contexts (triggers the cryptic
-- "WITHIN GROUP is required for ordered-set aggregate mode" error).
-- The fix is trivial: rename the column to chat_mode so it's never
-- ambiguous with the aggregate name.
--
-- This migration is idempotent — it works whether you ran the original
-- 0007_chat_mode.sql (which added `mode`) or you're running this
-- cleanly for the first time.
-- =====================================================================

do $$
begin
  -- Legacy path: 0007 added a 'mode' column. Rename it.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'messages'
      and column_name  = 'mode'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'messages'
      and column_name  = 'chat_mode'
  ) then
    alter table messages rename column mode to chat_mode;
  end if;
end $$;

-- Fresh install path: add the column if it doesn't exist.
alter table messages
  add column if not exists chat_mode text not null default 'ari';

-- Swap the CHECK constraint onto the new name.
alter table messages drop constraint if exists messages_mode_check;
alter table messages drop constraint if exists messages_chat_mode_check;
alter table messages
  add constraint messages_chat_mode_check
  check (chat_mode in ('ari', 'mae'));

-- Swap the index.
drop index if exists messages_project_mode_idx;
create index if not exists messages_project_chat_mode_idx
  on messages (project_id, chat_mode, created_at);
