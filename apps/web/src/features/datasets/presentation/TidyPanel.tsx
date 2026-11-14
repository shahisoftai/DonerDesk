"use client";

import { useState } from "react";
import { COLUMN_KINDS, type TidyStep } from "@donordesk/domain/contexts/datasets/browser.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { stepId } from "../domain/wizard";
import type { CheckResult } from "../domain/types";

const ADDABLE = ["KEEP_ROWS_WHERE", "FILL_DOWN", "UNPIVOT", "RENAME", "SPLIT", "DROP_COLUMNS", "RETYPE"] as const;
type Addable = (typeof ADDABLE)[number];
const INPUT = "rounded border border-slate-300 px-2 py-0.5 text-sm dark:border-slate-600 dark:bg-slate-900";
const list = (text: string): string[] => text.split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Screen 5 (optional): tidy the table with plain steps (§3.4). Each step is shown as a sentence, can be switched off, moved or removed,
 * and undone; the preview shows the first 20 rows after the steps. Steps are kept and replayed on every refresh.
 */
export function TidyPanel({ check, steps, onApply, onBack, onNext }: { check: CheckResult; steps: TidyStep[]; onApply: (s: TidyStep[]) => void; onBack: () => void; onNext: () => void }) {
  const { t } = useI18n();
  const [history, setHistory] = useState<TidyStep[][]>([]);
  const [adding, setAdding] = useState<Addable | "">("");
  const [f, setF] = useState<Record<string, string>>({});
  const headers = check.preview.headers;
  const apply = (next: TidyStep[]) => { setHistory([...history.slice(-30), steps]); onApply(next); };
  const move = (i: number, by: number) => { const n = [...steps]; const [s] = n.splice(i, 1); n.splice(Math.max(2, Math.min(n.length, i + by)), 0, s!); apply(n); };
  const params = (): Record<string, unknown> | null => {
    switch (adding) {
      case "KEEP_ROWS_WHERE": return f.column ? (f.empty === "1" ? { column: f.column, when: "EMPTY" } : { column: f.column, values: list(f.values ?? "") }) : null;
      case "FILL_DOWN": case "DROP_COLUMNS": return { columns: list(f.columns ?? "") };
      case "UNPIVOT": return { columns: list(f.columns ?? ""), nameColumn: f.name ?? "", valueColumn: f.value ?? "" };
      case "RENAME": return { from: f.from ?? "", to: f.to ?? "" };
      case "SPLIT": return { column: f.column ?? "", separator: f.separator ?? ",", into: list(f.into ?? "") };
      case "RETYPE": return { column: f.column ?? "", kind: f.kind ?? "COUNT" };
      default: return null;
    }
  };
  const colSelect = (k: string) => <select aria-label={t("ds.tidy.column")} className={INPUT} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option value="">{t("ds.tidy.column")}</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</select>;
  const text = (k: string, label: string) => <input aria-label={label} placeholder={label} className={INPUT} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">{t("ds.tidy.intro")}</p>
      <ol className="space-y-1 text-sm">
        {steps.map((s, i) => (
          <li key={s.id} className={`flex flex-wrap items-center gap-2 ${s.disabled ? "text-slate-400 line-through" : ""}`}>
            <span className="flex-1">{check.steps[i] ?? s.type}</span>
            {i >= 2 && <>
              <button type="button" className="text-xs underline" onClick={() => move(i, -1)} aria-label={t("ds.tidy.up")}>↑</button>
              <button type="button" className="text-xs underline" onClick={() => move(i, 1)} aria-label={t("ds.tidy.down")}>↓</button>
              <button type="button" className="text-xs underline" onClick={() => apply(steps.map((x) => (x.id === s.id ? { ...x, disabled: !x.disabled } : x)))}>{s.disabled ? t("ds.tidy.on") : t("ds.tidy.off")}</button>
              <button type="button" className="text-xs text-red-700 underline" onClick={() => apply(steps.filter((x) => x.id !== s.id))}>{t("ds.tidy.remove")}</button>
            </>}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={t("ds.tidy.add")} className={INPUT} value={adding} onChange={(e) => { setAdding(e.target.value as Addable); setF({}); }}>
          <option value="">{t("ds.tidy.add")}</option>{ADDABLE.map((a) => <option key={a} value={a}>{t(`ds.tidy.${a}`)}</option>)}
        </select>
        {adding === "KEEP_ROWS_WHERE" && <>{colSelect("column")}{text("values", t("ds.tidy.values"))}<label className="text-xs"><input type="checkbox" checked={f.empty === "1"} onChange={(e) => setF({ ...f, empty: e.target.checked ? "1" : "" })} /> {t("ds.tidy.whenEmpty")}</label></>}
        {(adding === "FILL_DOWN" || adding === "DROP_COLUMNS") && text("columns", t("ds.tidy.columns"))}
        {adding === "UNPIVOT" && <>{text("columns", t("ds.tidy.columns"))}{text("name", t("ds.tidy.nameColumn"))}{text("value", t("ds.tidy.valueColumn"))}</>}
        {adding === "RENAME" && <>{colSelect("from")}{text("to", t("ds.tidy.newName"))}</>}
        {adding === "SPLIT" && <>{colSelect("column")}{text("separator", t("ds.tidy.separator"))}{text("into", t("ds.tidy.into"))}</>}
        {adding === "RETYPE" && <>{colSelect("column")}<select aria-label={t("ds.columns.holds")} className={INPUT} value={f.kind ?? "COUNT"} onChange={(e) => setF({ ...f, kind: e.target.value })}>{COLUMN_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></>}
        {adding && <button type="button" className="rounded bg-brand-700 px-2 py-1 text-xs text-white" onClick={() => { const p = params(); if (p) { apply([...steps, { id: stepId(), type: adding, params: p }]); setAdding(""); } }}>{t("ds.tidy.addStep")}</button>}
        {history.length > 0 && <button type="button" className="text-xs underline" onClick={() => { const prev = history[history.length - 1]!; setHistory(history.slice(0, -1)); onApply(prev); }}>{t("ds.tidy.undo")}</button>}
      </div>
      <p className="text-xs text-slate-500">{t("ds.tidy.hint")}</p>
      <div className="max-h-72 overflow-auto rounded border border-slate-200 dark:border-slate-700">
        <table className="text-xs"><thead><tr>{headers.map((h) => <th key={h} className="whitespace-nowrap px-2 py-1 text-start">{h}</th>)}</tr></thead>
          <tbody>{check.preview.rows.map((r, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800">{r.map((c, k) => <td key={k} className="whitespace-nowrap px-2 py-0.5">{c}</td>)}</tr>)}</tbody></table>
      </div>
      <p className="text-xs text-slate-500">{t("ds.tidy.rowCount", { n: check.rowCount })}</p>
      <div className="flex gap-2"><button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" onClick={onBack}>{t("ds.back")}</button><button type="button" className="rounded bg-brand-700 px-3 py-1.5 text-sm font-medium text-white" onClick={onNext}>{t("ds.next")}</button></div>
    </div>
  );
}
