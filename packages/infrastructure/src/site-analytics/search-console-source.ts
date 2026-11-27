import {
  clickRate, metricOf, searchRow, topSearchRows,
  type DailySearch, type DateWindow, type SearchReport, type SearchRow,
} from "@donordesk/domain";
import { StatsSourceNotConfigured, type ISearchSource } from "@donordesk/application";
import type { IGoogleJson } from "./google-ports.js";

const SCOPE = ["https://www.googleapis.com/auth/webmasters.readonly"] as const;
const LIST_LIMIT = 15;

interface SearchRowDto {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  position?: number;
}
interface SearchAnswer {
  rows?: SearchRowDto[];
}

/** A full address shown as its path; the site's own name adds nothing to a table of its own pages. */
function pathOf(address: string): string {
  try {
    const url = new URL(address);
    return url.pathname;
  } catch {
    return address;
  }
}

/** Search impressions, clicks and queries from Google Search Console, read as the service account. */
export class SearchConsoleSource implements ISearchSource {
  constructor(
    private readonly google: IGoogleJson,
    private readonly site: string | undefined,
  ) {}

  async read(current: DateWindow, previous: DateWindow): Promise<SearchReport> {
    if (!this.site) throw new StatsSourceNotConfigured("The Search Console site is not set.");
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.site)}/searchAnalytics/query`;
    const ask = (window: DateWindow, dimensions: string[], rowLimit = 1000) =>
      this.google.post<SearchAnswer>(url, { startDate: window.startDate, endDate: window.endDate, dimensions, rowLimit, dataState: "final" }, SCOPE);
    const [now, before, daily, queries, pages, countries, devices] = await Promise.all([
      ask(current, []), ask(previous, []), ask(current, ["date"]), ask(current, ["query"], LIST_LIMIT),
      ask(current, ["page"], LIST_LIMIT), ask(current, ["country"], 10), ask(current, ["device"], 10),
    ]);
    const total = (a: SearchAnswer) => ({ clicks: a.rows?.[0]?.clicks ?? 0, impressions: a.rows?.[0]?.impressions ?? 0, position: a.rows?.[0]?.position });
    const t = total(now);
    const p = total(before);
    const table = (a: SearchAnswer, label: (key: string) => string = (k) => k): SearchRow[] =>
      topSearchRows((a.rows ?? []).map((r) => searchRow(label(r.keys?.[0] ?? ""), r.clicks ?? 0, r.impressions ?? 0, r.position)), LIST_LIMIT);
    const days: DailySearch[] = (daily.rows ?? []).map((r) => ({ date: r.keys?.[0] ?? "", clicks: r.clicks ?? 0, impressions: r.impressions ?? 0 })).sort((a, b) => a.date.localeCompare(b.date));
    return {
      clicks: metricOf(t.clicks, p.clicks),
      impressions: metricOf(t.impressions, p.impressions),
      ctr: clickRate(t.clicks, t.impressions),
      position: searchRow("", t.clicks, t.impressions, t.position).position,
      daily: days,
      queries: table(queries),
      pages: table(pages, pathOf),
      countries: table(countries, (k) => k.toUpperCase()),
      devices: table(devices, (k) => k.charAt(0) + k.slice(1).toLowerCase()),
    };
  }
}
