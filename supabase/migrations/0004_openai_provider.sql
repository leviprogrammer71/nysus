-- =====================================================================
-- Nysus — add 'openai' as a valid provider in the usage table
-- =====================================================================
-- When OPENAI_API_KEY is set, stills are generated via OpenAI's
-- gpt-image-1 API directly (not via OpenRouter). Usage rows from
-- that path record provider='openai'. Replicate and OpenRouter are
-- still the other two valid values.
--
-- Run after 0003_stills.sql.
-- =====================================================================

alter table usage drop constraint if exists usage_provider_check;
alter table usage
  add constraint usage_provider_check
  check (provider in ('replicate', 'openrouter', 'openai'));
