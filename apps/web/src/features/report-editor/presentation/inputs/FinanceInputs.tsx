"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { parseDelimited } from "@/lib/shared/delimited";
import {
  previewFinanceImportAction,
  savePeriodFinanceAction,
  verifyPeriodFinanceAction,
} from "@/lib/actions/reporting";
import type { FinanceImportPreviewShape, FinanceLineShape, PeriodFinanceShape } from "@/lib/actions/_schemas";

type Entry = "lines" | "totals";

const emptyLine = (): FinanceLineShape => ({ budgetLine: "", budget: "", expenditure: "", committed: "" });

/** Lines the user filled in, as the API expects them (blank rows dropped, empty committed omitted). */
function cleanLines(lines: FinanceLineShape[]): FinanceLineShape[] {
  return lines
    .filter((l) => l.budgetLine.trim() || l.budget.trim() || l.expenditure.trim())
    .map((l) => ({ budgetLine: l.budgetLine.trim(), budget: l.budget.trim(), expenditure: l.expenditure.trim(), ...(l.committed?.trim() ? { committed: l.committed.trim() } : {}) }));
}

/**
 * The Finance tab of the report inputs: budget and expenditure for the period,
 * typed in or imported from a pasted spreadsheet depending on the project's
 * setting. Nothing reaches the report until the figures are verified.
 */
export function FinanceInputs({
  periodId,
  projectId,
  initial,
  canEdit,
  canVerify,
  lockedReason,
}: {
  periodId: string;
  projectId: string;
  initial: PeriodFinanceShape;
  canEdit: boolean;
  canVerify: boolean;
  /** Why figures cannot be changed now (report under review, approved or submitted). */
  lockedReason?: string;
}) {
  const router = useRouter();
  const summary = initial.summary;
  const stored = summary?.figures;
  const [entry, setEntry] = useState<Entry>(stored && stored.lines.length === 0 ? "totals" : "lines");
  const [currency, setCurrency] = useState(summary?.view.currency ?? initial.defaultCurrency);
  const [lines, setLines] = useState<FinanceLineShape[]>(stored && stored.lines.length > 0 ? stored.lines.map((l) => ({ ...l, committed: l.committed ?? "" })) : [emptyLine()]);
  const [budget, setBudget] = useState(stored && stored.lines.length === 0 ? stored.budget : "");
  const [expenditure, setExpenditure] = useState(stored && stored.lines.length === 0 ? stored.expenditure : "");
  const [committed, setCommitted] = useState(stored && stored.lines.length === 0 ? stored.committed ?? "" : "");
  const [note, setNote] = useState(summary?.sourceNote ?? "");
  const [paste, setPaste] = useState("");
  const [preview, setPreview] = useState<FinanceImportPreviewShape | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const readOnly = !canEdit || Boolean(lockedReason);
  const rows = useMemo(() => parseDelimited(paste), [paste]);

  if (initial.mode === "DISABLED") {
    return (
      <section className="card max-w-2xl space-y-2">
        <h2 className="font-semibold">Financial figures are switched off</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Reports say that financial figures are reported separately. To put budget and expenditure in the report, turn this on in the project&rsquo;s reporting settings.
        </p>
        <Link className="btn-secondary inline-flex" href={`/projects/${projectId}/setup/profile`}>Open reporting settings</Link>
      </section>
    );
  }
  if (!initial.appliesToReportType) {
    return <p className="card max-w-2xl text-sm text-slate-600 dark:text-slate-300">This kind of report has no financial section, so there is nothing to enter here.</p>;
  }

  async function run<T>(work: () => Promise<{ ok: true; value: T } | { ok: false; error: { message: string } }>, done: (value: T) => string) {
    setBusy(true);
    setMessage(null);
    setFailure(null);
    const result = await work();
    setBusy(false);
    if (!result.ok) {
      setFailure(result.error.message);
      return;
    }
    setMessage(done(result.value));
    router.refresh();
  }

  const save = (payload: Record<string, unknown>) =>
    run(() => savePeriodFinanceAction(periodId, { currency: currency.trim().toUpperCase(), sourceNote: note.trim() || undefined, ...payload }), () => "Saved. The figures need to be verified before the report uses them.");

  function submitTyped(e: React.FormEvent) {
    e.preventDefault();
    if (entry === "lines") return save({ lines: cleanLines(lines) });
    return save({ budget, expenditure, ...(committed.trim() ? { committed } : {}) });
  }

  return (
    <div className="max-w-3xl space-y-4">
      {summary && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Figures for this period</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${summary.verified ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"}`}>
              {summary.verified ? "Verified" : "Not verified"}
            </span>
          </div>
          <dl className="grid gap-3 sm:grid-cols-4">
            {[
              ["Budget", summary.view.budget],
              ["Expenditure", summary.view.expenditure],
              ["Balance", summary.view.balance],
              ["Burn rate", summary.view.burnRatePercent === undefined ? "—" : `${summary.view.burnRatePercent}%`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{label}{label !== "Burn rate" ? ` (${summary.view.currency})` : ""}</dt>
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {summary.view.lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500 dark:text-slate-400">
                  <tr><th className="py-1 pr-3">Budget line</th><th className="pr-3">Budget</th><th className="pr-3">Expenditure</th><th className="pr-3">Balance</th><th>Burn rate</th></tr>
                </thead>
                <tbody>
                  {summary.view.lines.map((l) => (
                    <tr key={l.budgetLine} className="border-t border-slate-200 dark:border-white/10">
                      <td className="py-1 pr-3">{l.budgetLine}</td><td className="pr-3 tabular-nums">{l.budget}</td><td className="pr-3 tabular-nums">{l.expenditure}</td><td className="pr-3 tabular-nums">{l.balance}</td><td className="tabular-nums">{l.burnRatePercent === undefined ? "—" : `${l.burnRatePercent}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!summary.verified && (
            <p role="note" className="text-sm text-amber-900 dark:text-amber-200">
              These figures are not used in the report until they are verified.{canVerify ? "" : " Ask someone with approval rights to verify them."}
            </p>
          )}
          {!summary.verified && canVerify && !lockedReason && (
            <Button pending={busy} onClick={() => void run(() => verifyPeriodFinanceAction(periodId), () => "Verified. The financial section will now use these figures.")}>Verify these figures</Button>
          )}
        </section>
      )}

      {lockedReason && <p role="note" className="card text-sm text-amber-900 dark:text-amber-200">{lockedReason}</p>}

      {!readOnly && initial.mode === "TYPED" && (
        <form onSubmit={submitTyped} className="card space-y-4" noValidate>
          <h2 className="font-semibold">{summary ? "Change the figures" : "Enter the figures"}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Currency" htmlFor="financeCurrency" hint="3-letter code, e.g. USD">
              <Input id="financeCurrency" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <fieldset className="flex gap-4 text-sm" aria-label="How to enter the figures">
                <label className="flex items-center gap-2"><input type="radio" name="financeEntry" checked={entry === "lines"} onChange={() => setEntry("lines")} /> By budget line</label>
                <label className="flex items-center gap-2"><input type="radio" name="financeEntry" checked={entry === "totals"} onChange={() => setEntry("totals")} /> Totals only</label>
              </fieldset>
            </div>
          </div>
          {entry === "lines" ? (
            <div className="space-y-2">
              {lines.map((l, i) => {
                const update = (patch: Partial<FinanceLineShape>) => setLines((cur) => cur.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                    <Input aria-label={`Budget line ${i + 1}`} placeholder="Budget line (e.g. Staff)" value={l.budgetLine} onChange={(e) => update({ budgetLine: e.target.value })} />
                    <Input aria-label={`Budget ${i + 1}`} placeholder="Budget" inputMode="decimal" value={l.budget} onChange={(e) => update({ budget: e.target.value })} />
                    <Input aria-label={`Expenditure ${i + 1}`} placeholder="Spent" inputMode="decimal" value={l.expenditure} onChange={(e) => update({ expenditure: e.target.value })} />
                    <Input aria-label={`Committed ${i + 1}`} placeholder="Committed" inputMode="decimal" value={l.committed ?? ""} onChange={(e) => update({ committed: e.target.value })} />
                    <button type="button" className="text-xs text-danger-700 hover:underline dark:text-danger-400" onClick={() => setLines((cur) => (cur.length === 1 ? [emptyLine()] : cur.filter((_, j) => j !== i)))}>Remove</button>
                  </div>
                );
              })}
              <button type="button" className="text-sm text-brand-600 hover:underline dark:text-brand-400" onClick={() => setLines((cur) => [...cur, emptyLine()])}>+ Add budget line</button>
              <p className="text-xs text-slate-500 dark:text-slate-400">The totals are the sum of the lines.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Budget" htmlFor="financeBudget"><Input id="financeBudget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
              <Field label="Expenditure" htmlFor="financeExpenditure"><Input id="financeExpenditure" inputMode="decimal" value={expenditure} onChange={(e) => setExpenditure(e.target.value)} /></Field>
              <Field label="Committed (optional)" htmlFor="financeCommitted"><Input id="financeCommitted" inputMode="decimal" value={committed} onChange={(e) => setCommitted(e.target.value)} /></Field>
            </div>
          )}
          <Field label="Source note (optional)" htmlFor="financeNote" hint="Where the figures come from, e.g. “Finance ledger, 31 March”.">
            <Input id="financeNote" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex justify-end"><Button type="submit" pending={busy}>Save figures</Button></div>
        </form>
      )}

      {!readOnly && initial.mode === "IMPORT" && (
        <section className="card space-y-3">
          <h2 className="font-semibold">{summary ? "Replace the figures from a spreadsheet" : "Import the figures from a spreadsheet"}</h2>
          <Field label="Currency" htmlFor="financeCurrencyImport" hint="3-letter code, e.g. USD">
            <Input id="financeCurrencyImport" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)} className="max-w-[8rem]" />
          </Field>
          <Field label="Paste your budget lines" htmlFor="financePaste" hint="Columns: budget line, budget, expenditure, committed (optional). A header row is fine.">
            <Textarea id="financePaste" rows={6} value={paste} onChange={(e) => { setPaste(e.target.value); setPreview(null); }} placeholder={"Budget line\tBudget\tExpenditure\nStaff\t6,000\t2,000"} />
          </Field>
          <Button variant="secondary" pending={busy} disabled={rows.length === 0} onClick={() => void run(async () => { const r = await previewFinanceImportAction(periodId, rows); if (r.ok) setPreview(r.value); return r; }, (p) => `${p.readyCount} line(s) ready, ${p.errorCount} need attention.`)}>Preview</Button>
          {preview && (
            <div className="space-y-2 text-sm">
              <ul className="space-y-1">
                {preview.rows.map((r) => (
                  <li key={r.rowIndex} className={r.line ? "text-slate-700 dark:text-slate-200" : "text-danger-700 dark:text-danger-400"}>
                    Row {r.rowIndex}: {r.line ? `${r.line.budgetLine} · budget ${r.line.budget} · spent ${r.line.expenditure}${r.line.committed ? ` · committed ${r.line.committed}` : ""}` : r.error}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 dark:text-slate-400">Rows with problems are left out. Fix them in your spreadsheet and preview again if you need them.</p>
              <Button pending={busy} disabled={preview.readyCount === 0} onClick={() => void save({ lines: preview.rows.flatMap((r) => (r.line ? [r.line] : [])) })}>Use the {preview.readyCount} ready line(s)</Button>
            </div>
          )}
        </section>
      )}

      {failure && <p role="alert" className="text-sm font-medium text-danger-700 dark:text-danger-400">{failure}</p>}
      {message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
    </div>
  );
}
