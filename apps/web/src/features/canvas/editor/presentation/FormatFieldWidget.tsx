"use client";

import { useId } from "react";
import { FONTS, type ColourChoice } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { getAt } from "../../domain/path";
import type { FormatField } from "../domain/format-sections";
import { ColorField } from "./ColorField";
import { PaddingField } from "./PaddingField";
import { ConditionalRulesField } from "./ConditionalRulesField";
import { ColumnsField } from "./ColumnsField";

export interface FormatContextProps { card: string; resolve: (c: ColourChoice) => string; columns: readonly string[]; indicators: ReadonlyArray<{ id: string; code: string; name: string }> }
interface Props extends FormatContextProps { field: FormatField; settings: unknown; onChange: (path: string, value: unknown) => void }

const INPUT = "w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900";

/** One formatting setting, drawn from its row in the section table. A changed value shows a dot and can be reset on its own. */
export function FormatFieldWidget({ field, settings, onChange, card, resolve, columns, indicators }: Props) {
  const { t } = useI18n();
  const id = useId();
  const value = getAt(settings, field.path);
  const changed = value !== undefined;
  const reset = changed ? <button type="button" className="text-[11px] text-slate-500 underline" onClick={() => onChange(field.path, undefined)} aria-label={`${t("drawer.reset")}: ${t(field.labelKey as never)}`}>{t("drawer.reset")}</button> : null;
  const label = <span className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">{changed && <span aria-label={t("drawer.changed")} className="h-1.5 w-1.5 rounded-full bg-brand-600" />}<label htmlFor={id}>{t(field.labelKey as never)}</label><span className="ms-auto">{reset}</span></span>;
  switch (field.type) {
    case "toggle": return <label className="flex min-h-8 items-center gap-2 text-sm">{changed && <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-label={t("drawer.changed")} />}<input type="checkbox" checked={(value as boolean | undefined) ?? field.defaultValue ?? false} onChange={(e) => onChange(field.path, e.target.checked)} />{t(field.labelKey as never)}<span className="ms-auto">{reset}</span></label>;
    case "select": return <div className="space-y-1">{label}<select id={id} className={INPUT} value={(value as string | undefined) ?? field.defaultValue ?? ""} onChange={(e) => onChange(field.path, e.target.value || undefined)}>{field.defaultValue === undefined && <option value="">—</option>}{field.options.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey as never)}</option>)}</select></div>;
    case "number": return <div className="space-y-1">{label}<input id={id} type="number" className={INPUT} min={field.min} max={field.max} step={field.step ?? 1} value={typeof value === "number" ? value : ""} placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : "—"} onChange={(e) => onChange(field.path, e.target.value === "" ? undefined : Number(e.target.value))} /></div>;
    case "slider": return <div className="space-y-1">{label}<div className="flex items-center gap-2"><input id={id} type="range" className="flex-1" min={field.min} max={field.max} value={typeof value === "number" ? value : field.defaultValue} onChange={(e) => onChange(field.path, Number(e.target.value))} /><output htmlFor={id} className="w-8 text-end text-xs tabular-nums">{typeof value === "number" ? value : field.defaultValue}</output></div></div>;
    case "text": return <div className="space-y-1">{label}<input id={id} className={INPUT} maxLength={field.max} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(field.path, e.target.value || undefined)} /></div>;
    case "font": return <div className="space-y-1">{label}<select id={id} className={INPUT} value={(value as string | undefined) ?? ""} onChange={(e) => onChange(field.path, e.target.value || undefined)}><option value="">{t("v61.f.fontTheme")}</option>{FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}{f.bundled ? "" : ` (${t("v61.f.fontNotBundled")})`}</option>)}</select></div>;
    case "words": return <div className="space-y-1">{label}<textarea id={id} rows={2} className={INPUT} maxLength={field.max} placeholder={t("v61.text.auto")} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(field.path, e.target.value === "" ? undefined : e.target.value)} />{typeof value === "string" && value !== "" && <p className="text-[11px] text-amber-700 dark:text-amber-300">{t("v61.text.edited")}</p>}</div>;
    case "color": return <ColorField label={t(field.labelKey as never)} value={value as ColourChoice | undefined} card={card} resolve={resolve} onChange={(v) => onChange(field.path, v)} />;
    case "padding": return <PaddingField label={t(field.labelKey as never)} value={value as never} onChange={(v) => onChange(field.path, v)} />;
    case "conditional": return <ConditionalRulesField value={value as never} card={card} resolve={resolve} onChange={(v) => onChange(field.path, v)} />;
    case "columns": return <div className="space-y-1">{label}<ColumnsField value={value as never} columns={columns} onChange={(v) => onChange(field.path, v)} /></div>;
    case "indicators": {
      const chosen = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="space-y-1"><legend className="text-xs font-medium text-slate-600 dark:text-slate-300">{t(field.labelKey as never)}</legend>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto">{indicators.map((i) => <li key={i.id}><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={chosen.includes(i.id)} disabled={!chosen.includes(i.id) && chosen.length >= field.max} onChange={(e) => { const next = e.target.checked ? [...chosen, i.id] : chosen.filter((x) => x !== i.id); onChange(field.path, next.length ? next : undefined); }} />{i.code} {i.name}</label></li>)}</ul>
        </fieldset>
      );
    }
  }
}
