"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormDefinition, FormField } from "@donordesk/domain/contexts/collection/index.js";
import { listCollectionRecordsAction, reviewCollectionRecordAction } from "@/lib/actions/collection";
import { useActionState } from "@/lib/client/action-state";
import type { CollectionRecordView } from "@/lib/server/schemas-collection";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/data/Badge";
import { AssessmentRecordPanel } from "./AssessmentRecordPanel";

const REVIEW_LABEL = { PENDING: "Waiting for review", ACCEPTED: "Accepted", REJECTED: "Rejected" } as const;
const BAND_TONE = { GOOD: "success", FAIR: "warning", POOR: "danger" } as const;

/** The assessments that came in: one row per facility visit with its score and anything to look at. Open one for the detail; accept or reject it here. */
export function AssessmentRecordsTab({ formId, projectId, form, hasScore, canReview, canAct }: {
  formId: string; projectId: string; form: { fields: ReadonlyArray<FormField>; definition: Omit<FormDefinition, "fields"> }; hasScore: boolean; canReview: boolean; canAct: boolean;
}) {
  const [records, setRecords] = useState<CollectionRecordView[] | null>(null);
  const [filter, setFilter] = useState<keyof typeof REVIEW_LABEL>("PENDING");
  const [open, setOpen] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);
  const act = useActionState();
  const load = useCallback(async () => { const r = await listCollectionRecordsAction(formId, filter); setRecords(r.ok ? r.value : []); }, [formId, filter]);
  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, decision: "ACCEPT" | "REJECT" | "REOPEN", note?: string) {
    if (await act.run(() => reviewCollectionRecordAction(id, { decision, ...(note ? { note } : {}) }))) { setRejecting(null); await load(); }
  }

  return (
    <div className="space-y-3">
      <Field label="Show"><Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>{(Object.keys(REVIEW_LABEL) as Array<keyof typeof REVIEW_LABEL>).map((s) => <option key={s} value={s}>{REVIEW_LABEL[s]}</option>)}</Select></Field>
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      {records === null ? <p className="text-sm text-slate-500">Loading…</p> : records.length === 0 ? <p className="text-sm text-slate-500">Nothing here.</p> : (
        <ul className="space-y-3">
          {records.map((r) => (
            <li key={r.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{r.placeName ?? "No facility"}{r.visitNo ? <span className="ms-2 text-xs font-normal text-slate-500">visit {r.visitNo}</span> : null}</p>
                  <p className="text-xs text-slate-500">{r.placePath ? `${r.placePath} · ` : ""}sent {r.submittedOn} by {r.submitter}</p>
                </div>
                {r.score && <span className="flex items-center gap-2 text-sm"><span className="tabular-nums">{r.score.overall === null ? "—" : `${r.score.overall}%`}</span>{r.score.band && <Badge tone={BAND_TONE[(r.score.tone ?? "FAIR") as keyof typeof BAND_TONE] ?? "neutral"}>{r.score.band}</Badge>}</span>}
                {r.flags && r.flags.length > 0 && <Badge tone="warning">{r.flags.length} to look at</Badge>}
                <Button variant="secondary" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Close" : "Open"}</Button>
                {canReview && r.status !== "PENDING" && <Button variant="secondary" onClick={() => void decide(r.id, "REOPEN")}>Return to waiting</Button>}
                {canReview && r.status === "PENDING" && (rejecting?.id === r.id ? (
                  <span className="flex items-center gap-1">
                    <Input aria-label="Why it is rejected" placeholder="Why?" value={rejecting.note} onChange={(e) => setRejecting({ id: r.id, note: e.target.value })} />
                    <Button variant="secondary" onClick={() => void decide(r.id, "REJECT", rejecting.note)} disabled={!rejecting.note.trim()}>Reject</Button>
                  </span>
                ) : (
                  <span className="flex gap-1"><Button variant="secondary" onClick={() => void decide(r.id, "ACCEPT")}>Accept</Button><Button variant="secondary" onClick={() => setRejecting({ id: r.id, note: "" })}>Reject…</Button></span>
                ))}
                {r.status === "REJECTED" && r.reviewNote && <span className="text-xs text-slate-500">Rejected: {r.reviewNote}</span>}
              </div>
              {open === r.id && <AssessmentRecordPanel record={r} form={form} projectId={projectId} hasScore={hasScore} canAct={canAct} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
