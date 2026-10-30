"use client";

import { useEffect, useMemo, useState } from "react";
import { addMapOverlayAction, listMapOverlaysAction, readMapOverlayAction, removeMapOverlayAction } from "@/lib/actions/map-overlays";
import type { MapOverlayItem } from "@/lib/server/schemas-map-overlays";
import { parseOverlay, type Overlay } from "../domain/overlay-layer";
import { KML_MAX_BYTES, overlayFileToGeoJson } from "../domain/kml-to-geojson";

const merge = (name: string, parts: Overlay[]): Overlay | null =>
  parts.length === 0 ? null : { name, points: parts.flatMap((p) => p.points), lines: parts.flatMap((p) => p.lines) };

/**
 * Map overlays (after DevResults' "Map Overlays"): context such as rivers, roads or a camp outline. The organisation's kept overlays are listed to tick on or off; a
 * KML, KMZ (up to 3 MB) or GeoJSON file can be looked at for this visit, and kept for everyone by someone who may edit. An overlay is only drawn: nothing is reported
 * against it and it never replaces a boundary. The ticked ones are handed up as one overlay for the map to draw.
 */
export function OverlayPanel({ onOverlay }: { onOverlay: (overlay: Overlay | null) => void }) {
  const [stored, setStored] = useState<MapOverlayItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [data, setData] = useState<Map<string, Overlay>>(new Map());
  const [session, setSession] = useState<{ overlay: Overlay; geojson: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void listMapOverlaysAction().then((r) => { if (r.ok) { setStored(r.value.overlays); setCanEdit(r.value.canEdit); } }); }, []);

  const combined = useMemo(() => merge("Overlays", [...[...ticked].flatMap((id) => data.get(id) ?? []), ...(session ? [session.overlay] : [])]), [ticked, data, session]);
  useEffect(() => onOverlay(combined), [combined, onOverlay]);

  async function tick(o: MapOverlayItem, on: boolean) {
    setError(null);
    // The box changes at once; if the overlay cannot be opened it goes back.
    setTicked((t) => { const n = new Set(t); if (on) n.add(o.id); else n.delete(o.id); return n; });
    if (on && !data.has(o.id)) {
      const r = await readMapOverlayAction(o.id);
      const parsed = r.ok ? parseOverlay(r.value, o.name) : null;
      if (!r.ok || !parsed || !parsed.ok) {
        setError(r.ok && parsed && !parsed.ok ? parsed.reason : "That overlay could not be opened.");
        setTicked((t) => { const n = new Set(t); n.delete(o.id); return n; });
        return;
      }
      setData((d) => new Map(d).set(o.id, parsed.overlay));
    }
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > KML_MAX_BYTES * 2) { setError("That file is larger than 3 MB. Simplify it in Google Earth first."); return; }
    const converted = await overlayFileToGeoJson(file.name, new Uint8Array(await file.arrayBuffer()));
    if (!converted.ok) { setError(converted.reason); return; }
    const parsed = parseOverlay(converted.geojson, file.name);
    if (!parsed.ok) { setError(parsed.reason); return; }
    setSession({ overlay: parsed.overlay, geojson: converted.geojson, name: file.name });
  }

  async function keep() {
    if (!session) return;
    setBusy(true);
    const r = await addMapOverlayAction({ name: session.name, geojson: session.geojson });
    setBusy(false);
    if (!r.ok) { setError(r.error.message); return; }
    setStored((s) => [...s, r.value]);
    setData((d) => new Map(d).set(r.value.id, session.overlay));
    setTicked((t) => new Set(t).add(r.value.id));
    setSession(null);
  }

  async function remove(o: MapOverlayItem) {
    setBusy(true);
    const r = await removeMapOverlayAction(o.id);
    setBusy(false);
    if (!r.ok) { setError(r.error.message); return; }
    setStored((s) => s.filter((x) => x.id !== o.id));
    setTicked((t) => { const n = new Set(t); n.delete(o.id); return n; });
  }

  return (
    <div className="space-y-2 text-sm">
      <h3 className="font-medium">Overlays</h3>
      <p className="text-xs text-slate-500">Rivers, roads, a camp outline: context only. Nothing is reported against an overlay.</p>
      {stored.length === 0 ? <p className="text-xs text-slate-500">None kept yet.</p> : (
        <ul className="space-y-1">
          {stored.map((o) => (
            <li key={o.id} className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-1"><input type="checkbox" checked={ticked.has(o.id)} onChange={(e) => void tick(o, e.target.checked)} /><span className="truncate">{o.name}</span></label>
              {canEdit && <button type="button" className="text-xs underline disabled:opacity-50" disabled={busy} aria-label={`Remove the overlay ${o.name}`} onClick={() => void remove(o)}>Remove</button>}
            </li>
          ))}
        </ul>
      )}
      <label className="block font-medium">Look at a file
        <input type="file" accept=".kml,.kmz,.geojson,.json,.zip,.shp,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/geo+json" className="mt-1 block w-full text-xs" onChange={(e) => void choose(e.target.files?.[0])} />
      </label>
      <p className="text-xs text-slate-500">KML, KMZ, GeoJSON or a shapefile (.zip with the .shp, .dbf and .prj), up to 3 MB. Drawn for this visit unless you keep it.</p>
      {session && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>Showing “{session.name}”.</span>
          {canEdit && <button type="button" className="font-medium underline disabled:opacity-50" disabled={busy} onClick={() => void keep()}>Keep for everyone</button>}
          <button type="button" className="underline" onClick={() => setSession(null)}>Remove from this map</button>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-danger-600">{error}</p>}
    </div>
  );
}
