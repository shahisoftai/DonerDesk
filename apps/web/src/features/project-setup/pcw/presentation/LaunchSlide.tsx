"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { changeRisksAction, editDraftAction, getDraftAction, launchProjectAction, signOffAction } from "@/lib/actions/project-setup-draft";
import { editSetupItemAction } from "@/lib/actions/project-setup";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { LaunchReport, SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";
import { RISK_KINDS, RISK_KIND_LABEL, SERIOUSNESS, blockerSentences, canSignOff, groupedRisks, isSignedOffNow, isStarted, reportRows, riskKindLabel, signedDay, startedProjectId } from "../domain/launch-view";
import { NotUsedToggle } from "./NotUsedToggle";
import { AcceptAllWaiting } from "./AcceptAllWaiting";
import { OriginBadge } from "./OriginBadge";

type Work = () => Promise<{ ok: true; value: SetupDraftView } | { ok: false; error: { message: string } }>;

/**
 * Slide 10: risks and assumptions, the checklist, the starting dashboard, who is invited when, a plain summary of what will be
 * created, and the sign-off. The sign-off is for exactly what is on the page; changing anything makes it stale.
 */
export function LaunchSlide({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const c = PCW_COPY.launch;
  const s = view.summary;
  const { assumptions, others } = groupedRisks(view);
  const [risk, setRisk] = useState({ kind: "RISK", title: "", seriousness: "" });
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LaunchReport | null>(null);
  const [pending, startTransition] = useTransition();
  const started = isStarted(view, report);
  const projectId = startedProjectId(view, report);
  const launch = () =>
    startTransition(async () => {
      const r = await launchProjectAction(id);
      if (!r.ok) return setError(r.error.message);
      setError(null);
      setReport(r.value);
      const fresh = await getDraftAction(id);
      if (fresh.ok) onView(fresh.value);
    });
  const run = (work: Work) => startTransition(async () => { const r = await work(); if (r.ok) { setError(null); onView(r.value); } else setError(r.error.message); });
  const edit = (operation: unknown) => run(() => editDraftAction(id, operation));
  const changeRisk = (operation: unknown) => run(() => changeRisksAction(id, operation));
  const decide = (path: string, op: "ACCEPT" | "REJECT") =>
    startTransition(async () => {
      const r = await editSetupItemAction(id, { area: "RISKS", path, op });
      if (!r.ok) return setError(r.error.message);
      const fresh = await getDraftAction(id);
      if (fresh.ok) { setError(null); onView(fresh.value); } else setError(fresh.error.message);
    });

  const riskRow = (r: SetupDraftView["risks"][number]) => (
    <li key={r.path} className="space-y-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label={c.kind} className="!w-auto" value={r.value.kind ?? ""} onChange={(e) => changeRisk({ kind: "EDIT_RISK", path: r.path, patch: { kind: e.target.value } })}>
          {r.value.kind && !(r.value.kind in RISK_KIND_LABEL) ? <option value={r.value.kind}>{riskKindLabel(r.value.kind)}</option> : null}
          {RISK_KINDS.map((k) => <option key={k} value={k}>{RISK_KIND_LABEL[k]}</option>)}
        </Select>
        <input key={`t-${r.value.title}`} aria-label={c.what} defaultValue={r.value.title ?? ""} className="min-w-[10rem] flex-1 bg-transparent font-medium outline-none focus:underline" onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== r.value.title && changeRisk({ kind: "EDIT_RISK", path: r.path, patch: { title: e.target.value } })} />
        <Select aria-label={c.seriousness} className="!w-auto" value={r.value.seriousness ?? ""} onChange={(e) => e.target.value && changeRisk({ kind: "EDIT_RISK", path: r.path, patch: { seriousness: e.target.value } })}>
          <option value="">{c.choose}</option>
          {SERIOUSNESS.map((x) => <option key={x} value={x}>{c.serious[x]}</option>)}
        </Select>
        <OriginBadge origin={r.origin} />
        {r.status === "PROPOSED" ? <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(r.path, "ACCEPT")}>{PCW_COPY.places.accept}</button> : null}
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide(r.path, "REJECT")} aria-label={`${c.remove} ${r.value.title ?? ""}`}>{c.remove}</button>
      </div>
      <input key={`m-${r.value.mitigation}`} aria-label={c.action} placeholder={c.action} defaultValue={r.value.mitigation ?? ""} className="w-full bg-transparent text-slate-700 outline-none focus:underline dark:text-slate-200" onBlur={(e) => e.target.value.trim() !== (r.value.mitigation ?? "") && changeRisk({ kind: "EDIT_RISK", path: r.path, patch: { mitigation: e.target.value.trim() || null } })} />
    </li>
  );

  return (
    <div className="space-y-8">
      <AcceptAllWaiting id={id} area="RISKS" items={view.risks} onView={onView} onError={setError} />
      <section aria-labelledby="pcw-risks" className="space-y-3">
        <h2 id="pcw-risks" className="text-lg font-semibold">{c.risksTitle}</h2>
        {view.risks.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{c.noRisks}</p> : <ul className="space-y-2">{[...others, ...assumptions].map(riskRow)}</ul>}
        <fieldset className="grid gap-3 rounded-xl border border-dashed border-slate-300 p-4 sm:grid-cols-4 dark:border-white/20">
          <legend className="px-1 text-sm font-semibold">{c.addRisk}</legend>
          <Field label={c.kind}><Select value={risk.kind} onChange={(e) => setRisk({ ...risk, kind: e.target.value })}>{RISK_KINDS.map((k) => <option key={k} value={k}>{RISK_KIND_LABEL[k]}</option>)}</Select></Field>
          <Field label={c.what}><Input value={risk.title} onChange={(e) => setRisk({ ...risk, title: e.target.value })} /></Field>
          <Field label={c.seriousness}><Select value={risk.seriousness} onChange={(e) => setRisk({ ...risk, seriousness: e.target.value })}><option value="">{c.choose}</option>{SERIOUSNESS.map((x) => <option key={x} value={x}>{c.serious[x]}</option>)}</Select></Field>
          <div className="self-end"><button type="button" className="btn" disabled={pending || !risk.title.trim() || !risk.seriousness} onClick={() => { changeRisk({ kind: "ADD_RISK", riskKind: risk.kind, title: risk.title, seriousness: risk.seriousness }); setRisk({ ...risk, title: "" }); }}>{c.addRisk}</button></div>
        </fieldset>
        <NotUsedToggle id={id} view={view} requirement="launch.risks" onView={onView} />
        <NotUsedToggle id={id} view={view} requirement="launch.assumptions" onView={onView} />
      </section>

      <section aria-labelledby="pcw-checklist" className="space-y-2">
        <h2 id="pcw-checklist" className="text-lg font-semibold">{c.checklistTitle}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{c.checklistNote}</p>
      </section>

      <section aria-labelledby="pcw-dashboard" className="space-y-3">
        <h2 id="pcw-dashboard" className="text-lg font-semibold">{c.dashboardTitle}</h2>
        <Field label={c.dashboard}>
          <Select value={view.extras.dashboardTemplate ?? ""} onChange={(e) => edit({ kind: "SET_DASHBOARD", templateKey: e.target.value || null })}>
            <option value="">{c.none}</option>
            {view.dashboardOptions.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </Select>
        </Field>
        <NotUsedToggle id={id} view={view} requirement="launch.dashboard" onView={onView} />
      </section>

      <section aria-labelledby="pcw-people" className="space-y-3">
        <h2 id="pcw-people" className="text-lg font-semibold">{c.peopleTitle}</h2>
        {view.extras.team.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{c.noPeople}</p> : (
          <ul className="space-y-1">
            {view.extras.team.map((p) => (
              <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
                <span>{p.name}{p.email ? ` · ${p.email}` : ""}</span>
                <Select aria-label={`${c.peopleTitle}: ${p.name}`} className="!w-auto" value={p.invite} onChange={(e) => edit({ kind: "UPDATE_PERSON", key: p.key, patch: { invite: e.target.value } })}>
                  <option value="LATER">{c.inviteLater}</option>
                  <option value="NOW">{c.inviteNow}</option>
                </Select>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pcw-summary" className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm dark:border-white/10">
        <h2 id="pcw-summary" className="text-lg font-semibold">{c.summaryTitle}</h2>
        <p>{[c.count(s.results, "result", "results"), c.count(s.indicators, "indicator", "indicators"), c.count(s.places, "place", "places"), c.count(s.plannedActivities, "planned activity", "planned activities"), c.count(s.fundingSources, "funding source", "funding sources"), c.count(s.budgetLines, "budget line", "budget lines"), c.count(s.risks, "risk", "risks"), c.count(s.assumptions, "assumption", "assumptions")].join(" · ")}</p>
        <p>{c.count(s.people, "person", "people")}: {s.invitedAtLaunch} {c.inviteNow.toLowerCase()}, {s.invitedLater} {c.inviteLater.toLowerCase()}.</p>
        {s.fromDocuments.accepted + s.fromDocuments.leftOut > 0 ? <p>{c.fromDocs(s.fromDocuments.accepted, s.fromDocuments.leftOut)}</p> : null}
      </section>

      <section aria-labelledby="pcw-sign" className="space-y-3">
        <h2 id="pcw-sign" className="text-lg font-semibold">{c.signTitle}</h2>
        {isSignedOffNow(view) ? <p role="status">{c.signedBy(signedDay(view.extras.signOff.at))}</p> : blockerSentences(view, c).map((t) => <p key={t} role="status" className="text-sm text-slate-700 dark:text-slate-200">{t}</p>)}
        {view.launch.ok ? <p role="status" className="font-medium">{c.ready}</p> : null}
        <button type="button" className="btn" disabled={pending || started || !canSignOff(view) || isSignedOffNow(view)} onClick={() => run(() => signOffAction(id))}>{view.extras.signOff.byUserId ? c.signAgain : c.sign}</button>
      </section>

      <section aria-labelledby="pcw-start" className="space-y-3 rounded-xl border border-brand-200 p-4 dark:border-brand-500/30">
        <h2 id="pcw-start" className="text-lg font-semibold">{c.startTitle}</h2>
        {started ? (
          <p role="status" className="font-medium">{c.started} {projectId ? <Link className="underline" href={`/projects/${encodeURIComponent(projectId)}`}>{c.openProject}</Link> : null}</p>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">{c.startHelp}</p>
            {report?.status === "PARTIAL" ? <p role="status" className="text-sm font-medium">{c.partial}</p> : null}
            <button type="button" className="btn" disabled={pending || !view.launch.ok} onClick={launch}>{pending ? c.starting : report?.status === "PARTIAL" || view.status === "PARTIAL" ? c.tryAgain : c.start}</button>
          </>
        )}
        {report ? (
          <div className="space-y-3 text-sm">
            <h3 className="font-medium">{c.partsTitle}</h3>
            <ul className="space-y-1">
              {reportRows(report, c).map((row) => (
                <li key={row.key}>
                  <span className={row.failed ? "font-medium text-danger-600" : ""}>{row.name}: {row.state}</span>
                  {row.detail.map((d) => <span key={d} className="block ps-4 text-slate-600 dark:text-slate-300">{d}</span>)}
                </li>
              ))}
            </ul>
            {report.notWritten.length > 0 ? (
              <div>
                <h3 className="font-medium">{c.leftTitle}</h3>
                <ul className="list-disc ps-5 text-slate-700 dark:text-slate-200">{report.notWritten.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
