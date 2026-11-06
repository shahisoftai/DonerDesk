"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ReportingFrequencySchema, SETUP_AREA_KEYS, SectorSchema } from "@donordesk/contracts";
import { applySetupProposalAction, previewSetupApplyAction } from "@/lib/actions/project-setup";
import type { SetupApplyResult, SetupPreview, SetupProposalView } from "@/lib/server/schemas-project-setup";
import type { AreaKey } from "../domain/slide-deck";
import type { FieldKey } from "../copy";
import { GuidancePanel } from "./GuidancePanel";
import { useSetupCopy } from "./useSetupCopy";

const TEXT_FIELDS = ["title", "projectCode", "donorName", "implementingOrganization", "country"] as const;
const DATE_FIELDS = ["startDate", "endDate"] as const;
const asDateTime = (day: string) => (day ? `${day}T00:00:00.000Z` : "");

/** The last step: choose which parts to create, complete the project details, check the preview, and create. */
export function CreateSlide({ view, result, onApplied }: { view: SetupProposalView; result: SetupApplyResult | null; onApplied: (r: SetupApplyResult) => void }) {
  const { c } = useSetupCopy();
  const cr = c.create;
  const status = view.proposal.status;
  const accepted = (area: AreaKey) => view.areas.find((a) => a.area === area)?.accepted ?? 0;
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(SETUP_AREA_KEYS.map((a) => [a, a === "FACTS" || accepted(a) > 0])));
  const [preview, setPreview] = useState<SetupPreview | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // After Create is pressed the server keeps applying even when the answer is slow or never arrives (a long work plan takes
  // minutes): the slide then follows the proposal's own status and finishes by itself.
  const [applying, setApplying] = useState(false);
  const chosen = useMemo(() => SETUP_AREA_KEYS.filter((a) => selected[a]), [selected]);
  const chosenKey = chosen.join(",");

  const refresh = () => startTransition(async () => {
    const r = await previewSetupApplyAction(view.proposal.id, chosen);
    if (!r.ok) { setError(r.error.message || c.common.unknownError); return; }
    setError(null);
    setPreview(r.value);
    setForm((cur) => ({ ...Object.fromEntries(Object.entries(r.value.draft).map(([k, v]) => [k, String(v)])), ...cur }));
  });
  useEffect(() => { refresh(); /* the preview follows the choice of parts, and the proposal's own version */ }, [chosenKey, view.proposal.updatedAt]); // eslint-disable-line

  const applyRuns = view.runs.filter((r) => r.kind === "APPLY" && r.area !== undefined);
  const doneAreas = new Set(applyRuns.filter((r) => r.status !== "RUNNING").map((r) => r.area)).size;
  useEffect(() => {
    if (!applying && status !== "APPLYING") return;
    const poll = setInterval(() => router.refresh(), 4_000);
    return () => clearInterval(poll);
  }, [applying, status, router]);
  useEffect(() => {
    if (result !== null || (status !== "APPLIED" && status !== "PARTIAL") || !applying) return;
    // Applied while we were waiting: the result is what each area's run recorded.
    const latest = new Map(applyRuns.map((r) => [r.area as AreaKey, r]));
    onApplied({
      projectId: view.proposal.appliedProjectId ?? "",
      status: status === "PARTIAL" ? "PARTIAL" : "APPLIED",
      areas: SETUP_AREA_KEYS.filter((a) => latest.has(a)).map((a) => {
        const run = latest.get(a)!;
        const failed = run.status === "FAILED";
        return {
          area: a, status: failed ? "FAILED" as const : "APPLIED" as const,
          created: typeof run.detail.created === "number" ? run.detail.created : 0,
          skipped: typeof run.detail.skipped === "number" ? run.detail.skipped : 0,
          notes: [], ...(failed && typeof run.detail.reason === "string" ? { error: run.detail.reason } : {}),
        };
      }),
    });
  }, [applying, status, result]); // eslint-disable-line

  function create() {
    setError(null);
    const project = {
      title: form.title ?? "", projectCode: form.projectCode ?? "", donorName: form.donorName ?? "", implementingOrganization: form.implementingOrganization ?? "",
      country: form.country ?? "", sector: form.sector ?? "", startDate: asDateTime(form.startDate ?? ""), endDate: asDateTime(form.endDate ?? ""), reportingFrequency: form.reportingFrequency ?? "",
      ...(form.description ? { description: form.description } : {}),
    };
    setApplying(true);
    startTransition(async () => {
      let r;
      try { r = await applySetupProposalAction(view.proposal.id, { project, areas: chosen }); } catch { return; /* the answer was lost: the page follows the proposal instead */ }
      if (!r.ok) {
        // A slow answer is not a failure: the server is still creating, and the page follows it.
        if (r.error.kind === "unavailable") return;
        setApplying(false);
        setError((r.error.kind === "validation" ? Object.values(r.error.fields)[0]?.[0] : undefined) ?? r.error.message ?? c.common.unknownError);
        return;
      }
      onApplied(r.value);
    });
  }

  const resuming = status === "PARTIAL" || result?.status === "PARTIAL";
  const blocking = preview?.blocking ?? [];
  const notes = preview?.areas.flatMap((a) => a.notes) ?? [];
  // What is still empty in the form as it stands now, not what the documents lacked when the preview was made.
  const missing = (preview?.missing ?? []).filter((k) => !(form[k] ?? "").trim());
  const problemText = (p: (typeof blocking)[number]) => c.review.problems[p.code]?.(p.params ?? {}) ?? p.message;
  return (
    <>
      <GuidancePanel guide={cr} />
      <section aria-label={cr.partsTitle}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cr.partsTitle}</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SETUP_AREA_KEYS.map((area) => {
            const count = accepted(area);
            const locked = area === "FACTS";
            const off = !selected[area];
            return (
              <li key={area} className={`rounded-xl border p-3 ${off ? "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5" : "border-green-400/40 bg-green-50 dark:bg-green-400/5"}`}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={Boolean(selected[area])} disabled={locked || count === 0 || pending} onChange={(e) => setSelected({ ...selected, [area]: e.target.checked })} />
                  <span>
                    <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{c.areas[area].short}</span>
                    <span className="block text-xs text-slate-600 dark:text-slate-300">{locked ? cr.theProject : count === 0 ? cr.nothingAccepted : cr.accepted(count)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {blocking.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100">
          <p className="font-semibold">{cr.blocking}</p>
          <ul className="mt-1 list-disc ps-5">{blocking.map((p) => <li key={`${p.code}-${p.path}`}>{problemText(p)}</li>)}</ul>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cr.detailsTitle}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEXT_FIELDS.map((key) => (
            <div key={key}>
              <label htmlFor={`setup-${key}`} className="label">{cr.fields[key]}</label>
              <input id={`setup-${key}`} className="input" required value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          <div>
            <label htmlFor="setup-sector" className="label">{cr.fields.sector}</label>
            <select id="setup-sector" className="input" required value={form.sector ?? ""} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
              <option value="">{cr.choose}</option>
              {SectorSchema.options.map((s) => <option key={s} value={s}>{cr.sectors[s] ?? s}</option>)}
            </select>
          </div>
          {DATE_FIELDS.map((key) => (
            <div key={key}>
              <label htmlFor={`setup-${key}`} className="label">{cr.fields[key]}</label>
              <input id={`setup-${key}`} type="date" className="input" required value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          <div>
            <label htmlFor="setup-reportingFrequency" className="label">{cr.fields.reportingFrequency}</label>
            <select id="setup-reportingFrequency" className="input" required value={form.reportingFrequency ?? ""} onChange={(e) => setForm({ ...form, reportingFrequency: e.target.value })}>
              <option value="">{cr.choose}</option>
              {ReportingFrequencySchema.options.map((f) => <option key={f} value={f}>{cr.frequencies[f] ?? f}</option>)}
            </select>
          </div>
        </div>

        {missing.length > 0 && <p className="text-sm text-slate-700 dark:text-slate-200">{cr.missing} {missing.map((k) => cr.fields[k as FieldKey] ?? k).join(", ")}</p>}
        <section aria-label={cr.leftOut} className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-white/5">
          <p className="font-medium text-slate-900 dark:text-slate-100">{cr.leftOut}</p>
          {notes.length === 0 ? <p className="mt-1 text-slate-600 dark:text-slate-300">{cr.nothingLeftOut}</p> : <ul className="mt-1 list-disc ps-5 text-slate-700 dark:text-slate-200">{notes.map((note) => <li key={note}>{note}</li>)}</ul>}
        </section>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        {result?.status === "PARTIAL" && (
          <ul className="text-sm text-slate-700 dark:text-slate-200">
            {result.areas.filter((a) => a.status === "FAILED").map((a) => <li key={a.area} className="text-red-700 dark:text-red-300">{c.areas[a.area].short}: {a.error}</li>)}
          </ul>
        )}
        {view.proposal.appliedProjectId && resuming && <p className="text-sm"><Link className="underline" href={`/projects/${encodeURIComponent(view.proposal.appliedProjectId)}`}>{cr.viewProject}</Link></p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" disabled={pending} onClick={refresh}>{pending ? cr.previewing : cr.previewButton}</button>
          <button type="submit" className="btn px-8" disabled={pending || applying || status === "APPLYING" || blocking.length > 0}>{pending || applying ? cr.working : resuming ? cr.resumeButton : cr.createButton}</button>
        </div>
        {(applying || status === "APPLYING") && (
          <p role="status" className="text-sm text-slate-700 dark:text-slate-200">{cr.creatingNote} {doneAreas > 0 ? cr.creatingProgress(String(doneAreas), String(chosen.length)) : ""}</p>
        )}
      </form>
    </>
  );
}
