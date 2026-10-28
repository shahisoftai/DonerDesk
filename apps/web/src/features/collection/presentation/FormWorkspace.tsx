"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyCollectionTotalsAction, createCollectionLinkAction, getCollectionTotalsAction, listCollectionLinksAction, listCollectionRecordsAction,
  getCollectionTemplateAction, importCollectionRecordsAction, reviewCollectionRecordAction, revokeCollectionLinkAction, setCollectionFormStatusAction, submitCollectionRecordAction,
} from "@/lib/actions/collection";
import { useActionState } from "@/lib/client/action-state";
import { newIdempotencyKey } from "@/lib/shared/create-retry";
import type { RecordImportPreview, CollectionFormView, CollectionLinkView, CollectionRecordView, CollectionTotalsView } from "@/lib/server/schemas-collection";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/data/Badge";
import { Textarea } from "@/components/ui/Textarea";
import { FormFiller } from "./FormFiller";

type Tab = "fill" | "records" | "totals" | "share";

const STATUS_LABEL = { DRAFT: "Draft", PUBLISHED: "Open for answers", CLOSED: "Closed" } as const;
const REVIEW_LABEL = { PENDING: "Waiting for review", ACCEPTED: "Accepted", REJECTED: "Rejected" } as const;

/** A published form at work: filling it, reviewing what came in, seeing what it adds up to, sharing a link. */
export function FormWorkspace({ form, periods, canEdit, canSubmit, canReview }: {
  form: CollectionFormView;
  periods: Array<{ id: string; label: string }>;
  canEdit: boolean;
  canSubmit: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const status = useActionState();
  const [tab, setTab] = useState<Tab>(form.status === "PUBLISHED" && canSubmit ? "fill" : "records");
  const tabs: Array<[Tab, string]> = [
    ...(form.status === "PUBLISHED" && canSubmit ? ([["fill", "Fill in"]] as Array<[Tab, string]>) : []),
    ["records", `Records (${form.counts.PENDING} waiting)`],
    ["totals", "What it adds up to"],
    ...(canEdit && form.status === "PUBLISHED" ? ([["share", "Share a link"]] as Array<[Tab, string]>) : []),
  ];

  async function setState(to: "publish" | "close") {
    if (await status.run(() => setCollectionFormStatusAction(form.id, to))) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={form.status === "PUBLISHED" ? "success" : "neutral"}>{STATUS_LABEL[form.status]}</Badge>
        {canEdit && form.status === "DRAFT" && <Button onClick={() => void setState("publish")} pending={status.busy}>Publish</Button>}
        {canEdit && form.status === "PUBLISHED" && <Button variant="secondary" onClick={() => void setState("close")} pending={status.busy}>Close this form</Button>}
        {status.error && <span role="alert" className="text-sm text-danger-600">{status.error}</span>}
      </div>
      {form.status === "DRAFT" ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">This form is a draft. Publish it to start collecting answers; after that its questions cannot change.</p>
      ) : (
        <>
          <div role="tablist" className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">
            {tabs.map(([key, label]) => (
              <button key={key} role="tab" aria-selected={tab === key} className={`px-3 py-2 text-sm ${tab === key ? "border-b-2 border-brand-600 font-medium" : "text-slate-600 dark:text-slate-300"}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>
          {tab === "fill" && <FillTab form={form} />}
          {tab === "records" && <RecordsTab formId={form.id} fields={form.fields} canReview={canReview} />}
          {tab === "totals" && <TotalsTab formId={form.id} periods={periods} canApply={canSubmit} />}
          {tab === "share" && <ShareTab formId={form.id} />}
        </>
      )}
    </div>
  );
}

function FillTab({ form }: { form: CollectionFormView }) {
  const [key, setKey] = useState(newIdempotencyKey);
  return (
    <div className="space-y-8">
      <FormFiller
        key={key}
        fields={form.fields as never}
        uploadFile={async (file) => {
          const body = new FormData();
          body.set("file", file);
          try {
            const response = await fetch(`/api/collection-forms/${encodeURIComponent(form.id)}/files`, { method: "POST", body });
            const json = (await response.json().catch(() => null)) as { id?: string; name?: string; title?: string; detail?: string } | null;
            if (response.ok && json?.id) return { ok: true, id: json.id, name: json.name ?? file.name };
            return { ok: false, message: json?.detail ?? json?.title ?? "That file could not be sent." };
          } catch {
            return { ok: false, message: "No connection. Try again when you are online." };
          }
        }}
        onSubmit={async (answers) => {
          // The same key is reused if the send is repeated, so a retry after a bad connection is stored once.
          const r = await submitCollectionRecordAction(form.id, { id: key.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60).padEnd(8, "0"), answers });
          if (!r.ok) return { ok: false, message: r.error.message };
          setKey(newIdempotencyKey());
          return { ok: true };
        }}
      />
      <SheetImport formId={form.id} />
    </div>
  );
}

function download(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}

/** Many records at once from a spreadsheet: the form's own template, a preview, and an error file when something is wrong. */
function SheetImport({ formId }: { formId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<RecordImportPreview | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const act = useActionState();

  async function template() {
    const r = await getCollectionTemplateAction(formId);
    if (r.ok) download(r.value.fileName, r.value.text);
  }
  async function run(apply: boolean) {
    setSaved(null);
    const r = await act.run(() => importCollectionRecordsAction(formId, { text, apply }));
    if (r && typeof r === "object") {
      setPreview(r);
      if (apply) { setSaved(r.saved); router.refresh(); }
    }
  }

  return (
    <section className="space-y-3 border-t border-slate-200 pt-6 dark:border-slate-700">
      <h2 className="text-base font-semibold">Import many answers from a sheet</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">Download the sheet made for this form, fill one row per record, then paste it or choose the file. Nothing is saved until every row is right.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void template()}>Download the sheet</Button>
        <label className="btn-secondary cursor-pointer">
          Choose a file
          <input type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); setPreview(null); } e.target.value = ""; }} />
        </label>
      </div>
      <Field label="Or paste the rows here"><Textarea rows={5} value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} /></Field>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => void run(false)} pending={act.busy} disabled={!text.trim()}>Check the sheet</Button>
        <Button onClick={() => void run(true)} pending={act.busy} disabled={!text.trim() || (preview !== null && preview.invalid > 0)}>Import</Button>
      </div>
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      {saved !== null && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{saved === 0 ? "Nothing new: these rows were already imported." : `${saved} record${saved === 1 ? "" : "s"} imported. They wait for review.`}</p>}
      {preview && (
        <div className="space-y-2 text-sm">
          <p>{preview.total} row{preview.total === 1 ? "" : "s"}: {preview.valid} fine, {preview.invalid} with a problem.</p>
          {preview.missingColumns.length > 0 && <p className="text-danger-600">The sheet has no column for {preview.missingColumns.join(", ")}.</p>}
          {preview.unknownColumns.length > 0 && <p className="text-slate-500">These columns match no question and are ignored: {preview.unknownColumns.join(", ")}.</p>}
          <ul className="list-disc pl-5">
            {preview.rows.slice(0, 30).map((r) => <li key={r.rowNumber}>Row {r.rowNumber}: {[...r.problems, ...(r.ignored.length ? [`not asked here, so not stored: ${r.ignored.join(", ")}`] : [])].join(" ")}</li>)}
          </ul>
          {preview.errorFile && <Button variant="secondary" onClick={() => download("rows-to-fix.csv", preview.errorFile!)}>Download the rows to fix</Button>}
        </div>
      )}
    </section>
  );
}

function answerText(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") { const g = value as { lat?: number; lon?: number }; return `${g.lat}, ${g.lon}`; }
  return String(value);
}

function RecordsTab({ formId, fields, canReview }: { formId: string; fields: CollectionFormView["fields"]; canReview: boolean }) {
  const [records, setRecords] = useState<CollectionRecordView[] | null>(null);
  const [filter, setFilter] = useState<"PENDING" | "ACCEPTED" | "REJECTED">("PENDING");
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);
  const act = useActionState();
  const load = useCallback(async () => {
    const r = await listCollectionRecordsAction(formId, filter);
    setRecords(r.ok ? r.value : []);
  }, [formId, filter]);
  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, decision: "ACCEPT" | "REJECT" | "REOPEN", note?: string) {
    if (await act.run(() => reviewCollectionRecordAction(id, { decision, ...(note ? { note } : {}) }))) { setRejecting(null); await load(); }
  }

  return (
    <div className="space-y-3">
      <Field label="Show"><Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
        {(Object.keys(REVIEW_LABEL) as Array<keyof typeof REVIEW_LABEL>).map((s) => <option key={s} value={s}>{REVIEW_LABEL[s]}</option>)}
      </Select></Field>
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      {records === null ? <p className="text-sm text-slate-500">Loading…</p> : records.length === 0 ? <p className="text-sm text-slate-500">Nothing here.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-xs text-slate-500"><th className="py-2 pr-3">Sent</th><th className="pr-3">By</th>{fields.map((f) => <th key={f.key} className="pr-3">{f.label}</th>)}<th /></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className="py-2 pr-3">{r.submittedOn}</td>
                  <td className="pr-3">{r.submitter}{r.source === "LINK" ? " (link)" : ""}</td>
                  {fields.map((f) => (
                    <td key={f.key} className="pr-3">
                      {f.type === "FILE" ? (r.files?.[f.key] ? <a className="underline" href={`/api/collection-files/${encodeURIComponent(r.files[f.key]!.id)}`}>{r.files[f.key]!.name}</a> : "—") : answerText(r.answers[f.key])}
                      {f.type === "PLACE" && r.places?.[f.key] && (
                        <span className={`block text-xs ${r.places[f.key]!.status === "RESOLVED" ? "text-slate-500" : "text-amber-700 dark:text-amber-300"}`}>{r.places[f.key]!.status === "RESOLVED" ? r.places[f.key]!.label : `To confirm: ${r.places[f.key]!.label}`}</span>
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap py-2">
                    {r.status === "REJECTED" && r.reviewNote ? <span className="text-xs text-slate-500">Rejected: {r.reviewNote}</span> : null}
                    {canReview && r.status !== "PENDING" && <Button variant="secondary" onClick={() => void decide(r.id, "REOPEN")}>Return to waiting</Button>}
                    {canReview && r.status === "PENDING" && (rejecting?.id === r.id ? (
                      <span className="flex items-center gap-1">
                        <Input aria-label="Why it is rejected" placeholder="Why?" value={rejecting.note} onChange={(e) => setRejecting({ id: r.id, note: e.target.value })} />
                        <Button variant="secondary" onClick={() => void decide(r.id, "REJECT", rejecting.note)} disabled={!rejecting.note.trim()}>Reject</Button>
                      </span>
                    ) : (
                      <span className="flex gap-1">
                        <Button variant="secondary" onClick={() => void decide(r.id, "ACCEPT")}>Accept</Button>
                        <Button variant="secondary" onClick={() => setRejecting({ id: r.id, note: "" })}>Reject…</Button>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TotalsTab({ formId, periods, canApply }: { formId: string; periods: Array<{ id: string; label: string }>; canApply: boolean }) {
  const [totals, setTotals] = useState<CollectionTotalsView | null>(null);
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [done, setDone] = useState<string | null>(null);
  const act = useActionState();
  useEffect(() => { void getCollectionTotalsAction(formId).then((r) => setTotals(r.ok ? r.value : [])); }, [formId]);

  async function apply() {
    setDone(null);
    const r = await act.run(() => applyCollectionTotalsAction(formId, { reportingPeriodId: periodId }));
    if (r && typeof r === "object") setDone(`${r.saved} value${r.saved === 1 ? "" : "s"} entered as drafts${r.skipped ? `, ${r.skipped} verified value${r.skipped === 1 ? "" : "s"} left as they were` : ""}.`);
  }

  if (totals === null) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">Only accepted records are counted. A period with no accepted records stays empty; it is never read as 0.</p>
      {totals.map((t) => (
        <div key={t.indicatorId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <h3 className="font-medium">{t.indicatorCode} · {t.method === "COUNT" ? "records counted" : "numbers added up"}</h3>
          <ul className="mt-2 text-sm">
            {t.periods.map((p) => <li key={p.periodId}>{p.label}: <strong>{p.value === "" ? "Nothing collected" : p.value}</strong>{p.recordCount > 0 ? ` (${p.recordCount} record${p.recordCount === 1 ? "" : "s"})` : ""}</li>)}
          </ul>
          {(t.outsidePeriods > 0 || t.missingFigure > 0 || t.duplicates > 0) && (
            <p className="mt-2 text-xs text-slate-500">
              {[t.outsidePeriods > 0 && `${t.outsidePeriods} record${t.outsidePeriods === 1 ? "" : "s"} fall in no reporting period`, t.missingFigure > 0 && `${t.missingFigure} lack the number to add up`, t.duplicates > 0 && `${t.duplicates} repeat${t.duplicates === 1 ? "s" : ""} of a later record`].filter(Boolean).join("; ")}. They are left out.
            </p>
          )}
        </div>
      ))}
      {canApply && periods.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Enter these totals into the indicator values for"><Select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>{periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
          <Button onClick={() => void apply()} pending={act.busy}>Enter as drafts</Button>
        </div>
      )}
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      {done && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{done} Review and submit them from the indicator values page.</p>}
    </div>
  );
}

function ShareTab({ formId }: { formId: string }) {
  const [links, setLinks] = useState<CollectionLinkView[] | null>(null);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("30");
  const [fresh, setFresh] = useState<string | null>(null);
  const act = useActionState();
  const load = useCallback(async () => { const r = await listCollectionLinksAction(formId); setLinks(r.ok ? r.value : []); }, [formId]);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    const r = await act.run(() => createCollectionLinkAction(formId, { label, expiresInDays: Number(days) }));
    if (r && typeof r === "object") { setFresh(`${window.location.origin}/collect/${r.token}`); setLabel(""); await load(); }
  }
  async function revoke(id: string) { if (await act.run(() => revokeCollectionLinkAction(id))) await load(); }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">Anyone with a link can answer this form without signing in. Their answers wait here for a person to accept them. A link expires and can be withdrawn.</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Who is this link for?"><Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} /></Field>
        <Field label="Works for (days)"><Input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        <Button onClick={() => void create()} pending={act.busy} disabled={!label.trim()}>Make a link</Button>
      </div>
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      {fresh && (
        <div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-500/10">
          Copy this link now; it is not shown again:
          <input readOnly aria-label="The new link" className="mt-1 w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs dark:bg-slate-900" value={fresh} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
      <ul className="space-y-1 text-sm">
        {(links ?? []).map((l) => (
          <li key={l.id} className="flex items-center gap-3">
            <span>{l.label}</span>
            <span className="text-xs text-slate-500">{l.revoked ? "Withdrawn" : l.live ? `Works until ${l.expiresAt.slice(0, 10)}` : "Expired"}</span>
            {l.live && <Button variant="secondary" onClick={() => void revoke(l.id)}>Withdraw</Button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
