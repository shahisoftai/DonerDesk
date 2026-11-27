import { StatsSourceUnavailable } from "@donordesk/application";
import type { IAccessTokenProvider, IGoogleJson } from "./google-ports.js";

/** What a person should be told for each way Google can refuse. Never the body Google sent. */
function refusal(status: number): string {
  if (status === 401 || status === 403) return "Google refused access. Check that the service account has been added to Analytics and Search Console.";
  if (status === 404) return "Google could not find the property or site. Check its id.";
  if (status === 429) return "Google's request limit was reached. Try again in a few minutes.";
  return "Google could not answer right now.";
}

/** POSTs JSON to a Google API with the service account's token. Errors carry plain words only. */
export class GoogleJsonClient implements IGoogleJson {
  constructor(
    private readonly tokens: IAccessTokenProvider,
    private readonly fetcher: typeof fetch,
    private readonly timeoutMs = 20_000,
  ) {}

  async post<T>(url: string, body: unknown, scopes: readonly string[]): Promise<T> {
    const token = await this.tokens.token(scopes);
    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new StatsSourceUnavailable("Google could not be reached.");
    }
    if (!response.ok) throw new StatsSourceUnavailable(refusal(response.status));
    try {
      return (await response.json()) as T;
    } catch {
      throw new StatsSourceUnavailable("Google sent an answer that could not be read.");
    }
  }
}
