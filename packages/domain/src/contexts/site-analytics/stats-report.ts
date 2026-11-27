import type { StatsRange } from "./stats-range.js";

/** One part of the report. A part that cannot be read says why; it never breaks the others. */
export type StatsSectionStatus = "OK" | "NOT_CONFIGURED" | "UNAVAILABLE";

export interface StatsSection<T> {
  status: StatsSectionStatus;
  data: T | null;
  note: string | null;
}

export const okSection = <T>(data: T): StatsSection<T> => ({ status: "OK", data, note: null });
export const notConfiguredSection = <T>(note: string): StatsSection<T> => ({ status: "NOT_CONFIGURED", data: null, note });
export const unavailableSection = <T>(note: string): StatsSection<T> => ({ status: "UNAVAILABLE", data: null, note });

/** A figure for the range, the one before it, and the change between them (null when it cannot be stated). */
export interface Metric {
  value: number;
  previous: number | null;
  /** Fractional change, 0.1 = +10 %. Null without a previous figure above zero. */
  change: number | null;
}

export interface DailyTraffic {
  date: string;
  visitors: number;
  pageViews: number;
}

export interface Ranked {
  name: string;
  visitors: number;
  /** Share of the listed visitors, null when the total is zero. */
  share: number | null;
}

export interface PageRow {
  path: string;
  views: number;
  visitors: number;
}

export interface TrafficReport {
  visitors: Metric;
  pageViews: Metric;
  sessions: Metric;
  signUps: Metric;
  trialStarts: Metric;
  /** Sign-ups divided by visitors; null with no visitors. */
  signUpRate: number | null;
  daily: DailyTraffic[];
  pages: PageRow[];
  sources: Ranked[];
  countries: Ranked[];
  devices: Ranked[];
}

export interface SearchRow {
  name: string;
  clicks: number;
  impressions: number;
  /** Clicks over impressions; null with no impressions, never 0. */
  ctr: number | null;
  /** Average position (1 is the top); null when Google gives none. */
  position: number | null;
}

export interface DailySearch {
  date: string;
  clicks: number;
  impressions: number;
}

export interface SearchReport {
  clicks: Metric;
  impressions: Metric;
  ctr: number | null;
  position: number | null;
  daily: DailySearch[];
  queries: SearchRow[];
  pages: SearchRow[];
  countries: SearchRow[];
  devices: SearchRow[];
}

export interface WebsiteStatsReport {
  range: StatsRange;
  generatedAt: string;
  traffic: StatsSection<TrafficReport>;
  search: StatsSection<SearchReport>;
}
