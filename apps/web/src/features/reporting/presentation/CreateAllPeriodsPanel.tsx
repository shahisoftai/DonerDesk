"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAllPeriodsAction } from "@/lib/actions/reporting";
import { Button } from "@/components/ui/Button";
import { planSummary, type PlanLike } from "../domain/periods-plan-copy";

/** "Create all periods": the preview is the plan the server will execute, one action creates them. */
export function CreateAllPeriodsPanel({ projectId, plan, note }: { projectId: string; plan: PlanLike; note?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string; failures: string[] } | null>(null);

  async function createAll() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    const r = await createAllPeriodsAction(projectId);
    setBusy(false);
    if (!r.ok) return setResult({ tone: "error", text: r.error.message, failures: [] });
    setResult({
      tone: r.value.failed.length === 0 ? "ok" : "error",
      text: `${r.value.created.length} period${r.value.created.length === 1 ? "" : "s"} created${r.value.failed.length ? `, ${r.value.failed.length} could not be created` : ""}.`,
      failures: r.value.failed.map((f) => `${f.startDate} – ${f.endDate}: ${f.error}`),
    });
    router.refresh();
  }

  if (plan.periods.length === 0 && !result) return note ? <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{note}</p> : null;
  return (
    <section className="card mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Create all periods">
      <div className="text-sm">
        <p className="font-medium">Set up the whole reporting calendar</p>
        <p className="text-slate-600 dark:text-slate-300">{planSummary(plan)}</p>
        {result && (
          <div role={result.tone === "error" ? "alert" : "status"} className={result.tone === "error" ? "mt-1 text-danger-700 dark:text-danger-400" : "mt-1 text-success-700 dark:text-success-400"}>
            <p>{result.text}</p>
            {result.failures.length > 0 && <ul className="list-disc pl-5">{result.failures.map((f) => <li key={f}>{f}</li>)}</ul>}
          </div>
        )}
      </div>
      {plan.periods.length > 0 && <Button onClick={() => void createAll()} pending={busy}>Create all {plan.periods.length} periods</Button>}
    </section>
  );
}
