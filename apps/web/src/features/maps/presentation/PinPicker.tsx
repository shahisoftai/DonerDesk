"use client";

import { type Pin, type PlacedBy } from "../domain/marking/pin";
import type { ContainingArea } from "../domain/marking/snap";
import { CoordinateFields } from "./CoordinateFields";
import { PlaceMarker } from "./PlaceMarker";
import { useMapEngine } from "./useMapEngine";
import { useMapText } from "./useMapText";

/**
 * "Place on map" for any form: the map when the device can draw it, typed coordinates when it cannot (Phase 49.9: one engine). Both give
 * the form the same thing: a pin or null. The form keeps the value; this saves nothing.
 */
export function PinPicker({ value, onChange, country, onAreas }: {
  value: Pin | null;
  onChange: (pin: Pin | null, placedBy: PlacedBy) => void;
  country?: string | undefined;
  onAreas?: ((areas: ContainingArea[]) => void) | undefined;
}) {
  const { engine, markFailed } = useMapEngine();
  const { t } = useMapText();
  if (engine === "pending") return <p className="text-sm text-slate-500">{t("maps.loading")}</p>;
  if (engine === "maplibre") return <PlaceMarker value={value} onChange={onChange} country={country} onAreas={onAreas} onFailed={markFailed} />;
  return <CoordinateFields value={value} onChange={(pin) => onChange(pin, "TYPED")} />;
}
