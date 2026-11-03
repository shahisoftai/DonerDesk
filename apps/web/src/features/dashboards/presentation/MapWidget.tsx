"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { getPlaceResultsAction } from "@/lib/actions/places";
import { getActivityMapAction, listPlacesForMapAction } from "@/lib/actions/map-widgets";
import type { WorkPlanRow } from "@/lib/server/schemas";
import type { PlaceItem, PlaceResults } from "@/lib/server/schemas-places";
import { MapExplorer } from "@/features/maps/presentation/MapExplorer";
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
export function MapWidget({ view, projectId, preloaded }: { view: "RESULTS" | "ACTIVITIES"; projectId: string; /** A share link: the data was read on the server and comes with the drawing (there is no session to read it with). */ preloaded?: Record<string, unknown> | undefined }) {
  if (preloaded) return view === "RESULTS" ? <SharedResultsMap projectId={projectId} data={preloaded} /> : <SharedActivityMap projectId={projectId} data={preloaded} />;
  return view === "RESULTS" ? <ResultsMap projectId={projectId} /> : <ActivityMap projectId={projectId} />;
}

const SHARED_NOTE = "A fixed view for this link; the figures are as they stood when the page opened.";

function SharedResultsMap({ projectId, data }: { projectId: string; data: Record<string, unknown> }) {
  const places = PlaceListSchema.safeParse(data["places"]);
  const results = PlaceResultsSchema.safeParse(data["results"]);
  if (!places.success || !results.success) return <p role="alert" className="p-3 text-sm text-slate-600">This map could not be read just now.</p>;
  const fixed = results.data;
  return (
    <div className="h-full overflow-auto p-2">
      <MapExplorer compact staticData projectId={projectId} places={places.data.places} initial={fixed} periods={[]} loadResults={async () => ({ ok: true as const, value: fixed })} />
      <p className="px-1 pt-1 text-xs text-slate-500">{SHARED_NOTE}</p>
    </div>
  );
}

const SharedActivitiesSchema = z.object({ rows: z.array(WorkPlanRowSchema), country: z.string().optional() });

function SharedActivityMap({ projectId, data }: { projectId: string; data: Record<string, unknown> }) {
  const parsed = SharedActivitiesSchema.safeParse(data);
  if (!parsed.success) return <p role="alert" className="p-3 text-sm text-slate-600">This map could not be read just now.</p>;
  return (
    <div className="h-full overflow-auto p-2">
      <Suspense fallback={<p className="p-3 text-sm text-slate-500">Loading the map…</p>}>
        <PlanMapView projectId={projectId} rows={parsed.data.rows} risks={[]} {...(parsed.data.country ? { country: parsed.data.country } : {})} />
      </Suspense>
      <p className="px-1 pt-1 text-xs text-slate-500">{SHARED_NOTE}</p>
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
