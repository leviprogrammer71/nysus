import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppTopbar } from "@/app/components/app-topbar";
import { ListingBundlePicker } from "./listing-bundle-picker";

/**
 * /video — entry point for video creation flows.
 *
 * ?mode=listing  → Done-for-you Listing Bundle category picker (default)
 * ?mode=transform → Construction/transformation flow (future)
 *
 * Auth required. Middleware handles the redirect; this double-checks.
 */
export default async function VideoPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/video?mode=listing");

  const params = await searchParams;
  const mode = params.mode ?? "listing";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-6 sm:px-6">
      <AppTopbar email={user.email ?? null} />

      {mode === "listing" ? (
        <ListingBundlePicker />
      ) : (
        <div className="py-16 text-center">
          <h1 className="font-display text-2xl text-ink">Coming soon</h1>
          <p className="mt-2 font-body text-sm text-ink-soft/80">
            The {mode} flow is under construction.
          </p>
        </div>
      )}
    </main>
  );
}
