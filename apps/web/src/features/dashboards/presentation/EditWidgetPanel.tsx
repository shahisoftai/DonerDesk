"use client";

import { useState } from "react";
import { TILE_COLORS, type DashboardWidget, type KpiQuery, type MapWidgetQuery, type MetricQuery, type TileColor, type WidgetChange } from "@donordesk/domain/contexts/dashboards/index.js";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { TILE_COLOR_LABEL } from "../domain/tile-theme";
import { AddMapPanel } from "./AddMapPanel";
import { AddProjectListPanel } from "./AddProjectListPanel";
import { AddTilePanel } from "./AddTilePanel";

/** Which widgets can be changed in place, and by what: used by the canvas to show an Edit button only where one makes sense. */
export const canEditInPlace = (w: DashboardWidget): boolean => (w.kind ?? "CHART") !== "REPORT" && !(w.kind === undefined && !w.spec);

/** Changes the settings of one widget already on the dashboard, in the place and at the size it has. Nothing is kept until the dashboard is saved. */
export function EditWidgetPanel({ widget, chartTitle, onApply, onCancel }: { widget: DashboardWidget; chartTitle: string; onApply: (change: WidgetChange) => void; onCancel: () => void }) {
  const kind = widget.kind ?? "CHART";
  if (kind === "METRIC" && widget.metric) return <AddTilePanel projects={{}} onAdd={() => undefined} full={false} edit={{ initial: widget.metric, onApply: (metric: MetricQuery) => onApply({ kind: "METRIC", metric }), onCancel }} />;
  if (kind === "MAP" && widget.map) return <AddMapPanel projects={{}} onAdd={() => undefined} full={false} edit={{ initial: widget.map, onApply: (map: MapWidgetQuery) => onApply({ kind: "MAP", map }), onCancel }} />;
  if (kind === "PROJECT_LIST" && widget.projectList) return <AddProjectListPanel projects={{}} onAdd={() => undefined} full={false} edit={{ initial: widget.projectList, onApply: (projectList) => onApply({ kind: "PROJECT_LIST", projectList }), onCancel }} />;
  if (kind === "KPI" && widget.kpi) return <KpiForm initial={widget.kpi} onApply={(kpi) => onApply({ kind: "KPI", kpi })} onCancel={onCancel} />;
  if (kind === "TEXT") return <TextForm initial={widget.text ?? ""} onApply={(text) => onApply({ kind: "TEXT", text })} onCancel={onCancel} />;
  if (kind === "CHART") return <TitleForm initial={chartTitle} onApply={(title) => onApply({ kind: "CHART", title })} onCancel={onCancel} />;
  return null;
}

const shell = "space-y-3 rounded-lg border border-brand-300 p-3 dark:border-white/20";

function KpiForm({ initial, onApply, onCancel }: { initial: KpiQuery; onApply: (k: KpiQuery) => void; onCancel: () => void }) {
  const [color, setColor] = useState<TileColor | "">(initial.color ?? "");
  const [title, setTitle] = useState(initial.title ?? "");
  return (
    <form aria-label="Change this indicator tile" className={shell} onSubmit={(e) => { e.preventDefault(); const { color: _c, title: _t, ...rest } = initial; onApply({ ...rest, ...(color ? { color } : {}), ...(title.trim() ? { title: title.trim() } : {}) }); }}>
      <h3 className="text-sm font-medium">Change this indicator tile</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Colour"><Select value={color} onChange={(e) => setColor(e.target.value as TileColor | "")}><option value="">Plain card</option>{TILE_COLORS.map((c) => <option key={c} value={c}>{TILE_COLOR_LABEL[c]}</option>)}</Select></Field>
        <Field label="Name (optional)" description="Blank uses the indicator's code and name"><Input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></Field>
      </div>
      <div className="flex gap-2"><Button type="submit">Apply</Button><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}

function TextForm({ initial, onApply, onCancel }: { initial: string; onApply: (t: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  return (
    <form aria-label="Change this note" className={shell} onSubmit={(e) => { e.preventDefault(); if (text.trim()) onApply(text); }}>
      <h3 className="text-sm font-medium">Change this note</h3>
      <Field label="Text" description="Up to 2,000 characters"><Textarea rows={4} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} /></Field>
      <div className="flex gap-2"><Button type="submit" disabled={!text.trim()}>Apply</Button><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}

function TitleForm({ initial, onApply, onCancel }: { initial: string; onApply: (t: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(initial);
  return (
    <form aria-label="Rename this chart" className={shell} onSubmit={(e) => { e.preventDefault(); onApply(title); }}>
      <h3 className="text-sm font-medium">Rename this chart</h3>
      <Field label="Title" description="Its data and drawing stay as they are. To change those, build the chart again in Chart Studio."><Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></Field>
      <div className="flex gap-2"><Button type="submit">Apply</Button><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}
