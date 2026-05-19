import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, handle, bio, avatar_path, website")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 sm:px-6 lg:px-12 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-10 lg:pt-14 md:pb-10">
      <header className="flex flex-col gap-2 mb-6">
        <div className="eyebrow">The director</div>
        <h1 className="font-display text-[44px] sm:text-[56px] leading-[1] text-ink">
          Your <span className="italic">name</span> on the{" "}
          <span className="highlight">poster</span>.
        </h1>
        <p className="font-hand text-[20px] text-[color:var(--color-sepia-deep)] mt-1 leading-snug max-w-[60ch]">
          Shown on gallery tiles and share pages when you&rsquo;ve set a handle.
          Nothing is public until you choose so.
        </p>
      </header>

      <div className="sepia-rule mb-8" />

      <ProfileForm
        email={user.email ?? ""}
        initialProfile={{
          display_name: profile?.display_name ?? null,
          handle: profile?.handle ?? null,
          bio: profile?.bio ?? null,
          website: profile?.website ?? null,
        }}
      />
    </main>
  );
}
