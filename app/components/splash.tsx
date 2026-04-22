import { Logomark } from "./logomark";

/**
 * Splash / loading screen.
 *
 * Renders the animated logomark (muted looping video over the sketch
 * poster). Used by:
 *   - app/loading.tsx: Next's route-level streaming loading state
 *   - any ad-hoc full-screen wait overlay
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
          ? "fixed inset-0 z-[70] flex flex-col items-center justify-center bg-paper px-6 pt-safe pb-safe"
          : "flex flex-col items-center justify-center gap-4 py-16"
      }
    >
      <Logomark size={160} priority animated />
      {caption ? (
        <p className="mt-5 font-hand text-xl text-ink-soft">{caption}</p>
      ) : null}
    </div>
  );
}
