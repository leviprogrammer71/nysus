import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "./types";

/**
 * Browser-side Supabase client. Use only in client components.
 * For anything running on the server (layouts, pages, route handlers,
 * server actions), use `createServerClient` from ./server instead so
 * cookies/session refresh work correctly.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
