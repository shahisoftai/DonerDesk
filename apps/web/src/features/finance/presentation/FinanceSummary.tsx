import type { ProjectFinance } from "@/lib/server/schemas-finance";
import { FINANCE_COPY as C } from "../domain/finance-copy";
import { formatMoneyList, formatPrimary } from "../domain/finance-view";

/** The headline figures. Each currency stays on its own; a total in the reporting currency appears only when every amount has a dated rate. */
export function FinanceSummary({ f }: { f: ProjectFinance }) {
  const cells: Array<{ label: string; hint: string; list: ProjectFinance["index"]["obligated"]; primary?: ProjectFinance["inPrimary"]["obligated"] }> = [
    { label: C.obligated, hint: C.obligatedHint, list: f.index.obligated, primary: f.inPrimary.obligated },
    { label: C.disbursed, hint: C.disbursedHint, list: f.index.disbursed, primary: f.inPrimary.disbursed },
    { label: C.remaining, hint: "", list: f.index.remaining },
    { label: C.spent, hint: C.spentHint, list: f.index.spent, primary: f.inPrimary.spent },
  ];
  const extras = [
    { label: C.pending, list: f.totals.pending }, { label: C.outstanding, list: f.totals.outstandingAdvances }, { label: C.otherFunding, list: f.index.otherFunding },
  ].filter((e) => e.list.length > 0);
  return (
    <section aria-labelledby="fin-summary" className="space-y-3">
      <h2 id="fin-summary" className="text-base font-semibold">{C.summaryTitle}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cells.map((c) => {
          const p = c.primary && f.index && f.primaryCurrency ? formatPrimary(c.primary, f.primaryCurrency) : null;
          const showPrimary = p && c.list.some((m) => m.currency !== f.primaryCurrency);
          return (
            <div key={c.label} className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="mt-1 break-words text-lg font-semibold tabular-nums">{formatMoneyList(c.list)}</p>
              {showPrimary && p && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{C.inPrimary(f.primaryCurrency)}: <span className={p.hint ? "font-medium text-amber-700 dark:text-amber-300" : "tabular-nums"}>{p.text}</span></p>}
              {showPrimary && p?.hint && <p className="mt-1 text-xs text-slate-500">{p.hint}</p>}
              {c.hint && <p className="mt-1 text-xs text-slate-500">{c.hint}</p>}
            </div>
          );
        })}
      </div>
      {extras.length > 0 && (
        <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
          {extras.map((e) => <div key={e.label}><dt className="inline text-slate-500">{e.label}: </dt><dd className="inline tabular-nums">{formatMoneyList(e.list)}</dd></div>)}
        </dl>
      )}
    </section>
  );
}
