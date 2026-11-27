"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { analytics } from "../composition.ts";
import { allowsAnalytics } from "../domain/consent.ts";
import { OPEN_COOKIE_SETTINGS } from "../domain/consent-events.ts";
import { asksConsentOn, isAnalyticsRoute } from "../domain/analytics-routes.ts";
import { CookieBanner } from "./CookieBanner.tsx";
import { useConsent } from "./use-consent.ts";

/**
 * Joins the consent choice, the allow-list of pages and the analytics service. Analytics starts only on an allowed page
 * after a yes; it is paused the moment the visitor moves to a page that is not on the list (also by in-app navigation) and
 * stopped, with its cookies removed, when the answer is no.
 */
export function ConsentManager() {
  const pathname = usePathname() ?? "/";
  const { choice, ready, choose } = useConsent();
  const [reopened, setReopened] = useState(false);
  const service = analytics();
  const tracked = isAnalyticsRoute(pathname);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, open);
  }, []);

  useEffect(() => {
    if (!service || !ready) return;
    if (!allowsAnalytics(choice)) service.stop();
    else if (tracked) service.start();
    else service.pause();
  }, [service, ready, choice, tracked]);

  const asking = Boolean(service) && ready && asksConsentOn(pathname) && (choice === null || reopened);
  if (!asking) return null;
  const decide = (accept: boolean) => {
    choose(accept ? "all" : "essential");
    setReopened(false);
  };
  return <CookieBanner onAccept={() => decide(true)} onDecline={() => decide(false)} />;
}
