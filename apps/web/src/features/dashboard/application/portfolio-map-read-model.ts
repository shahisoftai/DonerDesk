import "server-only";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { WorkPlanResponseSchema } from "@/lib/server/schemas";
import { portfolioMapData, type PortfolioMapData, type PortfolioMapProject, type ProjectBand } from "../domain/portfolio-map";

/**
 * The plan rows of each live project, in parallel (capped), shaped for the map of all projects. A project whose plan cannot be read is listed as not on the map
 * with that reason: one failed call never breaks Home or hides the others.
 */
export async function loadPortfolioMap(token: string, projects: ReadonlyArray<{ projectId: string; title: string; country: string; band: ProjectBand }>, cap = 25): Promise<{ data: PortfolioMapData; total: number }> {
  const subset = projects.slice(0, cap);
  const loaded = await Promise.all(subset.map(async (p) => {
    const plan = await gatewayRequest(`/v1/projects/${encodeURIComponent(p.projectId)}/work-plan`, WorkPlanResponseSchema, token);
    return { p, plan };
  }));
  const ready: PortfolioMapProject[] = [];
  const failed: PortfolioMapData["notOnMap"] = [];
  for (const { p, plan } of loaded) {
    if (!plan.ok) { failed.push({ projectId: p.projectId, title: p.title, reason: "Its plan could not be read just now" }); continue; }
    ready.push({ ...p, rows: plan.value.items.map((r) => ({ id: r.id, title: r.title, location: r.location, latitude: r.latitude, longitude: r.longitude, places: r.places, signal: r.signal })) });
  }
  const data = portfolioMapData(ready);
  const beyondCap = projects.slice(cap).map((p) => ({ projectId: p.projectId, title: p.title, reason: "Not read (only the first projects are drawn on Home)" }));
  return { data: { ...data, notOnMap: [...data.notOnMap, ...failed, ...beyondCap] }, total: projects.length };
}
