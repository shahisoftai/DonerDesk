import type { PortfolioFinance } from "@/lib/server/schemas-finance";
import { FINANCE_COPY as C } from "../domain/finance-copy";
import { formatMoneyList, formatPrimary } from "../domain/finance-view";

/** Obligated, received and spent across the projects a person can see: per currency, own funding only, a reporting-currency line only when every amount has a rate. */
export function HomeFinance({ f }: { f: PortfolioFinance }) {
  const nothing = f.index.obligated.length === 0 && f.index.spent.length === 0 && f.index.disbursed.length === 0;
  if (nothing && f.awaitingApproval === 0) return null;
  const cells = [
    { label: C.obligated, list: f.index.obligated, primary: f.inPrimary.obligated },
    { label: C.disbursed, list: f.index.disbursed, primary: f.inPrimary.disbursed },
    { label: C.spent, list: f.index.spent, primary: f.inPrimary.spent },
  ];
  return (
    <section aria-labelledby="home-finance" className="space-y-2">
      <h2 id="home-finance" className="text-sm font-semibold">{C.homeTitle}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {cells.map((c) => {
          const p = formatPrimary(c.primary, f.primaryCurrency);
          const mixed = c.list.some((m) => m.currency !== f.primaryCurrency);
          return (
            <div key={c.label} className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="mt-1 break-words text-lg font-semibold tabular-nums">{formatMoneyList(c.list)}</p>
              {mixed && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{C.inPrimary(f.primaryCurrency)}: <span className={p.hint ? "font-medium text-amber-700 dark:text-amber-300" : "tabular-nums"}>{p.text}</span></p>}
              {mixed && p.hint && <p className="mt-1 text-xs text-slate-500">{p.hint}</p>}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">{C.homeCoverage(f.projectsWithFunding, f.projects)}{f.awaitingApproval > 0 ? ` ${C.homeWaiting(f.awaitingApproval)}` : ""}</p>
    </section>
  );
}
