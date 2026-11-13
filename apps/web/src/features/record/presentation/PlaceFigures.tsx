"use client";

import { useMemo } from "react";
import { placeEntries, placeRows, totalFromPlaces, type RecordablePlace } from "@donordesk/domain/contexts/places/place-recording.js";
import type { DisaggregationEntryInput } from "@donordesk/contracts";
import { Input } from "@/components/ui/Input";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/**
 * One figure per place (Phase 53.2): the rows are the project's places at the indicator's level; an empty box is left out, never stored as 0,
 * and the total is the sum of what was typed (additive types only, the rule is `totalFromPlaces`). It only reports entries and a total.
 */
export function PlaceFigures({ places, level, type, figures, onChange }: {
  places: readonly RecordablePlace[];
  level: number;
  type: string;
  figures: Readonly<Record<string, string>>;
  onChange: (figures: Record<string, string>, entries: DisaggregationEntryInput[], total: string) => void;
}) {
  const { t } = useI18n();
  const rows = useMemo(() => placeRows(places, level), [places, level]);
  const total = totalFromPlaces(type as never, rows.map((r) => ({ value: figures[r.placeId] ?? "" })));

  function set(placeId: string, value: string) {
    const next = { ...figures, [placeId]: value };
    const typed = rows.map((r) => ({ name: r.name, value: next[r.placeId] ?? "" }));
    onChange(next, placeEntries(typed), totalFromPlaces(type as never, typed) ?? "");
  }

  if (rows.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.value.byPlaceEmpty")}</p>;
  return (
    <fieldset className="space-y-2">
      <legend className="label">{t("record.value.byPlace")}</legend>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.placeId} className="flex items-center gap-3">
            <label className="min-w-0 flex-1 truncate text-base" htmlFor={`place-figure-${r.placeId}`}>{r.name}</label>
            <Input id={`place-figure-${r.placeId}`} className="min-h-[52px] w-32 text-lg font-semibold" inputMode="decimal" autoComplete="off" value={figures[r.placeId] ?? ""} onChange={(e) => set(r.placeId, e.target.value)} />
          </li>
        ))}
      </ul>
      {total !== null && <p className="text-sm font-semibold" role="status">{t("record.value.byPlaceTotal", { total })}</p>}
    </fieldset>
  );
}
