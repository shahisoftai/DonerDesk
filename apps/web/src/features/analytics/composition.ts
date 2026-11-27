import { GoogleTagAdapter } from "./adapters/google-tag-adapter.ts";
import type { AnalyticsPort } from "./ports/analytics-port.ts";

let instance: AnalyticsPort | null | undefined;

/**
 * The one place the analytics vendor is chosen. Without a measurement id (local work, a build that was not given one) there is
 * no analytics at all: the cookie question is not asked either, because there is nothing to consent to.
 */
export function analytics(): AnalyticsPort | null {
  if (instance !== undefined) return instance;
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  instance = id && typeof window !== "undefined" ? new GoogleTagAdapter(id, window as never, document as never) : null;
  return instance;
}
