"use client";

import { PAGE_PRESETS, pagePresetById, themeConformance, type Canvas, type CanvasPage } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const SELECT = "rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900";

interface Props {
  canvas: Canvas;
  page: CanvasPage;
  snap: boolean;
  onSnap: (on: boolean) => void;
  onPreset: (presetId: string) => void;
  onResetTheme: (ids?: readonly string[]) => void;
  label: (blockId: string) => string;
}

/** Page size, snapping and how many blocks differ from the theme (Phase 61.3 and 61.6). Every size is the person's choice; the theme list says what differs and clears it. */
export function PageLayoutPanel({ canvas, page, snap, onSnap, onPreset, onResetTheme, label }: Props) {
  const { t } = useI18n();
  const deviations = themeConformance(canvas);
  const preset = pagePresetById(page.format);
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="page-layout-panel">
      <label className="space-y-1"><span className="block text-xs font-medium text-slate-600 dark:text-slate-300">{t("v61.pageSize")}</span>
        <select aria-label={t("v61.pageSize")} className={SELECT} value={preset?.id ?? ""} onChange={(e) => onPreset(e.target.value)}>
          {!preset && <option value="">{page.format}</option>}
          {PAGE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}{p.size ? ` (${p.size.w} × ${p.size.h})` : ""}</option>)}
        </select></label>
      {page.mode === "FREE" && <label className="flex min-h-8 items-center gap-2 text-sm"><input type="checkbox" checked={snap} onChange={(e) => onSnap(e.target.checked)} />{t("v61.snap")}</label>}
      <div className="text-sm" data-testid="theme-conformance">
        {deviations.length === 0
          ? <span className="text-slate-500">{t("v61.themeAll")}</span>
          : <details><summary className="cursor-pointer">{t("v61.themeDiffers", { count: String(deviations.length) })}</summary>
              <ul className="mt-1 space-y-0.5 text-xs">{deviations.map((d) => <li key={d.blockId} className="flex items-center gap-2"><span>{label(d.blockId)}: {d.what.join(", ")}</span><button type="button" className="underline" onClick={() => onResetTheme([d.blockId])}>{t("v61.themeReset")}</button></li>)}</ul>
              <button type="button" className="mt-1 rounded border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-600" onClick={() => onResetTheme()}>{t("v61.themeResetAll")}</button>
            </details>}
      </div>
    </div>
  );
}
