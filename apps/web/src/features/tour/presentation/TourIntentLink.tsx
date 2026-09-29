"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export const TOUR_INTENT_KEY = "donordesk.academy.tour-intent";

/**
 * Public marketing hero's "Take the product tour" CTA. The real tour needs an
 * authenticated tenant, so this sends a new visitor through signup — but
 * marks the intent in localStorage first so the app auto-starts the tour the
 * first time they land in the portal, rather than dropping the intent at the
 * signup/onboarding redirect chain (which this avoids touching entirely).
 */
export function TourIntentLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        try {
          window.localStorage.setItem(TOUR_INTENT_KEY, "1");
        } catch {
          // Best-effort only; worst case the visitor lands on the dashboard and starts the tour manually.
        }
      }}
    >
      {children}
    </Link>
  );
}
