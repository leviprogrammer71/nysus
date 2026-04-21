/**
 * Database types.
 *
 * TODO (Phase 1 follow-up): regenerate from Supabase CLI once the project
 * is live:
 *     npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
 *
 * For now, hand-typed to match 0001_init.sql — good enough to drive
 * the Phase 1 UI. Keep this file in sync when the schema changes.
 */

import type { ShotPromptMetadata } from "@/lib/shot-prompt";

export type ClipStatus = "queued" | "processing" | "complete" | "failed";
export type SeedSource = "auto" | "manual_frame" | "upload" | "none";
export type MessageRole = "user" | "assistant" | "system";

export interface CharacterSheet {
  characters?: {
    name: string;
    age?: string;
    ethnicity?: string;
    appearance?: string;
    wardrobe?: string;
    voice?: string;
    demeanor?: string;
  }[];
  setting?: {
    primary?: string;
    recurring_symbol?: string;
  };
  [key: string]: unknown;
}

export interface AestheticBible {
  visual_style?: string;
  palette?: string;
  camera?: string;
  aspect_ratio?: string;
  audio_signature?: string;
  thematic_motifs?: string[];
  forbidden?: string[];
  [key: string]: unknown;
}

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          character_sheet: CharacterSheet;
          aesthetic_bible: AestheticBible;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          character_sheet?: CharacterSheet;
          aesthetic_bible?: AestheticBible;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          character_sheet?: CharacterSheet;
          aesthetic_bible?: AestheticBible;
          created_at?: string;
          updated_at?: string;
        };
      };
      clips: {
        Row: {
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
        };
        Insert: {
          id?: string;
          project_id: string;
          order_index: number;
          prompt: string;
          shot_metadata?: ShotPromptMetadata | null;
          seed_image_url?: string | null;
          seed_source?: SeedSource;
          video_url?: string | null;
          last_frame_url?: string | null;
          sampled_frames_urls?: string[];
          status?: ClipStatus;
          replicate_prediction_id?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          order_index?: number;
          prompt?: string;
          shot_metadata?: ShotPromptMetadata | null;
          seed_image_url?: string | null;
          seed_source?: SeedSource;
          video_url?: string | null;
          last_frame_url?: string | null;
          sampled_frames_urls?: string[];
          status?: ClipStatus;
          replicate_prediction_id?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          project_id: string;
          role: MessageRole;
          content: string;
          attached_frame_urls: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          role: MessageRole;
          content: string;
          attached_frame_urls?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          role?: MessageRole;
          content?: string;
          attached_frame_urls?: string[];
          created_at?: string;
        };
      };
    };
  };
}
