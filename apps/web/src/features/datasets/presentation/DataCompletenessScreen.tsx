"use client";

import type { BlockModel, DataCompletenessModel, PaintFrame } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { NothingToShow, screenText } from "@/features/canvas/presentation/screens/screen-text";

/** Who reported, group × period: "3 of 4" with the share, and who is missing on hover. A cell is never coloured alone: the figure is written. */
export function DataCompletenessScreen({ model, frame }: { model: BlockModel<DataCompletenessModel>; frame: PaintFrame }) {
  const { t } = useI18n();
  if (model.state !== "ready") return <NothingToShow text={screenText(frame)} reason={model.reason} authoring={model.state === "empty" && model.authoring} />;
  const m = model.model;
  const cell = (g: string, p: string) => m.cells.find((c) => c.group === g && c.period === p);
  const tone = (share: number | null): string => (share === null ? "" : share >= 90 ? "bg-emerald-50 dark:bg-emerald-950" : share >= 60 ? "bg-amber-50 dark:bg-amber-950" : "bg-red-50 dark:bg-red-950");
  return (
    <div className="h-full overflow-auto px-3 py-2">
      <table className="w-full text-xs">
        <caption className="mb-1 text-start text-xs text-slate-500">{t("ds.completeness.caption", { unit: m.unitLabel })}</caption>
        <thead><tr><th scope="col" className="px-2 py-1 text-start" />{m.periods.map((p) => <th key={p} scope="col" className="px-2 py-1 text-end font-medium text-slate-600">{p}</th>)}</tr></thead>
        <tbody>
          {m.groups.map((g) => (
            <tr key={g} className="border-t border-slate-100 dark:border-slate-800">
              <th scope="row" className="px-2 py-1 text-start font-medium">{g}</th>
              {m.periods.map((p) => {
                const c = cell(g, p);
                return <td key={p} className={`px-2 py-1 text-end tabular-nums ${tone(c?.share ?? null)}`} title={c && c.missing.length ? t("ds.completeness.missing", { names: c.missing.slice(0, 10).join(", ") }) : undefined}>{c ? `${c.reported}/${c.expected}` : ""}{c?.share !== null && c ? <span className="ms-1 text-slate-500">({c.share} %)</span> : null}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {model.notes.map((n, i) => <p key={i} className="mt-1 text-[11px] text-slate-500">{n}</p>)}
    </div>
  );
}
