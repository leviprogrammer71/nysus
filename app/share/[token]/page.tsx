import { notFound } from "next/navigation";
import Image from "next/image";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Logomark } from "@/app/components/logomark";
import type { CharacterSheet, AestheticBible } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

/**
 * Public read-only project page. No auth — anyone with the token sees
 * the timeline stills. Uses service-role read because the viewer may
 * not be signed in; we scope queries to share_enabled=true projects
 * only so revoked links stop working instantly.
 */
export default async function SharePage({ params }: PageProps) {
  const { token } = await params;
  if (!token || token.length < 10) notFound();

  const admin = createServiceRoleClient();

  const { data: project } = await admin
    .from("projects")
    .select("id, title, description, character_sheet, aesthetic_bible")
    .eq("share_token", token)
    .eq("share_enabled", true)
    .maybeSingle();
  if (!project) notFound();

  const { data: clips } = await admin
    .from("clips")
    .select(
      "id, order_index, prompt, still_image_url, video_url, status, narration, created_at",
    )
    .eq("project_id", project.id)
    .order("order_index", { ascending: true });

  const sheet = (project.character_sheet ?? {}) as CharacterSheet;
  const bible = (project.aesthetic_bible ?? {}) as AestheticBible;
  const tagline =
    bible.visual_style ??
    project.description ??
    (sheet.characters?.[0]?.name
      ? `A short film featuring ${sheet.characters[0].name}.`
      : "A short film.");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
      <header className="mb-6 flex items-center gap-3">
        <Logomark size={36} animated />
        <span className="font-display text-xs uppercase tracking-[0.25em] text-ink-soft/70">
          shared from Nysus
        </span>
      </header>

      <section className="mb-6">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">
          {project.title}
        </h1>
        <p className="mt-2 font-hand text-lg text-ink-soft">{tagline}</p>
      </section>

      {(clips ?? []).length === 0 ? (
        <p className="font-body text-sm text-ink-soft/70">
          No scenes yet.
        </p>
      ) : (
        <ol className="space-y-8">
          {(clips ?? []).map((c) => (
            <li key={c.id} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg text-ink">
                  Scene {c.order_index + 1}
                </h2>
                <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
                  {c.status === "complete" ? "finished" : c.status}
                </span>
              </div>
              {c.video_url ? (
                <video
                  src={c.video_url}
                  controls
                  playsInline
                  className="w-full rounded border border-ink/10 bg-ink/90"
                />
              ) : c.still_image_url ? (
                <Image
                  src={c.still_image_url}
                  alt={c.prompt}
                  width={720}
                  height={1280}
                  className="w-full rounded border border-ink/10"
                />
              ) : null}
              {c.narration ? (
                <p className="font-hand text-base text-sepia-deep">
                  {c.narration}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <footer className="mt-12 border-t border-ink/10 pt-4 font-body text-xs text-ink-soft/60">
        Made with Nysus · Dionysian cinema, by chat.
      </footer>
    </main>
  );
}
