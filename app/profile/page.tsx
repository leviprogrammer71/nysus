import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppTopbar } from "@/app/components/app-topbar";
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
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-6 sm:px-6 md:pb-10">
      <AppTopbar email={user.email ?? null} />

      <section className="mb-6">
        <p className="font-body text-[11px] uppercase tracking-[0.28em] text-ink-soft/70">
          Account
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-ink sm:text-4xl">
          Your profile
        </h1>
        <p className="mt-2 font-body text-sm text-ink-soft/80 leading-relaxed">
          Shown on gallery tiles and share pages when you&rsquo;ve set a handle.
          Nothing here is shared publicly until you set one.
        </p>
      </section>

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
