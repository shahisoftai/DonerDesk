import type { DateWindow, SearchReport, TrafficReport } from "@donordesk/domain";

/** The source has no credentials or property yet. The message is plain words for the Superadmin page, never a secret. */
export class StatsSourceNotConfigured extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatsSourceNotConfigured";
  }
}

/** The source was reached and refused or failed. The message is safe to show; the detail stays in the server log. */
export class StatsSourceUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatsSourceUnavailable";
  }
}

/** Visitors and page views on the website (Google Analytics today; any analytics vendor tomorrow). */
export interface ITrafficSource {
  read(current: DateWindow, previous: DateWindow): Promise<TrafficReport>;
}

/** How the website does in search results (Google Search Console today). */
export interface ISearchSource {
  read(current: DateWindow, previous: DateWindow): Promise<SearchReport>;
}

/** Short-lived memory for a read result, so the Superadmin page never hits Google on every view. */
export interface IStatsCache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
}
