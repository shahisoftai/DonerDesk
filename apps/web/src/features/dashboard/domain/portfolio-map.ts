/**
 * The map of all projects on Home (Phase 35.H2, after DevResults' Project Map tile: every place assigned to a project, whether or not results are reported there).
 * Pure. A project's sites are the places its planned work happens (the same rule as the plan's Map view); a place is one dot however many projects work there;
 * the dot's colour is the worst delivery label among those projects, and the words say which. A project with no locatable work is listed apart, never placed at a guess.
 */
import { siteMapData, type SiteMapItem, type SiteMapPoint, type SitePointInput } from "../../workplan/domain/site-map.ts";
import type { DeliverySignal } from "@donordesk/domain/contexts/workplan/index.js";

export type ProjectBand = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "NO_PLAN";

/** The pin colour a band uses (the plan map's palette): behind or at risk reads as "late", on track as "on time", no plan as the neutral grey. */
export const BAND_SIGNAL: Readonly<Record<ProjectBand, DeliverySignal>> = { ON_TRACK: "ON_TIME", AT_RISK: "LATE", OFF_TRACK: "LATE", NO_PLAN: "CANCELLED" };
export const BAND_WORDS: Readonly<Record<ProjectBand, string>> = { ON_TRACK: "On track", AT_RISK: "Needs attention", OFF_TRACK: "Behind", NO_PLAN: "No plan yet" };
const WORSE: readonly DeliverySignal[] = ["LATE", "ON_TIME", "DONE", "CANCELLED"];

export interface PortfolioMapProject { projectId: string; title: string; country: string; band: ProjectBand; rows: ReadonlyArray<SitePointInput> }

export interface PortfolioMapData {
  points: SiteMapPoint[];
  /** Projects with no work that could be placed: said, not guessed. */
  notOnMap: Array<{ projectId: string; title: string; reason: string }>;
  placedProjects: number;
}

const coordKey = (p: SiteMapPoint): string => `${p.lat.toFixed(2)}|${p.lng.toFixed(2)}`;

export function portfolioMapData(projects: ReadonlyArray<PortfolioMapProject>): PortfolioMapData {
  const merged = new Map<string, SiteMapPoint>();
  const notOnMap: PortfolioMapData["notOnMap"] = [];
  let placedProjects = 0;
  for (const p of projects) {
    // Cancelled activities do not make a project "work" somewhere.
    const live = p.rows.filter((r) => r.signal !== "CANCELLED");
    const data = siteMapData(live, { country: p.country });
    if (data.points.length === 0) {
      notOnMap.push({ projectId: p.projectId, title: p.title, reason: p.rows.length === 0 ? "No planned work yet" : live.some((r) => r.location?.trim()) ? "Its places match no known place" : "Its planned work has no place" });
      continue;
    }
    placedProjects += 1;
    for (const site of data.points) {
      const item: SiteMapItem = { id: p.projectId, title: p.title, signal: BAND_SIGNAL[p.band], label: BAND_WORDS[p.band] };
      const key = coordKey(site);
      const existing = merged.get(key);
      if (!existing) { merged.set(key, { name: site.name, ...(site.province ? { province: site.province } : {}), ...(site.country ? { country: site.country } : {}), lat: site.lat, lng: site.lng, worst: item.signal, items: [item], risks: [] }); continue; }
      if (!existing.items.some((i) => i.id === p.projectId)) existing.items.push(item);
      existing.worst = WORSE.find((s) => existing.items.some((i) => i.signal === s)) ?? item.signal;
    }
  }
  return { points: [...merged.values()], notOnMap, placedProjects };
}

export function portfolioMapSummary(d: PortfolioMapData, total: number): string {
  if (total === 0) return "No live projects yet.";
  const sites = d.points.length;
  return `${d.placedProjects} of ${total} ${total === 1 ? "project is" : "projects are"} on the map, at ${sites} ${sites === 1 ? "place" : "places"}.${d.notOnMap.length > 0 ? ` ${d.notOnMap.length} ${d.notOnMap.length === 1 ? "is" : "are"} listed below the map.` : ""}`;
}
