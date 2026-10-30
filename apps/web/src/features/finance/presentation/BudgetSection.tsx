import type { ProjectFinance } from "@/lib/server/schemas-finance";
import { FINANCE_COPY as C } from "../domain/finance-copy";
import { burnSentence, formatMoney } from "../domain/finance-view";

/** Budget lines against what was spent on them (approved expenses in the line's own currency), and spending set beside time elapsed: no projection is made. */
export function BudgetSection({ f }: { f: ProjectFinance }) {
  return (
    <section aria-labelledby="fin-budget" className="space-y-3">
      <h2 id="fin-budget" className="text-base font-semibold">{C.budgetTitle}</h2>
      {f.burn && (
        <div className="card text-sm" aria-label={C.burnTitle}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Bar label={C.burnSpent} percent={f.burn.spentPercent} />
            <Bar label={C.burnTime} percent={f.burn.timeElapsedPercent} />
          </div>
          <p className="mt-2 text-slate-600 dark:text-slate-300">{burnSentence(f.burn.gapPoints)}</p>
        </div>
      )}
      {!f.burn && <p className="text-sm text-slate-500">{C.burnNone}</p>}
      {f.budgetLines.length === 0 ? <p className="text-sm text-slate-500">{C.budgetEmpty}</p> : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-2">{C.line}</th><th className="px-3 py-2">{C.budget}</th><th className="px-3 py-2">{C.spent}</th><th className="px-3 py-2">{C.remainingLine}</th></tr></thead>
            <tbody>
              {f.budgetLines.map((l) => (
                <tr key={l.lineId} className="border-t border-slate-200 dark:border-white/10">
                  <td className="px-3 py-2"><span className="font-medium">{l.code}</span> {l.description && <span className="text-slate-500">{l.description}</span>}
                    {l.otherCurrencySpent > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">{C.otherCurrencySpent(l.otherCurrencySpent)}</p>}</td>
                  <td className="px-3 py-2 tabular-nums">{l.budget.minor > 0 ? formatMoney(l.budget) : C.noBudget}</td>
                  <td className="px-3 py-2 tabular-nums">{formatMoney({ minor: l.spentMinor, currency: l.budget.currency })}{l.spentPercent !== null && <span className="ms-1 text-xs text-slate-500">({l.spentPercent}%)</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{formatMoney({ minor: l.remainingMinor, currency: l.budget.currency })}{l.overspent && <span className="ms-2 rounded bg-danger-50 px-1.5 py-0.5 text-xs font-medium text-danger-700 dark:bg-danger-500/10 dark:text-danger-300">{C.overspent}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Bar({ label, percent }: { label: string; percent: number | null }) {
  return (
    <div>
      <div className="flex justify-between text-xs"><span>{label}</span><span className="tabular-nums">{percent === null ? "—" : `${percent}%`}</span></div>
      <div className="mt-1 h-2 rounded bg-slate-200 dark:bg-white/10" role="img" aria-label={`${label}: ${percent === null ? "not available" : `${percent}%`}`}>
        {percent !== null && <div className="h-2 rounded bg-brand-600" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />}
      </div>
    </div>
  );
}
