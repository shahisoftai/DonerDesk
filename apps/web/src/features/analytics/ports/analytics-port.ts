import type { AnalyticsParams } from "../domain/events.ts";

/** What the site needs from an analytics service. The screens know this and nothing about any vendor. */
export interface AnalyticsPort {
  /** Begin collecting. Called only after the visitor said yes. Safe to call again. */
  start(): void;
  /** Send nothing while the visitor is on a page where analytics is not allowed; start() resumes. Keeps what is stored. */
  pause(): void;
  /** Stop collecting at once and forget what the vendor stored on this device. */
  stop(): void;
  /** Resolves once the event has left the browser (or after a short wait), so a page can navigate away safely. */
  event(name: string, params?: AnalyticsParams): Promise<void>;
}
