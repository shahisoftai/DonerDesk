"use client";

import type { MapTableRow } from "../domain/table/map-table";
import { useMapText } from "./useMapText";

const STATUS_KEY = { VERIFIED: "maps.table.status.verified", UNVERIFIED: "maps.table.status.unverified", NOT_MEASURED: "maps.table.status.notMeasured" } as const;

/**
 * The results map as a table: the way into it for a keyboard, a screen reader and a slow connection. A place with no figure says
 * "Not measured" (never 0), a place the map could not draw says so, and each row has a button that opens the place's details, the same
 * as clicking it on the map.
 */
export function MapDataTable({ rows, unit, selectedPlaceId, onSelect }: { rows: readonly MapTableRow[]; unit?: string | null | undefined; selectedPlaceId?: string | null | undefined; onSelect?: ((row: MapTableRow) => void) | undefined }) {
  const { t, levelSingular } = useMapText();
  if (rows.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("maps.table.empty")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-start text-sm" data-testid="map-table">
        <caption className="pb-1 text-start text-xs text-slate-500">{t("maps.table.caption")}</caption>
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-white/10">
            <th scope="col" className="py-1 pe-3 text-start font-medium">{t("maps.table.place")}</th>
            <th scope="col" className="py-1 pe-3 text-start font-medium">{t("maps.table.level")}</th>
            <th scope="col" className="py-1 pe-3 text-start font-medium">{t("maps.table.figure")}</th>
            <th scope="col" className="py-1 pe-3 text-start font-medium">{t("maps.table.status")}</th>
            {onSelect && <th scope="col" className="py-1"><span className="sr-only">{t("maps.table.details")}</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.placeId} className={`border-b border-slate-100 dark:border-white/5 ${row.placeId === selectedPlaceId ? "bg-slate-50 dark:bg-white/5" : ""}`} aria-current={row.placeId === selectedPlaceId ? "true" : undefined}>
              <th scope="row" className="py-1.5 pe-3 text-start font-medium">
                {row.name}
                {row.path !== row.name && <span className="block text-xs font-normal text-slate-500">{row.path}</span>}
              </th>
              <td className="py-1.5 pe-3">{levelSingular(row.level)}</td>
              <td className="py-1.5 pe-3">{row.figure === null ? t("maps.notMeasured") : <bdi dir="ltr">{`${row.figure}${unit ? ` ${unit}` : ""}`}</bdi>}</td>
              <td className="py-1.5 pe-3">{t(STATUS_KEY[row.status])} · {row.onMap ? t("maps.table.onMap") : t("maps.table.notOnMap")}</td>
              {onSelect && (
                <td className="py-1.5">
                  <button type="button" className="underline" aria-label={t("maps.table.detailsFor", { name: row.name })} onClick={() => onSelect(row)}>{t("maps.table.details")}</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
