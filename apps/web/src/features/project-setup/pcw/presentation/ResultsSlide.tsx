"use client";

import { useState, useTransition } from "react";
import type { SetupLogLevel } from "@donordesk/domain";
import { changeResultsAction, editDraftAction, getDraftAction } from "@/lib/actions/project-setup-draft";
import { editSetupItemAction } from "@/lib/actions/project-setup";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";
import { LEVELS, needsParent, parentChoices, treeRows, unconfirmedCodes } from "../domain/results-view";
import { sentenceFor } from "../domain/pcw-view";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { presetVocabulary } from "@donordesk/domain/contexts/logframe/framework-vocabulary.js";
import { moveParents } from "../domain/parity-view";
import { AcceptAllWaiting } from "./AcceptAllWaiting";
import { OriginBadge } from "./OriginBadge";
import { WizardLibraryPanel } from "@/features/sector-library/presentation/WizardLibraryPanel";

/** Slide 3: the results framework as a tree. Anything from a document waits to be accepted; anything typed here is yours already. */
export function ResultsSlide({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const pcw = usePcwCopy();
  const { t } = useI18n();
  // The donor wording chosen on the Start step wins; otherwise the translated default words.
  const chosen = view.extras.start.wording ? presetVocabulary(view.extras.start.wording) : undefined;
  const lw = (level: string): string => chosen?.levels[level as keyof typeof chosen.levels] ?? PCW_COPY.common.levels[level] ?? level;
  const PCW_COPY = pcw.c;
  const c = PCW_COPY.results;
  const [level, setLevel] = useState<SetupLogLevel>(view.logframe.some((i) => i.value.level === "GOAL") ? "OUTCOME" : "GOAL");
  const [title, setTitle] = useState("");
  const [parent, setParent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rows = treeRows(view.logframe);
  const choices = parentChoices(level, view.logframe);
  const pendingCodes = unconfirmedCodes(view.logframe, view.extras.confirmedGeneratedCodes);

  const fail = (message: string) => setError(message);
  const take = (v: SetupDraftView) => { setError(null); onView(v); };
  const run = (work: () => Promise<{ ok: true; value: SetupDraftView } | { ok: false; error: { message: string } }>) =>
    startTransition(async () => { const r = await work(); if (r.ok) take(r.value); else fail(r.error.message); });
  const move = (path: string, node: { level: SetupLogLevel }, parentCode: string) =>
    startTransition(async () => {
      const r = await editSetupItemAction(id, { area: "LOGFRAME", path, op: "MOVE", value: { level: node.level, parentCode: parentCode || null } });
      if (!r.ok) return fail(r.error.message);
      const fresh = await getDraftAction(id);
      if (fresh.ok) take(fresh.value); else fail(fresh.error.message);
    });
  // A result may change level; it keeps its parent when that is still allowed, otherwise takes the first one that is.
  const changeLevel = (path: string, node: { level: SetupLogLevel; code: string | null; parentCode: string | null }, next: SetupLogLevel) => {
    if (next === node.level) return;
    const options = moveParents(next, view, node.code);
    const parentCode = options.find((p) => p.code === node.parentCode)?.code ?? options[0]?.code ?? null;
    move(path, { level: next }, parentCode ?? "");
  };
  const decide = (path: string, op: "ACCEPT" | "REJECT") =>
    startTransition(async () => {
      const r = await editSetupItemAction(id, { area: "LOGFRAME", path, op });
      if (!r.ok) return fail(r.error.message);
      const fresh = await getDraftAction(id);
      if (fresh.ok) take(fresh.value); else fail(fresh.error.message);
    });

  const add = () => {
    if (needsParent(level) && !parent) return fail(PCW_COPY.common.chooseParent(lw(level)));
    run(() => changeResultsAction(id, { kind: "ADD_NODE", level, title, parentCode: parent || null }));
    setTitle("");
  };

  return (
    <div className="space-y-6">
      <WizardLibraryPanel id={id} view={view} onView={onView} />
      <AcceptAllWaiting id={id} area="LOGFRAME" items={view.logframe} onView={onView} onError={setError} />
      {rows.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{c.empty}</p> : (
        <ul className="space-y-1">
          {rows.map(({ item, node, depth }) => (
            <li key={item.path} style={{ paddingInlineStart: `${depth * 1.5}rem` }} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{lw(node.level)}</span>
              <span className="font-mono text-xs text-slate-500">{node.code}</span>
              <textarea
                key={`n-${node.title}`}
                rows={2}
                aria-label={`${lw(node.level)} ${node.code ?? ""}`}
                defaultValue={node.title ?? ""}
                className="min-w-[12rem] flex-1 resize-y bg-transparent outline-none focus:underline"
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== node.title && run(() => changeResultsAction(id, { kind: "EDIT_NODE_TITLE", path: item.path, title: e.target.value }))}
              />
              <select
                aria-label={`${PCW_COPY.results.level}: ${node.code ?? node.title ?? ""}`}
                className="input max-w-[8rem] py-1 text-xs"
                value={node.level}
                disabled={pending}
                onChange={(e) => changeLevel(item.path, node, e.target.value as SetupLogLevel)}
              >
                {LEVELS.map((l) => <option key={l} value={l}>{lw(l)}</option>)}
              </select>
              {node.level !== "GOAL" ? (() => {
                const parents = moveParents(node.level, view, node.code);
                // A stored parent that is no longer a choice (it was removed) must not be shown as the first option: show it as not chosen.
                const valid = parents.some((p) => p.code === node.parentCode);
                return (
                  <select
                    aria-label={PCW_COPY.parity.moveUnder(node.code ?? node.title ?? PCW_COPY.parity.result)}
                    className="input max-w-[11rem] py-1 text-xs"
                    value={valid ? (node.parentCode ?? "") : ""}
                    disabled={pending}
                    onChange={(e) => move(item.path, node, e.target.value)}
                  >
                    {!needsParent(node.level) ? <option value="">{c.none}</option> : !valid ? <option value="" disabled>{PCW_COPY.indicators.choose}</option> : null}
                    {parents.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                  </select>
                );
              })() : null}
              <OriginBadge showTag={false} origin={item.origin} id={id} source={item.source} quote={item.quote} />
              {item.status === "PROPOSED" ? <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(item.path, "ACCEPT")}>{c.accept}</button> : null}
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(item.path, "REJECT")} aria-label={`${c.remove} ${node.title ?? ""}`}>{c.remove}</button>
              {node.level === "OUTCOME" || node.level === "OUTPUT" ? (
                <details className="basis-full text-xs">
                  <summary className="cursor-pointer text-slate-600 dark:text-slate-300">{t("framework.logic.summary")}</summary>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    <label className="block"><span className="mb-0.5 block">{t("framework.edit.rationale")}</span>
                      <textarea key={`r-${node.rationale ?? ""}`} className="input w-full" rows={2} maxLength={4000} defaultValue={node.rationale ?? ""}
                        onBlur={(e) => e.target.value.trim() !== (node.rationale ?? "") && run(() => changeResultsAction(id, { kind: "EDIT_NODE_LOGIC", path: item.path, rationale: e.target.value }))} />
                    </label>
                    <label className="block"><span className="mb-0.5 block">{t("framework.edit.assumptions")}</span>
                      <textarea key={`a-${node.assumptions ?? ""}`} className="input w-full" rows={2} maxLength={4000} defaultValue={node.assumptions ?? ""}
                        onBlur={(e) => e.target.value.trim() !== (node.assumptions ?? "") && run(() => changeResultsAction(id, { kind: "EDIT_NODE_LOGIC", path: item.path, assumptions: e.target.value }))} />
                    </label>
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {view.advice.filter((a) => a.slide === "RESULTS").map((a) => <p key={a.key} role="note" className="text-sm text-slate-600 dark:text-slate-300">{sentenceFor(a, pcw.sentences)}</p>)}
      {pendingCodes.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <p>{c.codesNote}</p>
          <button type="button" className="btn-secondary mt-2" disabled={pending} onClick={() => run(() => editDraftAction(id, { kind: "CONFIRM_CODES", codes: pendingCodes }))}>{c.keepCodes(pendingCodes.length)}</button>
        </div>
      ) : null}
      <fieldset className="grid gap-3 rounded-xl border border-dashed border-slate-300 p-4 sm:grid-cols-3 dark:border-white/20">
        <legend className="px-1 text-sm font-semibold">{c.add}</legend>
        <Field label={c.level}>
          <Select value={level} onChange={(e) => { setLevel(e.target.value as SetupLogLevel); setParent(""); }}>{LEVELS.map((l) => <option key={l} value={l}>{lw(l)}</option>)}</Select>
        </Field>
        <Field label={c.title}><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label={c.parent}>
          <Select value={parent} disabled={choices.length === 0} onChange={(e) => setParent(e.target.value)}>
            <option value="">{c.none}</option>
            {choices.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-3"><button type="button" className="btn" disabled={pending || !title.trim()} onClick={add}>{c.add}</button></div>
      </fieldset>
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
