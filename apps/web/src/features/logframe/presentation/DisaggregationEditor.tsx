"use client";

import { DisaggregationDimensionSchema, type DisaggregationEntryInput } from "@donordesk/contracts";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DISAGGREGATION_DIMENSION_LABEL, DISAGGREGATION_PRESETS } from "@/lib/labels";
import { parseIndicatorNumber } from "@/features/logframe/domain/indicator-progress";

const DIMENSIONS = DisaggregationDimensionSchema.options;

/** Breakdown of one period value by sex, age group, etc. Summable indicators must add up per dimension (checked on save). */
export function DisaggregationEditor({
  entries,
  onChange,
  disabled,
  total,
  summable,
  label,
}: {
  entries: DisaggregationEntryInput[];
  onChange: (entries: DisaggregationEntryInput[]) => void;
  disabled: boolean;
  total: string;
  summable: boolean;
  label: string;
}) {
  const set = (index: number, patch: Partial<DisaggregationEntryInput>) =>
    onChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  function addPreset(dimension: DisaggregationEntryInput["dimension"]) {
    const existing = new Set(entries.filter((e) => e.dimension === dimension).map((e) => e.category.toLowerCase()));
    const additions = (DISAGGREGATION_PRESETS[dimension] ?? [""])
      .filter((category) => !category || !existing.has(category.toLowerCase()))
      .map((category) => ({ dimension, category, value: "" }));
    onChange([...entries, ...additions]);
  }

  const totalNumber = parseIndicatorNumber(total);
  const sums = new Map<string, number>();
  for (const entry of entries) {
    const value = parseIndicatorNumber(entry.value);
    if (value !== null) sums.set(entry.dimension, (sums.get(entry.dimension) ?? 0) + value);
  }

  return (
    <fieldset className="space-y-3" aria-label={label}>
      {entries.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">No breakdown yet. Add a dimension below.</p>}
      {entries.map((entry, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <Select
            value={entry.dimension}
            disabled={disabled}
            onChange={(event) => set(index, { dimension: event.target.value as DisaggregationEntryInput["dimension"] })}
            className="min-h-[34px] w-36 px-2 py-1 text-xs"
            aria-label="Dimension"
          >
            {DIMENSIONS.map((d) => <option key={d} value={d}>{DISAGGREGATION_DIMENSION_LABEL[d] ?? d}</option>)}
          </Select>
          <Input
            value={entry.category}
            disabled={disabled}
            onChange={(event) => set(index, { category: event.target.value })}
            placeholder="Category"
            className="min-h-[34px] w-40 px-2 py-1 text-xs"
            aria-label="Category"
          />
          <Input
            value={entry.value}
            disabled={disabled}
            inputMode="decimal"
            onChange={(event) => set(index, { value: event.target.value })}
            placeholder="Value"
            className="min-h-[34px] w-28 px-2 py-1 text-xs"
            aria-label={`Value for ${entry.category || "category"}`}
          />
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(entries.filter((_, i) => i !== index))} aria-label={`Remove ${entry.category || "row"}`}>
              Remove
            </Button>
          )}
        </div>
      ))}
      {sums.size > 0 && (
        <ul className="flex flex-wrap gap-3 text-xs">
          {[...sums].map(([dimension, sum]) => {
            const matches = !summable || totalNumber === null || Math.abs(sum - totalNumber) < 1e-9;
            return (
              <li key={dimension} className={matches ? "text-slate-500 dark:text-slate-400" : "font-medium text-danger-700 dark:text-danger-400"}>
                {DISAGGREGATION_DIMENSION_LABEL[dimension] ?? dimension}: {sum}
                {summable && totalNumber !== null ? ` of ${totalNumber}` : ""}
                {!matches && " — must equal the period value"}
              </li>
            );
          })}
        </ul>
      )}
      {!disabled && (
        <div className="flex flex-wrap gap-2">
          {DIMENSIONS.map((d) => (
            <Button key={d} type="button" variant="secondary" size="sm" onClick={() => addPreset(d)}>
              + {DISAGGREGATION_DIMENSION_LABEL[d] ?? d}
            </Button>
          ))}
        </div>
      )}
    </fieldset>
  );
}
