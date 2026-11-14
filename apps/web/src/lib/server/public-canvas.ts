import { apiBaseUrl } from "@/lib/server/api-gateway";
import { PublicCanvasSchema } from "@/lib/server/schemas-canvas";

/** What a canvas link answers, or null when the link is not usable (malformed, expired, withdrawn, unreachable: one answer for all). Read on the server, never in the browser. */
export async function readPublicCanvas(token: string, filters: { periodId?: string; places?: string; ds?: string } = {}) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  try {
    const query = new URLSearchParams({ ...(filters.periodId ? { periodId: filters.periodId } : {}), ...(filters.places ? { places: filters.places } : {}), ...(filters.ds ? { ds: filters.ds } : {}) }).toString();
    const response = await fetch(`${apiBaseUrl()}/public/canvases/${encodeURIComponent(token)}${query ? `?${query}` : ""}`, { cache: "no-store" });
    if (!response.ok) return null;
    const parsed = PublicCanvasSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
