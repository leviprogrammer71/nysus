-- =====================================================================
-- Nysus — seed project: "I Don't Even Like You Tho"
-- =====================================================================
-- Run this AFTER you've signed in for the first time and a user row
-- exists in auth.users. Replace the email lookup below with your own
-- email if you changed ALLOWED_EMAIL.
--
-- Usage (Supabase SQL editor):
--     set local "request.jwt.claim.email" = 'lethalduke71@gmail.com';
--     \i supabase/seed/example_project.sql
--
-- Or simpler — just paste the body, replacing the lookup as needed.
-- =====================================================================

insert into projects (user_id, title, description, character_sheet, aesthetic_bible)
select
  u.id,
  'I Don''t Even Like You Tho',
  'A short-form series exploring karmic debt and philosophical entanglement through recurring domestic fights.',
  '{
    "characters": [
      {
        "name": "David",
        "age": "mid-30s",
        "ethnicity": "Latino-Mediterranean",
        "appearance": "Olive skin, dark stubble, tired hazel eyes with slight under-eye shadows, black wavy hair pushed back, 5''11\", lean athletic build",
        "wardrobe": "Fitted charcoal grey henley with sleeves pushed to forearms, dark jeans, small silver ring on right pinky, thin leather cord necklace",
        "voice": "Low baritone, slightly raspy, smoker''s texture, speaks slowly with long pauses, flat affect. Reference: Oscar Isaac''s quieter register.",
        "demeanor": "Exhausted rather than angry, observational, retreats outward"
      },
      {
        "name": "Maya",
        "age": "early 30s",
        "ethnicity": "warm brown skin",
        "appearance": "Shoulder-length dark curly hair (slightly frizzy, lived-in), full brows, sharp brown eyes, small gold hoop earrings, no makeup except smudged mascara, 5''6\", slim",
        "wardrobe": "Oversized cream knit sweater falling off one shoulder, black leggings, barefoot",
        "voice": "Mid-alto, slightly breathy, clear diction, tight in the throat when emotional — controlled intensity rather than shouting. Reference: Tessa Thompson''s measured delivery.",
        "demeanor": "Intense, coiled, stays inside"
      }
    ],
    "setting": {
      "primary": "Small urban apartment — warm tungsten lighting, exposed brick on one wall, small kitchen visible in background, half-burnt pillar candle on wooden coffee table, cluttered but not messy, plants by the window",
      "recurring_symbol": "A single framed print of a geometric occult sigil on the wall, subtle background"
    }
  }'::jsonb,
  '{
    "visual_style": "Cinematic 35mm film grain, A24-style naturalism",
    "palette": "Muted desaturated with warm tungsten highlights and cool blue shadows",
    "camera": "Handheld with slight movement, shallow depth of field",
    "aspect_ratio": "9:16 vertical",
    "audio_signature": "Low ominous synth drone under montage sequences, unison voiceover for philosophical reveals (both characters speaking same words in sync)",
    "thematic_motifs": [
      "Cigarette/balcony as observer moment",
      "Repetition across time suggesting karmic loop",
      "Silence after argument louder than the argument",
      "Unison voice as evidence the two are one system"
    ],
    "forbidden": [
      "Bright saturated colors",
      "Steady tripod shots",
      "Resolved endings — always leave the loop open"
    ]
  }'::jsonb
from auth.users u
where u.email = 'lethalduke71@gmail.com'
limit 1;
