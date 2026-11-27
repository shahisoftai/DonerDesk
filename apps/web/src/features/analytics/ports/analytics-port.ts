import type { AnalyticsParams } from "../domain/events.ts";

/** What the site needs from an analytics service. The screens know this and nothing about any vendor. */
export interface AnalyticsPort {
  /** Begin collecting. Called only after the visitor said yes. Safe to call again. */
  start(): void;
  /** Stop collecting at once and forget what the vendor stored on this device. */
  stop(): void;
  pageView(path: string): void;
  /** Resolves once the event has left the browser (or after a short wait), so a page can navigate away safely. */
  event(name: string, params?: AnalyticsParams): Promise<void>;
}
