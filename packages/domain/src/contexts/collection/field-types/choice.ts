import type { FormField } from "../form-model.js";
import { bad, ok, type FieldCtx, type FieldTypeDef } from "./contract.js";

const at = (f: FormField, ctx: FieldCtx): string => ctx.prefix + f.key;

function optionsProblems(f: FormField): string[] {
  const values = (f.options ?? []).map((o) => o.value);
  const out: string[] = [];
  if (values.length < 2) out.push("A choice field needs at least two options.");
  if (new Set(values).size !== values.length) out.push("Two options have the same value.");
  return out;
}

const SELECT: FieldTypeDef = {
  asks: true, takesOptions: true,
  validate(f, raw, ctx) {
    const t = String(raw).trim();
    return (f.options ?? []).some((o) => o.value === t) ? ok(t) : bad(at(f, ctx), `${f.label}: "${t}" is not one of the options.`, "OPTION", { label: f.label });
  },
  checkDefinition: (f) => optionsProblems(f),
};

const MULTI_SELECT: FieldTypeDef = {
  asks: true, takesOptions: true,
  validate(f, raw, ctx) {
    const list = Array.isArray(raw) ? raw.map((x) => String(x).trim()) : [String(raw).trim()];
    const allowed = new Set((f.options ?? []).map((o) => o.value));
    const unknown = list.find((v) => !allowed.has(v));
    if (unknown !== undefined) return bad(at(f, ctx), `${f.label}: "${unknown}" is not one of the options.`, "OPTION", { label: f.label });
    const kept = [...new Set(list)];
    // Keep the form's own order so two people ticking the same boxes store the same answer.
    return ok((f.options ?? []).map((o) => o.value).filter((v) => kept.includes(v)));
  },
  checkDefinition: (f) => optionsProblems(f),
};

export const CHOICE_FIELD_TYPES = { SELECT, MULTI_SELECT } as const;
