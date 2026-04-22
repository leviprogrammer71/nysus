import type { ClipStatus, SeedSource, StillStatus } from "@/lib/supabase/types";
import type { ShotPromptMetadata } from "@/lib/shot-prompt";

export interface TimelineClip {
  id: string;
  project_id: string;
  order_index: number;
  prompt: string;
  shot_metadata: ShotPromptMetadata | null;
  seed_image_url: string | null;
  seed_source: SeedSource;
  video_url: string | null;
  last_frame_url: string | null;
  sampled_frames_urls: string[];
  status: ClipStatus;
  replicate_prediction_id: string | null;
  error_message: string | null;
  // Stills pipeline
  still_image_url: string | null;
  still_prompt: string | null;
  still_status: StillStatus;
  still_replicate_prediction_id: string | null;
  still_approved?: boolean;
  narration: string | null;
  narration_audio_url?: string | null;
  captions_srt?: string | null;
  created_at: string;
}
