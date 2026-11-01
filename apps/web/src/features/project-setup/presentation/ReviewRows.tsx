"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { editSetupItemAction, rerunSetupAreaAction } from "@/lib/actions/project-setup";
import type { SetupProposalView } from "@/lib/server/schemas-project-setup";
import { canAccept, canReject, countRows, editableText, rowsForField, showsConfidence, statusKey, type ReviewRow } from "../domain/review-state";
import type { AreaKey } from "../domain/slide-deck";
import type { ProblemCode } from "../copy";
import { useSetupCopy } from "./useSetupCopy";

type Op = "ACCEPT" | "REJECT" | "EDIT" | "FILL";

/** Facts that take one plain value: the only items a person may write their own version of (lists are accepted or rejected). */
const WRITABLE_FACTS = new Set(["name", "code", "donor", "currency", "summary", "startDate", "endDate"]);

const TONE: Record<string, string> = {
  ACCEPTED: "border-green-400/50 bg-green-50/60 dark:bg-green-400/5",
  EDITED: "border-green-400/50 bg-green-50/60 dark:bg-green-400/5",
  REJECTED: "border-slate-200 bg-slate-50 opacity-70 dark:border-white/10 dark:bg-white/5",
  PROPOSED: "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/50",
  NOT_IN_DOCUMENT: "border-dashed border-slate-300 bg-white dark:border-white/15 dark:bg-slate-900/40",
};
const TAG: Record<string, string> = { ACCEPTED: "tag-green", EDITED: "tag-green", REJECTED: "tag-slate", PROPOSED: "tag-amber", NOT_IN_DOCUMENT: "tag-slate" };

/** The items of one area with their decisions: accept, reject, write your own, accept all, or read the area again. */
export function ReviewRows({ view, area, readOnly }: { view: SetupProposalView; area: AreaKey; readOnly: boolean }) {
  const { c } = useSetupCopy();
  const rv = c.review;
  const router = useRouter();
  const { proposal } = view;
  const fields = view.areas.find((a) => a.area === area)?.fields ?? [];
  const sections = fields.map((f) => rowsForField(proposal.proposal, f, view.problems));
  const rows = sections.flatMap((s) => s.rows);
  const counts = countRows(rows);
  const version = useRef(proposal.updatedAt);
  useEffect(() => { version.current = proposal.updatedAt; }, [proposal.updatedAt]);
  const [editing, setEditing] = useState<{ path: string; text: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmAgain, setConfirmAgain] = useState(false);
  const [pending, startTransition] = useTransition();
  const waiting = rows.filter((r) => r.status === "PROPOSED" && canAccept(r));

  /** A row's name in the person's language: a fact by its label, an untitled item by its field and place, else its own title. */
  const labelOf = (row: ReviewRow) =>
    row.factKey ? rv.factLabels[row.factKey] ?? row.label : row.untitled ? rv.untitled(rv.fieldHeadings[row.field] ?? row.field, row.index + 1) : row.label;

  async function send(row: ReviewRow, op: Op, value?: string): Promise<boolean> {
    const r = await editSetupItemAction(proposal.id, { area, path: row.path, op, value, expectedUpdatedAt: version.current });
    if (!r.ok) {
      setMessage(r.error.kind === "conflict" ? c.common.stale : r.error.message || c.common.unknownError);
      return false;
    }
    version.current = r.value.updatedAt;
    return true;
  }
  const act = (row: ReviewRow, op: Op, value?: string) => {
    setMessage(null);
    startTransition(async () => { if (await send(row, op, value)) { setEditing(null); router.refresh(); } });
  };
  const acceptAll = () => {
    setMessage(null);
    startTransition(async () => {
      for (const row of waiting) if (!(await send(row, "ACCEPT"))) break;
      router.refresh();
    });
  };
  const readAgain = () => {
    setMessage(null);
    setConfirmAgain(false);
    startTransition(async () => {
      const r = await rerunSetupAreaAction(proposal.id, area);
      if (!r.ok) setMessage(r.error.message || c.common.unknownError);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{rv.counts(counts.accepted, counts.pending, counts.total)}</p>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {waiting.length > 0 && <button type="button" className="btn" disabled={pending} onClick={acceptAll}>{rv.acceptAll(waiting.length)}</button>}
            {area !== "FACTS" && (confirmAgain ? (
              <>
                <button type="button" className="btn-secondary" disabled={pending} onClick={readAgain}>{rv.readAgainYes}</button>
                <button type="button" className="btn-secondary" onClick={() => setConfirmAgain(false)}>{rv.readAgainKeep}</button>
              </>
            ) : <button type="button" className="btn-secondary" disabled={pending} onClick={() => setConfirmAgain(true)}>{rv.readAgain}</button>)}
          </div>
        )}
      </div>
      {confirmAgain && <p role="status" className="text-xs text-amber-800 dark:text-amber-200">{rv.readAgainNote}</p>}
      {message && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100">{message}</p>}

      {sections.map((section) => (
        <section key={section.field} aria-label={rv.fieldHeadings[section.field]} className="space-y-3">
          {sections.length > 1 && <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{rv.fieldHeadings[section.field]}</h3>}
          {section.rows.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-white/15 dark:text-slate-300">{rv.noItems}</p>}
          <ul className="space-y-3">
            {section.rows.map((row) => {
              const key = statusKey(row);
              return (
                <li key={row.path} className={`rounded-xl border p-4 transition ${TONE[key]}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {row.level && rv.levels[row.level] ? <span className="tag me-2">{rv.levels[row.level]}</span> : null}{labelOf(row)}
                    </p>
                    <p className="flex items-center gap-2 text-xs">
                      <span className={`tag ${TAG[key]}`}>{rv.status[key]}</span>
                      {showsConfidence(row) && <span className="text-slate-600 dark:text-slate-300">{rv.confidence[row.confidence as keyof typeof rv.confidence] ?? row.confidence}</span>}
                    </p>
                  </div>
                  <p className={`mt-1 text-sm ${row.summary === "Not stated" ? "italic text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>{row.summary === "Not stated" ? rv.notStated : row.summary}</p>
                  {row.quote && (
                    <blockquote className="mt-2 border-s-2 border-brand-300 ps-3 text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-medium">{rv.from}: </span>“{row.quote}”
                    </blockquote>
                  )}
                  {row.problems.map((p) => {
                    const say = rv.problems[p.code as ProblemCode];
                    return <p key={`${p.code}-${p.path}`} className={`mt-2 text-xs font-medium ${p.severity === "HARD" ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-200"}`}>{say ? say(p.params ?? {}) : p.message}</p>;
                  })}

                  {!readOnly && (editing?.path === row.path ? (
                    <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); act(row, row.summary === "Not stated" ? "FILL" : "EDIT", editing.text); }}>
                      <label htmlFor={`edit-${row.path}`} className="sr-only">{rv.writeOwn}</label>
                      <input id={`edit-${row.path}`} className="input min-w-0 flex-1" value={editing.text} onChange={(e) => setEditing({ path: row.path, text: e.target.value })} />
                      <button type="submit" className="btn" disabled={pending}>{rv.save}</button>
                      <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>{rv.cancel}</button>
                    </form>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canAccept(row) && row.status !== "ACCEPTED" && row.status !== "EDITED" && <button type="button" className="btn" disabled={pending} onClick={() => act(row, "ACCEPT")}>✓ {rv.accept}</button>}
                      {canReject(row) && row.summary !== "Not stated" && <button type="button" className="btn-secondary" disabled={pending} onClick={() => act(row, "REJECT")}>✕ {rv.reject}</button>}
                      {section.field === "facts" && WRITABLE_FACTS.has(row.factKey ?? "") && (
                        <button type="button" className="btn-secondary" disabled={pending} onClick={() => setEditing({ path: row.path, text: editableText(proposal.proposal.facts[row.factKey as keyof typeof proposal.proposal.facts].value) })}>✎ {rv.writeOwn}</button>
                      )}
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
