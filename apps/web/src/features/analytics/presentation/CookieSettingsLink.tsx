"use client";

import { OPEN_COOKIE_SETTINGS } from "../domain/consent-events.ts";

/** A footer button that opens the cookie question again, so the choice can be changed as easily as it was made. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))}>
      Cookie settings
    </button>
  );
}
