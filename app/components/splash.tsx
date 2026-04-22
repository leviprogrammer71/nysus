import Image from "next/image";

/**
 * Splash / loading screen.
 *
 * Renders the static logomark for now. When the user provides the
 * animated welcome-screen version, swap the `<Image>` here for a
 * `<video>`, Lottie, or animated SVG — the call sites (app/loading.tsx,
 * any future splash overlay) don't change.
 *
 * Keeping this centralized makes the eventual swap a one-file edit.
 */
export function Splash({
  fullscreen = true,
  caption = "opening the notebook…",
}: {
  fullscreen?: boolean;
  caption?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading Nysus"
      className={
        fullscreen
          ? "fixed inset-0 z-[70] flex flex-col items-center justify-center bg-paper px-6"
          : "flex flex-col items-center justify-center gap-4 py-16"
      }
    >
      <div className="relative w-32 sm:w-40 animate-paper-breath">
        <Image
          src="/illustrations/logo-mark.png"
          alt=""
          width={320}
          height={320}
          priority
          sizes="160px"
          className="w-full h-auto"
        />
      </div>
      {caption ? (
        <p className="mt-5 font-hand text-xl text-ink-soft">{caption}</p>
      ) : null}
    </div>
  );
}
