"use client";

import type { StyleField } from "@donordesk/domain/contexts/reporting/chart-style.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { cn } from "@/components/ui/cn";
import { humanize } from "../domain/studio-style";
import { styleHelp, styleLabel, styleWord } from "../domain/style-copy";

const input = "input px-2 py-1 text-xs";

/** One style option as a control: a number, a choice, an on/off setting or a short text. Empty means "keep the default" and clears the option. */
export function StyleControl({ field, groupLabel, value, onChange }: { field: StyleField; groupLabel: string; value: unknown; onChange: (v: unknown) => void }) {
  const { t, locale } = useI18n();
  const name = styleLabel(locale, field);
  const word = (o: string) => styleWord(locale, o, humanize(o));
  const label = `${groupLabel}: ${name}`;
  const help = styleHelp(locale, field);
  const hint = field.default !== null && field.default !== "" ? t("studio.look.default", { value: typeof field.default === "boolean" ? t(field.default ? "studio.look.on" : "studio.look.off") : word(String(field.default)) }) : undefined;
  return (
    <label className="block text-xs">
      <span className="mb-0.5 block font-medium text-slate-600 dark:text-slate-300">{name}</span>
      {field.type === "number" && (
        <input type="number" dir="ltr" aria-label={label} className={cn(input, "w-full")} min={field.min} max={field.max} step={field.integer ? 1 : 0.05} placeholder={field.default !== null ? String(field.default) : `${field.min}–${field.max}`}
          value={typeof value === "number" ? value : ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
      )}
      {field.type === "choice" && (
        <select aria-label={label} className={cn(input, "w-full")} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">{hint ?? "—"}</option>
          {field.options.map((o) => <option key={o} value={o}>{word(o)}</option>)}
        </select>
      )}
      {field.type === "flag" && (
        <select aria-label={label} className={cn(input, "w-full")} value={typeof value === "boolean" ? (value ? "on" : "off") : ""} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value === "on")}>
          <option value="">{hint ?? "—"}</option>
          <option value="on">{t("studio.look.on")}</option><option value="off">{t("studio.look.off")}</option>
        </select>
      )}
      {field.type === "text" && (
        <input type="text" aria-label={label} className={cn(input, "w-full")} maxLength={field.maxLength} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || undefined)} />
      )}
      {help && <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{help}</span>}
    </label>
  );
}
