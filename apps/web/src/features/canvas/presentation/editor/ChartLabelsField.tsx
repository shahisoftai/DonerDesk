"use client";

import type { ChartSpecV2 } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const INPUT = "w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900";
const SHOWS = ["VALUE", "PERCENT", "NAME", "NAME_VALUE"] as const;
const NUMBERS = ["FULL", "COMPACT", "DECIMAL_1", "DECIMAL_2"] as const;
const POSITIONS = ["AUTO", "TOP", "BOTTOM", "LEFT", "RIGHT", "INSIDE", "OUTSIDE"] as const;
type Labels = NonNullable<ChartSpecV2["labels"]>;

interface Props { spec: ChartSpecV2 | undefined; onChange: (spec: ChartSpecV2) => void }

/**
 * The numbers on a chart (Phase 61.10): show the values, say what to write (the figure, its share, the name, or both), how the figure is
 * written, where it sits (above, below, beside, inside) and how large. Every chart kind that can carry a figure takes it; a kind that
 * writes its own (a gauge, a ring) or has no single value (a box plot) ignores it, and the picture says nothing false either way.
 */
export function ChartLabelsField({ spec, onChange }: Props) {
  const { t } = useI18n();
  if (!spec) return null;
  const labels: Labels = spec.labels ?? { show: false, format: "VALUE" };
  const style = spec.style?.labels;
  const setLabels = (patch: Partial<Labels>): void => onChange({ ...spec, labels: { ...labels, ...patch } });
  const setStyle = (patch: { position?: string | undefined; size?: number | undefined }): void => {
    const next = { ...(spec.style?.labels ?? {}), ...patch } as Record<string, unknown>;
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    const rest = { ...(spec.style ?? {}) } as Record<string, unknown>;
    if (Object.keys(next).length > 0) rest["labels"] = next; else delete rest["labels"];
    onChange({ ...spec, style: Object.keys(rest).length > 0 ? (rest as ChartSpecV2["style"]) : undefined } as ChartSpecV2);
  };
  return (
    <fieldset className="space-y-2 rounded border border-slate-200 p-2 dark:border-slate-700" data-testid="chart-labels-field">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("v61.labels.title")}</legend>
      <label className="flex min-h-8 items-center gap-2 text-sm"><input type="checkbox" checked={labels.show} onChange={(e) => setLabels({ show: e.target.checked })} data-testid="labels-show" />{t("v61.labels.show")}</label>
      {labels.show && (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5"><span className="block text-[11px] text-slate-500">{t("v61.labels.what")}</span>
            <select className={INPUT} value={labels.format} onChange={(e) => setLabels({ format: e.target.value as Labels["format"] })} data-testid="labels-what">{SHOWS.map((s) => <option key={s} value={s}>{t(`v61.labels.what.${s}` as never)}</option>)}</select></label>
          <label className="space-y-0.5"><span className="block text-[11px] text-slate-500">{t("v61.labels.number")}</span>
            <select className={INPUT} value={labels.numberFormat ?? "FULL"} onChange={(e) => setLabels({ numberFormat: e.target.value as Labels["numberFormat"] })}>{NUMBERS.map((s) => <option key={s} value={s}>{t(`v61.labels.number.${s}` as never)}</option>)}</select></label>
          <label className="space-y-0.5"><span className="block text-[11px] text-slate-500">{t("v61.labels.position")}</span>
            <select className={INPUT} value={style?.position ?? "AUTO"} onChange={(e) => setStyle({ position: e.target.value === "AUTO" ? undefined : e.target.value })} data-testid="labels-position">{POSITIONS.map((s) => <option key={s} value={s}>{t(`v61.labels.position.${s}` as never)}</option>)}</select></label>
          <label className="space-y-0.5"><span className="block text-[11px] text-slate-500">{t("v61.labels.size")}</span>
            <input type="number" min={8} max={32} className={INPUT} value={style?.size ?? ""} placeholder="12" onChange={(e) => setStyle({ size: e.target.value === "" ? undefined : Math.min(32, Math.max(8, Number(e.target.value))) })} /></label>
        </div>
      )}
    </fieldset>
  );
}
