"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Default CTA destination across the product. Every "Begin", "Get
 * Started", and "New Film" button should point here — the done-for-you
 * Listing Bundle category picker.
 */
const DEFAULT_CTA = "/video?mode=listing";

/**
 * Navigate to the primary CTA destination. Wraps useRouter so callers
 * get a stable callback they can pass to onClick handlers.
 */
export function useCtaNavigation() {
  const router = useRouter();
  const go = useCallback(
    (dest?: string) => {
      router.push(dest ?? DEFAULT_CTA);
    },
    [router],
  );
  return { go, defaultHref: DEFAULT_CTA };
}

/**
 * Returns the correct CTA href based on auth state. Unauthenticated
 * users land on /login with a `next` param that bounces them to the
 * video flow after sign-in; authenticated users go straight there.
 */
export function useSmartCTA(isAuthenticated: boolean) {
  const dest = DEFAULT_CTA;
  const href = isAuthenticated ? dest : `/login?next=${encodeURIComponent(dest)}`;
  return { href, label: "New film" };
}
