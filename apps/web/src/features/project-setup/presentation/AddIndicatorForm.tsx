"use client";

import { useState } from "react";
import type { ResultOption } from "../domain/review-state";
import type { IndicatorFieldKey } from "../copy";
import { useSetupCopy } from "./useSetupCopy";

const TEXT_FIELDS: readonly IndicatorFieldKey[] = ["unit", "baseline", "target", "frequency", "meansOfVerification"];
const TYPES = ["NUMBER", "PERCENTAGE", "RATIO", "CURRENCY"] as const;

/** An indicator the documents do not list, typed by a person under the result it measures (it is their own entry). */
export function AddIndicatorForm({ results, disabled, onAdd }: {
  results: ReadonlyArray<ResultOption>; disabled: boolean; onAdd: (value: Record<string, string | null>) => Promise<boolean>;
}) {
  const { c } = useSetupCopy();
  const rv = c.review;
  const empty = { title: "", code: "", result: "", type: "", unit: "", baseline: "", target: "", frequency: "", meansOfVerification: "" };
  const [form, setForm] = useState<Record<IndicatorFieldKey, string>>(empty);
  const set = (key: IndicatorFieldKey) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const nul = (v: string) => (v.trim() ? v.trim() : null);
  const submit = async () => {
    const done = await onAdd({
      title: nul(form.title), code: nul(form.code), logframeCode: nul(form.result), type: nul(form.type),
      unit: nul(form.unit), baseline: nul(form.baseline), target: nul(form.target), frequency: nul(form.frequency), meansOfVerification: nul(form.meansOfVerification),
    });
    if (done) setForm(empty);
  };
  return (
    <details className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900 dark:text-slate-100">＋ {rv.addIndicatorOpen}</summary>
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{rv.addIndicatorLead}</p>
      <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className="flex flex-col gap-1 text-xs sm:col-span-2" htmlFor="add-ind-title">
          <span>{rv.indicatorFields.title}</span>
          <input id="add-ind-title" className="input" required value={form.title} onChange={set("title")} />
        </label>
        <label className="flex flex-col gap-1 text-xs" htmlFor="add-ind-result">
          <span>{rv.indicatorFields.result}</span>
          <select id="add-ind-result" className="input" value={form.result} onChange={set("result")}>
            <option value="">{rv.noResult}</option>
            {results.map((o) => <option key={o.code} value={o.code}>{`${rv.levels[o.level] ?? o.level} ${o.code} · ${o.title}`.slice(0, 90)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" htmlFor="add-ind-type">
          <span>{rv.indicatorFields.type}</span>
          <select id="add-ind-type" className="input" value={form.type} onChange={set("type")}>
            <option value="">{rv.anyType}</option>
            {TYPES.map((t) => <option key={t} value={t}>{rv.indicatorTypes[t]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" htmlFor="add-ind-code">
          <span>{rv.indicatorFields.code}</span>
          <input id="add-ind-code" className="input" value={form.code} onChange={set("code")} />
        </label>
        {TEXT_FIELDS.map((key) => (
          <label key={key} className="flex flex-col gap-1 text-xs" htmlFor={`add-ind-${key}`}>
            <span>{rv.indicatorFields[key]}</span>
            <input id={`add-ind-${key}`} className="input" value={form[key]} onChange={set(key)} />
          </label>
        ))}
        <div className="sm:col-span-2"><button type="submit" className="btn" disabled={disabled || !form.title.trim()}>{rv.addIndicatorButton}</button></div>
      </form>
    </details>
  );
}
