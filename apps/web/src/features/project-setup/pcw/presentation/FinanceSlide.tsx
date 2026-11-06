"use client";

import { useState, useTransition } from "react";
import { changeFinanceAction, editDraftAction, getDraftAction } from "@/lib/actions/project-setup-draft";
import { editSetupItemAction } from "@/lib/actions/project-setup";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import { usePcwCopy } from "./usePcwCopy";
import { SUPPORT, activityChoices, currencyNote, money, suggestedCurrency, suggestionFor, targetLabel } from "../domain/finance-view";
import { notUsedAnswer } from "../domain/pcw-view";
import { NotUsedToggle } from "./NotUsedToggle";
import { AcceptAllWaiting } from "./AcceptAllWaiting";
import { OriginBadge } from "./OriginBadge";

type Work = () => Promise<{ ok: true; value: SetupDraftView } | { ok: false; error: { message: string } }>;

/**
 * Slide 9: funding, the budget placed on the planned activities (or marked a cost of the whole project), the currency the
 * project reports in, and who approves spending. Funding and budget are set side by side so a difference is seen, and
 * accepted by a person, before launch. A project that does not track money here says so and the slide is done.
 */
export function FinanceSlide({ id, view, onView }: { id: string; view: SetupDraftView; onView: (v: SetupDraftView) => void }) {
  const pcw = usePcwCopy();
  const PCW_COPY = pcw.c;
  const c = PCW_COPY.finance;
  const off = notUsedAnswer(view, "finance.funding").notUsed;
  const fin = view.extras.finance;
  const activities = activityChoices(view);
  const sum = view.financeSummary;
  const [fund, setFund] = useState({ source: "", amount: "", currency: suggestedCurrency(view) });
  const [line, setLine] = useState({ category: "", amount: "", currency: suggestedCurrency(view) });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (work: Work) => startTransition(async () => { const r = await work(); if (r.ok) { setError(null); onView(r.value); } else setError(r.error.message); });
  const change = (op: unknown) => run(() => changeFinanceAction(id, op));
  const decide = (area: "FUNDING_BUDGET", path: string, op: "ACCEPT" | "REJECT") =>
    startTransition(async () => {
      const r = await editSetupItemAction(id, { area, path, op });
      if (!r.ok) return setError(r.error.message);
      const fresh = await getDraftAction(id);
      if (fresh.ok) { setError(null); onView(fresh.value); } else setError(fresh.error.message);
    });
  const setFinance = (patch: Record<string, unknown>) => run(() => editDraftAction(id, { kind: "SET_FINANCE", patch }));
  const place = (budgetKey: string, target: string) => target && setFinance({ budgetPlan: { ...fin.budgetPlan, [budgetKey]: target } });

  if (off) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm text-slate-700 dark:text-slate-200">{c.useFinance}: no.</p>
        <NotUsedToggle id={id} view={view} requirement="finance.funding" onView={onView} />
        {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AcceptAllWaiting id={id} area="FUNDING_BUDGET" items={[...view.funding, ...view.budget]} onView={onView} onError={setError} />
      <section aria-labelledby="pcw-funding" className="space-y-3">
        <h2 id="pcw-funding" className="text-lg font-semibold">{c.fundingTitle}</h2>
        {view.funding.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{c.noFunding}</p> : (
          <ul className="space-y-1">
            {view.funding.map((f) => (
              <li key={f.path} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
                <input key={`s-${f.value.sourceName}`} aria-label={c.source} defaultValue={f.value.sourceName ?? ""} className="min-w-[10rem] flex-1 bg-transparent font-medium outline-none focus:underline" onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== f.value.sourceName && change({ kind: "EDIT_FUNDING", path: f.path, patch: { sourceName: e.target.value } })} />
                <input key={`a-${f.value.amount}`} aria-label={c.amount} inputMode="decimal" defaultValue={f.value.amount ?? ""} className="w-32 bg-transparent text-end outline-none focus:underline" onBlur={(e) => e.target.value.trim() !== (f.value.amount ?? "") && change({ kind: "EDIT_FUNDING", path: f.path, patch: { amount: e.target.value } })} />
                <input key={`c-${f.value.currency}`} aria-label={c.currency} defaultValue={f.value.currency ?? ""} maxLength={3} className="w-14 bg-transparent uppercase outline-none focus:underline" onBlur={(e) => e.target.value.trim().toUpperCase() !== (f.value.currency ?? "") && change({ kind: "EDIT_FUNDING", path: f.path, patch: { currency: e.target.value } })} />
                <OriginBadge origin={f.origin} />
                {f.status === "PROPOSED" ? <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide("FUNDING_BUDGET", f.path, "ACCEPT")}>{PCW_COPY.places.accept}</button> : null}
                <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide("FUNDING_BUDGET", f.path, "REJECT")} aria-label={`${PCW_COPY.results.remove} ${f.value.sourceName ?? ""}`}>{PCW_COPY.results.remove}</button>
              </li>
            ))}
          </ul>
        )}
        <fieldset className="grid gap-3 rounded-xl border border-dashed border-slate-300 p-4 sm:grid-cols-4 dark:border-white/20">
          <legend className="px-1 text-sm font-semibold">{c.addFunding}</legend>
          <Field label={c.source}><Input value={fund.source} onChange={(e) => setFund({ ...fund, source: e.target.value })} /></Field>
          <Field label={c.amount}><Input inputMode="decimal" value={fund.amount} onChange={(e) => setFund({ ...fund, amount: e.target.value })} /></Field>
          <Field label={c.currency}><Input maxLength={3} value={fund.currency} onChange={(e) => setFund({ ...fund, currency: e.target.value })} /></Field>
          <div className="self-end"><button type="button" className="btn" disabled={pending || !fund.source.trim()} onClick={() => { change({ kind: "ADD_FUNDING", sourceName: fund.source, amount: fund.amount, currency: fund.currency }); setFund({ ...fund, source: "", amount: "" }); }}>{c.addFunding}</button></div>
        </fieldset>
      </section>

      <section aria-labelledby="pcw-budget" className="space-y-3">
        <h2 id="pcw-budget" className="text-lg font-semibold">{c.budgetTitle}</h2>
        {view.budget.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{c.noBudget}</p> : (
          <ul className="space-y-2">
            {view.budget.map((b) => {
              const suggestion = suggestionFor(view, b.budgetKey);
              const target = fin.budgetPlan[b.budgetKey] ?? "";
              return (
                <li key={b.path} className="space-y-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <input key={`k-${b.value.category}`} aria-label={c.category} defaultValue={b.value.category ?? ""} className="min-w-[10rem] flex-1 bg-transparent font-medium outline-none focus:underline" onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== b.value.category && change({ kind: "EDIT_BUDGET", path: b.path, patch: { category: e.target.value } })} />
                    <input key={`m-${b.value.amount}`} aria-label={c.amount} inputMode="decimal" defaultValue={b.value.amount ?? ""} className="w-28 bg-transparent text-end outline-none focus:underline" onBlur={(e) => e.target.value.trim() !== (b.value.amount ?? "") && change({ kind: "EDIT_BUDGET", path: b.path, patch: { amount: e.target.value } })} />
                    <input key={`u-${b.value.currency}`} aria-label={c.currency} maxLength={3} defaultValue={b.value.currency ?? ""} className="w-14 bg-transparent uppercase outline-none focus:underline" onBlur={(e) => e.target.value.trim().toUpperCase() !== (b.value.currency ?? "") && change({ kind: "EDIT_BUDGET", path: b.path, patch: { currency: e.target.value } })} />
                    {b.value.kind === "TOTAL" ? <span className="text-xs text-slate-500">{c.statedTotal}</span> : (
                    <Select aria-label={c.goesWith} className="!w-auto max-w-[16rem]" value={target} onChange={(e) => place(b.budgetKey, e.target.value)}>
                      <option value="">{c.choose}</option>
                      <option value={SUPPORT}>{c.supportCost}</option>
                      {activities.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                    </Select>
                    )}
                    <OriginBadge origin={b.origin} />
                    {b.status === "PROPOSED" ? <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide("FUNDING_BUDGET", b.path, "ACCEPT")}>{PCW_COPY.places.accept}</button> : null}
                    <button type="button" className="btn-secondary" disabled={pending} onClick={() => decide("FUNDING_BUDGET", b.path, "REJECT")} aria-label={`${PCW_COPY.results.remove} ${b.value.category ?? ""}`}>{PCW_COPY.results.remove}</button>
                  </div>
                  {suggestion ? (
                    <p className="text-slate-600 dark:text-slate-300">
                      {c.suggested}: <strong>{targetLabel(view, suggestion.target, c.supportCost)}</strong> ({suggestion.reason}){" "}
                      <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => editDraftAction(id, { kind: "ACCEPT_BUDGET_SUGGESTIONS", ids: [suggestion.id] }))}>{c.useOne}</button>{" "}
                      <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => editDraftAction(id, { kind: "REJECT_SUGGESTION", id: suggestion.id }))}>{c.notThis}</button>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {view.budgetSuggestions.length > 1 ? <button type="button" className="btn" disabled={pending} onClick={() => run(() => editDraftAction(id, { kind: "ACCEPT_BUDGET_SUGGESTIONS", ids: view.budgetSuggestions.map((s) => s.id) }))}>{c.useAll(view.budgetSuggestions.length)}</button> : null}
        <fieldset className="grid gap-3 rounded-xl border border-dashed border-slate-300 p-4 sm:grid-cols-4 dark:border-white/20">
          <legend className="px-1 text-sm font-semibold">{c.addBudget}</legend>
          <Field label={c.category}><Input value={line.category} onChange={(e) => setLine({ ...line, category: e.target.value })} /></Field>
          <Field label={c.amount}><Input inputMode="decimal" value={line.amount} onChange={(e) => setLine({ ...line, amount: e.target.value })} /></Field>
          <Field label={c.currency}><Input maxLength={3} value={line.currency} onChange={(e) => setLine({ ...line, currency: e.target.value })} /></Field>
          <div className="self-end"><button type="button" className="btn" disabled={pending || !line.category.trim()} onClick={() => { change({ kind: "ADD_BUDGET", category: line.category, amount: line.amount, currency: line.currency }); setLine({ ...line, category: "", amount: "" }); }}>{c.addBudget}</button></div>
        </fieldset>
      </section>

      <section aria-labelledby="pcw-sum" className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm dark:border-white/10">
        <h2 id="pcw-sum" className="text-lg font-semibold">{c.summaryTitle}</h2>
        <p>{c.fundingTotal}: {sum.funding.length === 0 ? "—" : sum.funding.map((t) => `${money(t.total)} ${t.currency}`).join(" · ")}</p>
        <p>{c.budgetTotal}: {sum.budget.length === 0 ? "—" : sum.budget.map((t) => `${money(t.total)} ${t.currency}`).join(" · ")}</p>
        {sum.differences.map((d) => <p key={d.currency} role="status" className="font-medium">{c.differs(d.currency, money(d.funding), money(d.budget))}</p>)}
        {sum.statedTotalMismatch ? <p role="status" className="font-medium">{c.stated}</p> : null}
        {sum.differences.length === 0 && !sum.statedTotalMismatch && sum.funding.length > 0 && sum.budget.length > 0 ? <p role="status">{c.agree}</p> : null}
        {sum.unreadable > 0 ? <p>{c.unreadable(sum.unreadable)}</p> : null}
        {currencyNote(view) ? <p className="text-slate-600 dark:text-slate-300">{c.otherCurrencies}</p> : null}
        {sum.differences.length > 0 || sum.statedTotalMismatch ? (
          <label className="flex items-center gap-2"><Checkbox checked={fin.differenceAcknowledged} onChange={(e) => setFinance({ differenceAcknowledged: e.target.checked })} /> {c.acknowledge}</label>
        ) : null}
      </section>

      <section aria-labelledby="pcw-spend" className="grid gap-4 sm:grid-cols-2">
        <h2 id="pcw-spend" className="text-lg font-semibold sm:col-span-2">{c.approvalTitle}</h2>
        <Field label={c.reportingCurrency}>
          <Input key={`rc-${fin.reportingCurrency}`} maxLength={3} defaultValue={fin.reportingCurrency ?? ""} onBlur={(e) => { const v = e.target.value.trim().toUpperCase(); if (v && v !== fin.reportingCurrency) setFinance({ reportingCurrency: v }); }} />
        </Field>
        <div className="self-end">
          {/* Offered, never filled in silently: it is saved only when the person chooses it. */}
          {!fin.reportingCurrency && suggestedCurrency(view) ? <button type="button" className="btn-secondary" onClick={() => setFinance({ reportingCurrency: suggestedCurrency(view) })}>{c.useCurrency(suggestedCurrency(view))}</button> : null}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">{c.rolesNote}</p>
      </section>

      <NotUsedToggle id={id} view={view} requirement="finance.funding" onView={onView} />
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
