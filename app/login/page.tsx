import { LoginForm } from "./login-form";
import { MaskGlyph } from "@/app/components/mask-glyph";
import { WelcomeSplash } from "./welcome-splash";

export const metadata = {
  title: "Sign in · Nysus",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const safeReturn = sanitizeReturn(params.next);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 paper-grain vignette">
      <WelcomeSplash />
      <div className="w-full max-w-md flex flex-col items-center gap-7">
        <header className="flex flex-col items-center gap-3 text-center">
          <MaskGlyph size={96} />
          <div className="leading-none mt-1">
            <h1 className="font-display text-[40px] tracking-[0.04em] text-ink">
              Nysus
            </h1>
            <p className="font-hand text-[18px] text-[color:var(--color-sepia-deep)] -mt-0.5">
              a director&rsquo;s notebook
            </p>
          </div>
          <p className="font-hand text-[20px] text-[color:var(--color-sepia-deep)] mt-2">
            open the <span className="highlight">notebook</span>
          </p>
        </header>

        <div className="sepia-rule w-full" />

        <LoginForm returnTo={safeReturn} />

        <footer className="mt-2 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          <span className="inline-block w-6 h-px bg-[color:var(--color-sepia)]" />
          <span>after Dionysus</span>
          <span className="inline-block w-6 h-px bg-[color:var(--color-sepia)]" />
        </footer>
      </div>
    </main>
  );
}

/** Only allow relative paths starting with / to prevent open redirect. */
function sanitizeReturn(raw?: string): string {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  return raw;
}
