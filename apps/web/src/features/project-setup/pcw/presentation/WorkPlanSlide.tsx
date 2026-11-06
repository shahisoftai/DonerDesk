"use client";

import { useState, useTransition } from "react";
import { changePlanAction, editDraftAction, getDraftAction } from "@/lib/actions/project-setup-draft";
import { editSetupItemAction } from "@/lib/actions/project-setup";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";
import { activityOptions, indicatorOptions, indicatorPatch, parseFiles, placeNames, placePatch, planRows, projectWidePatch, share, suggestionTarget } from "../domain/plan-view";
import { roleLabel } from "../domain/team-view";
import { NotUsedToggle } from "./NotUsedToggle";
import { AcceptAllWaiting } from "./AcceptAllWaiting";
import { OriginBadge } from "./OriginBadge";
import { PlanTimeline } from "./PlanTimeline";

type Work = () => Promise<{ ok: true; value: SetupDraftView } | { ok: false; error: { message: string } }>;

function Meter({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <div>
      <p className="text-sm text-slate-800 dark:text-slate-100">{label}</p>
      <progress className="mt-1 h-2 w-full" max={1} value={share(done, total)} aria-label={label} />
    </div>
  );
}

/**
 * Slide 6: each piece of planned work, tied to the project's activity it belongs to, its dates, places, the indicators it
 * feeds, its lead and the files it needs. Suggested links come with their reasons and nothing is linked until accepted.
 */
export function WorkPlanSlide({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const c = PCW_COPY.plan;
  const rows = planRows(view);
  const activities = activityOptions(view);
  const places = placeNames(view);
  const indicators = indicatorOptions(view);
  const team = view.extras.team;
  const [title, setTitle] = useState("");
  const [activity, setActivity] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const take = (v: SetupDraftView) => { setError(null); setPicked(new Set()); onView(v); };
  const run = (work: Work) => startTransition(async () => { const r = await work(); if (r.ok) take(r.value); else setError(r.error.message); });
  const editPlan = (path: string, patch: Record<string, unknown>) => run(() => changePlanAction(id, { kind: "EDIT_PLAN", path, patch }));
  const setup = (planKey: string, patch: Record<string, unknown>) => run(() => editDraftAction(id, { kind: "SET_PLAN_SETUP", planKey, patch }));
  const decide = (path: string, op: "ACCEPT" | "REJECT") =>
    startTransition(async () => {
      const r = await editSetupItemAction(id, { area: "PLAN", path, op });
      if (!r.ok) return setError(r.error.message);
      const fresh = await getDraftAction(id);
      if (fresh.ok) take(fresh.value); else setError(fresh.error.message);
    });
  const accept = (ids: string[]) => ids.length > 0 && run(() => editDraftAction(id, { kind: "ACCEPT_SUGGESTIONS", ids }));
  const kindWord = { INDICATOR: c.kindIndicator, PLACE: c.kindPlace, LEAD: c.kindLead } as const;

  return (
    <div className="space-y-6">
      <AcceptAllWaiting id={id} area="PLAN" items={view.plan} onView={onView} onError={setError} />
      <section aria-label={c.coverageTitle} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-3 dark:border-white/10">
        <Meter label={c.activitiesLine(view.coverage.activities.covered, view.coverage.activities.total)} done={view.coverage.activities.covered} total={view.coverage.activities.total} />
        <Meter label={c.plansLine(view.coverage.plans.complete, view.coverage.plans.total)} done={view.coverage.plans.complete} total={view.coverage.plans.total} />
        <Meter label={c.indicatorsLine(view.coverage.indicators.fed, view.coverage.indicators.total)} done={view.coverage.indicators.fed} total={view.coverage.indicators.total} />
      </section>
      <PlanTimeline view={view} />

      {view.suggestions.length > 0 ? (
        <section aria-labelledby="pcw-suggested" className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-900/20">
          <h2 id="pcw-suggested" className="font-semibold">{c.suggested}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{c.suggestedHelp}</p>
          <ul className="space-y-1">
            {view.suggestions.map((s) => {
              const row = view.plan.find((p) => p.planKey === s.planKey);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <Checkbox aria-label={`${kindWord[s.kind]}: ${suggestionTarget(view, s)}`} checked={picked.has(s.id)} onChange={(e) => setPicked((cur) => { const n = new Set(cur); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} />
                  <span className="font-medium">{row?.value.title ?? s.planKey}</span>
                  <span>→ {kindWord[s.kind]}: {suggestionTarget(view, s)}</span>
                  <span className="text-slate-600 dark:text-slate-300">({s.reason})</span>
                  <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => editDraftAction(id, { kind: "REJECT_SUGGESTION", id: s.id }))}>{c.reject}</button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" disabled={pending || picked.size === 0} onClick={() => accept([...picked])}>{c.acceptSelected(picked.size)}</button>
            <button type="button" className="btn" disabled={pending} onClick={() => accept(view.suggestions.map((s) => s.id))}>{c.acceptAll(view.suggestions.length)}</button>
          </div>
        </section>
      ) : null}

      {rows.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{c.empty}</p> : null}
      {rows.map(({ item, setup: s }) => (
        <article key={item.path} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
          <header className="flex flex-wrap items-center gap-2">
            <input key={`t-${item.value.title}`} aria-label={c.title} defaultValue={item.value.title ?? ""} className="min-w-[12rem] flex-1 bg-transparent font-medium outline-none focus:underline" onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== item.value.title && editPlan(item.path, { title: e.target.value })} />
            <OriginBadge origin={item.origin} id={id} source={item.source} quote={item.quote} />
            {item.status === "PROPOSED" ? <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(item.path, "ACCEPT")}>{PCW_COPY.results.accept}</button> : null}
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(item.path, "REJECT")} aria-label={`${PCW_COPY.results.remove} ${item.value.title ?? ""}`}>{PCW_COPY.results.remove}</button>
          </header>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={c.activity}>
              <Select value={item.value.logframeCode ?? ""} onChange={(e) => editPlan(item.path, { logframeCode: e.target.value || null })}>
                <option value="">{c.choose}</option>
                {activities.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
              </Select>
            </Field>
            <Field label={c.start}><Input type="date" key={`s-${item.value.start}`} defaultValue={item.value.start ?? ""} onBlur={(e) => e.target.value !== (item.value.start ?? "") && editPlan(item.path, { start: e.target.value || null })} /></Field>
            <Field label={c.end}><Input type="date" key={`e-${item.value.end}`} defaultValue={item.value.end ?? ""} onBlur={(e) => e.target.value !== (item.value.end ?? "") && editPlan(item.path, { end: e.target.value || null })} /></Field>
            <Field label={c.lead}>
              <Select value={s.leadKey ?? ""} onChange={(e) => e.target.value && setup(item.planKey, { leadKey: e.target.value })}>
                <option value="">{c.choose}</option>
                {team.map((p) => <option key={p.key} value={p.key}>{p.name} · {roleLabel(p.role)}</option>)}
              </Select>
            </Field>
          </div>
          <fieldset className="text-sm">
            <legend className="mb-1 font-medium">{c.places}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <label className="flex items-center gap-1"><Checkbox checked={s.projectWide} onChange={(e) => setup(item.planKey, projectWidePatch(e.target.checked))} /> {c.projectWide}</label>
              {places.length === 0 ? <span className="text-slate-600 dark:text-slate-300">{c.noneNoPlaces}</span> : places.map((name) => (
                <label key={name} className="flex items-center gap-1"><Checkbox checked={s.placeNames.includes(name)} onChange={(e) => setup(item.planKey, placePatch(s, name, e.target.checked))} /> {name}</label>
              ))}
            </div>
          </fieldset>
          <fieldset className="text-sm">
            <legend className="mb-1 font-medium">{c.indicators}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {indicators.length === 0 ? <span className="text-slate-600 dark:text-slate-300">{c.noneNoIndicators}</span> : indicators.map((i) => (
                <label key={i.code} className="flex items-center gap-1"><Checkbox checked={s.indicatorCodes.includes(i.code)} onChange={(e) => setup(item.planKey, indicatorPatch(s, i.code, e.target.checked))} /> {i.label}</label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={c.files}><Input key={`f-${s.requiredFiles.join()}`} defaultValue={s.requiredFiles.join(", ")} onBlur={(e) => setup(item.planKey, { requiredFiles: parseFiles(e.target.value) })} /></Field>
            <label className="flex items-center gap-2 self-end text-sm"><Checkbox checked={s.recordsParticipants} onChange={(e) => setup(item.planKey, { recordsParticipants: e.target.checked })} /> {c.participants}</label>
          </div>
        </article>
      ))}

      <fieldset className="grid gap-3 rounded-xl border border-dashed border-slate-300 p-4 sm:grid-cols-3 dark:border-white/20">
        <legend className="px-1 text-sm font-semibold">{c.add}</legend>
        <Field label={c.title}><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label={c.activity}>
          <Select value={activity} onChange={(e) => setActivity(e.target.value)}>
            <option value="">{c.choose}</option>
            {activities.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
          </Select>
        </Field>
        <div className="self-end"><button type="button" className="btn" disabled={pending || !title.trim()} onClick={() => { run(() => changePlanAction(id, { kind: "ADD_PLAN", title, logframeCode: activity || null })); setTitle(""); }}>{c.add}</button></div>
      </fieldset>
      <NotUsedToggle id={id} view={view} requirement="plan.indicators" label={PCW_COPY.noIndicatorLinks} onView={onView} />
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
