import { readFile } from "node:fs/promises";
import { GetWebsiteStatsHandler, StatsSourceNotConfigured, SystemClock } from "@donordesk/application";
import { GoogleAnalyticsTrafficSource } from "./ga-traffic-source.js";
import { GoogleJsonClient } from "./google-json-client.js";
import { GoogleTokenProvider } from "./google-token-provider.js";
import { SearchConsoleSource } from "./search-console-source.js";
import { parseServiceAccountKey, type ServiceAccountKey } from "./service-account.js";
import { TtlCache } from "./ttl-cache.js";

const ONE_HOUR_MS = 3_600_000;

/** The process environment; this module reads only GOOGLE_STATS_SERVICE_ACCOUNT_FILE, GA4_PROPERTY_ID and SEARCH_CONSOLE_SITE. */
export type SiteAnalyticsEnv = Readonly<Record<string, string | undefined>>;

/**
 * The one place the website-visitors report is assembled: it reads the three settings, builds the Google readers and hands
 * back the use case. With a setting missing the report says which part is not set up instead of failing.
 */
export function createWebsiteStatsHandler(
  env: SiteAnalyticsEnv,
  io: { fetcher?: typeof fetch; read?: (path: string) => Promise<string> } = {},
): GetWebsiteStatsHandler {
  const fetcher = io.fetcher ?? fetch;
  const read = io.read ?? ((path: string) => readFile(path, "utf8"));
  const keyFile = env.GOOGLE_STATS_SERVICE_ACCOUNT_FILE;
  let key: Promise<ServiceAccountKey> | undefined;
  const loadKey = (): Promise<ServiceAccountKey> => {
    if (!keyFile) return Promise.reject(new StatsSourceNotConfigured("The Google service account key is not set up on the server."));
    key ??= read(keyFile).then(parseServiceAccountKey, () => {
      throw new StatsSourceNotConfigured("The Google service account key file could not be read.");
    });
    key.catch(() => { key = undefined; });
    return key;
  };
  const google = new GoogleJsonClient(new GoogleTokenProvider(loadKey, fetcher), fetcher);
  return new GetWebsiteStatsHandler(
    new GoogleAnalyticsTrafficSource(google, env.GA4_PROPERTY_ID),
    new SearchConsoleSource(google, env.SEARCH_CONSOLE_SITE),
    new TtlCache(ONE_HOUR_MS),
    new SystemClock(),
  );
}
