"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkloadResponse } from "@/lib/server/schemas";
import { setCapacityAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatShortDate } from "@donordesk/domain/contexts/workplan/index.js";
import { parseCapacity } from "@donordesk/domain/contexts/workplan/index.js";

/**
 * Open planned activities each person leads, week by week, against the limit set for them. Counted in activities, not hours.
 * A week over the limit is marked in words as well as colour.
 */
export function WorkloadPanel({ data, names, today, canManage }: { data: WorkloadResponse; names: Record<string, string>; today: string; canManage: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const [draft, setDraft] = useState<Record<string, string>>({});

  async function saveLimit(userId: string) {
    const parsed = parseCapacity(draft[userId]);
    if (!parsed.ok) return;
    const done = await state.run(() => setCapacityAction(userId, parsed.value));
    if (done) { setDraft((d) => { const { [userId]: _, ...rest } = d; return rest; }); router.refresh(); }
  }

  if (data.rows.length === 0) return null;
  return (
    <section aria-labelledby="workload-title" className="space-y-3">
      <h3 id="workload-title" className="text-base font-semibold">Workload by week</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">Open planned activities each person leads, per week, each counted by its effort (1 to 5; a normal activity is 1). A limit is optional; over it is flagged in words.</p>
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th scope="col" className="py-2 pr-3 font-medium">Person</th>
              <th scope="col" className="py-2 pr-3 font-medium">Limit a week</th>
              {data.weeks.map((w) => <th key={w} scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">{formatShortDate(w, today)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/10">
            {data.rows.map((row) => (
              <tr key={row.userId}>
                <th scope="row" className="py-2 pr-3 text-left font-medium">{names[row.userId] ?? "A team member"}</th>
                <td className="py-2 pr-3">
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <label htmlFor={`cap-${row.userId}`} className="sr-only">Limit a week for {names[row.userId] ?? "this person"}</label>
                      <Input id={`cap-${row.userId}`} inputMode="numeric" className="w-20" placeholder={row.capacity === null ? "None" : String(row.capacity)} value={draft[row.userId] ?? ""} onChange={(e) => setDraft({ ...draft, [row.userId]: e.target.value })} />
                      <Button size="sm" variant="secondary" disabled={state.busy || draft[row.userId] === undefined} onClick={() => saveLimit(row.userId)}>Save</Button>
                    </div>
                  ) : (row.capacity === null ? "No limit" : `${row.capacity}`)}
                </td>
                {row.weeks.map((w) => (
                  <td key={w.weekStart} className={`py-2 pr-3 font-mono ${w.over ? "font-semibold text-danger-600" : ""}`}>
                    {w.load}{w.over ? " · over" : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
