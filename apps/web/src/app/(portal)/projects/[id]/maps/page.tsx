import { MapStudioPanel } from "@/features/visual-studio/presentation/MapStudioPanel";

export const dynamic = "force-dynamic";

/** The Maps (Phase 34.4): the project's results by place as maps and rankings, saved as views, with the places as KML and GeoJSON. The Visual Studio hosts the same panel. */
export default async function MapsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MapStudioPanel projectId={id} studioHref={`/projects/${id}/charts`} />;
}
