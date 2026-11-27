import {
  daysIn, metricOf, plainName, ranked, signUpRate, topPages,
  type DailyTraffic, type DateWindow, type PageRow, type Ranked, type TrafficReport,
} from "@donordesk/domain";
import { StatsSourceNotConfigured, type ITrafficSource } from "@donordesk/application";
import { CURRENT, PREVIOUS, gaDate, gaRows, type GaReport, type GaRow } from "./ga-report-rows.js";
import type { IGoogleJson } from "./google-ports.js";

const SCOPE = ["https://www.googleapis.com/auth/analytics.readonly"] as const;
const LIST_LIMIT = 10;
/** The event names the public site sends (apps/web ANALYTICS_EVENTS). */
const SIGN_UP = "sign_up";
const BEGIN_TRIAL = "begin_trial";

const range = (w: DateWindow) => ({ startDate: w.startDate, endDate: w.endDate });
const dim = (name: string) => ({ name });
const metric = (name: string) => ({ name });

function direct(name: string): string {
  return name === "(direct)" ? "Direct" : plainName(name);
}

/** Visitors and page views from Google Analytics 4 (the Data API), read as the service account. */
export class GoogleAnalyticsTrafficSource implements ITrafficSource {
  constructor(
    private readonly google: IGoogleJson,
    private readonly propertyId: string | undefined,
  ) {}

  async read(current: DateWindow, previous: DateWindow): Promise<TrafficReport> {
    if (!this.propertyId || !/^\d+$/.test(this.propertyId)) throw new StatsSourceNotConfigured("The Google Analytics property id is not set.");
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${this.propertyId}:batchRunReports`;
    const both = [range(current), range(previous)];
    const [first, second] = await Promise.all([
      this.google.post<{ reports?: GaReport[] }>(url, {
        requests: [
          { dateRanges: both, metrics: [metric("activeUsers"), metric("screenPageViews"), metric("sessions")] },
          { dateRanges: [range(current)], dimensions: [dim("date")], metrics: [metric("activeUsers"), metric("screenPageViews")], orderBys: [{ dimension: { dimensionName: "date" } }], limit: 400 },
          { dateRanges: [range(current)], dimensions: [dim("pagePath")], metrics: [metric("screenPageViews"), metric("activeUsers")], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: LIST_LIMIT },
          { dateRanges: [range(current)], dimensions: [dim("sessionSource")], metrics: [metric("activeUsers")], orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }], limit: 50 },
        ],
      }, SCOPE),
      this.google.post<{ reports?: GaReport[] }>(url, {
        requests: [
          { dateRanges: [range(current)], dimensions: [dim("country")], metrics: [metric("activeUsers")], orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }], limit: 50 },
          { dateRanges: [range(current)], dimensions: [dim("deviceCategory")], metrics: [metric("activeUsers")], limit: 10 },
          { dateRanges: both, dimensions: [dim("eventName")], metrics: [metric("eventCount")], dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: [SIGN_UP, BEGIN_TRIAL] } } } },
        ],
      }, SCOPE),
    ]);
    const [totals, daily, pages, sources] = (first.reports ?? []).map((r) => gaRows(r));
    const [countries, devices, events] = (second.reports ?? []).map((r) => gaRows(r));
    const total = (rows: GaRow[] | undefined, which: string, name: string): number | null => {
      const row = (rows ?? []).find((r) => r.dims.dateRange === which);
      return row ? (row.metrics[name] ?? 0) : null;
    };
    const measure = (name: string) => metricOf(total(totals, CURRENT, name) ?? 0, total(totals, PREVIOUS, name));
    const eventMetric = (event: string) => {
      const pick = (which: string) => (events ?? []).find((r) => r.dims.dateRange === which && r.dims.eventName === event)?.metrics.eventCount ?? 0;
      return metricOf(pick(CURRENT), pick(PREVIOUS));
    };
    const visitors = measure("activeUsers");
    const signUps = eventMetric(SIGN_UP);
    return {
      visitors,
      pageViews: measure("screenPageViews"),
      sessions: measure("sessions"),
      signUps,
      trialStarts: eventMetric(BEGIN_TRIAL),
      signUpRate: signUpRate(signUps.value, visitors.value),
      daily: this.fillDays(current, daily ?? []),
      pages: this.pages(pages ?? []),
      sources: this.names(sources ?? [], "sessionSource", direct),
      countries: this.names(countries ?? [], "country", (n) => plainName(n)),
      devices: this.names(devices ?? [], "deviceCategory", (n) => plainName(n)),
    };
  }

  /** A day Google lists no row for had no visitors: a real zero, so the line is continuous. */
  private fillDays(window: DateWindow, rows: GaRow[]): DailyTraffic[] {
    const byDate = new Map(rows.map((r) => [gaDate(r.dims.date ?? ""), r]));
    return daysIn(window).map((date) => ({ date, visitors: byDate.get(date)?.metrics.activeUsers ?? 0, pageViews: byDate.get(date)?.metrics.screenPageViews ?? 0 }));
  }

  private pages(rows: GaRow[]): PageRow[] {
    return topPages(rows.map((r) => ({ path: plainName(r.dims.pagePath, "/"), views: r.metrics.screenPageViews ?? 0, visitors: r.metrics.activeUsers ?? 0 })), LIST_LIMIT);
  }

  private names(rows: GaRow[], dimension: string, label: (raw: string) => string): Ranked[] {
    const merged = new Map<string, number>();
    for (const r of rows) {
      const name = label(r.dims[dimension] ?? "");
      merged.set(name, (merged.get(name) ?? 0) + (r.metrics.activeUsers ?? 0));
    }
    return ranked([...merged].map(([name, visitors]) => ({ name, visitors })), LIST_LIMIT);
  }
}
