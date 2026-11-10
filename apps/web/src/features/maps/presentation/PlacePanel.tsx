"use client";

import type { PlacePanel as Panel } from "../domain/map-explorer";
import { useMapText } from "./useMapText";

/** What a click on the map shows: the place, its figures for every indicator, and the places inside it. */
export function PlacePanel({ panel, name, canDrill, drillLabel, onDrill, onSelect, onClose }: {
  panel: Panel | null;
  /** The clicked boundary's own name, shown even when no place in the list matches it. */
  name: string;
  canDrill: boolean;
  /** The button text; it names the level that would open. */
  drillLabel?: string;
  onDrill: () => void;
  onSelect: (placeId: string) => void;
  onClose: () => void;
}) {
  const { t } = useMapText();
  return (
    <aside aria-label={t("maps.panel.details")} className="card space-y-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{name}</h3>
          {panel && <p className="text-xs text-slate-500">{panel.path}</p>}
          {panel?.facility && <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("maps.panel.facility")}</p>}
        </div>
        <button type="button" className="rounded border px-2" aria-label={t("maps.panel.close")} onClick={onClose}>×</button>
      </div>
      {canDrill && <button type="button" className="btn-secondary" onClick={onDrill}>{drillLabel ?? t("maps.panel.openProvinces")}</button>}
      {!panel || panel.figures.length === 0 ? (
        <p className="text-slate-600">{t("maps.panel.noFigures")}</p>
      ) : (
        <ul className="space-y-1">
          {panel.figures.map((f) => (
            <li key={f.indicatorId}>
              <span className="font-medium">{f.code}</span> {f.name}: {f.display === null ? t("maps.panel.notCombined") : `${f.display}${f.unit ? ` ${f.unit}` : ""}`}
              {!f.verified && f.display !== null ? ` ${t("maps.panel.notVerified")}` : ""}
              {f.note && <span className="block text-xs text-slate-500">{f.note}</span>}
            </li>
          ))}
        </ul>
      )}
      {panel && panel.children.length > 0 && (
        <div>
          <p className="font-medium">{t("maps.panel.inside")}</p>
          <ul className="mt-1 space-y-1">
            {panel.children.map((c) => (
              <li key={c.placeId}>
                <button type="button" className="underline" onClick={() => onSelect(c.placeId)}>{c.name}</button>: {c.display ?? t("maps.panel.notMeasured")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
