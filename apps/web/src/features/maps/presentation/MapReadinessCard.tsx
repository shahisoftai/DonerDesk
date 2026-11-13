"use client";

import Link from "next/link";
import type { MapReadiness } from "@donordesk/domain/contexts/places/map-readiness.js";
import { useMapText } from "./useMapText";

/** Where each reason's one button goes. A table, so a new reason adds a row (the compiler asks for it). */
const ACTION_HREF: Record<MapReadiness["code"], (projectId: string) => string> = {
  NO_PLACES: (id) => `/projects/${id}/places`,
  NO_INDICATOR_BY_PLACE: (id) => `/projects/${id}/indicators`,
  NO_VALUES_YET: (id) => `/projects/${id}/enter`,
  PLACES_TO_CONFIRM: (id) => `/projects/${id}/places`,
};

/** What a map says instead of an empty ground: the first thing missing and one button to put it right (Phase 53.2). */
export function MapReadinessCard({ projectId, readiness }: { projectId: string; readiness: MapReadiness }) {
  const { t } = useMapText();
  return (
    <div className="card space-y-2 text-sm" role="status" data-testid="map-readiness">
      <p>{t(`maps.ready.${readiness.code}` as never)}</p>
      <Link className="btn-primary inline-block" href={ACTION_HREF[readiness.code](projectId)}>{t(`maps.ready.${readiness.code}.action` as never)}</Link>
    </div>
  );
}
