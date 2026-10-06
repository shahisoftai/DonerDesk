"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { attachEvidenceAction, detachEvidenceAction } from "@/lib/actions/activities";
import { setEvidencePeriodAction } from "@/lib/actions/evidence";

type Option = { id: string; label: string };

/**
 * What this file proves: the activity it belongs to, and the indicator value (indicator + reporting period) it supports.
 * Every change goes through the one evidence linker on the server, so a file page, an upload form and a suggestion all
 * leave the same links.
 */
export function EvidenceLinkPanel({
  evidenceId,
  current,
  activities,
  indicators,
  periods,
  canEdit,
}: {
  evidenceId: string;
  current: { activityId?: string; indicatorId?: string; reportingPeriodId?: string };
  activities: Option[];
  indicators: Option[];
  periods: Option[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [activityId, setActivityId] = useState("");
  const [indicatorId, setIndicatorId] = useState("");
  const [periodId, setPeriodId] = useState(current.reportingPeriodId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = (options: Option[], id: string | undefined) => options.find((o) => o.id === id)?.label;

  async function run(work: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setBusy(true);
    setError(null);
    const result = await work();
    setBusy(false);
    if (!result.ok) return setError(result.error?.message ?? "That did not work.");
    router.refresh();
  }

  async function attachIndicator() {
    await run(async () => {
      // An indicator value belongs to a reporting period: set the file's period first when it has none or a new one was chosen.
      if (periodId && periodId !== current.reportingPeriodId) {
        const set = await setEvidencePeriodAction(evidenceId, periodId);
        if (!set.ok) return set;
      }
      return attachEvidenceAction({ evidenceId, indicatorId });
    });
  }

  const activityLabel = label(activities, current.activityId);
  const indicatorLabel = label(indicators, current.indicatorId);

  return (
    <section className="card space-y-4" aria-labelledby="supports-heading">
      <div>
        <h2 id="supports-heading" className="text-sm font-medium text-slate-700 dark:text-slate-200">Supports</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Linking a file makes reports use it as proof for that activity or indicator value.</p>
      </div>
      <ul className="space-y-1 text-sm">
        <li className="flex items-center justify-between gap-2">
          <span>Activity: {activityLabel ?? (current.activityId ? "Linked" : "None")}</span>
          {canEdit && current.activityId && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => detachEvidenceAction({ evidenceId, activityId: current.activityId }))}>Remove</Button>}
        </li>
        <li className="flex items-center justify-between gap-2">
          <span>
            Indicator: {indicatorLabel ?? (current.indicatorId ? "Linked" : "None")}
            {current.reportingPeriodId ? ` · ${label(periods, current.reportingPeriodId) ?? "reporting period set"}` : ""}
          </span>
          {canEdit && current.indicatorId && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => detachEvidenceAction({ evidenceId, indicatorId: current.indicatorId }))}>Remove</Button>}
        </li>
      </ul>
      {canEdit && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Field label="Link to an activity" htmlFor="link-activity">
              <Select id="link-activity" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
                <option value="">Choose an activity…</option>
                {activities.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </Select>
            </Field>
            <Button size="sm" variant="secondary" disabled={!activityId || busy} pending={busy} onClick={() => void run(() => attachEvidenceAction({ evidenceId, activityId }))}>Link activity</Button>
          </div>
          <div className="space-y-2">
            <Field label="Link to an indicator value" htmlFor="link-indicator">
              <Select id="link-indicator" value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)}>
                <option value="">Choose an indicator…</option>
                {indicators.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
              </Select>
            </Field>
            <Field label="For reporting period" htmlFor="link-period">
              <Select id="link-period" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                <option value="">Choose a period…</option>
                {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </Field>
            <Button size="sm" variant="secondary" disabled={!indicatorId || !periodId || busy} pending={busy} onClick={() => void attachIndicator()}>Link indicator</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger-700 dark:text-danger-400">{error}</p>}
    </section>
  );
}
