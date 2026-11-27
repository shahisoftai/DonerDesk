"use client";

import { useCallback, useEffect, useState } from "react";
import { consentCookie, parseConsent, type ConsentChoice } from "../domain/consent.ts";

/**
 * The visitor's cookie choice on this device. `ready` is false until the cookie has been read in the browser, so nothing
 * is shown or sent on a guess. Storage failures read as "not chosen".
 */
export function useConsent(): { choice: ConsentChoice | null; ready: boolean; choose: (choice: ConsentChoice) => void } {
  const [choice, setChoice] = useState<ConsentChoice | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setChoice(parseConsent(document.cookie));
    } catch {
      setChoice(null);
    }
    setReady(true);
  }, []);

  const choose = useCallback((next: ConsentChoice) => {
    try {
      document.cookie = consentCookie(next, window.location.protocol === "https:");
    } catch {
      /* the choice still applies for this visit */
    }
    setChoice(next);
  }, []);

  return { choice, ready, choose };
}
