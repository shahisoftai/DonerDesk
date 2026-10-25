"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WORKPLAN_COPY } from "@donordesk/domain/contexts/workplan/index.js";
import { updatePlannedActivityAction } from "@/lib/actions/workplan";
import { useActionState } from "@/lib/client/action-state";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LocationPickerFigure } from "./LocationPickerFigure";

/**
 * Where a planned activity happens, editable after it was created: the typed place (with the map's own spellings suggested)
 * and, for a place the map does not know, a pin dropped by hand. A row the map could not place is fixed here, not by recreating it.
 */
export function LocationEditor({ itemId, location, latitude, longitude, country, customLayerUrl, canEdit }: {
  itemId: string;
  location: string | undefined;
  latitude: number | undefined;
  longitude: number | undefined;
  country?: string;
  customLayerUrl?: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const state = useActionState();
  const [text, setText] = useState(location ?? "");
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : null);
  const [pinOpen, setPinOpen] = useState(false);
  const [places, setPlaces] = useState<string[]>([]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) return setPlaces([]);
    let alive = true;
    void import("../domain/site-map").then(({ suggestPlaces }) => { if (alive) setPlaces(suggestPlaces(q, country)); }).catch(() => {});
    return () => { alive = false; };
  }, [text, country]);

  const unchanged = text.trim() === (location ?? "") && (pin?.latitude ?? null) === (latitude ?? null) && (pin?.longitude ?? null) === (longitude ?? null);

  async function save() {
    const done = await state.run(() => updatePlannedActivityAction(itemId, {
      location: text.trim() === "" ? null : text.trim(),
      latitude: pin ? pin.latitude : null,
      longitude: pin ? pin.longitude : null,
    }));
    if (done === true) router.refresh();
  }

  return (
    <section aria-labelledby="location-title" className="space-y-2">
      <h2 id="location-title" className="text-sm font-semibold">Where</h2>
      {!canEdit ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{location ?? "No place set."}</p>
      ) : (
        <div className="space-y-2">
          <label htmlFor="plan-location" className="block text-sm">Place</label>
          <Input id="plan-location" list="plan-item-places" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} className="max-w-md" />
          {places.length > 0 && <datalist id="plan-item-places">{places.map((p) => <option key={p} value={p} />)}</datalist>}
          {!pinOpen && !pin && (
            <button type="button" className="block text-sm font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => setPinOpen(true)}>{WORKPLAN_COPY.placeOnMap}</button>
          )}
          {(pinOpen || pin) && (
            <div className="max-w-xl space-y-2">
              <LocationPickerFigure value={pin} country={country} customLayerUrl={customLayerUrl} onChange={(next) => { setPin(next); if (next) setPinOpen(true); }} />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">{pin ? `${pin.latitude}, ${pin.longitude}` : WORKPLAN_COPY.pinHint}</p>
                {pin && <button type="button" className="text-sm font-medium text-slate-600 hover:underline dark:text-slate-300" onClick={() => setPin(null)}>{WORKPLAN_COPY.clearPin}</button>}
              </div>
            </div>
          )}
          <Button size="sm" onClick={save} pending={state.busy} disabled={unchanged}>Save place</Button>
        </div>
      )}
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
    </section>
  );
}
