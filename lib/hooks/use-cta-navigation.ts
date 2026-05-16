"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Default CTA destination across the product. Every "Begin", "Get
 * Started", and "New Film" button should point here.
 */
const DEFAULT_CTA = "/projects/new";

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
 * dashboard after sign-in; authenticated users go straight to new project.
 */
export function useSmartCTA(isAuthenticated: boolean) {
  const dest = DEFAULT_CTA;
  const href = isAuthenticated ? dest : `/login?next=${encodeURIComponent(dest)}`;
  return { href, label: "New film" };
}
