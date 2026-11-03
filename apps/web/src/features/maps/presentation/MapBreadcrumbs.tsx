"use client";

import type { DrillPath } from "../domain/drill/drill-path";
import { useMapText } from "./useMapText";

/** World › Country › Province › District … Each earlier crumb goes back to it. The last one is where the map is. */
export function MapBreadcrumbs({ path, onBack }: { path: DrillPath; onBack: (index: number) => void }) {
  const { t } = useMapText();
  return (
    <nav aria-label={t("maps.nav.label")} className="flex flex-wrap items-center gap-1 text-sm">
      {path.length === 0 ? <strong>{t("maps.world")}</strong> : <button type="button" className="underline" onClick={() => onBack(-1)}>{t("maps.world")}</button>}
      {path.map((crumb, i) => (
        <span key={`${crumb.level}:${crumb.ref}`} className="flex items-center gap-1">
          <span aria-hidden>›</span>
          {i === path.length - 1 ? <strong aria-current="location">{crumb.name}</strong> : <button type="button" className="underline" onClick={() => onBack(i)}>{crumb.name}</button>}
        </span>
      ))}
    </nav>
  );
}
