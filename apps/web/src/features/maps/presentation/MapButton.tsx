import Link from "next/link";

/** The "Map" button on an indicator row (Phase 53.3): opens the project's map on that indicator. A plain link, so it works from a server page. */
export function MapButton({ projectId, indicatorId, label = "Map" }: { projectId: string; indicatorId: string; label?: string }) {
  return <Link className="text-sm font-medium underline" href={`/visuals/maps/${encodeURIComponent(projectId)}?indicator=${encodeURIComponent(indicatorId)}`}>{label}</Link>;
}
