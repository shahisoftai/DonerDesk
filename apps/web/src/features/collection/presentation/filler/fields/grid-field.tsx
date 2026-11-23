"use client";

import { useEffect, useState } from "react";
import { isNotApplicable, type GridColumn } from "@donordesk/domain/contexts/collection/index.js";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { framed } from "../FieldFrame";
import type { FieldViewProps, FillContext } from "../field-types";

type Cells = Record<string, Record<string, unknown>>;
/** True on a screen wide enough for a table. Only one of the table and the cards is drawn, so a long checklist is not in the page twice. */
function useWide(): boolean {
  const query = "(min-width: 768px)";
  const [wide, setWide] = useState(() => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : true));
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

const text = (v: unknown): string => (v === undefined || v === null ? "" : typeof v === "boolean" ? (v ? "yes" : "no") : String(v));

/** One cell of a table: the control for the column's type, with "not applicable" where the column allows it. */
function Cell({ column, rowLabel, value, onChange, ctx }: { column: GridColumn; rowLabel: string; value: unknown; onChange(v: unknown): void; ctx: FillContext }) {
  const { t } = ctx;
  const na = isNotApplicable(value);
  const name = `${rowLabel}, ${column.label}`;
  const disabled = ctx.readOnly;
  const control = column.type === "YES_NO" ? (
    <Select aria-label={name} value={text(value)} disabled={disabled} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{t("common.choose")}</option>
      <option value="yes">{t("common.yes")}</option>
      <option value="no">{t("common.no")}</option>
    </Select>
  ) : column.type === "SELECT" ? (
    <Select aria-label={name} value={text(value)} disabled={disabled} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{t("common.choose")}</option>
      {(column.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  ) : column.type === "NUMBER" ? (
    <Input aria-label={name} inputMode="decimal" value={text(value)} disabled={disabled} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)} />
  ) : (
    <Input aria-label={name} value={text(value)} disabled={disabled} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)} />
  );
  return (
    <div className="flex items-center gap-2">
      {na ? <span className="text-sm text-slate-500">{t("assess.na")}</span> : <div className="min-w-0 flex-1">{control}</div>}
      {column.allowNotApplicable && !disabled && (
        <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
          <input type="checkbox" aria-label={`${name}, ${t("assess.na")}`} checked={na} onChange={(e) => onChange(e.target.checked ? { na: true } : undefined)} />
          {t("assess.na.short")}
        </label>
      )}
    </div>
  );
}

/**
 * A table of rows against typed columns. On a wide screen it is a table with the row names down the side; on a phone each row is a card
 * with its columns stacked, so a long checklist is filled one item at a time. The answer is `{ rowKey: { columnKey: value } }`.
 */
export function GridFieldView(p: FieldViewProps) {
  const rows = p.field.rows ?? [];
  const columns = p.field.columns ?? [];
  const value = (p.value && typeof p.value === "object" ? p.value : {}) as Cells;
  const setCell = (rowKey: string, colKey: string, v: unknown) => {
    const row = { ...(value[rowKey] ?? {}) };
    if (v === undefined) delete row[colKey]; else row[colKey] = v;
    const next = { ...value };
    if (Object.keys(row).length === 0) delete next[rowKey]; else next[rowKey] = row;
    p.onChange(Object.keys(next).length === 0 ? undefined : next);
  };
  const path = p.prefix + p.field.key;
  const wide = useWide();
  return framed(p, (
    <div>
      {wide ? (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky start-0 bg-white p-2 text-start font-medium dark:bg-slate-900"><span className="sr-only">{p.field.label}</span></th>
              {columns.map((c) => <th key={c.key} scope="col" className="p-2 text-start font-medium">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-slate-200 dark:border-slate-700">
                <th scope="row" className="sticky start-0 bg-white p-2 text-start font-normal dark:bg-slate-900">{r.label}</th>
                {columns.map((c) => {
                  const err = p.ctx.problemAt(`${path}.${r.key}.${c.key}`);
                  return (
                    <td key={c.key} className="p-1 align-top">
                      <Cell column={c} rowLabel={r.label} value={value[r.key]?.[c.key]} onChange={(v) => setCell(r.key, c.key, v)} ctx={p.ctx} />
                      {err && <p role="alert" className="mt-1 text-xs text-danger-600">{err}</p>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : (
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.key} className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
            <p className="mb-2 font-medium">{r.label}</p>
            <div className="space-y-2">
              {columns.map((c) => {
                const err = p.ctx.problemAt(`${path}.${r.key}.${c.key}`);
                return (
                  <label key={c.key} className="block text-sm">
                    <span className="mb-1 block text-slate-600 dark:text-slate-300">{c.label}</span>
                    <Cell column={c} rowLabel={r.label} value={value[r.key]?.[c.key]} onChange={(v) => setCell(r.key, c.key, v)} ctx={p.ctx} />
                    {err && <span role="alert" className="mt-1 block text-xs text-danger-600">{err}</span>}
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      )}
    </div>
  ));
}
