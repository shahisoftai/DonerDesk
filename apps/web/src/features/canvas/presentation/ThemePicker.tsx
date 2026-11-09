"use client";

import { THEME_FAMILIES, THEME_SPECS, THEME_TONES, listThemes, type ThemeTone } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const SELECT = "rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900";

/** The tone a theme id is in: `OCEAN` is light, `OCEAN:dark` is dark. */
const split = (id: string): { base: string; tone: ThemeTone } => {
  const [base, tone] = id.split(":");
  return { base: base!, tone: (tone ? tone.toUpperCase() : "LIGHT") as ThemeTone };
};

/** Pick a look from the gallery, grouped by family, and the tone it is in (light, dark, print, high contrast). The four tones of one look share a name, so changing the tone keeps the look. */
export function ThemePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useI18n();
  const { base, tone } = split(value);
  const compose = (b: string, tn: ThemeTone): string => (tn === "LIGHT" ? b : `${b}:${tn.toLowerCase()}`);
  const classic = listThemes().filter((th) => !THEME_SPECS.some((s) => s.id === th.id.split(":")[0]) && !th.id.includes(":"));
  return (
    <>
      <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">{t("editor.theme.look")}</span>
        <select className={SELECT} value={base} onChange={(e) => onChange(compose(e.target.value, tone))}>
          <optgroup label={t("editor.theme.classic")}>{classic.map((th) => <option key={th.id} value={th.id}>{th.label}</option>)}</optgroup>
          {THEME_FAMILIES.map((f) => <optgroup key={f} label={t(`editor.theme.family.${f}` as never)}>{THEME_SPECS.filter((s) => s.family === f).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</optgroup>)}
        </select></label>
      {THEME_SPECS.some((s) => s.id === base) && (
        <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">{t("editor.theme.tone")}</span>
          <select className={SELECT} value={tone} onChange={(e) => onChange(compose(base, e.target.value as ThemeTone))}>{THEME_TONES.map((tn) => <option key={tn} value={tn}>{t(`editor.theme.tone.${tn}` as never)}</option>)}</select></label>
      )}
    </>
  );
}
