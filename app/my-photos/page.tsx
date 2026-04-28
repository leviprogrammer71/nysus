import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { AppTopbar } from "@/app/components/app-topbar";
import { loadMyPhotos } from "@/lib/my-photos";
import { MyPhotosGrid } from "./my-photos-grid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MyPhotosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my-photos");

  const admin = createServiceRoleClient();
  const photos = await loadMyPhotos({ admin, userId: user.id });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-6 sm:px-6 md:pb-10">
      <AppTopbar email={user.email ?? null} />
      <section className="mb-6">
        <p className="font-body text-[11px] uppercase tracking-[0.28em] text-ink-soft/70">
          Personal archive
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-ink sm:text-4xl">
          My photos
        </h1>
        <p className="mt-2 max-w-xl font-body text-sm text-ink-soft/80 leading-relaxed">
          Every still, portrait, reference, and clip you&rsquo;ve generated or
          uploaded. Tap a tile to see the project it belongs to. Tap the trash
          to delete; deletes remove the file from storage and detach it from
          the project.
        </p>
        <p className="mt-2 font-body text-xs text-ink-soft/60">
          {photos.length} {photos.length === 1 ? "item" : "items"}
        </p>
      </section>
      <MyPhotosGrid initialPhotos={photos} />
    </main>
  );
}
