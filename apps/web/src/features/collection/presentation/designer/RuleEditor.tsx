"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Draft, Op, Rule } from "../../domain/designer-model";

const OP_LABEL: Record<Op, string> = { EQ: "is", NEQ: "is not", GT: "is more than", LT: "is less than", FILLED: "has an answer", EMPTY: "has no answer", CONTAINS: "includes" };

/** "Ask this only when…": one simple rule on an earlier question. A combined rule written elsewhere is kept as it is until replaced. */
export function RuleEditor({ title, earlier, labelOf, rule, custom, onChange }: {
  title: string; earlier: Draft[]; labelOf: (key: string) => string; rule: Rule | null; custom: boolean; onChange: (r: Rule | null) => void;
}) {
  const askable = earlier.filter((e) => e.type !== "SECTION" && e.type !== "NOTE");
  if (askable.length === 0) return null;
  if (custom) return <p className="text-xs text-slate-500">{title}: a combined rule that is kept as it is. <Button variant="secondary" onClick={() => onChange({ field: askable[0]!.key, op: "EQ", value: "" })}>Replace it</Button></p>;
  if (!rule) return <button type="button" className="text-xs text-brand-600 hover:underline dark:text-brand-400" onClick={() => onChange({ field: askable[0]!.key, op: "EQ", value: "" })}>{title}…</button>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs">{title}</span>
      <Select aria-label={`${title}: question`} value={rule.field} onChange={(e) => onChange({ ...rule, field: e.target.value })}>
        {askable.map((e) => <option key={e.key} value={e.key}>{labelOf(e.key)}</option>)}
      </Select>
      <Select aria-label={`${title}: comparison`} value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value as Op })}>
        {(Object.keys(OP_LABEL) as Op[]).map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
      </Select>
      {rule.op !== "FILLED" && rule.op !== "EMPTY" && <Input aria-label={`${title}: value`} className="max-w-[10rem]" value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })} />}
      <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => onChange(null)}>Remove</button>
    </div>
  );
}
