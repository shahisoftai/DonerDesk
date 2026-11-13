import Link from "next/link";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { DataSheetResponseSchema, ProjectDetailSchema, PhotoEvidenceResponseSchema, WorkPlanResponseSchema } from "@/lib/server/schemas";
import { PhotosMapPanel } from "@/features/maps/presentation/PhotosMapPanel";
import { SavedChartListSchema } from "@/lib/server/schemas-charts";
import { InlineError } from "@/components/feedback/PageState";
import { LazyChartStudio, LazyMapExplorer } from "./LazyStudios";
import { PlaceListSchema, PlaceResultsSchema } from "@/lib/server/schemas-places";
import { PlaceFlowListSchema } from "@/lib/server/schemas-place-flows";
import { FlowsPanel } from "@/features/maps/presentation/FlowsPanel";
import { MapContextSchema } from "@/lib/server/schemas-map-context";

/** The project's results by place as maps and rankings, saved as views, with the places as KML and GeoJSON. Drawn by the project page and by the Visual Studio. */
export async function MapStudioPanel({ projectId, studioHref }: { projectId: string; studioHref: string }) {
  const id = projectId;
  const ctx = await requireSession();
  const [sheet, saved, placeList, initial, photos, plan, flows, mapContext, project] = await Promise.all([
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/data-sheet`, DataSheetResponseSchema, ctx.token),
    gatewayRequest(`/v1/charts?projectId=${encodeURIComponent(id)}`, SavedChartListSchema, ctx.token),
    gatewayRequest("/v1/places", PlaceListSchema, ctx.token),
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/place-results?level=1`, PlaceResultsSchema, ctx.token),
    gatewayRequest("/v1/evidence/search", PhotoEvidenceResponseSchema, ctx.token, { method: "POST", body: { projectId: id, pageSize: 200, page: 1 } }),
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/work-plan`, WorkPlanResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/place-flows`, PlaceFlowListSchema, ctx.token),
    gatewayRequest("/v1/organization/map-context", MapContextSchema, ctx.token),
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}`, ProjectDetailSchema, ctx.token),
  ]);
  // Planned activities naming each place directly (phase 42.1); the tree rolls them up. Absent when the plan cannot be read.
  const activityCounts: Record<string, number> = {};
  if (plan.ok) for (const item of plan.value.items) for (const place of item.places ?? []) activityCounts[place.id] = (activityCounts[place.id] ?? 0) + 1;
  if (!sheet.ok) return <InlineError title={sheet.error.message} referenceId={sheet.error.referenceId} />;
  return (
    <>
      <p className="mb-3 text-sm"><Link className="underline" href={`/projects/${id}/data`}>Data Center</Link> · <Link className="underline" href={studioHref}>Chart Studio</Link></p>
      <LazyMapExplorer projectId={id} places={placeList.ok ? placeList.value.places : []} initial={initial.ok ? initial.value : null} periods={sheet.value.periods.map((p) => ({ id: p.id, label: p.label }))} activityCounts={activityCounts} mapContext={mapContext.ok ? mapContext.value : null} projectCountry={project.ok ? project.value.country : null} />
      {photos.ok && <div className="mt-8"><PhotosMapPanel projectId={id} photos={photos.value.items} places={placeList.ok ? placeList.value.places.map((p) => ({ name: p.name, aliases: p.aliases, latitude: p.latitude, longitude: p.longitude, archived: p.archived })) : []} /></div>}
      {flows.ok && <FlowsPanel projectId={id} places={(placeList.ok ? placeList.value.places : []).filter((p) => !p.archived).map((p) => ({ id: p.id, path: p.path }))} flows={flows.value.flows} canEdit={flows.value.canEdit} limit={flows.value.limit} />}
      <h2 className="mb-2 mt-8 text-lg font-semibold">Map charts and saved views</h2>
      <LazyChartStudio mode="map"
        projectId={id}
        indicators={sheet.value.indicators.map((i) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, isRate: i.isRate }))}
        periods={sheet.value.periods.map((p) => ({ id: p.id, label: p.label }))}
        initialCharts={saved.ok ? saved.value.charts : []}
        canShare={ctx.capabilities.has("project.edit")}
      />
    </>
  );
}
