-- =====================================================================
-- Nysus — stills pipeline columns on clips
-- =====================================================================
-- Each clip represents a scene. A scene has:
--   1. A STILL — the seed image (generated via Flux or uploaded)
--   2. A VIDEO — the animated clip (generated via Seedance from the still)
--   3. NARRATION — the optional voiceover text
--
-- Before this migration, we only tracked the video side. With the new
-- chat-driven pipeline, Dio drafts the image_prompt + video prompt +
-- narration together, and the user generates each stage when ready.
-- =====================================================================

alter table clips
  add column if not exists still_image_url text,
  add column if not exists still_prompt text,
  add column if not exists still_status text not null default 'none'
    check (still_status in ('none', 'queued', 'processing', 'complete', 'failed')),
  add column if not exists still_replicate_prediction_id text,
  add column if not exists narration text;

create index if not exists clips_still_status_idx on clips (still_status)
  where still_status in ('queued', 'processing');
