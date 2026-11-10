"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlaceAction } from "@/lib/actions/places";
import type { PlaceItem } from "@/lib/server/schemas-places";
import { Button } from "@/components/ui/Button";
import { PinPicker } from "@/features/maps/presentation/PinPicker";
import { useMapText } from "@/features/maps/presentation/useMapText";
import type { Pin, PlacedBy } from "@/features/maps/domain/marking/pin";

/**
 * Pins an existing place, or changes or clears its pin, and says whether it is a facility (Phase 49). A place needs a pin to take part in
 * distances, rings and the nearest-facility list, and to be drawn as a dot; the list could only add pins to new places before.
 */
export function PlacePinEditor({ place, country, onClose }: { place: PlaceItem; country?: string | undefined; onClose: () => void }) {
  const { t } = useMapText();
  const router = useRouter();
  const [pin, setPin] = useState<Pin | null>(place.latitude !== undefined && place.longitude !== undefined ? { latitude: place.latitude, longitude: place.longitude } : null);
  const [by, setBy] = useState<PlacedBy>("MAP_PIN");
  const [facility, setFacility] = useState(Boolean(place.facility));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null);
    try {
      const r = await updatePlaceAction(place.id, { latitude: pin?.latitude ?? null, longitude: pin?.longitude ?? null, facility, ...(pin ? { placedBy: by } : {}) });
      if (!r.ok) { setError(r.error.message); return; }
      router.refresh();
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <section className="card space-y-3" aria-label={t("maps.places.pinFor", { name: place.name })}>
      <h3 className="text-sm font-semibold">{t("maps.places.pinFor", { name: place.name })}</h3>
      <PinPicker value={pin} country={country} onChange={(next, placedBy) => { setPin(next); setBy(placedBy); }} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={facility} onChange={(e) => setFacility(e.target.checked)} /> {t("maps.places.isFacility")}</label>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void save()} pending={busy} disabled={busy}>{t("maps.places.savePin")}</Button>
        <Button size="sm" variant="secondary" onClick={onClose} disabled={busy}>{t("maps.places.cancelPin")}</Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
    </section>
  );
}
