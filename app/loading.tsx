import { Splash } from "./components/splash";

/**
 * Root-level loading UI. Next shows this automatically while the
 * server component tree for a navigation is streaming in.
 */
export default function Loading() {
  return <Splash fullscreen={false} caption="loading…" />;
}
