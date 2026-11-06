"use client";

import type { ReactNode } from "react";
import { formatPin, type Pin, type PlacedBy } from "../domain/marking/pin";
import type { ContainingArea } from "../domain/marking/snap";
import { PlaceMarker } from "./PlaceMarker";
import { useMapEngine } from "./useMapEngine";
import { useMapText } from "./useMapText";

/**
 * "Place on map" for any form: the real map when the browser can draw it, the older figure when it cannot (no WebGL, or the new
 * map not switched on). Both give the form the same thing: a pin or null. The form keeps the value; this saves nothing.
 */
export function PinPicker({ value, onChange, country, onAreas, legacy }: {
  value: Pin | null;
  onChange: (pin: Pin | null, placedBy: PlacedBy) => void;
  country?: string | undefined;
  onAreas?: ((areas: ContainingArea[]) => void) | undefined;
  /** The older picker, drawn when the new map is unavailable. */
  legacy: (props: { value: Pin | null; onChange: (pin: Pin | null) => void }) => ReactNode;
}) {
  const { engine, markFailed } = useMapEngine();
  const { t } = useMapText();
  if (engine === "pending") return <p className="text-sm text-slate-500">{t("maps.loading")}</p>;
  if (engine === "maplibre") return <PlaceMarker value={value} onChange={onChange} country={country} onAreas={onAreas} onFailed={markFailed} />;
  return (
    <div className="space-y-2">
      {legacy({ value, onChange: (pin) => onChange(pin, "MAP_PIN") })}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">{value ? formatPin(value) : t("maps.pin.hint")}</p>
        {value && <button type="button" className="text-sm font-medium text-slate-600 hover:underline dark:text-slate-300" onClick={() => onChange(null, "MAP_PIN")}>{t("maps.pin.clear")}</button>}
      </div>
    </div>
  );
}
