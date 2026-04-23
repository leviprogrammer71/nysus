-- =====================================================================
-- Nysus — 0007 "Two threads"
-- =====================================================================
-- Splits the single director chat into two named conversations that
-- share the same project but live in separate message histories:
--   * ari — Ariadne, the planner / conversation partner.
--   * mae — Maenads, the executor / builder.
--
-- We name the column chat_mode (not mode) because `mode` collides
-- with Postgres's ordered-set aggregate mode() in several query
-- contexts and triggers the cryptic error
-- "WITHIN GROUP is required for ordered-set aggregate mode".
--
-- Messages predating this migration default to 'ari' (the planning
-- side) since the executor chat won't have any history until the
-- user hands something off.
-- =====================================================================

alter table messages
  add column if not exists chat_mode text not null default 'ari'
    check (chat_mode in ('ari', 'mae'));

create index if not exists messages_project_chat_mode_idx
  on messages (project_id, chat_mode, created_at);
