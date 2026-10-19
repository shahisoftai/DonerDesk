"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importSubmissionsAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";

/**
 * Adds people from a KoboToolbox or ODK export (CSV). The file is read in the browser and checked on the server; a file with
 * any wrong row adds nobody, and the message names the lines to fix.
 */
export function SubmissionImport({ projectId }: { projectId: string }) {
  const router = useRouter();
  const state = useActionState();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [added, setAdded] = useState<number | null>(null);

  function pick(file: File | undefined) {
    setAdded(null);
    if (!file) { setText(null); setFileName(""); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setText(typeof reader.result === "string" ? reader.result : null);
    reader.readAsText(file);
  }

  async function run() {
    if (!text) return;
    const done = await state.run(() => importSubmissionsAction(projectId, text));
    if (done) { setAdded(done.added); setText(null); setFileName(""); router.refresh(); }
  }

  return (
    <section aria-labelledby="sub-import" className="max-w-2xl space-y-3">
      <h2 id="sub-import" className="text-base font-semibold">Import an export</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        From KoboToolbox or ODK, as CSV. Columns: <span className="font-mono">case_code, sex, age_group, location, date, consent</span>. Nothing is added unless every row is right.
      </p>
      <input id="sub-file" type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0])} className="text-sm" aria-label="CSV file from KoboToolbox or ODK" />
      {fileName && <p className="text-xs text-slate-500">{fileName}</p>}
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      {added !== null && <p role="status" className="text-sm">Added {added} {added === 1 ? "person" : "people"}.</p>}
      <Button onClick={run} pending={state.busy} disabled={!text}>Import the file</Button>
    </section>
  );
}
