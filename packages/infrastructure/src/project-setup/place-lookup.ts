/**
 * Recognises a place name from the public web (user rule, 2026-11-04), through an OpenStreetMap Nominatim endpoint named by
 * `PLACE_LOOKUP_URL` (unset = no lookup, nothing leaves the server). Only the name and country are sent, never the project or the
 * document. The answer is offered beside the document's words and never replaces them. One request at a time, at most one a
 * second (Nominatim's usage policy); any failure is "unknown".
 */
import type { RecognisedPlace } from "@donordesk/domain";
import type { ISetupPlaceLookup } from "@donordesk/application";

const TIMEOUT_MS = 5_000;
const GAP_MS = 1_100;

export class NominatimPlaceLookup implements ISetupPlaceLookup {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly known = new Map<string, RecognisedPlace | null>();

  constructor(private readonly baseUrl: string, private readonly fetchImpl: typeof fetch = fetch, private readonly gapMs = GAP_MS) {}

  lookup(name: string, country: string | null): Promise<RecognisedPlace | null> {
    const query = country ? `${name}, ${country}` : name;
    if (this.known.has(query)) return Promise.resolve(this.known.get(query)!);
    const work = this.queue.then(() => this.ask(query, country));
    this.queue = work.then(() => new Promise((r) => setTimeout(r, this.gapMs)), () => undefined);
    return work;
  }

  private async ask(query: string, country: string | null): Promise<RecognisedPlace | null> {
    try {
      const url = `${this.baseUrl.replace(/\/+$/, "")}/search?format=jsonv2&addressdetails=1&limit=1&accept-language=en&q=${encodeURIComponent(query)}`;
      const response = await this.fetchImpl(url, { headers: { "User-Agent": "DonorDesk/3 (project setup place check)" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) return null;
      const [hit] = (await response.json()) as Array<{ name?: string; display_name?: string; address?: { country?: string } }>;
      const parts = (hit?.display_name ?? "").split(",").map((p) => p.trim()).filter(Boolean);
      const found = hit && parts.length > 0 ? hit.address?.country ?? null : null;
      // A name found in another country is not this place.
      const result: RecognisedPlace | null = parts.length > 0 && (!country || !found || found.toLowerCase() === country.toLowerCase())
        ? { name: hit!.name || parts[0]!, within: parts.slice(1).join(", "), country: found, source: "OpenStreetMap" }
        : null;
      this.known.set(query, result);
      return result;
    } catch {
      return null;
    }
  }
}
