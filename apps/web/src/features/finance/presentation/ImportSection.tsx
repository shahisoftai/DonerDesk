"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importRegisterSheetAction } from "@/lib/actions/finance";
import { useActionState } from "@/lib/client/action-state";
import type { RegisterImport } from "@/lib/server/schemas-finance";
import { registerSheetTemplate } from "@donordesk/domain/contexts/finance/register-sheet.js";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { FINANCE_COPY as C } from "../domain/finance-copy";

const dataUrl = (text: string) => `data:text/csv;charset=utf-8,${encodeURIComponent(text)}`;

/** Check a sheet, then import it. The check changes nothing; the import changes everything or nothing. */
export function ImportSection({ projectId }: { projectId: string }) {
  const router = useRouter();
  const act = useActionState();
  const [text, setText] = useState("");
  const [result, setResult] = useState<RegisterImport | null>(null);

  async function run(apply: boolean) {
    const out = await act.run(() => importRegisterSheetAction(projectId, { text, apply }));
    if (!out) return;
    setResult(out);
    if (out.applied) { setText(""); router.refresh(); }
  }

  return (
    <section aria-labelledby="fin-import" className="space-y-3">
      <h2 id="fin-import" className="text-base font-semibold">{C.importTitle}</h2>
      <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">{C.importIntro}</p>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <a className="font-medium underline" href={dataUrl(registerSheetTemplate())} download="finance-register-template.csv">{C.importTemplate}</a>
        <label className="flex items-center gap-2">{C.importFile}
          <input type="file" accept=".csv,.tsv,.txt" className="text-xs" disabled={act.busy} onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); setResult(null); } }} />
        </label>
      </div>
      <label className="block text-sm font-medium">{C.importPaste}
        <Textarea rows={5} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} disabled={act.busy} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={act.busy || text.trim() === ""} onClick={() => void run(false)}>{C.importCheck}</Button>
        {result && !result.applied && result.invalid === 0 && result.valid > 0 && <Button type="button" disabled={act.busy} onClick={() => void run(true)}>{C.importApply}</Button>}
      </div>
      {act.error && <p role="alert" className="text-sm text-danger-600">{act.error}</p>}
      {result && (
        <div className="text-sm" aria-live="polite">
          {result.applied ? <p className="text-emerald-700 dark:text-emerald-300">{C.importDone(result.imported, result.alreadyThere)}</p>
            : result.invalid > 0 ? (
              <>
                <p className="font-medium text-danger-600">{C.importProblems(result.invalid)}</p>
                <ul className="mt-1 list-disc pl-5 text-danger-600">{result.problems.slice(0, 30).map((p, i) => <li key={`${p.row}-${i}`}>{C.importRow(p.row, p.message)}</li>)}</ul>
                {result.errorFile && <a className="mt-2 inline-block font-medium underline" href={dataUrl(result.errorFile)} download="finance-register-problems.csv">{C.importErrorFile}</a>}
              </>
            ) : <p>{C.importOk(result.valid)}</p>}
          {result.unknownColumns.length > 0 && <p className="mt-1 text-xs text-slate-500">{C.importUnknown(result.unknownColumns.join(", "))}</p>}
        </div>
      )}
    </section>
  );
}
