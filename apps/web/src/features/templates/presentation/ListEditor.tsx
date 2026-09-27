"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

/** Edits an ordered list of short texts (questions, evidence items, rules). */
export function ListEditor({
  label,
  items,
  onChange,
  placeholder,
  addLabel = "Add",
  multiline = false,
  hint,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  multiline?: boolean;
  hint?: string;
}) {
  const id = useId();
  const set = (i: number, value: string) => onChange(items.map((v, j) => (j === i ? value : v)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <fieldset className="space-y-2" aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</legend>
      {hint && <p id={`${id}-hint`} className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {items.length === 0 && <p className="text-xs italic text-slate-400">None.</p>}
      {items.map((value, i) => (
        <div key={i} className="flex items-start gap-2">
          {multiline ? (
            <Textarea aria-label={`${label} ${i + 1}`} className="min-h-[60px] flex-1" value={value} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
          ) : (
            <Input aria-label={`${label} ${i + 1}`} className="flex-1" value={value} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
          )}
          <div className="flex shrink-0 gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">↓</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} aria-label={`Remove ${label} ${i + 1}`}>✕</Button>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...items, ""])}>{addLabel}</Button>
    </fieldset>
  );
}
