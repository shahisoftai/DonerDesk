/**
 * The visitor's cookie choice. The cookie name and its two values are the ones the site has always used, so a choice made
 * before analytics existed is still understood ("essential" = no analytics, "all" = analytics allowed).
 */
export const CONSENT_COOKIE = "dd_cookie_consent";
/** A declined visitor is not asked again for half a year (asking every two weeks is pressure, not consent). */
export const CONSENT_DAYS = 180;

export type ConsentChoice = "all" | "essential";

/** The choice in a `document.cookie` string; anything else (no cookie, an unknown value) is "not chosen yet". */
export function parseConsent(cookieHeader: string): ConsentChoice | null {
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  return value === "all" || value === "essential" ? value : null;
}

/** The cookie string that remembers a choice on this device only. */
export function consentCookie(choice: ConsentChoice, secure: boolean): string {
  return `${CONSENT_COOKIE}=${choice}; Max-Age=${CONSENT_DAYS * 24 * 60 * 60}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Only an explicit yes allows analytics. No answer is no. */
export function allowsAnalytics(choice: ConsentChoice | null): boolean {
  return choice === "all";
}
