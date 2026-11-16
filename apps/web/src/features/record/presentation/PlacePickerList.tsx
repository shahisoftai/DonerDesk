"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { PackEntryPlace } from "@/features/offline/domain/offline-pack";
import { filterPlaces } from "../domain/place-first";

/** The places a person can start from, as big buttons with a search box; the one used last is first. */
export function PlacePickerList({ places, recent, onChoose }: { places: readonly PackEntryPlace[]; recent?: string | undefined; onChoose: (place: PackEntryPlace) => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterPlaces(places, query, recent).slice(0, 60), [places, query, recent]);
  return (
    <div className="space-y-3">
      {places.length > 8 && <Input aria-label={t("placeEntry.findPlace")} placeholder={t("placeEntry.findPlace")} value={query} onChange={(e) => setQuery(e.target.value)} className="min-h-[52px] text-base" />}
      <ul className="-mx-4 divide-y divide-slate-200 dark:divide-white/10">
        {shown.map((p) => (
          <li key={p.placeId}>
            <button type="button" onClick={() => onChoose(p)} className="flex min-h-[60px] w-full flex-col justify-center px-4 text-start transition hover:bg-slate-50 dark:hover:bg-white/5">
              <span className="text-base font-semibold">{p.name}</span>
              {p.path !== p.name && <span className="text-sm text-slate-600 dark:text-slate-300">{p.path}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
