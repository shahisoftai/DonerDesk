"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { importPlacesAction } from "@/lib/actions/places";
import { useActionState } from "@/lib/client/action-state";
import type { PlaceImportPreview, PlaceItem } from "@/lib/server/schemas-places";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import type { Pin } from "@/features/maps/domain/marking/pin";
import { goTo, isFinished, pendingCount, placeCurrent, placedItems, sheetFor, skipCurrent, startWalk } from "@/features/maps/domain/marking/bulk-place";
import { suggestParent, type ContainingArea } from "@/features/maps/domain/marking/snap";
import { PinPicker } from "@/features/maps/presentation/PinPicker";
import { useMapText } from "@/features/maps/presentation/useMapText";
import { LocationPickerFigure } from "@/features/workplan/presentation/LocationPickerFigure";

/**
 * Put the words nobody has placed yet on the map, one after another. Each is pinned or skipped; nothing is saved until the end, and
 * the saving is the ordinary places sheet: any bad row blocks the whole set and names its row, and a place already listed is skipped.
 */
export function BulkPlaceWalk({ texts, places, onClose }: { texts: readonly string[]; places: readonly PlaceItem[]; onClose: () => void }) {
  const router = useRouter();
  const { t, levelSingular } = useMapText();
  const check = useActionState();
  const [walk, setWalk] = useState(() => startWalk(texts));
  const [pin, setPin] = useState<Pin | null>(null);
  const [level, setLevel] = useState("4");
  const [useParent, setUseParent] = useState(true);
  const [areas, setAreas] = useState<ContainingArea[]>([]);
  const [preview, setPreview] = useState<PlaceImportPreview | null>(null);
  const live = useMemo(() => places.filter((p) => !p.archived), [places]);
  const country = live.find((p) => p.adminLevel === 0)?.name;
  const parent = suggestParent(areas, live, null);
  const current = walk.items[walk.current];
  const placed = placedItems(walk);

  function go(next: typeof walk) { setWalk(next); const item = next.items[next.current]; setPin(item?.pin ?? null); setLevel(String(item?.level ?? 4)); setPreview(null); }

  async function run(apply: boolean) {
    const out = await check.run(() => importPlacesAction({ text: sheetFor(walk), apply }));
    if (!out) return;
    setPreview(out);
    if (apply && out.applied) { router.refresh(); onClose(); }
  }

  if (!current) return <p className="text-sm text-slate-600">{t("maps.walk.nothing")}</p>;
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-white/10" aria-label={t("maps.walk.aria")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm" aria-live="polite"><strong>{current.text}</strong> <span className="text-slate-500">· {t("maps.walk.progress", { placed: placed.length, skipped: walk.items.filter((i) => i.status === "SKIPPED").length, pending: pendingCount(walk) })}</span></p>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>{t("maps.close")}</Button>
      </div>
      <PinPicker value={pin} country={country} onAreas={setAreas} onChange={(next) => setPin(next)}
        legacy={({ value, onChange }) => <LocationPickerFigure value={value} {...(country ? { country } : {})} onChange={onChange} />} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">{t("maps.walk.kind")}
          <Select className="block" value={level} onChange={(e) => setLevel(e.target.value)}>
            {[1, 2, 3, 4].map((l) => <option key={l} value={l}>{levelSingular(l)}</option>)}
          </Select>
        </label>
        {parent && <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={useParent} onChange={(e) => setUseParent(e.target.checked)} /> {t("maps.walk.putUnder", { name: parent.name })}</label>}
        <Button type="button" disabled={!pin} onClick={() => { go(placeCurrent(walk, pin!, Number(level), parent && useParent ? parent.name : undefined)); }}>{t("maps.walk.placeNext")}</Button>
        <Button type="button" variant="secondary" onClick={() => go(skipCurrent(walk))}>{t("maps.walk.skip")}</Button>
      </div>
      <ul className="flex flex-wrap gap-1 text-xs" aria-label={t("maps.walk.all")}>
        {walk.items.map((item, i) => (
          <li key={item.text}>
            <button type="button" className={`rounded-full border px-2 py-0.5 ${i === walk.current ? "border-brand-600 bg-brand-50 dark:bg-white/10" : ""}`} onClick={() => go(goTo(walk, i))}>
              {item.status === "PLACED" ? "✓ " : item.status === "SKIPPED" ? "– " : ""}{item.text}
            </button>
          </li>
        ))}
      </ul>
      {(isFinished(walk) || placed.length > 0) && (
        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-white/10">
          <Button type="button" onClick={() => void run(false)} pending={check.busy} disabled={placed.length === 0}>{t("maps.walk.check", { count: placed.length })}</Button>
          {check.error && <p role="alert" className="text-sm text-danger-600">{check.error}</p>}
          {preview && preview.problems.length > 0 && (
            <ul role="alert" className="list-disc pl-5 text-sm text-danger-600">{preview.problems.map((p) => <li key={`${p.row}-${p.message}`}>{t("maps.walk.row", { row: p.row, message: p.message })}</li>)}</ul>
          )}
          {preview && preview.problems.length === 0 && !preview.applied && (
            <div className="space-y-2 text-sm">
              <p>{preview.create.length === 0 ? t("maps.walk.nothingNew") : t("maps.walk.willAdd", { count: preview.create.length })}{preview.skipped.length > 0 ? ` · ${t("maps.walk.alreadyListed", { count: preview.skipped.length })}` : ""}</p>
              {preview.create.length > 0 && <Button type="button" onClick={() => void run(true)} pending={check.busy}>{t("maps.walk.save", { count: preview.create.length })}</Button>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
