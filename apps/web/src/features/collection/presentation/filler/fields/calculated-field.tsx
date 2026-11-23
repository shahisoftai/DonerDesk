"use client";

import { evaluateFormFormula, parseFormFormula, resolvePath, roundTo } from "@donordesk/domain/contexts/collection/index.js";
import { framed } from "../FieldFrame";
import type { FieldViewProps } from "../field-types";

/** A figure the form works out from earlier answers. Read only; the server works it out again and ignores anything sent. */
export function CalculatedFieldView(p: FieldViewProps) {
  const parsed = parseFormFormula(p.field.formula ?? "");
  const n = parsed.ok ? evaluateFormFormula(parsed.expr, (path) => resolvePath(p.scope, path).map((x) => x.value)) : null;
  const shown = n === null ? null : roundTo(n, p.field.decimals ?? 2);
  return framed({ ...p, field: { ...p.field, required: true } }, (
    <p className="min-h-[44px] rounded-md bg-slate-50 px-3 py-2 text-sm tabular-nums dark:bg-slate-800" aria-live="polite">
      {shown === null ? <span className="text-slate-500">{p.ctx.t("assess.calc.missing")}</span> : <>{shown.toLocaleString("en", { maximumFractionDigits: 10 })} <span className="text-xs text-slate-500">{p.ctx.t("assess.calc.auto")}</span></>}
    </p>
  ));
}
