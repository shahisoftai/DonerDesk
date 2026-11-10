import { preload } from "react-dom";
import { admin1FileKey } from "../domain/boundaries/join";

/**
 * Asks the browser for a country's province outlines while the page is still rendering (Phase 49.1), so the first map does not wait for them
 * after the map library loads. Safe in render: React dedupes repeated calls, and a country with no file costs one 404.
 */
export function preloadCountryOutlines(country: string | null | undefined): void {
  const key = country ? admin1FileKey(country) : "";
  if (!key) return;
  preload(`/geo/ADM1/${encodeURIComponent(key)}.json`, { as: "fetch", crossOrigin: "anonymous" });
}
