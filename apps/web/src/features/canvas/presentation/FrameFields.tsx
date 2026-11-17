"use client";

import { frameOf, type BlockInstance, type CanvasPage, type FreeFrame } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const INPUT = "w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-sm dark:border-slate-600 dark:bg-slate-900";
type Key = "x" | "y" | "w" | "h" | "rot";
const FIELDS: ReadonlyArray<{ key: Key; labelKey: string }> = [{ key: "x", labelKey: "v61.frame.x" }, { key: "y", labelKey: "v61.frame.y" }, { key: "w", labelKey: "v61.frame.w" }, { key: "h", labelKey: "v61.frame.h" }, { key: "rot", labelKey: "v61.frame.rot" }];

/** Exact position, size and turn of a block on a free page, in pixels: every number is the person's choice (Phase 61.3). Stacking order is one step at a time. */
export function FrameFields({ block, page, onFrame }: { block: BlockInstance; page: CanvasPage; onFrame: (patch: Partial<FreeFrame>) => void }) {
  const { t } = useI18n();
  const f = frameOf(block, page);
  const locked = block.style?.locked === true;
  return (
    <fieldset className="space-y-2 rounded border border-slate-200 p-2 dark:border-slate-700" data-testid="frame-fields" disabled={locked}>
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("v61.frame.title")}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {FIELDS.map(({ key, labelKey }) => (
          <label key={key} className="space-y-0.5"><span className="block text-[11px] text-slate-500">{t(labelKey as never)}</span>
            <input type="number" aria-label={t(labelKey as never)} className={INPUT} value={Math.round(f[key] ?? 0)} step={key === "rot" ? 5 : 1}
              onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onFrame({ [key]: n } as Partial<FreeFrame>); }} /></label>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        {(["FRONT", "UP", "DOWN", "BACK"] as const).map((how) => <button key={how} type="button" className="rounded border border-slate-300 px-2 py-0.5 dark:border-slate-600" onClick={() => onFrame({ z: (f.z ?? 0) + (how === "FRONT" ? 10 : how === "UP" ? 1 : how === "DOWN" ? -1 : -10) })}>{t(`v61.frame.${how}` as never)}</button>)}
      </div>
    </fieldset>
  );
}
