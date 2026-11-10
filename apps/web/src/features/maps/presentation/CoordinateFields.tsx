"use client";

import { useState } from "react";
import { formatPin, parsePin, type Pin } from "../domain/marking/pin";
import { useMapText } from "./useMapText";

/**
 * Placing a pin by typing its coordinates (Phase 49.9): what a device that cannot draw a map is offered. The same rule as the map's own
 * fields (`parsePin`); a problem is named, never saved.
 */
export function CoordinateFields({ value, onChange }: { value: Pin | null; onChange: (pin: Pin | null) => void }) {
  const { t } = useMapText();
  const [lat, setLat] = useState(value ? String(value.latitude) : "");
  const [lng, setLng] = useState(value ? String(value.longitude) : "");
  const [problem, setProblem] = useState<string | null>(null);
  function apply() {
    const r = parsePin(lat, lng);
    if (r === null) { setProblem(null); onChange(null); return; }
    if (!r.ok) { setProblem(t(`maps.pin.problem.${r.problem}`)); return; }
    setProblem(null);
    onChange(r.pin);
  }
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-slate-500">{t("maps.noWebGlPin")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col">{t("maps.pin.latitude")}<input inputMode="decimal" className="w-32 rounded border px-2 py-1" value={lat} onChange={(e) => setLat(e.target.value)} /></label>
        <label className="flex flex-col">{t("maps.pin.longitude")}<input inputMode="decimal" className="w-32 rounded border px-2 py-1" value={lng} onChange={(e) => setLng(e.target.value)} /></label>
        <button type="button" className="rounded border px-3 py-1" onClick={apply}>{t("maps.pin.apply")}</button>
      </div>
      {value && <p className="text-xs text-slate-500">{formatPin(value)}</p>}
      {problem && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{problem}</p>}
    </div>
  );
}
