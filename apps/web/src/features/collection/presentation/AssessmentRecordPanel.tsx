"use client";

import { useEffect, useState } from "react";
import type { FormDefinition, FormField } from "@donordesk/domain/contexts/collection/index.js";
import { compareVisitsAction, createCorrectiveActionAction, getRecordScoreAction, listAssessorsAction } from "@/lib/actions/assessments";
import { useActionState } from "@/lib/client/action-state";
import type { CollectionRecordView } from "@/lib/server/schemas-collection";
import type { ComparisonView, ScoreView } from "@/lib/server/schemas-assessments";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { FormFiller } from "./filler/FormFiller";

const CHANGE_WORD = { IMPROVED: "Better", SAME: "Same", WORSE: "Worse", NOT_COMPARABLE: "Not comparable" } as const;

/**
 * One finished assessment: its score by section, the items that scored lowest (each can become a request or a problem), the comparison with
 * the visit before, the file in PDF, Word or Excel, and the answers themselves. Everything is read from the stored answers.
 */
export function AssessmentRecordPanel({ record, form, projectId, hasScore, canAct }: {
  record: CollectionRecordView;
  form: { fields: ReadonlyArray<FormField>; definition: Omit<FormDefinition, "fields"> };
  projectId: string;
  hasScore: boolean;
  canAct: boolean;
}) {
  const [score, setScore] = useState<ScoreView | null>(null);
  const [compare, setCompare] = useState<ComparisonView | { none: string } | null>(null);
  const [people, setPeople] = useState<Array<{ userId: string; name: string }>>([]);
  const [who, setWho] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const act = useActionState();

  useEffect(() => { if (hasScore) void getRecordScoreAction(record.id).then((r) => setScore(r.ok ? r.value : null)); }, [record.id, hasScore]);
  useEffect(() => { if (canAct) void listAssessorsAction(projectId).then((r) => { if (r.ok) setPeople(r.value); }); }, [canAct, projectId]);

  async function showCompare() {
    const r = await compareVisitsAction(record.id);
    setCompare(r.ok ? r.value : { none: r.error.message });
  }
  async function raise(path: string, label: string, kind: "TASK" | "RISK") {
    setMessage(null);
    const r = await act.run(() => createCorrectiveActionAction(record.id, { path, label, kind, ...(kind === "TASK" ? { assigneeId: who } : {}) }));
    if (r && typeof r === "object") setMessage(kind === "TASK" ? "Request made. The person is told." : "Problem raised on the project.");
  }

  return (
    <div className="space-y-5 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Download:</span>
        {(["PDF", "DOCX", "XLSX"] as const).map((f) => <a key={f} className="btn-secondary btn-sm" href={`/api/collection-records/${encodeURIComponent(record.id)}/export?format=${f}`}>{f === "DOCX" ? "Word" : f === "XLSX" ? "Excel" : "PDF"}</a>)}
        {hasScore && record.placeId && <Button variant="secondary" onClick={() => void showCompare()}>Compare with the visit before</Button>}
      </div>

      {record.flags && record.flags.length > 0 && (
        <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-300" aria-label="Things to look at">
          {record.flags.map((f) => <li key={f.code}>Look at this: {f.detail}.</li>)}
        </ul>
      )}

      {score && (
        <section className="space-y-2">
          <h3 className="text-base font-semibold">Score {score.overall === null ? "not available" : `${score.overall}%`}{score.band ? ` · ${score.band.label}` : ""}</h3>
          <p className="text-xs text-slate-500">Based on {score.answered} of {score.total} items answered.{score.bandWithheld === "NOT_ENOUGH_ANSWERED" ? " Too few were answered to give a band." : ""}{score.illustrative ? " The weights and bands are illustrative." : ""}</p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {score.sections.map((s) => <li key={s.key} className="flex justify-between gap-3"><span className="min-w-0 break-words">{s.title}</span><span className="tabular-nums">{s.percent === null ? "Not answered" : `${s.percent}%`}</span></li>)}
          </ul>
          {score.lowest.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Items that scored lowest</h4>
              {canAct && <label className="flex items-center gap-2 text-sm">Ask this person:<Select value={who} onChange={(e) => setWho(e.target.value)}><option value="">Choose…</option>{people.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}</Select></label>}
              <ul className="space-y-1 text-sm">
                {score.lowest.slice(0, 12).map((i) => (
                  <li key={i.path} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words">{i.section}: {i.label} ({i.points} of {i.possible})</span>
                    {canAct && <>
                      <Button variant="ghost" disabled={!who || act.busy} onClick={() => void raise(i.path, i.label, "TASK")}>Ask for a fix</Button>
                      <Button variant="ghost" disabled={act.busy} onClick={() => void raise(i.path, i.label, "RISK")}>Raise a problem</Button>
                    </>}
                  </li>
                ))}
              </ul>
              {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
              {message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
            </div>
          )}
        </section>
      )}

      {compare && "none" in compare && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{compare.none}</p>}
      {compare && "items" in compare && (
        <section className="space-y-2">
          <h3 className="text-base font-semibold">Visit {compare.afterVisit ?? ""} compared with visit {compare.beforeVisit ?? "before"}</h3>
          <p className="text-sm">Overall {compare.overall.before ?? "—"}% to {compare.overall.after ?? "—"}%{compare.overall.delta === null ? "" : ` (${compare.overall.delta > 0 ? "+" : ""}${compare.overall.delta} points)`}. {compare.counts.IMPROVED} better, {compare.counts.WORSE} worse, {compare.counts.SAME} the same, {compare.counts.NOT_COMPARABLE} not comparable.</p>
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {compare.items.filter((i) => i.change === "IMPROVED" || i.change === "WORSE").map((i) => <li key={i.path}>{CHANGE_WORD[i.change]}: {i.label} ({i.before ?? "—"} to {i.after ?? "—"})</li>)}
          </ul>
        </section>
      )}

      <details>
        <summary className="cursor-pointer text-sm font-medium">The answers</summary>
        <div className="mt-3"><FormFiller fields={form.fields} definition={form.definition} initialAnswers={record.answers} initialHow={(record.how ?? {}) as never} readOnly onSubmit={async () => ({ ok: true })} /></div>
      </details>
    </div>
  );
}
