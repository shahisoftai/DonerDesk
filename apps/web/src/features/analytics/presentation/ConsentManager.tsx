"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { analytics } from "../composition.ts";
import { allowsAnalytics } from "../domain/consent.ts";
import { OPEN_COOKIE_SETTINGS } from "../domain/consent-events.ts";
import { asksConsentOn, countsPageViewOn, isAnalyticsRoute, pagePathOf } from "../domain/analytics-routes.ts";
import { CookieBanner } from "./CookieBanner.tsx";
import { useConsent } from "./use-consent.ts";

/**
 * Joins the consent choice, the allow-list of pages and the analytics service. Analytics starts only on an allowed page
 * after a yes; it stops the moment the answer is no or the visitor leaves the allowed pages; a page view carries the path
 * only, never the query.
 */
export function ConsentManager() {
  const pathname = usePathname() ?? "/";
  const { choice, ready, choose } = useConsent();
  const [reopened, setReopened] = useState(false);
  const service = analytics();
  const tracked = isAnalyticsRoute(pathname);
  const active = ready && tracked && allowsAnalytics(choice);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, open);
  }, []);

  useEffect(() => {
    if (!service) return;
    if (!ready) return;
    if (!allowsAnalytics(choice)) service.stop();
  }, [service, ready, choice]);

  useEffect(() => {
    if (!service || !active) return;
    service.start();
    if (countsPageViewOn(pathname)) service.pageView(pagePathOf(pathname));
  }, [service, active, pathname]);

  const asking = Boolean(service) && ready && asksConsentOn(pathname) && (choice === null || reopened);
  if (!asking) return null;
  const decide = (accept: boolean) => {
    choose(accept ? "all" : "essential");
    setReopened(false);
  };
  return <CookieBanner onAccept={() => decide(true)} onDecline={() => decide(false)} />;
}
