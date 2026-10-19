"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMinor } from "@donordesk/domain/contexts/workplan/index.js";
import type { PlanItemBudget as BudgetView } from "@/lib/server/schemas";
import { addBudgetExpenseAction, addBudgetLineAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { useHydrated } from "@/lib/client/use-hydrated";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { BUDGET_CATEGORY_WORDS, BUDGET_STATE_WORDS, spentBarPercent } from "../domain/budget-view";

const CATEGORIES = Object.keys(BUDGET_CATEGORY_WORDS) as Array<keyof typeof BUDGET_CATEGORY_WORDS>;

/**
 * The money for one planned activity (phase 28.1-D): each line, what is spent, and where it stands. A line with no budget
 * says so. An overspend is flagged, never blocked. Managers add lines; the lead or a manager books expenses.
 */
export function PlanItemBudget({ itemId, lines, canManage, canSpend, today }: { itemId: string; lines: BudgetView["items"]; canManage: boolean; canSpend: boolean; today: string }) {
  const router = useRouter();
  const state = useActionState();
  const hydrated = useHydrated();
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("TRAVEL");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [donorName, setDonorName] = useState("");
  const [expenseFor, setExpenseFor] = useState<string | null>(null);
  const [expDate, setExpDate] = useState(today);
  const [expAmount, setExpAmount] = useState("");
  const [expNote, setExpNote] = useState("");

  async function addLine() {
    const done = await state.run(() => addBudgetLineAction(itemId, { code, category, currency, amount, ...(donorName.trim() ? { donorName } : {}) }));
    if (done) { setCode(""); setAmount(""); setDonorName(""); router.refresh(); }
  }

  async function addExpense(lineId: string) {
    const done = await state.run(() => addBudgetExpenseAction(itemId, lineId, { date: expDate, amount: expAmount, ...(expNote.trim() ? { description: expNote } : {}) }));
    if (done) { setExpenseFor(null); setExpAmount(""); setExpNote(""); router.refresh(); }
  }

  if (lines.length === 0 && !canManage) return null;
  return (
    <section aria-labelledby="budget-title" className="space-y-3">
      <h2 id="budget-title" className="text-sm font-semibold">Budget</h2>
      {lines.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">No budget lines yet.</p>}
      {lines.map((l) => {
        const p = l.position;
        const money = (minor: number | null) => (minor === null ? "No budget set" : formatMinor(minor, l.currency));
        return (
          <article key={l.id} className="card space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm"><span className="font-mono text-slate-500">{l.code}</span> · {BUDGET_CATEGORY_WORDS[l.category]}{l.donorName ? ` · ${l.donorName}` : ""}</p>
              <p className={`text-sm font-medium ${p.overspent ? "text-danger-600" : ""}`}>{BUDGET_STATE_WORDS[p.state]}</p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>Budget <b className="font-mono">{money(p.budgetedMinor)}</b></span>
              <span>Spent <b className="font-mono">{money(p.spentMinor)}</b></span>
              {p.remainingMinor !== null && <span>{p.overspent ? "Over by" : "Left"} <b className="font-mono">{money(Math.abs(p.remainingMinor))}</b></span>}
            </div>
            {p.budgetedMinor !== null && (
              <div className="h-2 w-full overflow-hidden rounded bg-slate-200 dark:bg-white/10" role="img" aria-label={`${p.spentPercent ?? 0}% spent`}>
                <div className={`h-full ${p.overspent ? "bg-danger-600" : "bg-brand-600"}`} style={{ width: `${spentBarPercent(p.spentPercent)}%` }} />
              </div>
            )}
            {l.description && <p className="text-xs text-slate-500">{l.description}</p>}
            {l.expenses.length > 0 && (
              <ul className="space-y-1 text-sm">
                {l.expenses.map((e) => (
                  <li key={e.id} className="flex flex-wrap justify-between gap-2"><span>{e.date} {e.description && `· ${e.description}`}</span><span className="font-mono">{formatMinor(e.amountMinor, l.currency)}</span></li>
                ))}
              </ul>
            )}
            {canSpend && expenseFor !== l.id && <Button size="sm" variant="secondary" onClick={() => { setExpenseFor(l.id); setExpDate(today); }}>Add an expense</Button>}
            {canSpend && expenseFor === l.id && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
                <div className="space-y-1"><label htmlFor={`exp-date-${l.id}`} className="block text-xs">Date</label><Input id={`exp-date-${l.id}`} type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} /></div>
                <div className="space-y-1"><label htmlFor={`exp-amt-${l.id}`} className="block text-xs">Amount ({l.currency})</label><Input id={`exp-amt-${l.id}`} inputMode="decimal" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="e.g. 150" /></div>
                <div className="space-y-1"><label htmlFor={`exp-note-${l.id}`} className="block text-xs">What it was for</label><Input id={`exp-note-${l.id}`} value={expNote} onChange={(e) => setExpNote(e.target.value)} /></div>
                <div className="flex gap-2"><Button size="sm" onClick={() => addExpense(l.id)} pending={state.busy} disabled={!hydrated || !expAmount.trim()}>Save</Button><Button size="sm" variant="secondary" onClick={() => setExpenseFor(null)}>Cancel</Button></div>
              </div>
            )}
          </article>
        );
      })}
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}

      {canManage && (
        <details className="max-w-2xl rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <summary className="cursor-pointer text-sm font-medium">Add a budget line</summary>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1"><label htmlFor="bl-code" className="block text-sm">Code</label><Input id="bl-code" value={code} maxLength={30} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 2.1-T" /></div>
            <div className="space-y-1"><label htmlFor="bl-cat" className="block text-sm">Cost category</label>
              <Select id="bl-cat" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>{CATEGORIES.map((c) => <option key={c} value={c}>{BUDGET_CATEGORY_WORDS[c]}</option>)}</Select></div>
            <div className="space-y-1"><label htmlFor="bl-amount" className="block text-sm">Budget amount</label><Input id="bl-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1200 or 12.50" /></div>
            <div className="space-y-1"><label htmlFor="bl-cur" className="block text-sm">Currency</label><Input id="bl-cur" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></div>
            <div className="space-y-1 sm:col-span-2"><label htmlFor="bl-donor" className="block text-sm">Donor (optional)</label><Input id="bl-donor" value={donorName} onChange={(e) => setDonorName(e.target.value)} /></div>
            <div className="sm:col-span-2"><Button size="sm" onClick={addLine} pending={state.busy} disabled={!hydrated || !code.trim() || !amount.trim()}>Add the line</Button></div>
          </div>
        </details>
      )}
    </section>
  );
}
