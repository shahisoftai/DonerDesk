"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { saveSectionNoteAction, setStandingStatementAction, type ComplianceNotesShape } from "@/lib/actions/reporting";
import { agree, countOf } from "@donordesk/domain/core/plural.js";

type Row = ComplianceNotesShape["sections"][number];

/**
 * One statement per compliance section of the donor's template (environmental, branding, safeguarding...). These
 * sections have no indicator or activity behind them: what you write here is what the report says, as the reporting
 * officer's statement. A section left empty is a to-do, not a silent "no record" in the report.
 */
export function ComplianceNotes({ periodId, projectId, initial, canEdit }: { periodId: string; projectId: string; initial: ComplianceNotesShape; canEdit: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial.sections);
  const [saved, setSaved] = useState<Record<string, string>>(() => Object.fromEntries(initial.sections.map((r) => [r.key, r.note])));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Typing saves after a short pause, so a statement is not lost when the user leaves the page without leaving the field.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);
  if (rows.length === 0) return null;

  const missing = rows.filter((r) => !r.note.trim()).length;

  async function save(key: string, note: string) {
    if ((saved[key] ?? "") === note) return;
    setBusyKey(key);
    setError(null);
    const result = await saveSectionNoteAction(periodId, key, note);
    setBusyKey(null);
    if (!result.ok) return setError(result.error.message);
    setSaved((s) => ({ ...s, [key]: note }));
    router.refresh();
  }

  /** A statement that holds every period (a branding policy, a waste procedure): kept on the project, offered each month. */
  async function saveStanding(key: string, text: string) {
    setBusyKey(key);
    setError(null);
    const result = await setStandingStatementAction(projectId, key, text);
    setBusyKey(null);
    if (!result.ok) return setError(result.error.message);
    router.refresh();
  }

  function change(key: string, note: string) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, note } : r)));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => void save(key, note), 1500);
  }

  return (
    <section aria-labelledby="compliance-heading" className="card space-y-4">
      <div>
        <h2 id="compliance-heading" className="text-base font-semibold">Compliance statements</h2>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
          The donor's template asks for a statement on each of these. They have no indicator behind them, so the report says what you write.
          {missing > 0 ? ` ${countOf(missing, "statement")} ${agree(missing, "is", "are")} still to do.` : " Every statement is written."}
        </p>
      </div>
      {rows.map((row) => (
        <div key={row.key}>
          <label htmlFor={`note-${row.key}`} className="block text-sm font-medium text-slate-800 dark:text-slate-100">
            {row.title}{!row.note.trim() && <span className="ml-2 text-xs font-normal text-warning-700 dark:text-warning-400">To do</span>}
          </label>
          <Textarea
            id={`note-${row.key}`}
            rows={3}
            value={row.note}
            readOnly={!canEdit}
            placeholder="What did you do this period? For example the steps taken, who was involved, and any incident."
            onChange={(e) => change(row.key, e.target.value)}
            onBlur={(e) => void save(row.key, e.target.value)}
          />
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            {canEdit && row.previousNote && row.previousNote !== row.note && (
              <Button size="sm" variant="ghost" onClick={() => { change(row.key, row.previousNote ?? ""); void save(row.key, row.previousNote ?? ""); }}>
                Same as last month
              </Button>
            )}
            {canEdit && row.standingStatement && row.standingStatement !== row.note && (
              <Button size="sm" variant="ghost" onClick={() => { change(row.key, row.standingStatement ?? ""); void save(row.key, row.standingStatement ?? ""); }}>
                Use the standing statement
              </Button>
            )}
            {canEdit && row.note.trim() && row.note !== row.standingStatement && (
              <Button size="sm" variant="ghost" onClick={() => void saveStanding(row.key, row.note)}>
                Save as standing statement
              </Button>
            )}
            {busyKey === row.key && <span role="status">Saving…</span>}
          </div>
        </div>
      ))}
      {error && <p role="alert" className="text-sm text-danger-700 dark:text-danger-400">{error}</p>}
    </section>
  );
}
