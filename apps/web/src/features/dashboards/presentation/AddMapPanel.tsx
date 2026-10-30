"use client";

import { useState } from "react";
import { MAP_VIEWS, MAP_VIEW_LABEL, type MapView, type MapWidgetQuery } from "@donordesk/domain/contexts/dashboards/index.js";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const HINT: Record<MapView, string> = {
  RESULTS: "Shades areas by an indicator's recorded values. The person looking can change the indicator, the period and the level of detail.",
  ACTIVITIES: "Pins the planned activities where they happen, coloured by how delivery stands.",
};

/** While editing: add an interactive map for a project. It stores only what it shows; the figures are read when the dashboard is opened, under the viewer's own access. */
export function AddMapPanel({ projects, onAdd, full, edit }: {
  projects: Record<string, string>;
  onAdd: (projectId: string, map: MapWidgetQuery) => void;
  full: boolean;
  edit?: { initial: MapWidgetQuery; onApply: (map: MapWidgetQuery) => void; onCancel: () => void };
}) {
  const ids = Object.keys(projects);
  const [projectId, setProjectId] = useState(ids[0] ?? "");
  const [view, setView] = useState<MapView>(edit?.initial.view ?? "RESULTS");
  const [title, setTitle] = useState(edit?.initial.title ?? "");
  if (!edit && ids.length === 0) return null;
  return (
    <form aria-label={edit ? "Change this map" : "Add a map"} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-white/10" onSubmit={(e) => { e.preventDefault(); const q: MapWidgetQuery = { view, ...(title.trim() ? { title: title.trim() } : {}) }; if (edit) { edit.onApply(q); return; } onAdd(projectId, q); setTitle(""); }}>
      <h3 className="text-sm font-medium">{edit ? "Change this map" : "Add a map"}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {!edit && <Field label="Project"><Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>{ids.map((id) => <option key={id} value={id}>{projects[id]}</option>)}</Select></Field>}
        <Field label="Map" description={HINT[view]}><Select value={view} onChange={(e) => setView(e.target.value as MapView)}>{MAP_VIEWS.map((v) => <option key={v} value={v}>{MAP_VIEW_LABEL[v]}</option>)}</Select></Field>
        <Field label="Name (optional)"><Input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!edit && (full || !projectId)}>{edit ? "Apply" : "Add the map"}</Button>
        {edit && <Button type="button" variant="secondary" onClick={edit.onCancel}>Cancel</Button>}
        {!edit && full && <span className="text-xs text-slate-500">This dashboard is full.</span>}
      </div>
    </form>
  );
}
