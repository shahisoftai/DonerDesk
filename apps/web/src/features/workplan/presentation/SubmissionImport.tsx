"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SUBMISSION_FIELDS, REQUIRED_SUBMISSION_FIELDS, submissionHeaders, suggestSubmissionMapping, type SubmissionMapping } from "@donordesk/domain/contexts/workplan/index.js";
import { importSubmissionsAction, previewSubmissionsAction, saveSubmissionMappingAction } from "@/lib/actions/workplan";
import type { SubmissionReview } from "@/lib/server/schemas";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

const FIELD_WORDS: Record<string, string> = {
  case_code: "Case code", sex: "Sex", age_group: "Age group", location: "Location (optional)", date: "Day they joined", consent: "Consent given",
};

/**
 * Adds people from a KoboToolbox or ODK export (CSV). The columns are read from the file; the mapping starts from the project's
 * saved mapping, or from matching names. A managers may save the mapping for the project. A file with any wrong row adds nobody.
 */
export function SubmissionImport({ projectId, savedMapping, canManage }: { projectId: string; savedMapping: SubmissionMapping | null; canManage: boolean }) {
  const router = useRouter();
  const state = useActionState();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<SubmissionMapping>({});
  const [added, setAdded] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [review, setReview] = useState<SubmissionReview | null>(null);

  function pick(file: File | undefined) {
    setAdded(null); setSaved(false);
    if (!file) { setText(null); setFileName(""); setHeaders([]); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      const found = submissionHeaders(content);
      setText(content);
      setHeaders(found);
      const starting = { ...suggestSubmissionMapping(found), ...(savedMapping ?? {}) };
      setMapping(Object.fromEntries(Object.entries(starting).filter(([, v]) => v !== undefined && found.includes(v))) as SubmissionMapping);
    };
    reader.readAsText(file);
  }

  const missing = REQUIRED_SUBMISSION_FIELDS.filter((f) => !mapping[f]);

  async function check() {
    if (!text || missing.length) return;
    setReview(null);
    const res = await previewSubmissionsAction(projectId, text, mapping as Record<string, string>);
    if (res.ok) setReview(res.value);
    else setReview(null);
  }

  async function run() {
    if (!text || missing.length) return;
    const done = await state.run(() => importSubmissionsAction(projectId, text, mapping as Record<string, string>));
    if (done) { setAdded(done.added); setText(null); setFileName(""); setHeaders([]); router.refresh(); }
  }

  async function saveForProject() {
    const done = await state.run(() => saveSubmissionMappingAction(projectId, mapping as Record<string, string>));
    if (done) setSaved(true);
  }

  return (
    <section aria-labelledby="sub-import" className="max-w-2xl space-y-3">
      <h2 id="sub-import" className="text-base font-semibold">Import an export</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">From KoboToolbox or ODK, as CSV. Choose which column holds each answer. Nothing is added unless every row is right.</p>
      <input id="sub-file" type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0])} className="text-sm" aria-label="CSV file from KoboToolbox or ODK" />
      {fileName && <p className="text-xs text-slate-500">{fileName}</p>}

      {headers.length > 0 && (
        <div className="space-y-2">
          {SUBMISSION_FIELDS.map((field) => (
            <div key={field} className="grid grid-cols-1 gap-1 sm:grid-cols-[180px_1fr] sm:items-center">
              <label htmlFor={`map-${field}`} className="text-sm">{FIELD_WORDS[field]}</label>
              <Select id={`map-${field}`} value={mapping[field] ?? ""} onChange={(e) => setMapping({ ...mapping, [field]: e.target.value || undefined })}>
                <option value="">{REQUIRED_SUBMISSION_FIELDS.includes(field) ? "Choose a column" : "Not in this file"}</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </Select>
            </div>
          ))}
          {missing.length > 0 && <p role="status" className="text-sm text-amber-700 dark:text-amber-400">Choose a column for: {missing.map((m) => FIELD_WORDS[m]).join(", ")}.</p>}
        </div>
      )}

      {headers.length > 0 && !missing.length && text && (
        <div className="space-y-2">
          <Button variant="secondary" onClick={check} disabled={state.busy}>Check the file first</Button>
          {review && (
            <div role="region" aria-label="Check before importing" className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
              <p>{review.ready} ready to add{review.problems.length ? `, ${review.problems.length} row${review.problems.length === 1 ? "" : "s"} to fix` : ""}.</p>
              {review.problems.map((p) => <p key={p.line} className="text-danger-600">{p.message}</p>)}
              {review.clashes.map((c) => <p key={c.line} className="text-danger-600">Line {c.line}: case code {c.caseCode} is already used here. It will not be added.</p>)}
              {review.likely.length > 0 && (
                <div>
                  <p className="font-medium">These may be people already on the register. They are not merged; check them:</p>
                  <ul className="list-disc pl-5">{review.likely.map((l) => <li key={l.line}>Line {l.line} ({l.caseCode}) looks like {l.looksLike.join(", ")}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      {added !== null && <p role="status" className="text-sm">Added {added} {added === 1 ? "person" : "people"}.</p>}
      {saved && <p role="status" className="text-sm">Saved as this project&apos;s column mapping.</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={run} pending={state.busy} disabled={!text || missing.length > 0}>Import the file</Button>
        {canManage && headers.length > 0 && <Button variant="secondary" onClick={saveForProject} disabled={state.busy || missing.length > 0}>Use this mapping for future files</Button>}
      </div>
    </section>
  );
}
