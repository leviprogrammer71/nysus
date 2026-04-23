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
    draft_mode: boolean;
    share_token: string | null;
    share_enabled: boolean;
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
    draft_mode?: boolean;
    share_token?: string | null;
    share_enabled?: boolean;
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
    draft_mode?: boolean;
    share_token?: string | null;
    share_enabled?: boolean;
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
    narration_audio_url: string | null;
    narration_model: string | null;
    captions_srt: string | null;
    still_approved: boolean;
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
    narration_audio_url?: string | null;
    narration_model?: string | null;
    captions_srt?: string | null;
    still_approved?: boolean;
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
    narration_audio_url?: string | null;
    narration_model?: string | null;
    captions_srt?: string | null;
    still_approved?: boolean;
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

type UserBudgetOverrideScope = "day" | "month";

type UserBudgetOverridesTable = {
  Row: {
    id: string;
    user_id: string;
    scope: UserBudgetOverrideScope;
    period: string;
    extra_cents: number;
    stripe_session_id: string | null;
    stripe_payment_intent_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  };
  Insert: {
    id?: string;
    user_id: string;
    scope?: UserBudgetOverrideScope;
    period: string;
    extra_cents: number;
    stripe_session_id?: string | null;
    stripe_payment_intent_id?: string | null;
    metadata?: Record<string, unknown>;
    created_at?: string;
  };
  Update: {
    id?: string;
    user_id?: string;
    scope?: UserBudgetOverrideScope;
    period?: string;
    extra_cents?: number;
    stripe_session_id?: string | null;
    stripe_payment_intent_id?: string | null;
    metadata?: Record<string, unknown>;
    created_at?: string;
  };
  Relationships: [];
};

type PushSubscriptionsTable = {
  Row: {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    user_agent: string | null;
    created_at: string;
    last_used_at: string | null;
  };
  Insert: {
    id?: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    user_agent?: string | null;
    created_at?: string;
    last_used_at?: string | null;
  };
  Update: {
    id?: string;
    user_id?: string;
    endpoint?: string;
    p256dh?: string;
    auth?: string;
    user_agent?: string | null;
    created_at?: string;
    last_used_at?: string | null;
  };
  Relationships: [];
};

type UserProgressTable = {
  Row: {
    user_id: string;
    xp: number;
    level: number;
    streak_days: number;
    last_ship_date: string | null;
    total_scenes: number;
    total_stitches: number;
    total_shares: number;
    total_remixes_received: number;
    used_seedance: boolean;
    used_kling: boolean;
    updated_at: string;
  };
  Insert: {
    user_id: string;
    xp?: number;
    level?: number;
    streak_days?: number;
    last_ship_date?: string | null;
    total_scenes?: number;
    total_stitches?: number;
    total_shares?: number;
    total_remixes_received?: number;
    used_seedance?: boolean;
    used_kling?: boolean;
    updated_at?: string;
  };
  Update: {
    user_id?: string;
    xp?: number;
    level?: number;
    streak_days?: number;
    last_ship_date?: string | null;
    total_scenes?: number;
    total_stitches?: number;
    total_shares?: number;
    total_remixes_received?: number;
    used_seedance?: boolean;
    used_kling?: boolean;
    updated_at?: string;
  };
  Relationships: [];
};

type UserAchievementsTable = {
  Row: {
    id: string;
    user_id: string;
    slug: string;
    awarded_at: string;
    metadata: Record<string, unknown>;
  };
  Insert: {
    id?: string;
    user_id: string;
    slug: string;
    awarded_at?: string;
    metadata?: Record<string, unknown>;
  };
  Update: {
    id?: string;
    user_id?: string;
    slug?: string;
    awarded_at?: string;
    metadata?: Record<string, unknown>;
  };
  Relationships: [];
};

type GalleryLikesTable = {
  Row: {
    id: string;
    project_id: string;
    user_id: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    project_id: string;
    user_id: string;
    created_at?: string;
  };
  Update: {
    id?: string;
    project_id?: string;
    user_id?: string;
    created_at?: string;
  };
  Relationships: [];
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
      user_budget_overrides: UserBudgetOverridesTable;
      push_subscriptions: PushSubscriptionsTable;
      user_progress: UserProgressTable;
      user_achievements: UserAchievementsTable;
      gallery_likes: GalleryLikesTable;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
