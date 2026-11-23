"use client";

import { framed } from "../FieldFrame";
import type { FieldViewProps } from "../field-types";

/** Tick every box that applies. The answer is the list of ticked values. */
export function MultiSelectFieldView(p: FieldViewProps) {
  const chosen = new Set(Array.isArray(p.value) ? (p.value as string[]) : []);
  const toggle = (value: string, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(value); else next.delete(value);
    p.onChange(next.size === 0 ? undefined : [...next]);
  };
  return framed(p, (
    <fieldset className="space-y-1">
      <legend className="sr-only">{p.field.label}</legend>
      {(p.field.options ?? []).map((o) => (
        <label key={o.value} className="flex min-h-[44px] items-center gap-2 text-sm">
          <input type="checkbox" checked={chosen.has(o.value)} disabled={p.ctx.readOnly} onChange={(e) => toggle(o.value, e.target.checked)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  ));
}
