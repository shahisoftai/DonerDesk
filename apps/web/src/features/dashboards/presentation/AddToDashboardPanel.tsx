"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DataChartSpec } from "@donordesk/domain/contexts/reporting/data-charts.js";
import { addDashboardChartAction, listDashboardsAction } from "@/lib/actions/dashboards";
import { useActionState } from "@/lib/client/action-state";
import type { DashboardSummary } from "@/lib/server/schemas-dashboards";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";

/** "Add this chart to a dashboard" on the Data Center: only dashboards the person can change are offered. */
export function AddToDashboardPanel({ projectId, spec, disabledReason }: { projectId: string; spec: DataChartSpec; disabledReason?: string }) {
  const [options, setOptions] = useState<DashboardSummary[] | null>(null);
  const [choice, setChoice] = useState("");
  const [done, setDone] = useState<{ id: string; count: number } | null>(null);
  const act = useActionState();
  useEffect(() => {
    void listDashboardsAction(projectId).then((r) => {
      const editable = r.ok ? r.value.filter((d) => d.canEdit && (d.scope !== "PROJECT" || d.projectId === projectId)) : [];
      setOptions(editable);
      setChoice((current) => current || editable[0]?.id || "");
    });
  }, [projectId]);

  async function add() {
    setDone(null);
    const r = await act.run(() => addDashboardChartAction(choice, { projectId, spec }));
    if (r && typeof r === "object") setDone({ id: choice, count: r.chartCount });
  }

  return (
    <section className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
      <h3 className="text-sm font-medium">Add to a dashboard</h3>
      {options === null ? <p className="text-sm text-slate-500">Loading…</p> : options.length === 0 ? (
        <p className="text-sm text-slate-500">You have no dashboard to add to yet. <Link className="underline" href={`/dashboards?project=${projectId}`}>Make one</Link>.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Dashboard"><Select value={choice} onChange={(e) => setChoice(e.target.value)}>{options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Button onClick={() => void add()} pending={act.busy} disabled={act.busy || !choice || Boolean(disabledReason)}>Add the chart</Button>
        </div>
      )}
      {disabledReason && <p className="text-xs text-slate-500">{disabledReason}</p>}
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      {done && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Added. <Link className="underline" href={`/dashboards/${done.id}`}>Open the dashboard</Link> ({done.count} chart{done.count === 1 ? "" : "s"}).</p>}
    </section>
  );
}
