import {
  notConfiguredSection, okSection, parseStatsRange, unavailableSection, windowsFor,
  type StatsRange, type StatsSection, type WebsiteStatsReport,
} from "@donordesk/domain";
import type { IClock } from "../../ports/core.js";
import {
  StatsSourceNotConfigured, StatsSourceUnavailable,
  type ISearchSource, type IStatsCache, type ITrafficSource,
} from "../../ports/site-analytics.js";

/** Search Console data runs about two days behind; asking for today would show a falling line that is only missing data. */
export const SEARCH_LAG_DAYS = 2;
const UNREACHABLE = "Google did not answer. Try again in a few minutes.";

interface Read<T> {
  section: StatsSection<T>;
  at: string;
}

/**
 * The website-visitors report for the Superadmin page. Each part is read on its own, so one part failing (a missing key, a
 * Google outage) leaves the other part showing. Only a successful read is remembered, so a failure is tried again.
 */
export class GetWebsiteStatsHandler {
  constructor(
    private readonly traffic: ITrafficSource,
    private readonly search: ISearchSource,
    private readonly cache: IStatsCache,
    private readonly clock: IClock,
  ) {}

  async handle(rawDays: unknown, options: { fresh?: boolean } = {}): Promise<WebsiteStatsReport> {
    const days = parseStatsRange(rawDays);
    const now = this.clock.now();
    const [traffic, search] = await Promise.all([
      this.part(`traffic:${days}`, options.fresh === true, now, () => {
        const w = windowsFor(days, now);
        return this.traffic.read(w.current, w.previous);
      }),
      this.part(`search:${days}`, options.fresh === true, now, () => {
        const w = windowsFor(days, now, SEARCH_LAG_DAYS);
        return this.search.read(w.current, w.previous);
      }),
    ]);
    return { range: days as StatsRange, generatedAt: [traffic.at, search.at].sort()[0]!, traffic: traffic.section, search: search.section };
  }

  private async part<T>(key: string, fresh: boolean, now: Date, load: () => Promise<T>): Promise<Read<T>> {
    if (!fresh) {
      const cached = this.cache.get<Read<T>>(key);
      if (cached) return cached;
    }
    try {
      const read: Read<T> = { section: okSection(await load()), at: now.toISOString() };
      this.cache.set(key, read);
      return read;
    } catch (error) {
      return { section: this.failure<T>(error), at: now.toISOString() };
    }
  }

  private failure<T>(error: unknown): StatsSection<T> {
    if (error instanceof StatsSourceNotConfigured) return notConfiguredSection(error.message);
    if (error instanceof StatsSourceUnavailable) return unavailableSection(error.message);
    return unavailableSection(UNREACHABLE);
  }
}
