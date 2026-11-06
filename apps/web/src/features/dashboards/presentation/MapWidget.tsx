"use client";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { getPlaceResultsAction } from "@/lib/actions/places";
import { getActivityMapAction, listPlacesForMapAction } from "@/lib/actions/map-widgets";
import type { WorkPlanRow } from "@/lib/server/schemas";
import type { PlaceItem, PlaceResults } from "@/lib/server/schemas-places";
import { MapExplorer, type PlaceResultsLoader } from "@/features/maps/presentation/MapExplorer";
import { useShareLink } from "./ShareLinkContext";
import { useMapText } from "@/features/maps/presentation/useMapText";
import { PlaceListSchema, PlaceResultsSchema } from "@/lib/server/schemas-places";
import { WorkPlanRowSchema } from "@/lib/server/schemas";
import { z } from "zod";

const PlanMapView = lazy(() => import("@/features/workplan/presentation/PlanMapView"));

type State<T> = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; value: T };

/**
 * A map card on a dashboard. Nothing is stored in the dashboard but what the card shows; the data is read here, for the person looking, under their
 * own access, so a project they cannot see is refused by the API rather than drawn. "Results by place" is the map page's explorer in a card (hover,
 * click, drill, detail, indicator, time slider); "Where activities are" is the plan's site map.
 */
export function MapWidget({ view, projectId, widgetId, preloaded }: { view: "RESULTS" | "ACTIVITIES"; projectId: string; widgetId: string; /** A share link: the data was read on the server and comes with the drawing (there is no session to read it with). */ preloaded?: Record<string, unknown> | undefined }) {
  if (preloaded) return view === "RESULTS" ? <SharedResultsMap projectId={projectId} widgetId={widgetId} data={preloaded} /> : <SharedActivityMap projectId={projectId} data={preloaded} />;
  return view === "RESULTS" ? <ResultsMap projectId={projectId} /> : <ActivityMap projectId={projectId} />;
}


/** Reads another level or period of this widget's own map through the link (the server decides what the link may read). */
function sharedLoader(token: string, widgetId: string, failed: string): PlaceResultsLoader {
  return async (_projectId, level, periodId) => {
    try {
      const query = new URLSearchParams({ widget: widgetId, level: String(level), ...(periodId ? { periodId } : {}) });
      const response = await fetch(`/api/shared/dashboard/${encodeURIComponent(token)}/map-results?${query}`, { headers: { accept: "application/json" } });
      if (!response.ok) return { ok: false as const, error: { kind: "unavailable" as const, message: failed, retryable: response.status >= 500 } };
      const parsed = PlaceResultsSchema.safeParse(await response.json());
      return parsed.success ? { ok: true as const, value: parsed.data } : { ok: false as const, error: { kind: "unexpected" as const, message: failed } };
    } catch {
      return { ok: false as const, error: { kind: "unavailable" as const, message: failed, retryable: true } };
    }
  };
}

function SharedResultsMap({ projectId, widgetId, data }: { projectId: string; widgetId: string; data: Record<string, unknown> }) {
  const link = useShareLink();
  const { t } = useMapText();
  const parsed = useMemo(() => ({ places: PlaceListSchema.safeParse(data["places"]), results: PlaceResultsSchema.safeParse(data["results"]) }), [data]);
  const loader = useMemo<PlaceResultsLoader>(() => {
    if (link) return sharedLoader(link.token, widgetId, t("maps.shared.failed"));
    const fixed = parsed.results.success ? parsed.results.data : null;
    return async () => (fixed ? { ok: true as const, value: fixed } : { ok: false as const, error: { kind: "unexpected" as const, message: t("maps.shared.failed") } });
  }, [link, widgetId, parsed, t]);
  if (!parsed.places.success || !parsed.results.success) return <p role="alert" className="p-3 text-sm text-slate-600">{t("maps.shared.failed")}</p>;
  const fixed = parsed.results.data;
  // With the link's token the map opens districts and moves through periods like a signed-in one; without it, it stays the fixed view it was sent as.
  return (
    <div className="h-full overflow-auto p-2">
      <MapExplorer compact staticData={!link} projectId={projectId} places={parsed.places.data.places} initial={fixed} periods={link ? fixed.periods : []} loadResults={loader} />
      <p className="px-1 pt-1 text-xs text-slate-500">{link ? t("maps.shared.live") : t("maps.shared.fixed")}</p>
    </div>
  );
}

const SharedActivitiesSchema = z.object({ rows: z.array(WorkPlanRowSchema), country: z.string().optional() });

function SharedActivityMap({ projectId, data }: { projectId: string; data: Record<string, unknown> }) {
  const { t } = useMapText();
  const parsed = SharedActivitiesSchema.safeParse(data);
  if (!parsed.success) return <p role="alert" className="p-3 text-sm text-slate-600">{t("maps.shared.failed")}</p>;
  return (
    <div className="h-full overflow-auto p-2">
      <Suspense fallback={<p className="p-3 text-sm text-slate-500">Loading the map…</p>}>
        <PlanMapView projectId={projectId} rows={parsed.data.rows} risks={[]} {...(parsed.data.country ? { country: parsed.data.country } : {})} />
      </Suspense>
      <p className="px-1 pt-1 text-xs text-slate-500">{t("maps.shared.fixed")}</p>
    </div>
  );
}

function ResultsMap({ projectId }: { projectId: string }) {
  const [state, setState] = useState<State<{ places: PlaceItem[]; results: PlaceResults }>>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    void Promise.all([listPlacesForMapAction(), getPlaceResultsAction(projectId, 1)]).then(([places, results]) => {
      if (!live) return;
      if (!places.ok) return setState({ kind: "error", message: places.error.message });
      if (!results.ok) return setState({ kind: "error", message: results.error.message });
      setState({ kind: "ready", value: { places: places.value, results: results.value } });
    });
    return () => { live = false; };
  }, [projectId]);
  if (state.kind === "loading") return <p className="p-3 text-sm text-slate-500">Loading the map…</p>;
  if (state.kind === "error") return <p role="alert" className="p-3 text-sm text-slate-600">{state.message}</p>;
  return (
    <div className="h-full overflow-auto p-2">
      <MapExplorer compact projectId={projectId} places={state.value.places} initial={state.value.results} periods={state.value.results.periods} />
    </div>
  );
}

function ActivityMap({ projectId }: { projectId: string }) {
  const [state, setState] = useState<State<{ rows: WorkPlanRow[]; country?: string }>>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    void getActivityMapAction(projectId).then((r) => { if (live) setState(r.ok ? { kind: "ready", value: r.value } : { kind: "error", message: r.error.message }); });
    return () => { live = false; };
  }, [projectId]);
  if (state.kind === "loading") return <p className="p-3 text-sm text-slate-500">Loading the map…</p>;
  if (state.kind === "error") return <p role="alert" className="p-3 text-sm text-slate-600">{state.message}</p>;
  return (
    <div className="h-full overflow-auto p-2">
      <Suspense fallback={<p className="p-3 text-sm text-slate-500">Loading the map…</p>}>
        <PlanMapView projectId={projectId} rows={state.value.rows} risks={[]} {...(state.value.country ? { country: state.value.country } : {})} />
      </Suspense>
    </div>
  );
}
