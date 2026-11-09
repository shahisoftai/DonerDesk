"use client";

import { useEffect, useRef } from "react";
import type { ChartSpecV2 } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { CHART_STYLE_PRESETS, PRESET_PALETTE_PREFIX, applyPreset, presetColors } from "@donordesk/domain/contexts/reporting/chart-presets.js";
import type { StyleGaugeBand, StyleGroup } from "@donordesk/domain/contexts/reporting/chart-style.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { cn } from "@/components/ui/cn";
import { changedIn, groupsFor, resetGroup, resetLook, styleValue, withBands, withStyleValue } from "../domain/studio-style";
import { GaugeBands } from "./GaugeBands";
import { StyleControl } from "./StyleControl";
import { styleGroupLabel } from "../domain/style-copy";

/** The colours of a theme as a strip, so a person sees what they are choosing. */
function Swatches({ id }: { id: string }) {
  return <span className="flex gap-0.5" aria-hidden>{(presetColors(id, "light") ?? []).slice(0, 8).map((c, i) => <span key={i} className="h-3 w-3 rounded-sm border border-black/10" style={{ background: c }} />)}</span>;
}

/**
 * Look and feel: a theme to start from, then every option the chart type offers, grouped by the part of the chart it changes. A click on a
 * part of the picture opens its group. Every group can be reset on its own. What each option is comes from the domain's table.
 */
export function StylePanel({ spec, edit, focus }: { spec: ChartSpecV2; edit: (next: ChartSpecV2) => void; focus: StyleGroup | null }) {
  const { t, locale } = useI18n();
  const groups = groupsFor(spec.kind).map((g) => ({ ...g, label: styleGroupLabel(locale, g.group, g.label) }));
  const opened = useRef<HTMLDetailsElement | null>(null);
  const presetId = spec.paletteId?.startsWith(PRESET_PALETTE_PREFIX) ? spec.paletteId.slice(PRESET_PALETTE_PREFIX.length) : "";
  useEffect(() => { opened.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); }, [focus]);
  const anySet = spec.style !== undefined || presetId !== "";

  return (
    <div className="space-y-2" data-testid="style-panel">
      <label className="block text-xs">
        <span className="mb-0.5 block font-medium text-slate-600 dark:text-slate-300">{t("studio.look.preset")}</span>
        <select aria-label={t("studio.look.preset")} className="input w-full px-2 py-1 text-xs" value={presetId} onChange={(e) => { const next = e.target.value ? applyPreset(spec, e.target.value) : null; if (next) edit(next); }}>
          <option value="">{t("studio.look.presetNone")}</option>
          <optgroup label="DonorDesk">{CHART_STYLE_PRESETS.filter((p) => p.source === "DONORDESK").map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
          <optgroup label="ECharts">{CHART_STYLE_PRESETS.filter((p) => p.source === "ECHARTS").map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
        </select>
        {presetId && <span className="mt-1 block"><Swatches id={presetId} /></span>}
      </label>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("studio.look.hint")}</p>
      {anySet && <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => edit(resetLook(spec))}>{t("studio.look.resetAll")}</button>}
      {groups.map(({ group, label, fields }) => {
        const count = changedIn(spec, group);
        const isFocus = focus === group;
        return (
          <details key={group} open={isFocus || count > 0 ? true : undefined} ref={isFocus ? opened : undefined} data-group={group} className={cn("rounded-lg border bg-white p-2 dark:bg-slate-900/60", isFocus ? "border-brand-600" : "border-slate-200 dark:border-white/10")}>
            <summary className="cursor-pointer text-sm font-semibold">{label}{count > 0 && <span className="ms-1 rounded bg-brand-600 px-1 text-[10px] font-normal text-white">{count}</span>}{group === "interaction" && <span className="ms-1 text-[10px] font-normal text-slate-500">{t("studio.look.screenOnly")}</span>}</summary>
            <div className="mt-2 space-y-2">
              {fields.map((f) => <StyleControl key={f.path} field={f} groupLabel={label} value={styleValue(spec, f.path)} onChange={(v) => edit(withStyleValue(spec, f.path, v))} />)}
              {group === "gauge" && <GaugeBands bands={(styleValue(spec, "gauge.bands") as StyleGaugeBand[] | undefined) ?? []} onChange={(b) => edit(withBands(spec, b))} />}
              {count > 0 && <button type="button" className="text-xs underline" onClick={() => edit(resetGroup(spec, group))}>{t("studio.look.reset")}</button>}
            </div>
          </details>
        );
      })}
    </div>
  );
}
