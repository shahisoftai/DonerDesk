"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReportScope } from "@donordesk/domain/contexts/reporting/report-scope.js";
import { missingScopeFields } from "@donordesk/domain/contexts/reporting/report-scope.js";
import { Button } from "@/components/ui/Button";
import { ReportScopeFields, cleanScope, type ScopeActivityOption } from "@/features/reporting/presentation/ReportScopeFields";
import { updateReportingPeriodScopeAction } from "@/lib/actions/reporting";

const SCOPE_ERROR: Record<string, string> = {
  activityIds: "Select at least one activity for an activity report.",
  eventName: "Name the event or situation.",
  situationDate: "Enter the date the situation refers to.",
  title: "Give the report a title.",
};

/**
 * Edit what an activity / situation / custom report covers (the "Covers" tab of
 * the report inputs). Sections already written for the old scope are marked out
 * of date by the server; nothing is regenerated until the user asks.
 */
export function ScopeInputs({
  periodId,
  reportType,
  initialScope,
  activities,
  canEdit,
  lockedReason,
}: {
  periodId: string;
  reportType: string;
  initialScope: ReportScope;
  activities: ScopeActivityOption[];
  canEdit: boolean;
  /** Why the scope cannot be changed now (report under review, approved or submitted). */
  lockedReason?: string;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<ReportScope>(initialScope);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const readOnly = !canEdit || Boolean(lockedReason);
  const dirty = JSON.stringify(cleanScope(scope)) !== JSON.stringify(cleanScope(initialScope));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setFailure(null);
    const missing = missingScopeFields(reportType, scope);
    if (missing.length > 0) {
      setErrors(Object.fromEntries(missing.map((k) => [k, [SCOPE_ERROR[k] ?? "Required."]])));
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await updateReportingPeriodScopeAction(periodId, cleanScope(scope));
    setBusy(false);
    if (!result.ok) {
      setFailure(result.error.message);
      if (result.error.kind === "validation" && result.error.fields) setErrors(result.error.fields);
      return;
    }
    setMessage(
      !result.value.changed
        ? "Nothing changed."
        : result.value.staleSections > 0
          ? `Saved. ${result.value.staleSections} written section${result.value.staleSections === 1 ? " was" : "s were"} marked out of date: regenerate or re-check them before approving.`
          : "Saved.",
    );
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card max-w-2xl space-y-4" noValidate>
      <div>
        <h2 className="font-semibold">What this report covers</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Changing this changes what the AI writes about. Sections that were already written are marked out of date; nothing is regenerated automatically.
        </p>
      </div>
      {lockedReason && <p role="note" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{lockedReason}</p>}
      <fieldset disabled={readOnly} className="space-y-4">
        <ReportScopeFields reportType={reportType} scope={scope} onChange={(patch) => setScope((s) => ({ ...s, ...patch }))} fields={errors} activities={activities} />
      </fieldset>
      {failure && <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{failure}</p>}
      {message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" pending={busy} disabled={!dirty}>Save scope</Button>
        </div>
      )}
    </form>
  );
}
