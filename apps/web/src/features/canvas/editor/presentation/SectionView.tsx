"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { setAt } from "../../domain/path";
import type { FormatSection } from "../domain/format-sections";
import { FormatFieldWidget, type FormatContextProps } from "./FormatFieldWidget";

interface Props extends FormatContextProps { section: FormatSection; settings: unknown; open: boolean; onToggle: (open: boolean) => void; onChange: (settings: unknown) => void }

/** One collapsible formatting section. Its fields write into one settings object; "Reset this section" goes back to the defaults. */
export function SectionView({ section, settings, open, onToggle, onChange, ...ctx }: Props) {
  const { t } = useI18n();
  const isSet = settings !== undefined && JSON.stringify(settings) !== "{}";
  return (
    <details open={open} onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)} className="rounded border border-slate-200 dark:border-slate-700" data-section={section.capability}>
      <summary className="flex min-h-10 cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
        {isSet && <span className="h-1.5 w-1.5 rounded-full bg-sky-600" aria-label={t("drawer.changed")} />}
        <span className="flex-1">{t(section.labelKey as never)}</span>
      </summary>
      <div className="space-y-3 border-t border-slate-200 p-3 dark:border-slate-700">
        {section.fields.map((f) => <FormatFieldWidget key={f.path} field={f} settings={settings} onChange={(path, v) => { const next = setAt(settings ?? {}, path, v); onChange(JSON.stringify(next) === "{}" ? undefined : next); }} {...ctx} />)}
        {isSet && <button type="button" className="text-xs text-slate-600 underline" onClick={() => onChange(undefined)}>{t("drawer.resetSection")}</button>}
      </div>
    </details>
  );
}
