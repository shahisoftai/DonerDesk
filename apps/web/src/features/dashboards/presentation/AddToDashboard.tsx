"use client";

import { useEffect, useState } from "react";
import type { AddDashboardWidgetInput } from "@donordesk/contracts";
import { addDashboardChartAction, listDashboardsAction } from "@/lib/actions/dashboards";
import type { DashboardSummary } from "@/lib/server/schemas-dashboards";

/** One thing a screen can put on a dashboard: a chart, a KPI tile, a map. `null` input = not possible yet, with the reason. */
export interface DashboardChoice { key: string; label: string; input: Omit<AddDashboardWidgetInput, "projectId" | "spec"> & { spec?: object } | null; disabledReason?: string }

/**
 * The one "Add to a dashboard" control (Version 4.000, plan F24), used by the Data Center, the Chart Studio and the map:
 * the same list of dashboards the person can change (a project dashboard only from its own project), the same buttons, the
 * same message and link afterwards. `startNew` offers a new dashboard made of this one thing.
 */
export function AddToDashboard({
  projectId,
  choices,
  startNew,
  heading = "Add to a dashboard",
  addedText,
}: {
  projectId: string;
  choices: readonly DashboardChoice[];
  startNew?: { label: string; run: () => Promise<void> };
  heading?: string;
  /** The sentence after a successful add (a screen may keep its own words); the count of widgets follows it. */
  addedText?: string;
}) {
  const [options, setOptions] = useState<DashboardSummary[] | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; id?: string } | null>(null);

  useEffect(() => {
    void listDashboardsAction(projectId).then((r) => {
      const editable = r.ok ? r.value.filter((d) => d.canEdit && (d.scope !== "PROJECT" || d.projectId === projectId)) : [];
      setOptions(editable);
      setChoice((current) => current || editable[0]?.id || "");
    });
  }, [projectId]);

  async function add(c: DashboardChoice) {
    if (!c.input || !choice) return;
    setBusy(c.key);
    setMsg(null);
    const r = await addDashboardChartAction(choice, { projectId, ...c.input });
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: addedText ?? `Added (${r.value.chartCount} on the dashboard).`, id: choice } : { ok: false, text: r.error.message });
  }

  const reasons = [...new Set(choices.filter((c) => !c.input && c.disabledReason).map((c) => c.disabledReason!))];
  return (
    <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-white/10" aria-label={heading}>
      <h3 className="text-sm font-semibold">{heading}</h3>
      {options === null ? <p className="text-sm text-slate-500">Loading your dashboards…</p> : (
        <div className="flex flex-wrap items-center gap-2">
          {options.length > 0 && (
            <>
              <label className="sr-only" htmlFor={`add-dash-${projectId}`}>Choose a dashboard</label>
              <select id={`add-dash-${projectId}`} className="input w-auto max-w-full" value={choice} onChange={(e) => setChoice(e.target.value)}>
                {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {choices.map((c, i) => (
                <button key={c.key} type="button" className={i === 0 ? "btn-primary" : "btn-secondary"} disabled={!c.input || !choice || busy !== null} aria-busy={busy === c.key || undefined} onClick={() => void add(c)}>
                  {c.label}
                </button>
              ))}
            </>
          )}
          {startNew && (
            <button type="button" className={options.length > 0 ? "btn-ghost" : "btn-primary"} disabled={busy !== null} onClick={() => { setBusy("new"); void startNew.run().finally(() => setBusy(null)); }}>
              {startNew.label}
            </button>
          )}
          {options.length === 0 && !startNew && <p className="text-sm text-slate-500">You have no dashboard to add to yet. <a className="link" href="/visuals/new">Make one</a>.</p>}
        </div>
      )}
      {reasons.map((r) => <p key={r} className="text-xs text-slate-500">{r}</p>)}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-danger-600"}`}>
          {msg.text} {msg.ok && msg.id && <a className="link" href={`/visuals/open/dashboard/${msg.id}`}>Open the dashboard</a>}
        </p>
      )}
    </section>
  );
}
