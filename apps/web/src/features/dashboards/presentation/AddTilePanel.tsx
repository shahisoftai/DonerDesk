"use client";

import { useState } from "react";
import { METRICS, METRIC_KEYS, TILE_COLORS, type MetricKey, type MetricQuery, type TileColor } from "@donordesk/domain/contexts/dashboards/index.js";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TILE_BACKGROUND, TILE_COLOR_LABEL } from "../domain/tile-theme";

const GROUP_LABEL = { FINANCE: "Money", ACTIVITIES: "Activities" } as const;

/** While editing: add a coloured number tile for a project (a money figure or a count of planned activities). It joins the dashboard like any chart and is kept when saved. */
export function AddTilePanel({ projects, onAdd, full, edit }: {
  projects: Record<string, string>;
  onAdd: (projectId: string, metric: MetricQuery) => void;
  full: boolean;
  /** Changing a tile already on the dashboard: its project stays, the form starts from its settings. */
  edit?: { initial: MetricQuery; onApply: (metric: MetricQuery) => void; onCancel: () => void };
}) {
  const ids = Object.keys(projects);
  const [projectId, setProjectId] = useState(ids[0] ?? "");
  const [metric, setMetric] = useState<MetricKey>(edit?.initial.metric ?? "FIN_OBLIGATED");
  const [color, setColor] = useState<TileColor>(edit?.initial.color ?? METRICS[edit?.initial.metric ?? "FIN_OBLIGATED"].defaultColor);
  const [title, setTitle] = useState(edit?.initial.title ?? "");
  const [currency, setCurrency] = useState(edit?.initial.currency ?? "");
  const money = METRICS[metric].group === "FINANCE";
  if (!edit && ids.length === 0) return null;
  return (
    <form aria-label={edit ? "Change this number tile" : "Add a number tile"} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-white/10" onSubmit={(e) => {
      e.preventDefault();
      const query: MetricQuery = { metric, color, ...(title.trim() ? { title: title.trim() } : {}), ...(money && currency.trim() ? { currency: currency.trim().toUpperCase() } : {}) };
      if (edit) { edit.onApply(query); return; }
      onAdd(projectId, query);
      setTitle("");
    }}>
      <h3 className="text-sm font-medium">{edit ? "Change this number tile" : "Add a number tile"}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {!edit && <Field label="Project"><Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>{ids.map((id) => <option key={id} value={id}>{projects[id]}</option>)}</Select></Field>}
        <Field label="Figure">
          <Select value={metric} onChange={(e) => { const m = e.target.value as MetricKey; setMetric(m); setColor(METRICS[m].defaultColor); }}>
            {(["FINANCE", "ACTIVITIES"] as const).map((g) => <optgroup key={g} label={GROUP_LABEL[g]}>{METRIC_KEYS.filter((k) => METRICS[k].group === g).map((k) => <option key={k} value={k}>{METRICS[k].label}</option>)}</optgroup>)}
          </Select>
        </Field>
        <Field label="Colour">
          <Select value={color} onChange={(e) => setColor(e.target.value as TileColor)}>{TILE_COLORS.map((c) => <option key={c} value={c}>{TILE_COLOR_LABEL[c]}</option>)}</Select>
        </Field>
        <Field label="Name (optional)"><Input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></Field>
        {money && <Field label="Currency (optional)" description="Blank reads the reporting currency"><Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></Field>}
      </div>
      <div className="flex items-center gap-3">
        <span aria-hidden className="inline-block h-5 w-8 rounded" style={{ backgroundColor: TILE_BACKGROUND[color] }} />
        <Button type="submit" disabled={!edit && (full || !projectId)}>{edit ? "Apply" : "Add the tile"}</Button>
        {edit && <Button type="button" variant="secondary" onClick={edit.onCancel}>Cancel</Button>}
        {!edit && full && <span className="text-xs text-slate-500">This dashboard is full.</span>}
      </div>
    </form>
  );
}
