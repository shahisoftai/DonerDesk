"use client";

import { useState, useTransition } from "react";
import type { SetupLogLevel, SlideKey } from "@donordesk/domain";
import { changeResultsAction } from "@/lib/actions/project-setup-draft";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { leftOutFor } from "../domain/parity-view";
import { LEVELS, needsParent, parentChoices } from "../domain/results-view";
import { usePcwCopy } from "./usePcwCopy";

/** One left-out line on the Results step: the person picks where it belongs and adds it as a result. */
function AddAsResult({ id, text, view, onView }: { id: string; text: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const c = usePcwCopy().c;
  const [level, setLevel] = useState<SetupLogLevel>(view.logframe.some((i) => i.value.level === "GOAL") ? "OUTCOME" : "GOAL");
  const [parent, setParent] = useState("");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const choices = parentChoices(level, view.logframe);
  const add = () => {
    if (needsParent(level) && !parent) return setError(c.common.chooseParent(c.common.levels[level] ?? level));
    startTransition(async () => {
      const r = await changeResultsAction(id, { kind: "ADD_NODE", level, title: text, parentCode: parent || null });
      if (r.ok) { setError(null); setAdded(true); onView(r.value); } else setError(r.error.message);
    });
  };
  if (added) return <span className="ms-2 text-xs text-slate-500">{c.parity.leftOutAdded}</span>;
  return (
    <span className="ms-2 inline-flex flex-wrap items-center gap-1">
      <select aria-label={c.results.level} className="input max-w-[8rem] py-0.5 text-xs" value={level} onChange={(e) => { setLevel(e.target.value as SetupLogLevel); setParent(""); setError(null); }}>
        {LEVELS.map((l) => <option key={l} value={l}>{c.common.levels[l] ?? l}</option>)}
      </select>
      {choices.length > 0 ? (
        <select aria-label={c.results.parent} className="input max-w-[11rem] py-0.5 text-xs" value={parent} onChange={(e) => setParent(e.target.value)}>
          <option value="">{c.results.none}</option>
          {choices.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
        </select>
      ) : null}
      <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={add}>{c.parity.leftOutAdd}</button>
      {error ? <span role="alert" className="text-xs text-danger-600">{error}</span> : null}
    </span>
  );
}

/** What the reading found for this step but could not find word for word in the documents: shown, never silently dropped. */
export function LeftOutNote({ id, view, slide, onView }: { id: string; view: SetupDraftView; slide: SlideKey; onView: (v: SetupDraftView) => void }) {
  const t = usePcwCopy().c.parity;
  const areas = leftOutFor(view, slide);
  const total = areas.reduce((n, a) => n + a.total, 0);
  if (total === 0) return null;
  return (
    <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
      <summary className="cursor-pointer select-none font-medium">{t.leftOutTitle(total)}</summary>
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{t.leftOutLead}</p>
      <ul className="mt-2 space-y-2">
        {areas.flatMap((a) => a.items.map((item) => ({ area: a.area, item }))).map(({ area, item }, i) => (
          <li key={`${item.field}-${i}`} className="text-xs">“{item.text}” <span className="text-slate-500">· {t.leftOutReasons[item.reason]}</span>
            {area === "LOGFRAME" ? <AddAsResult id={id} text={item.text} view={view} onView={onView} /> : null}
          </li>
        ))}
      </ul>
      {areas.some((a) => a.items.length < a.total) ? <p className="mt-2 text-xs text-slate-500">{t.leftOutMore}</p> : null}
    </details>
  );
}
