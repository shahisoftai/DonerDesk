"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";

type Pad = { top: number; end: number; bottom: number; start: number };
const SIDES = ["top", "end", "bottom", "start"] as const;

/** Padding on four sides, in px (0 to 48); empty uses the frame's own spacing. */
export function PaddingField({ label, value, onChange }: { label: string; value: Pad | undefined; onChange: (v: Pad | undefined) => void }) {
  const { t } = useI18n();
  const cur: Pad = value ?? { top: 16, end: 16, bottom: 16, start: 16 };
  return (
    <fieldset className="space-y-1"><legend className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</legend>
      <div className="grid grid-cols-4 gap-1">
        {SIDES.map((s) => (
          <label key={s} className="text-[11px] text-slate-500">{t(`pad.${s}` as never)}
            <input type="number" min={0} max={48} className="w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-sm dark:border-slate-600 dark:bg-slate-900" value={value ? cur[s] : ""} placeholder="—"
              onChange={(e) => { const n = e.target.value === "" ? NaN : Math.min(48, Math.max(0, Math.round(Number(e.target.value)))); onChange(Number.isNaN(n) ? undefined : { ...cur, [s]: n }); }} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
