"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDataAlertAction, removeDataAlertAction } from "@/lib/actions/visual-data";
import type { DataAlertView } from "@/lib/server/schemas-visual-data";

const RULES = [
  { kind: "BELOW", label: "falls below", needsValue: true },
  { kind: "ABOVE", label: "goes above", needsValue: true },
  { kind: "BELOW_PERCENT_OF_TARGET", label: "is under this % of its target", needsValue: true },
  { kind: "WORSE_THAN_PREVIOUS", label: "is worse than the period before", needsValue: false },
  { kind: "NO_VALUE", label: "has no figure for the latest ended period", needsValue: false },
] as const;
const STATE_WORD = { OK: "Fine", FIRING: "Needs attention", NO_DATA: "Not judged" } as const;

export interface AlertIndicator { id: string; code: string; name: string }

/** Add, see and remove the caller's own alerts on one project's indicators. The run that tells them happens on the server every hour. */
export function AlertsPanel({ projectId, indicators, alerts, projectNames }: { projectId?: string | undefined; indicators: AlertIndicator[]; alerts: DataAlertView[]; projectNames: Record<string, string> }) {
  const router = useRouter();
  const [indicatorId, setIndicatorId] = useState(indicators[0]?.id ?? "");
  const [kind, setKind] = useState<(typeof RULES)[number]["kind"]>("BELOW");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const rule = RULES.find((r) => r.kind === kind)!;

  async function add() {
    setMessage(null);
    const r = await addDataAlertAction({ projectId, indicatorId, kind, ...(rule.needsValue ? { value: Number(value) } : {}) });
    if (!r.ok) { setMessage(r.error.message); return; }
    setValue(""); setMessage("Alert added. You will be told once when it needs attention."); router.refresh();
  }

  return (
    <div className="space-y-4">
      {projectId && indicators.length > 0 && (
        <form className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <label className="flex flex-col gap-1">Tell me when
            <select value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)} className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900">
              {indicators.map((i) => <option key={i.id} value={i.id}>{i.code} {i.name}</option>)}
            </select></label>
          <label className="flex flex-col gap-1">the figure
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900">
              {RULES.map((r) => <option key={r.kind} value={r.kind}>{r.label}</option>)}
            </select></label>
          {rule.needsValue && <label className="flex flex-col gap-1">Number
            <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="w-28 rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900" /></label>}
          <button type="submit" className="rounded bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-800">Add alert</button>
        </form>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
      {alerts.length === 0 ? <p className="text-sm text-slate-500">You have no alerts. Choose a project above, then add one.</p> : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700" data-testid="alert-list">
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>{projectNames[a.projectId] ?? "A project"} · {RULES.find((r) => r.kind === a.kind)?.label}{a.value !== null ? ` ${a.value}` : ""}</span>
              <span className="flex items-center gap-3"><span className={a.state === "FIRING" ? "font-medium text-red-700" : "text-slate-500"}>{STATE_WORD[a.state]}</span>
                <button type="button" className="underline" onClick={async () => { const r = await removeDataAlertAction(a.id); if (r.ok) router.refresh(); }}>Remove</button></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
