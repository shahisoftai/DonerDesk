"use client";

import { useRouter } from "next/navigation";
import { addBudgetCategoryAction, addCurrencyRateAction, addFundingSourceAction, setFinanceCurrenciesAction, setSeparateApproverAction, updateFundingSourceAction } from "@/lib/actions/finance";
import { useActionState } from "@/lib/client/action-state";
import type { FundingSourceItem, RatesView } from "@/lib/server/schemas-finance";
import { FINANCE_COPY as C } from "../domain/finance-copy";
import { EntryForm } from "./EntryForm";

type Category = { id: string; code: string; label: string; archived: boolean };

/** The lists and rates every project's finance uses: funding sources, reporting currencies, dated exchange rates and the organisation's own budget categories. */
export function FinanceSettingsPanel({ sources, rates, categories, canEdit, today }: { sources: FundingSourceItem[]; rates: RatesView; categories: Category[]; canEdit: boolean; today: string }) {
  const router = useRouter();
  const toggle = useActionState();
  const flip = async (id: string, patch: { ownFunding?: boolean; archived?: boolean }) => { if (await toggle.run(() => updateFundingSourceAction(id, patch))) router.refresh(); };
  const ordered = [...rates.rates].sort((a, b) => (a.effectiveOn < b.effectiveOn ? 1 : a.effectiveOn > b.effectiveOn ? -1 : 0));
  return (
    <div className="space-y-10">
      <section aria-labelledby="set-currencies" className="space-y-2">
        <h2 id="set-currencies" className="text-base font-semibold">{C.currenciesTitle}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{C.primaryCurrency}: <strong>{rates.primaryCurrency}</strong>{rates.localCurrency ? <> · {C.localCurrency.replace(" (optional)", "")}: <strong>{rates.localCurrency}</strong></> : null}</p>
        {canEdit && (
          <EntryForm title={C.currenciesTitle} submit={C.saveCurrencies}
            fields={[{ name: "primaryCurrency", label: C.primaryCurrency, kind: "currency", required: true, initial: rates.primaryCurrency }, { name: "localCurrency", label: C.localCurrency, kind: "currency", initial: rates.localCurrency ?? "" }]}
            onSubmit={(v) => setFinanceCurrenciesAction(v)} />
        )}
      </section>

      <section aria-labelledby="set-approval" className="space-y-2">
        <h2 id="set-approval" className="text-base font-semibold">{C.approvalTitle}</h2>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">{C.approvalIntro}</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={rates.separateApprover} disabled={!canEdit || toggle.busy} onChange={async (e) => { if (await toggle.run(() => setSeparateApproverAction({ on: e.target.checked }))) router.refresh(); }} />
          {C.approvalLabel}
        </label>
        {toggle.error && <p role="alert" className="text-sm text-danger-600">{toggle.error}</p>}
      </section>

      <section aria-labelledby="set-sources" className="space-y-2">
        <h2 id="set-sources" className="text-base font-semibold">{C.sourcesTitle}</h2>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">{C.sourcesIntro}</p>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm dark:divide-white/10 dark:border-white/10">
          {sources.length === 0 && <li className="p-3 text-slate-500">{C.none}</li>}
          {sources.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span className={s.archived ? "text-slate-400 line-through" : ""}>{s.name} <span className="ms-2 text-xs text-slate-500">{s.ownFunding ? C.fundingOwn : C.fundingNotOwn}</span></span>
              {canEdit && (
                <span className="flex gap-3">
                  <button type="button" className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300" disabled={toggle.busy} onClick={() => void flip(s.id, { ownFunding: !s.ownFunding })}>{s.ownFunding ? C.fundingNotOwn : C.fundingOwn}</button>
                  <button type="button" className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50 dark:text-brand-300" disabled={toggle.busy} onClick={() => void flip(s.id, { archived: !s.archived })}>{s.archived ? C.restore : C.archive}</button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {toggle.error && <p role="alert" className="text-sm text-danger-600">{toggle.error}</p>}
        {canEdit && (
          <EntryForm title={C.addSource} submit={C.addSource}
            fields={[{ name: "name", label: C.sourceName, kind: "text", required: true }, { name: "ownFunding", label: C.sourceOwn, kind: "select", initial: "true", options: [{ value: "true", label: C.fundingOwn }, { value: "false", label: C.fundingNotOwn }] }]}
            onSubmit={(v) => addFundingSourceAction({ name: v.name, ownFunding: v.ownFunding !== "false" })} />
        )}
      </section>

      <section aria-labelledby="set-rates" className="space-y-2">
        <h2 id="set-rates" className="text-base font-semibold">{C.ratesTitle}</h2>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">{C.ratesIntro}</p>
        {ordered.length === 0 ? <p className="text-sm text-slate-500">{C.ratesEmpty}</p> : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
            <table className="w-full min-w-[480px] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-2">{C.rateDay}</th><th className="px-3 py-2">{C.rateFrom}</th><th className="px-3 py-2">{C.rateTo}</th><th className="px-3 py-2">{C.rate.split(" ")[0]}</th><th className="px-3 py-2">{C.rateSource}</th></tr></thead>
              <tbody>{ordered.map((r) => <tr key={r.id} className="border-t border-slate-200 dark:border-white/10"><td className="px-3 py-2">{r.effectiveOn}</td><td className="px-3 py-2">{r.from}</td><td className="px-3 py-2">{r.to}</td><td className="px-3 py-2 tabular-nums">{r.rate}</td><td className="px-3 py-2 text-xs text-slate-500">{r.source}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {canEdit && (
          <EntryForm title={C.addRate} submit={C.addRate}
            fields={[
              { name: "from", label: C.rateFrom, kind: "currency", required: true }, { name: "to", label: C.rateTo, kind: "currency", required: true, initial: rates.primaryCurrency },
              { name: "rate", label: C.rate, kind: "text", required: true, hint: "For example 1.0850" }, { name: "effectiveOn", label: C.rateDay, kind: "date", required: true, initial: today },
              { name: "source", label: C.rateSource, kind: "text" },
            ]}
            onSubmit={(v) => addCurrencyRateAction(v)} />
        )}
      </section>

      <section aria-labelledby="set-categories" className="space-y-2">
        <h2 id="set-categories" className="text-base font-semibold">{C.categoriesTitle}</h2>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">{C.categoriesIntro}</p>
        <ul className="text-sm">{categories.length === 0 ? <li className="text-slate-500">{C.none}</li> : categories.map((c) => <li key={c.id}><span className="font-medium">{c.code}</span> {c.label}</li>)}</ul>
        {canEdit && <EntryForm title={C.addCategory} submit={C.addCategory} fields={[{ name: "code", label: C.categoryCode, kind: "text", required: true }, { name: "label", label: C.categoryLabel, kind: "text", required: true }]} onSubmit={(v) => addBudgetCategoryAction(v)} />}
      </section>
    </div>
  );
}
