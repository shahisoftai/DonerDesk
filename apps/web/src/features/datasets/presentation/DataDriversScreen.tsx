"use client";

import type { BlockModel, DataDriversModel, PaintFrame } from "@donordesk/domain/contexts/canvas/index.js";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { NothingToShow, screenText } from "@/features/canvas/presentation/screens/screen-text";

/** What differs (§3.11): each ranked difference as a bar with its sentence and group sizes; refused candidates say why. Never a cause. */
export function DataDriversScreen({ model, frame }: { model: BlockModel<DataDriversModel>; frame: PaintFrame }) {
  const { t } = useI18n();
  if (model.state !== "ready") return <NothingToShow text={screenText(frame)} reason={model.reason} authoring={model.state === "empty" && model.authoring} />;
  const ranked = model.model.results.filter((r) => r.status === "RANKED");
  const refused = model.model.results.filter((r) => r.status === "REFUSED");
  const max = Math.max(0.1, ...ranked.map((r) => (r.status === "RANKED" ? Math.abs(r.effect) : 0)));
  return (
    <div className="h-full space-y-2 overflow-auto px-3 py-2 text-sm">
      {ranked.length === 0 && <p className="text-slate-500">{t("ds.drivers.none")}</p>}
      {ranked.map((r) => r.status === "RANKED" && (
        <div key={r.candidate} className="space-y-1">
          <div className="flex items-center gap-2"><span className="w-32 shrink-0 truncate text-xs font-medium">{r.label}: {r.group}</span>
            <span aria-hidden className={`h-3 rounded-sm ${r.difference >= 0 ? "bg-emerald-600" : "bg-amber-600"}`} style={{ width: `${(Math.abs(r.effect) / max) * 60}%` }} />
            <span className="text-xs tabular-nums text-slate-600">{r.difference >= 0 ? "+" : ""}{r.difference}</span></div>
          <p className="text-xs text-slate-600 dark:text-slate-300">{r.sentence} <span className="text-slate-400">{t("ds.drivers.interval", { from: r.interval[0], to: r.interval[1] })}</span></p>
        </div>
      ))}
      {refused.length > 0 && <ul className="space-y-0.5 text-[11px] text-slate-500">{refused.map((r) => r.status === "REFUSED" && <li key={r.candidate}>{r.reason}</li>)}</ul>}
      {model.notes.map((n, i) => <p key={i} className="text-[11px] text-slate-500">{n}</p>)}
    </div>
  );
}
