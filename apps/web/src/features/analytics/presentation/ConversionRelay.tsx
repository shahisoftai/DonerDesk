"use client";

import { useEffect } from "react";
import { analytics } from "../composition.ts";
import { allowsAnalytics, parseConsent } from "../domain/consent.ts";
import type { Welcome } from "../domain/events.ts";

/**
 * After sign-up: send the sign-up event if the visitor allowed analytics, then continue to the app. A person who did not
 * allow it, or whose browser blocks it, is forwarded at once. Nothing here can hold a person back for long.
 */
export function ConversionRelay({ welcome }: { welcome: Welcome }) {
  useEffect(() => {
    let cancelled = false;
    const go = () => { if (!cancelled) window.location.replace(welcome.next); };
    const service = analytics();
    if (!service || !allowsAnalytics(parseConsent(document.cookie))) { go(); return () => { cancelled = true; }; }
    service.start();
    void service.event(welcome.event, welcome.params).then(go, go);
    return () => { cancelled = true; };
  }, [welcome]);
  return null;
}
