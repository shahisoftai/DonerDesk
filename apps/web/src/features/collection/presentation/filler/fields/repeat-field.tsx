"use client";

import { Button } from "@/components/ui/Button";
import { withAnswer, withRows } from "../../../domain/filler-state";
import { framed } from "../FieldFrame";
import type { FieldViewProps } from "../field-types";
import { FIELD_VIEWS } from "./index";

type Row = Record<string, unknown>;

/** Several rows of the same questions (blocks, wards, staff). Add, copy the last row, remove; each row asks the repeat's own questions. */
export function RepeatFieldView(p: FieldViewProps) {
  const { t } = p.ctx;
  const rows = (Array.isArray(p.value) ? p.value : []) as Row[];
  const max = Math.min(p.field.maxRows ?? 100, 100);
  const name = p.field.rowLabel ?? p.field.label;
  const children = p.field.fields ?? [];
  const set = (next: Row[]) => p.onChange(next.length === 0 ? undefined : next);
  const path = p.prefix + p.field.key;
  return framed(p, (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-sm text-slate-500">{t("assess.repeat.empty")}</p>}
      {rows.map((row, i) => (
        <fieldset key={i} className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
          <legend className="px-1 text-sm font-medium">{t("assess.repeat.row", { name, n: i + 1 })}</legend>
          <div className="space-y-3">
            {children.map((c) => {
              const View = FIELD_VIEWS[c.type];
              if (!View) return null;
              return <View key={c.key} field={c} value={row[c.key]} prefix={`${path}[${i}].`} scope={{ ...p.scope, ...row }} ctx={p.ctx} onChange={(v) => set(withRows(rows, i, withAnswer(row, c.key, v)))} />;
            })}
          </div>
          {!p.ctx.readOnly && <div className="mt-2"><Button type="button" variant="ghost" onClick={() => set(rows.filter((_, j) => j !== i))}>{t("assess.repeat.remove")}</Button></div>}
        </fieldset>
      ))}
      {!p.ctx.readOnly && rows.length < max && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => set([...rows, {}])}>{t("assess.repeat.add", { name })}</Button>
          {rows.length > 0 && <Button type="button" variant="ghost" onClick={() => set([...rows, { ...rows[rows.length - 1] }])}>{t("assess.repeat.copy")}</Button>}
        </div>
      )}
      {rows.length >= max && <p className="text-xs text-slate-500">{t("assess.repeat.max", { max })}</p>}
    </div>
  ));
}
