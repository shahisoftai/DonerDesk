"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkReviewActivitiesAction } from "@/lib/actions/activities";
import { Badge } from "@/components/data/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { activityStatusTone } from "@/lib/shared/tone";
import { ACTIVITY_STATUS_LABEL } from "@/lib/labels";
import { bulkSummary, reviewableIds, toggleSelection, withWithdrawnLast } from "../domain/bulk-selection";

export interface ActivityRow {
  id: string;
  activityTitle: string;
  activityDate: string;
  location?: string;
  participantsTotal?: number;
  status: string;
}

/** The activity list, with a reviewer's "Accept selected": one action, one shared note, a result per record. */
export function ActivityBulkList({ projectId, items, canReview }: { projectId: string; items: ActivityRow[]; canReview: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string; failures: string[] } | null>(null);
  const rows = withWithdrawnLast(items);
  const waiting = reviewableIds(items);

  async function acceptSelected() {
    if (busy || selected.length === 0) return;
    setBusy(true);
    setMessage(null);
    const result = await bulkReviewActivitiesAction({ activityIds: selected, decision: "ACCEPT", notes: note.trim() || undefined });
    setBusy(false);
    if (!result.ok) return setMessage({ tone: "error", text: result.error.message, failures: [] });
    const titles = new Map(items.map((a) => [a.id, a.activityTitle]));
    setMessage({
      tone: result.value.failed === 0 ? "ok" : "error",
      text: bulkSummary(result.value),
      failures: result.value.results.filter((r) => !r.ok).map((r) => `${titles.get(r.activityId) ?? r.activityId}: ${r.error ?? "not accepted"}`),
    });
    setSelected([]);
    setNote("");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-3">
      {canReview && waiting.length > 0 && (
        <div className="card flex flex-wrap items-end gap-3" role="group" aria-label="Review several records">
          <div className="text-sm">
            <span className="font-medium">{waiting.length} waiting for review.</span>{" "}
            <button type="button" className="underline" onClick={() => setSelected(selected.length === waiting.length ? [] : waiting)}>
              {selected.length === waiting.length ? "Clear selection" : "Select all waiting"}
            </button>
          </div>
          {selected.length > 0 && (
            <>
              <div className="min-w-[14rem] flex-1">
                <Input aria-label="Note for all selected records (optional)" placeholder="Note for all selected (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              </div>
              <Button onClick={() => void acceptSelected()} pending={busy}>Accept {selected.length} selected</Button>
            </>
          )}
        </div>
      )}
      {message && (
        <div role={message.tone === "error" ? "alert" : "status"} className={`card text-sm ${message.tone === "error" ? "text-danger-700 dark:text-danger-400" : "text-success-700 dark:text-success-400"}`}>
          <p className="font-medium">{message.text}</p>
          {message.failures.length > 0 && <ul className="mt-1 list-disc pl-5">{message.failures.map((f) => <li key={f}>{f}</li>)}</ul>}
        </div>
      )}
      {rows.length === 0 && <div className="card text-sm text-slate-600 dark:text-slate-300">No activity updates yet.</div>}
      {rows.map((a) => (
        <div key={a.id} className={`card flex items-center gap-3 transition hover:border-brand-400/40 dark:hover:border-brand-400/30 ${a.status === "WITHDRAWN" ? "opacity-60" : ""}`}>
          {canReview && (
            <Checkbox
              aria-label={`Select ${a.activityTitle}`}
              checked={selected.includes(a.id)}
              disabled={a.status !== "SUBMITTED" || busy}
              onChange={() => setSelected((s) => toggleSelection(s, a.id))}
            />
          )}
          <Link href={`/projects/${projectId}/activities/${a.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{a.activityTitle}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{a.activityDate.slice(0, 10)} · {a.location ?? "—"} · {a.participantsTotal ?? 0} participants</div>
            </div>
            <Badge tone={activityStatusTone(a.status)}>{ACTIVITY_STATUS_LABEL[a.status] ?? a.status.replace(/_/g, " ")}</Badge>
          </Link>
        </div>
      ))}
    </div>
  );
}
