"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AutomationRulesResponse } from "@/lib/server/schemas";
import { setAutomationRuleAction } from "@/lib/actions/workplan";
import { setAutomationRuleSettingsAction } from "@/lib/actions/automation";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Rule = AutomationRulesResponse["items"][number];

/** The numbers a rule offers, each typed as text until saved. Built from what the server declares for the rule. */
function RuleNumbers({ projectId, rule, busy, onSaved }: { projectId: string; rule: Rule; busy: boolean; onSaved: () => void }) {
  const state = useActionState();
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(rule.settings.map((s) => [s.name, String(s.value)])));
  const values = Object.fromEntries(rule.settings.map((s) => [s.name, /^\d+$/.test((draft[s.name] ?? "").trim()) ? Number(draft[s.name]) : NaN]));
  const changed = rule.settings.some((s) => values[s.name] !== s.value);
  const invalid = rule.settings.some((s) => !Number.isInteger(values[s.name]));

  async function save() {
    const done = await state.run(() => setAutomationRuleSettingsAction(projectId, rule.ruleKey, values as Record<string, number>));
    if (done) onSaved();
  }

  if (rule.settings.length === 0) return null;
  return (
    <div className="ml-7 mt-2 flex flex-wrap items-end gap-2">
      {rule.settings.map((s) => (
        <div key={s.name} className="space-y-1">
          <label htmlFor={`rule-${rule.ruleKey}-${s.name}`} className="block text-xs">{s.label} ({s.min} to {s.max})</label>
          <Input id={`rule-${rule.ruleKey}-${s.name}`} inputMode="numeric" className="w-24" value={draft[s.name] ?? ""} onChange={(e) => setDraft({ ...draft, [s.name]: e.target.value })} />
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={save} pending={state.busy} disabled={busy || invalid || !changed}>Save</Button>
      {state.error && <p role="alert" className="w-full text-sm text-danger-600">{state.error}</p>}
    </div>
  );
}

/**
 * The project's automatic reminders (phase 28.1-K). Each rule is one sentence and one switch, with the numbers it offers beneath it.
 * A switched-off rule sends nothing; every change is audited.
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
      <ul className="space-y-3">
        {data.items.map((r) => (
          <li key={r.ruleKey}>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={r.enabled} disabled={state.busy} onChange={(e) => toggle(r.ruleKey, e.target.checked)} />
              <span>{r.label}</span>
            </label>
            <RuleNumbers key={`${r.ruleKey}-${r.settings.map((s) => s.value).join(",")}`} projectId={projectId} rule={r} busy={state.busy} onSaved={() => router.refresh()} />
          </li>
        ))}
      </ul>
    </section>
  );
}
