import type { ClipStatus, SeedSource } from "@/lib/supabase/types";
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
  created_at: string;
}
