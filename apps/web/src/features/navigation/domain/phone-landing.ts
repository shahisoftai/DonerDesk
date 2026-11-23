/**
 * Where a person lands after signing in (Phase 64). A field officer on a phone lands in the field app (`/field`): it is built for the
 * phone, works with no signal, and opens their day. On a laptop, or when they ask for the online Home (`?stay=1`), they get the Home.
 * Pure: the caller passes the home variant, the browser's user-agent text and the query value.
 */
const PHONE = /Android|iPhone|iPod|Mobile|Windows Phone/i;

export function isPhone(userAgent: string | null | undefined): boolean {
  return !!userAgent && PHONE.test(userAgent);
}

export function landsInFieldApp(input: { homeVariant: string; userAgent: string | null | undefined; stay?: string | undefined; external?: boolean }): boolean {
  if (input.external) return false;
  if (input.homeVariant !== "FIELD") return false;
  if (input.stay === "1") return false;
  return isPhone(input.userAgent);
}
