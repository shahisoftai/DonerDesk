"use client";

import { useState } from "react";
import { CHART_KINDS, kindsByFamily, validateChartSpec, type ChartKind, type ChartSpecV2 } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { reshapeForKind } from "@donordesk/domain/contexts/reporting/chart-reshape.js";

const FAMILY_LABEL: Record<string, string> = {
  COMPARISON: "Compare", TREND: "Over time", PART_TO_WHOLE: "Parts of a whole", DISTRIBUTION: "Spread", RELATIONSHIP: "Relationships", MATRIX: "Grids", FLOW: "Flows",
  PROGRESS: "Progress to target", SCHEDULE: "Schedule", GEOGRAPHIC: "Maps", COMBINATION: "Combined", TABLE: "Tables",
};
const INPUT = "w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900";

interface Props { label: string; spec: ChartSpecV2 | undefined; indicatorIds: readonly string[]; onChange: (spec: ChartSpecV2) => void }

/**
 * Every chart kind the product can draw is offered (Phase 61.2). Choosing one the current data cannot show does not hide it: the chart is
 * reshaped to data that can ("Pie needs each indicator's latest value, so the chart now shows that"), the person is told, and a kind that
 * cannot honestly be drawn from the project's records says why. The honesty rules still run on the result.
 */
export function ChartKindField({ label, spec, indicatorIds, onChange }: Props) {
  const [note, setNote] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  if (!spec) return null;
  const groups = kindsByFamily();
  function choose(kind: ChartKind): void {
    const r = reshapeForKind(spec!, kind, indicatorIds);
    if (!r.ok) { setNote({ tone: "error", text: r.reason }); return; }
    const problems = validateChartSpec(r.spec);
    onChange(r.spec);
    setNote(problems[0] ? { tone: "error", text: problems[0].message } : r.note ? { tone: "info", text: r.note } : null);
  }
  return (
    <div className="space-y-1" data-testid="chart-kind-field">
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor="chart-kind">{label}</label>
      <select id="chart-kind" className={INPUT} value={spec.kind} onChange={(e) => choose(e.target.value as ChartKind)}>
        {groups.map((g) => {
          const built = g.kinds.filter((k) => CHART_KINDS[k].status === "BUILT");
          return built.length === 0 ? null : <optgroup key={g.family} label={FAMILY_LABEL[g.family] ?? g.family}>{built.map((k) => <option key={k} value={k}>{CHART_KINDS[k].label}</option>)}</optgroup>;
        })}
      </select>
      {note && <p role={note.tone === "error" ? "alert" : "status"} className={`text-xs ${note.tone === "error" ? "text-red-700" : "text-slate-600 dark:text-slate-300"}`} data-testid="chart-kind-note">{note.text}</p>}
    </div>
  );
}
