"use client";

import { MAX_GAUGE_BANDS, STYLE_TONES, type StyleGaugeBand, type StyleTone } from "@donordesk/domain/contexts/reporting/chart-style.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { cn } from "@/components/ui/cn";

/** The coloured stretches of a dial: each ends higher than the one before, up to 100. */
export function GaugeBands({ bands, onChange }: { bands: StyleGaugeBand[]; onChange: (next: StyleGaugeBand[]) => void }) {
  const { t } = useI18n();
  const last = bands[bands.length - 1]?.upTo ?? 0;
  const set = (i: number, patch: Partial<StyleGaugeBand>) => onChange(bands.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div className="space-y-1" data-testid="gauge-bands">
      {bands.map((b, i) => (
        <div key={i} className="flex items-center gap-1 text-xs">
          <input type="number" min={1} max={100} aria-label={`${t("studio.look.band.upTo")} ${i + 1}`} className={cn("input w-20 px-2 py-1 text-xs")} value={b.upTo} onChange={(e) => set(i, { upTo: Number(e.target.value) })} />
          <select aria-label={`${t("studio.look.band.upTo")} ${i + 1} ${t("studio.look.preset")}`} className={cn("input w-auto px-2 py-1 text-xs")} value={b.tone} onChange={(e) => set(i, { tone: e.target.value as StyleTone })}>
            {STYLE_TONES.map((tone) => <option key={tone} value={tone}>{t(`studio.look.tone.${tone}`)}</option>)}
          </select>
          <button type="button" className="text-red-700 dark:text-red-300" aria-label={`${t("studio.look.band.remove")} ${i + 1}`} onClick={() => onChange(bands.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn-secondary px-2 py-1 text-xs" disabled={bands.length >= MAX_GAUGE_BANDS || last >= 100} onClick={() => onChange([...bands, { upTo: Math.min(100, last + Math.max(10, Math.round((100 - last) / 2))), tone: STYLE_TONES[Math.min(bands.length, STYLE_TONES.length - 1)]! }])}>{t("studio.look.band.add")}</button>
    </div>
  );
}
