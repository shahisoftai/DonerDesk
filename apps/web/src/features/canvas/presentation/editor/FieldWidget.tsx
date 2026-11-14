"use client";

import { useId } from "react";
import { getAt, setAt } from "../../domain/path";
import type { Field } from "../../domain/prop-fields";
import { DatasetFieldWidget } from "@/features/datasets/presentation/DatasetFieldWidget";

export interface IndicatorOption { id: string; code: string; name: string }
interface Props { field: Field; settings: unknown; onChange: (path: string, value: unknown) => void; indicators: ReadonlyArray<IndicatorOption> }

const INPUT = "w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900";
const asText = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const asLines = (v: unknown): string => (Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : "");

/** One setting of a block, drawn from its row in the field table. A person's words are written exactly as typed. */
export function FieldWidget({ field, settings, onChange, indicators }: Props) {
  const id = useId();
  const value = getAt(settings, field.path);
  const label = <label htmlFor={id} className="block text-xs font-medium text-slate-600 dark:text-slate-300">{field.label}</label>;
  const hint = "hint" in field && field.hint ? <p className="text-xs text-slate-500">{field.hint}</p> : null;

  switch (field.type) {
    case "dataset": case "datasetColumn": case "datasetColumns": case "wells": return <DatasetFieldWidget field={field} settings={settings} onChange={onChange} />;
    case "text": return <div className="space-y-1">{label}<input id={id} className={INPUT} value={asText(value)} onChange={(e) => onChange(field.path, e.target.value)} />{hint}</div>;
    case "textarea": return <div className="space-y-1">{label}<textarea id={id} rows={4} className={INPUT} value={asText(value)} onChange={(e) => onChange(field.path, e.target.value)} />{hint}</div>;
    case "number": return <div className="space-y-1">{label}<input id={id} type="number" className={INPUT} min={field.min} max={field.max} value={asText(value)} onChange={(e) => onChange(field.path, e.target.value === "" ? undefined : Number(e.target.value))} /></div>;
    case "boolean": return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value === true} onChange={(e) => onChange(field.path, e.target.checked)} />{field.label}</label>;
    case "select": return (
      <div className="space-y-1">{label}
        <select id={id} className={INPUT} value={asText(value)} onChange={(e) => onChange(field.path, e.target.value || undefined)}>
          {field.empty !== undefined && <option value="">{field.empty}</option>}
          {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
    case "indicator": return (
      <div className="space-y-1">{label}
        <select id={id} className={INPUT} value={asText(value)} onChange={(e) => onChange(field.path, e.target.value || undefined)}>
          <option value="">{indicators.length === 0 ? "Choose a project first" : "Choose an indicator"}</option>
          {indicators.map((i) => <option key={i.id} value={i.id}>{i.code} {i.name}</option>)}
        </select>
      </div>
    );
    case "indicators": {
      const chosen = new Set(Array.isArray(value) ? (value as string[]) : []);
      return (
        <fieldset className="space-y-1"><legend className="text-xs font-medium text-slate-600 dark:text-slate-300">{field.label}</legend>
          {indicators.length === 0 && <p className="text-xs text-slate-500">Choose a project first.</p>}
          <div className="max-h-40 space-y-1 overflow-auto rounded border border-slate-200 p-2 dark:border-slate-700">
            {indicators.map((i) => (
              <label key={i.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={chosen.has(i.id)} onChange={(e) => { const next = new Set(chosen); if (e.target.checked) next.add(i.id); else next.delete(i.id); onChange(field.path, indicators.filter((x) => next.has(x.id)).map((x) => x.id)); }} /><span>{i.code} {i.name}</span></label>
            ))}
          </div>
        </fieldset>
      );
    }
    case "choices": {
      const chosen = new Set(Array.isArray(value) ? (value as string[]) : []);
      return (
        <fieldset className="space-y-1"><legend className="text-xs font-medium text-slate-600 dark:text-slate-300">{field.label}</legend>
          {field.options.map((o) => <label key={o.value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.has(o.value)} onChange={(e) => { const next = new Set(chosen); if (e.target.checked) next.add(o.value); else next.delete(o.value); onChange(field.path, field.options.filter((x) => next.has(x.value)).map((x) => x.value)); }} />{o.label}</label>)}
        </fieldset>
      );
    }
    case "lines": return <div className="space-y-1">{label}<textarea id={id} rows={4} className={INPUT} value={asLines(value)} onChange={(e) => onChange(field.path, e.target.value.split("\n"))} />{hint}</div>;
    case "list": {
      const items = Array.isArray(value) ? (value as unknown[]) : [];
      return (
        <fieldset className="space-y-2"><legend className="text-xs font-medium text-slate-600 dark:text-slate-300">{field.label}</legend>
          {items.map((item, i) => (
            <div key={i} className="space-y-2 rounded border border-slate-200 p-2 dark:border-slate-700">
              {field.item.map((sub) => <FieldWidget key={sub.path} field={sub} settings={item} indicators={indicators} onChange={(path, v) => onChange(field.path, items.map((x, j) => (j === i ? setAt(x, path, v) : x)))} />)}
              <button type="button" className="text-xs text-red-700 underline" onClick={() => onChange(field.path, items.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800" onClick={() => onChange(field.path, [...items, structuredClone(field.blank)])}>{field.add}</button>
        </fieldset>
      );
    }
  }
}
