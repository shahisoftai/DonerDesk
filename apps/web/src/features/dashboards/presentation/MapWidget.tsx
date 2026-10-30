"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { getPlaceResultsAction } from "@/lib/actions/places";
import { getActivityMapAction, listPlacesForMapAction } from "@/lib/actions/map-widgets";
import type { WorkPlanRow } from "@/lib/server/schemas";
import type { PlaceItem, PlaceResults } from "@/lib/server/schemas-places";
import { MapExplorer } from "@/features/maps/presentation/MapExplorer";

const PlanMapView = lazy(() => import("@/features/workplan/presentation/PlanMapView"));

type State<T> = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; value: T };

/**
 * A map card on a dashboard. Nothing is stored in the dashboard but what the card shows; the data is read here, for the person looking, under their
 * own access, so a project they cannot see is refused by the API rather than drawn. "Results by place" is the map page's explorer in a card (hover,
 * click, drill, detail, indicator, time slider); "Where activities are" is the plan's site map.
 */
export function MapWidget({ view, projectId }: { view: "RESULTS" | "ACTIVITIES"; projectId: string }) {
  return view === "RESULTS" ? <ResultsMap projectId={projectId} /> : <ActivityMap projectId={projectId} />;
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
