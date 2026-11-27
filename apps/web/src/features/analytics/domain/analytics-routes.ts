/**
 * Where analytics may run: an allow-list of public marketing and legal pages. A route that is not here (the signed-in app,
 * share, embed, collect, invite, reset-password, field and checkout pages) is never tracked, so a new route is private by default.
 */
export interface AnalyticsRoute {
  path: string;
  /** "exact" matches the path itself; "prefix" matches it and everything under it. */
  match: "exact" | "prefix";
  /** The cookie question is asked here. */
  asksConsent: boolean;
  /** A visit here is counted as a page view. */
  countsPageView: boolean;
}

const page = (path: string, match: AnalyticsRoute["match"] = "exact"): AnalyticsRoute => ({ path, match, asksConsent: true, countsPageView: true });

export const ANALYTICS_ROUTES: readonly AnalyticsRoute[] = [
  page("/"), page("/platform"), page("/features"), page("/solutions", "prefix"), page("/pricing"), page("/compare"), page("/tour"),
  page("/security"), page("/contact-sales"), page("/support", "prefix"), page("/signup"),
  page("/privacy"), page("/terms"), page("/cookies"), page("/subprocessors"), page("/dpa"), page("/refunds"), page("/acceptable-use"),
  /** The relay after sign-up only sends the sign-up event: it asks nothing and is not itself a page view. */
  { path: "/welcome", match: "exact", asksConsent: false, countsPageView: false },
];

/** The path without query or fragment and without a trailing slash, which is the only form of an address that is ever sent. */
export function pagePathOf(location: string): string {
  const path = location.split("#")[0]!.split("?")[0]!;
  return path.length > 1 ? path.replace(/\/+$/, "") || "/" : path || "/";
}

export function routeFor(location: string): AnalyticsRoute | null {
  const path = pagePathOf(location);
  return ANALYTICS_ROUTES.find((r) => (r.match === "exact" ? path === r.path : path === r.path || path.startsWith(`${r.path}/`))) ?? null;
}

export const isAnalyticsRoute = (location: string): boolean => routeFor(location) !== null;
export const asksConsentOn = (location: string): boolean => routeFor(location)?.asksConsent === true;
export const countsPageViewOn = (location: string): boolean => routeFor(location)?.countsPageView === true;
