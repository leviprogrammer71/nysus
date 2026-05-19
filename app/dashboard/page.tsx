import Link from "next/link";
import Image from "next/image";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { loadGallery } from "@/lib/gallery";
import { aphorismOfTheDay } from "@/lib/aphorisms";
import { PushOptIn } from "@/app/components/push-optin";

/**
 * /dashboard — the director's notebook, first leaf.
 *
 * Pulled from the design system's Dashboard mockup. The page opens
 * like a leaf being turned — epigraph aphorism, run-on greeting,
 * three chapter-style CTAs, then the productions grid styled as
 * poster-fragments. Bottom strip: "recent from the forges" + the
 * monthly forge usage gauge.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects, error } = await supabase
    .from("projects")
    .select(
      "id, title, description, character_sheet, aesthetic_bible, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) {
    const isMissingSchema =
      error.code === "PGRST202" ||
      /schema cache|public\.(projects|clips|messages)/i.test(error.message);
    if (isMissingSchema) return <SchemaMissing />;
    return <LoadError message={error.message} />;
  }

  const hasProjects = projects && projects.length > 0;

  const admin = createServiceRoleClient();
  const [videoCountR, stillCountR, clipsForThumbsR, galleryEntries] =
    await Promise.all([
      admin
        .from("clips")
        .select("*", { count: "exact", head: true })
        .eq("status", "complete"),
      admin
        .from("clips")
        .select("*", { count: "exact", head: true })
        .eq("still_status", "complete"),
      admin
        .from("clips")
        .select(
          "project_id, still_image_url, video_url, status, still_status, order_index, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300),
      loadGallery({ limit: 6, excludeUserId: user?.id }),
    ]);

  const totalProjects = projects?.length ?? 0;
  const totalVideos = videoCountR.count ?? 0;
  const totalStills = stillCountR.count ?? 0;

  // Roll up per-project stats from the clip table for the procession
  // glyph + "touched" + still thumbnails.
  type ProjectMeta = {
    thumb: string | null;
    totalScenes: number;
    rendered: number;
    stillsReady: number;
    lastTouchedClipAt: string | null;
  };
  const metaByProject = new Map<string, ProjectMeta>();
  for (const c of clipsForThumbsR.data ?? []) {
    if (!c.project_id) continue;
    const m: ProjectMeta = metaByProject.get(c.project_id) ?? {
      thumb: null,
      totalScenes: 0,
      rendered: 0,
      stillsReady: 0,
      lastTouchedClipAt: null,
    };
    m.totalScenes += 1;
    if (c.status === "complete") m.rendered += 1;
    if (c.still_status === "complete") m.stillsReady += 1;
    if (!m.thumb && c.still_status === "complete" && c.still_image_url) {
      m.thumb = c.still_image_url;
    }
    if (
      c.created_at &&
      (!m.lastTouchedClipAt || c.created_at > m.lastTouchedClipAt)
    ) {
      m.lastTouchedClipAt = c.created_at;
    }
    metaByProject.set(c.project_id, m);
  }

  const aphorism = aphorismOfTheDay();
  const userName = displayNameFor(user?.email);
  const greeting = greetingFor(new Date());
  const productionsInMotion = (projects ?? []).filter((p) => {
    const m = metaByProject.get(p.id);
    if (!m) return false;
    // A film is "in motion" if it has scenes but isn't all-rendered yet.
    return m.totalScenes > 0 && m.rendered < m.totalScenes;
  }).length;
  const awaitingCut = (projects ?? []).filter((p) => {
    const m = metaByProject.get(p.id);
    if (!m) return false;
    return m.totalScenes > 0 && m.rendered === m.totalScenes;
  }).length;
  const lastTouched = (projects ?? [])[0];

  return (
    <main className="relative px-6 md:px-12 lg:px-16 pt-10 lg:pt-14 pb-24 max-w-[1280px] mx-auto">
      {/* Gutter vine — runs down the left edge on md+ */}
      <div
        className="absolute top-24 bottom-24 left-2 w-[44px] gutter-vine pointer-events-none hidden md:block"
        aria-hidden
      />

      {/* ─── Epigraph (aphorism) ─── */}
      <div className="max-w-[640px] leaf-in">
        <div className="eyebrow mb-2">Epigraph</div>
        <p className="font-display italic text-[19px] md:text-[22px] leading-[1.45] text-ink">
          &ldquo;{aphorism.text}&rdquo;
        </p>
        {aphorism.whisper ? (
          <div className="font-hand text-[16px] text-[color:var(--color-sepia-deep)] mt-1">
            — {aphorism.whisper}
          </div>
        ) : null}
      </div>

      {/* ─── Hero greeting ─── */}
      <div className="mt-12 lg:mt-16 leaf-in-2">
        <div className="eyebrow text-[color:var(--color-ink-soft)]">
          {greeting.eyebrow}
        </div>
        {hasProjects ? (
          <>
            <h1 className="font-display text-[44px] md:text-[64px] lg:text-[76px] leading-[0.98] tracking-[-0.005em] mt-3 max-w-[14ch]">
              {greeting.salutation},<br />
              <span className="italic">{userName}</span>.{" "}
              <span className="highlight">
                {wordForCount(productionsInMotion)}
              </span>{" "}
              films <span className="italic">in&nbsp;motion</span>,
            </h1>
            <h1 className="font-display text-[44px] md:text-[64px] lg:text-[76px] leading-[0.98] tracking-[-0.005em] mt-1 max-w-[18ch]">
              {awaitingCut > 0 ? (
                <>
                  {awaitingCut === 1 ? "one" : wordForCount(awaitingCut)}{" "}
                  <span className="italic">awaiting</span> the{" "}
                  <span className="highlight-thin">cut</span>.
                </>
              ) : (
                <>
                  the <span className="italic">cut</span> is still{" "}
                  <span className="highlight-thin">distant</span>.
                </>
              )}
            </h1>
            {lastTouched ? (
              <p className="font-hand text-[22px] text-[color:var(--color-sepia-deep)] mt-5">
                last touched — <span className="italic">{lastTouched.title}</span>,{" "}
                {timeAgo(lastTouched.updated_at)}.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h1 className="font-display text-[44px] md:text-[60px] lg:text-[70px] leading-[1] mt-3 max-w-[14ch]">
              No <span className="italic">procession</span> yet —{" "}
              <span className="highlight">light</span> the first{" "}
              <span className="italic">torch</span>.
            </h1>
            <p className="font-hand text-[20px] text-[color:var(--color-sepia-deep)] mt-5 max-w-md leading-snug">
              Ari is at the desk with a fresh sheet of paper. Tell her a
              sentence and she&rsquo;ll find the shape of it.
            </p>
          </>
        )}
      </div>

      {/* ─── Three chapter CTAs ─── */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-y-4 md:gap-x-10 max-w-[920px] leaf-in-3">
        <ChapterCTA
          chapter="Chapter I"
          title={
            <>
              Begin a new <span className="italic">procession</span>
            </>
          }
          hint="open a fresh page with Ari"
          href="/projects/new"
        />
        <ChapterCTA
          chapter="Chapter II"
          title={
            <>
              Cross the <span className="italic">threshold</span>
            </>
          }
          hint="to the forges — no project required"
          href="/playground"
        />
        <ChapterCTA
          chapter="Chapter III"
          title={
            <>
              Return to a <span className="italic">film</span>
            </>
          }
          hint="the productions below, choose your altar"
          href="#productions"
        />
      </div>

      <PushOptIn />

      {/* ─── Productions ─── */}
      <div
        id="productions"
        className="mt-20 flex items-center gap-6 rosette scroll-mt-24"
      >
        <span className="eyebrow text-[color:var(--color-ink-soft)]">
          Productions in motion
        </span>
        <span className="font-hand text-[18px] text-[color:var(--color-sepia-deep)]">
          {wordForCount(totalProjects)}
        </span>
      </div>

      {hasProjects ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {(projects ?? []).slice(0, 12).map((p, i) => {
            const meta = metaByProject.get(p.id) ?? {
              thumb: null,
              totalScenes: 0,
              rendered: 0,
              stillsReady: 0,
              lastTouchedClipAt: null,
            };
            const motif =
              motifFor(p.character_sheet, p.aesthetic_bible) ??
              "a film waiting for its first beat.";
            const currentStage = stageFor(meta);
            return (
              <ProductionCard
                key={p.id}
                index={i}
                href={`/projects/${p.id}`}
                indexLabel={`No. ${String(totalProjects - i).padStart(2, "0")}`}
                kindLabel={kindLabelFor(meta)}
                title={p.title}
                motif={motif}
                thumbUrl={meta.thumb}
                stillsReady={meta.stillsReady}
                totalScenes={meta.totalScenes}
                rendered={meta.rendered}
                currentStageIdx={currentStage.idx}
                stageHand={currentStage.hand}
                touchedAt={p.updated_at}
              />
            );
          })}
        </div>
      ) : (
        <EmptyProductionsArt />
      )}

      {/* ─── Bottom strip — gallery + forge gauge ─── */}
      <div className="mt-20 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-10">
        <div>
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <div className="eyebrow text-[color:var(--color-ink-soft)]">
                Recent from the forges
              </div>
              <h2 className="font-display text-[28px] mt-1">
                Stills <span className="italic">and</span> motions
              </h2>
            </div>
            <Link
              href="/gallery"
              className="font-hand text-[18px] text-[color:var(--color-sepia-deep)] hover:text-ink transition-colors"
            >
              see the whole gallery →
            </Link>
          </div>
          <ForgesStrip
            entries={galleryEntries}
            fallbackThumbs={
              (clipsForThumbsR.data ?? [])
                .filter(
                  (c) =>
                    (c.still_status === "complete" && c.still_image_url) ||
                    (c.status === "complete" && c.video_url),
                )
                .slice(0, 6)
                .map((c) => ({
                  url: c.still_image_url ?? null,
                  isVideo: c.status === "complete",
                }))
            }
          />
        </div>

        <div>
          <div className="eyebrow text-[color:var(--color-ink-soft)]">
            The forge — this month
          </div>
          <h2 className="font-display text-[28px] mt-1">
            {totalStills + totalVideos}{" "}
            <span className="italic">of</span> {totalStills + totalVideos + 12}
          </h2>
          <p className="font-hand text-[18px] text-[color:var(--color-sepia-deep)] mt-1">
            {forgePoetic(totalStills, totalVideos)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] text-[color:var(--color-ink-soft)]">
            <ForgeStat label="still forge" value={totalStills} />
            <ForgeStat label="motion forge" value={totalVideos} />
            <ForgeStat label="productions" value={totalProjects} />
            <ForgeStat
              label="rendered"
              value={Array.from(metaByProject.values()).reduce(
                (acc, m) => acc + m.rendered,
                0,
              )}
            />
          </div>
        </div>
      </div>

      {/* footer signature */}
      <div className="mt-24 flex items-center justify-between border-t border-[color:var(--color-sepia)]/30 pt-5">
        <div className="font-hand text-[18px] text-[color:var(--color-sepia-deep)]">
          after Dionysus.
        </div>
        <div className="eyebrow text-[color:var(--color-ink-soft)]">
          Nysus · the long evening
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------

function ChapterCTA({
  chapter,
  title,
  hint,
  href,
}: {
  chapter: string;
  title: React.ReactNode;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="chapter-link block group py-3 border-t border-[color:var(--color-ink)]/70"
    >
      <div className="flex items-baseline justify-between">
        <div className="eyebrow text-[color:var(--color-ink-soft)]">{chapter}</div>
        <span className="chev font-mono text-[12px] text-[color:var(--color-ink-soft)]">
          ⟶
        </span>
      </div>
      <div className="font-display text-[28px] mt-1">{title}</div>
      <div className="rule h-[2px] w-8 mt-2" />
      <div className="font-hand text-[16px] text-[color:var(--color-sepia-deep)] mt-1">
        {hint}
      </div>
    </Link>
  );
}

function ProductionCard({
  index,
  href,
  indexLabel,
  kindLabel,
  title,
  motif,
  thumbUrl,
  stillsReady,
  totalScenes,
  rendered,
  currentStageIdx,
  stageHand,
  touchedAt,
}: {
  index: number;
  href: string;
  indexLabel: string;
  kindLabel: string;
  title: string;
  motif: string;
  thumbUrl: string | null;
  stillsReady: number;
  totalScenes: number;
  rendered: number;
  currentStageIdx: number;
  stageHand: string;
  touchedAt: string;
}) {
  const leafInClass = ["leaf-in", "leaf-in-2", "leaf-in-3", "leaf-in-4"][index % 4];
  const isAwaitingCut = currentStageIdx === 5 && rendered === totalScenes && totalScenes > 0;
  return (
    <Link href={href} className={`leaf p-4 group block ${leafInClass}`}>
      <div className="aspect-[4/5] still-placeholder-dark relative overflow-hidden">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 60% 70%, rgba(232,178,58,0.20), transparent 35%), radial-gradient(circle at 30% 40%, rgba(122,47,58,0.30), transparent 45%)",
            }}
          />
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(0,0,0,0.55))",
          }}
        />
        <div className="absolute top-2 left-2 font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-paper)]/80">
          {indexLabel}
        </div>
        {isAwaitingCut ? (
          <svg
            className="absolute top-3 right-3"
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden
          >
            <path
              d="M6 8 C 14 14, 22 22, 34 32"
              stroke="var(--color-red-grease)"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.92"
            />
            <path
              d="M6 32 C 16 26, 24 18, 34 8"
              stroke="var(--color-red-grease)"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.92"
            />
          </svg>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="eyebrow text-[color:var(--color-sepia-deep)]">
          {kindLabel}
        </div>
        <h3 className="font-display text-[26px] leading-[1.05] mt-1">{title}</h3>
        <p className="font-hand text-[18px] text-[color:var(--color-sepia-deep)] mt-1 leading-snug line-clamp-2">
          {motif}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2.5 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`proc-dot ${
              i < currentStageIdx
                ? "done"
                : i === currentStageIdx
                ? "current"
                : "future"
            }`}
            aria-hidden
          />
        ))}
        <span
          className={`ml-1 font-mono text-[10px] tracking-[0.18em] uppercase ${
            isAwaitingCut
              ? "font-hand text-[color:var(--color-wine-dark)] tracking-normal text-[15px]"
              : "text-[color:var(--color-ink-soft)]"
          }`}
        >
          {isAwaitingCut
            ? "awaiting the cut"
            : `${stageHand} · ${stillsReady}/${Math.max(totalScenes, stillsReady)}`}
        </span>
      </div>

      <div className="sepia-rule-tight my-3" />
      <div className="flex items-baseline justify-between">
        <div className="font-hand text-[15px] text-[color:var(--color-sepia-deep)]">
          touched {timeAgo(touchedAt)}
        </div>
        <div className="font-mono text-[10px] text-[color:var(--color-ink-soft)]">
          {totalScenes > 0 ? `${totalScenes} sc.` : "draft 0"}
        </div>
      </div>
    </Link>
  );
}

function ForgesStrip({
  entries,
  fallbackThumbs,
}: {
  entries: Awaited<ReturnType<typeof loadGallery>>;
  fallbackThumbs: Array<{ url: string | null; isVideo: boolean }>;
}) {
  // Prefer the user's own clips for this strip — it's "recent from
  // your forges." Fall back to gallery entries from other directors
  // when the user has nothing yet.
  const tiles =
    fallbackThumbs.length > 0
      ? fallbackThumbs.slice(0, 6)
      : entries.slice(0, 6).map((g) => ({
          url: g.thumb_url ?? null,
          isVideo: Boolean(g.video_url),
        }));
  if (tiles.length === 0) {
    return (
      <div className="mt-5 grid grid-cols-3 md:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={
              i % 2 === 0
                ? "aspect-square still-placeholder-dark"
                : "aspect-square still-placeholder"
            }
          />
        ))}
      </div>
    );
  }
  return (
    <div className="mt-5 grid grid-cols-3 md:grid-cols-6 gap-2">
      {tiles.map((t, i) => (
        <div
          key={i}
          className={`aspect-square overflow-hidden relative ${
            t.url ? "" : i % 2 === 0 ? "still-placeholder-dark" : "still-placeholder"
          }`}
        >
          {t.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : null}
          {t.isVideo ? (
            <div className="absolute bottom-1 right-1 font-mono text-[9px] text-[color:var(--color-paper)] bg-[color:var(--color-ink)]/60 px-1">
              ▶
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ForgeStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-ink tabular-nums">{value}</span>
    </div>
  );
}

function EmptyProductionsArt() {
  return (
    <div className="mt-12 grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center max-w-[1000px]">
      <figure className="relative max-w-[460px] mx-auto lg:mx-0">
        <div className="aspect-[4/5] still-placeholder relative overflow-hidden">
          <Image
            src="/illustrations/empty-notebook.png"
            alt="A torchlit empty page"
            fill
            sizes="(max-width: 480px) 90vw, 460px"
            className="object-cover mix-blend-multiply"
          />
        </div>
      </figure>
      <div>
        <div className="eyebrow text-[color:var(--color-ink-soft)]">
          A blank desk · welcome, director
        </div>
        <h2 className="font-display text-[36px] md:text-[48px] leading-[1] mt-3 max-w-[16ch]">
          Tell Ari a sentence. She finds the{" "}
          <span className="italic">shape</span>.
        </h2>
        <Link
          href="/projects/new"
          className="chapter-link group inline-flex items-baseline gap-3 border-t border-ink mt-8 pt-3 pr-10"
        >
          <span className="eyebrow text-[color:var(--color-ink-soft)]">
            Chapter I &nbsp;⟶
          </span>
          <span className="font-display text-[28px]">
            Begin the first <span className="italic">film</span>
          </span>
        </Link>
      </div>
    </div>
  );
}

function SchemaMissing() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-10">
      <div className="eyebrow text-[color:var(--color-sepia-deep)]">
        One more step
      </div>
      <h1 className="font-display text-[36px] text-ink mt-2">
        The <span className="highlight">notebook</span> isn&rsquo;t open yet.
      </h1>
      <p className="mt-3 font-hand text-[18px] text-[color:var(--color-sepia-deep)]">
        Supabase is connected, but the schema hasn&rsquo;t been applied.
      </p>
      <ol className="mt-6 space-y-2 font-body text-sm text-ink">
        <li>
          1. Open{" "}
          <a
            href="https://supabase.com/dashboard"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            supabase.com/dashboard
          </a>{" "}
          → SQL editor → New query.
        </li>
        <li>
          2. Run <code>supabase/migrations/0001_init.sql</code> through{" "}
          <code>0010_storyflow.sql</code>.
        </li>
        <li>3. Reload this page.</li>
      </ol>
    </main>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <div className="eyebrow text-[color:var(--color-red-grease)]">
        the reel jammed
      </div>
      <h1 className="font-display text-[36px] text-ink mt-2">
        Something went <span className="italic">off-script</span>.
      </h1>
      <p className="mt-3 font-hand text-[16px] text-[color:var(--color-sepia-deep)] max-w-md">
        {message}
      </p>
      <Link href="/dashboard" className="btn-paper mt-6 inline-block">
        try again
      </Link>
    </main>
  );
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function displayNameFor(email: string | null | undefined): string {
  if (!email) return "Director";
  const local = email.split("@")[0];
  // Strip common suffixes; capitalize.
  const base = local.replace(/\d+$/, "").replace(/[._-]/g, " ");
  const cleaned = base.trim() || "director";
  return cleaned
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function greetingFor(d: Date): { eyebrow: string; salutation: string } {
  const h = d.getHours();
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
  if (h < 5) return { eyebrow: `${weekday} · small hours`, salutation: "Still up" };
  if (h < 11) return { eyebrow: `${weekday} · morning`, salutation: "Good morning" };
  if (h < 17) return { eyebrow: `${weekday} · afternoon`, salutation: "Good afternoon" };
  if (h < 21) return { eyebrow: `${weekday} · the long evening`, salutation: "Good evening" };
  return { eyebrow: `${weekday} · late`, salutation: "Late again" };
}

const WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
function wordForCount(n: number): string {
  if (n < 0) return "no";
  if (n < WORDS.length) return WORDS[n];
  return String(n);
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "moments ago";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

const STAGES = [
  { hand: "concept · oracle" },
  { hand: "script · liturgy" },
  { hand: "scenes · the line" },
  { hand: "image · the mask" },
  { hand: "animate · the rite" },
  { hand: "stitch · the cut" },
];
function stageFor(meta: {
  totalScenes: number;
  rendered: number;
  stillsReady: number;
}): { idx: number; hand: string } {
  if (meta.totalScenes === 0) return { idx: 0, hand: STAGES[0].hand };
  if (meta.rendered === meta.totalScenes)
    return { idx: 5, hand: STAGES[5].hand };
  if (meta.rendered > 0) return { idx: 4, hand: STAGES[4].hand };
  if (meta.stillsReady > 0) return { idx: 3, hand: STAGES[3].hand };
  return { idx: 2, hand: STAGES[2].hand };
}

function kindLabelFor(meta: {
  totalScenes: number;
  rendered: number;
}): string {
  if (meta.totalScenes === 0) return "A first inkling";
  if (meta.rendered === meta.totalScenes) return "A vignette";
  if (meta.totalScenes >= 6) return "A short film";
  return "A feature in fragments";
}

function motifFor(
  sheet: unknown,
  bible: unknown,
): string | null {
  const s = (sheet ?? {}) as {
    setting?: { recurring_symbol?: string; primary?: string };
    characters?: Array<{ demeanor?: string; name?: string }>;
  };
  const b = (bible ?? {}) as { visual_style?: string; thematic_motifs?: string[] };
  const candidates = [
    s.setting?.recurring_symbol,
    s.setting?.primary,
    b.thematic_motifs?.[0],
    b.visual_style,
    s.characters?.[0]?.demeanor && s.characters[0]?.name
      ? `${s.characters[0].name} — ${s.characters[0].demeanor}`
      : null,
    s.characters?.[0]?.name ? `featuring ${s.characters[0].name}` : null,
  ].filter(Boolean) as string[];
  return candidates[0] ? candidates[0].slice(0, 60) : null;
}

function forgePoetic(stills: number, motions: number): string {
  if (stills + motions === 0) return "the vines are still — strike the first still.";
  if (motions === 0) return "stills are ready; the rite has not begun.";
  if (motions < 4) return "the rite is small, the wine is fresh.";
  if (motions < 12) return "enough wine for nine more scenes.";
  return "the procession has been long; rest is allowed.";
}
