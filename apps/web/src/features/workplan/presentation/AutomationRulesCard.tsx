"use client";

import { useRouter } from "next/navigation";
import type { AutomationRulesResponse } from "@/lib/server/schemas";
import { setAutomationRuleAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";

/**
 * The project's automatic reminders (phase 28.1-K). Each rule is one sentence and one switch. A switched-off rule sends
 * nothing; the choice is audited.
 */
export function AutomationRulesCard({ projectId, data }: { projectId: string; data: AutomationRulesResponse }) {
  const router = useRouter();
  const state = useActionState();

  async function toggle(ruleKey: string, enabled: boolean) {
    const done = await state.run(() => setAutomationRuleAction(projectId, ruleKey, enabled));
    if (done) router.refresh();
  }

  return (
    <section aria-labelledby="automation-title" className="space-y-3">
      <h3 id="automation-title" className="text-base font-semibold">Automatic reminders</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">These are sent once a day, at most once for each thing.</p>
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      <ul className="space-y-2">
        {data.items.map((r) => (
          <li key={r.ruleKey}>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={r.enabled} disabled={state.busy} onChange={(e) => toggle(r.ruleKey, e.target.checked)} />
              <span>{r.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
