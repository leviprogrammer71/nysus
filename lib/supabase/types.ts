/**
 * Database types.
 *
 * Hand-shaped to match postgrest-js's `GenericSchema`:
 *   - Tables / Views / Functions at the schema level
 *   - Each Table carries Row / Insert / Update / Relationships
 *
 * TODO: regenerate via `npx supabase gen types typescript --project-id <ref>`
 * once the CLI is wired up. Keep this file in sync when the schema changes.
 */

import type { ShotPromptMetadata } from "@/lib/shot-prompt";

export type ClipStatus = "queued" | "processing" | "complete" | "failed";
export type StillStatus = "none" | "queued" | "processing" | "complete" | "failed";
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
    /** Storage paths (not URLs) to reference images for this character. */
    reference_images?: string[];
  }[];
  setting?: {
    primary?: string;
    recurring_symbol?: string;
    reference_images?: string[];
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
  /** Mood-board: storage paths (not URLs). */
  reference_images?: string[];
  [key: string]: unknown;
}

type ProjectsTable = {
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
  Relationships: [];
};

type ClipsTable = {
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
    // Stills pipeline (added 0003_stills.sql)
    still_image_url: string | null;
    still_prompt: string | null;
    still_status: StillStatus;
    still_replicate_prediction_id: string | null;
    narration: string | null;
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
    still_image_url?: string | null;
    still_prompt?: string | null;
    still_status?: StillStatus;
    still_replicate_prediction_id?: string | null;
    narration?: string | null;
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
    still_image_url?: string | null;
    still_prompt?: string | null;
    still_status?: StillStatus;
    still_replicate_prediction_id?: string | null;
    narration?: string | null;
    created_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "clips_project_id_fkey";
      columns: ["project_id"];
      isOneToOne: false;
      referencedRelation: "projects";
      referencedColumns: ["id"];
    },
  ];
};

export type UsageProvider = "replicate" | "openrouter" | "openai";
export type UsageAction = "generate" | "regenerate" | "chat" | "critique";

type UsageTable = {
  Row: {
    id: string;
    user_id: string | null;
    project_id: string | null;
    provider: UsageProvider;
    action: UsageAction;
    cost_usd_cents: number;
    tokens_in: number | null;
    tokens_out: number | null;
    metadata: Record<string, unknown>;
    created_at: string;
  };
  Insert: {
    id?: string;
    user_id?: string | null;
    project_id?: string | null;
    provider: UsageProvider;
    action: UsageAction;
    cost_usd_cents?: number;
    tokens_in?: number | null;
    tokens_out?: number | null;
    metadata?: Record<string, unknown>;
    created_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string | null;
    project_id?: string | null;
    provider?: UsageProvider;
    action?: UsageAction;
    cost_usd_cents?: number;
    tokens_in?: number | null;
    tokens_out?: number | null;
    metadata?: Record<string, unknown>;
    created_at?: string;
  };
  Relationships: [];
};

type MessagesTable = {
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
  Relationships: [
    {
      foreignKeyName: "messages_project_id_fkey";
      columns: ["project_id"];
      isOneToOne: false;
      referencedRelation: "projects";
      referencedColumns: ["id"];
    },
  ];
};

export interface Database {
  // Discriminator consumed by @supabase/supabase-js to infer PostgREST version.
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      projects: ProjectsTable;
      clips: ClipsTable;
      messages: MessagesTable;
      usage: UsageTable;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
