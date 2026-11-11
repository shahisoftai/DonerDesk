"use client";

import { useId } from "react";
import { COLOUR_ROLES, type ColourChoice } from "@donordesk/domain/contexts/canvas/index.js";
import { contrastRatio } from "@donordesk/domain/contexts/infographics/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

interface Props { label: string; value: ColourChoice | undefined; card: string; resolve: (c: ColourChoice) => string; onChange: (v: ColourChoice | undefined) => void }

const HEX = /^#[0-9a-f]{6}$/i;

/** A colour setting (Phase 50.2): a theme colour first (it follows the theme and is checked in light and dark), else a custom one with a contrast warning. */
export function ColorField({ label, value, card, resolve, onChange }: Props) {
  const { t } = useI18n();
  const id = useId();
  const mode = value === undefined ? "" : "role" in value ? value.role : "custom";
  const shown = value ? resolve(value) : null;
  const weak = shown && HEX.test(shown) && contrastRatio(shown, card) < 3;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</label>
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-6 w-6 shrink-0 rounded border border-slate-300" style={{ background: shown ?? "transparent" }} />
        <select id={id} className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900" value={mode}
          onChange={(e) => { const v = e.target.value; onChange(v === "" ? undefined : v === "custom" ? { hex: shown && HEX.test(shown) ? shown : "#1f6feb" } : { role: v as (typeof COLOUR_ROLES)[number] }); }}>
          <option value="">{t("color.default")}</option>
          <optgroup label={t("color.theme")}>{COLOUR_ROLES.map((r) => <option key={r} value={r}>{t(`color.role.${r}` as never)}</option>)}</optgroup>
          <option value="custom">{t("color.custom")}</option>
        </select>
        {value && "hex" in value && <input type="color" aria-label={t("color.custom")} value={value.hex} onChange={(e) => onChange({ hex: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-slate-300" />}
      </div>
      {weak && <p role="status" className="text-xs text-amber-800 dark:text-amber-200">{t("color.lowContrast")}</p>}
    </div>
  );
}
