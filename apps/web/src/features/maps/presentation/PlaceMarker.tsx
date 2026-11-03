"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useColorMode } from "../../design/presentation/use-color-mode";
import { geometryBounds } from "../domain/model/bounds";
import type { Bounds } from "../domain/model/scene";
import { canUndo, formatPin, fromGps, gpsFailureFor, nudge, parsePin, record, samePin, startHistory, undo, type Direction, type Pin, type PlacedBy } from "../domain/marking/pin";
import { describeAreas, type ContainingArea } from "../domain/marking/snap";
import type { PinPlacer } from "../ports/pin-placer";
import { useContainingAreas } from "./useContainingAreas";
import { useMapServices } from "./MapServices";
import { useMapText } from "./useMapText";

interface Scene { focus: Bounds | null; outline: unknown | null }

const DIRECTIONS: ReadonlyArray<{ id: Direction; key: string; glyph: string }> = [
  { id: "NORTH", key: "maps.pin.nudge.north", glyph: "↑" },
  { id: "SOUTH", key: "maps.pin.nudge.south", glyph: "↓" },
  { id: "WEST", key: "maps.pin.nudge.west", glyph: "←" },
  { id: "EAST", key: "maps.pin.nudge.east", glyph: "→" },
];

/**
 * Put one pin on a real map: click to drop it, drag it to move it, type or nudge it for exactness, use the device's location, undo.
 * It reports the pin and how it came to be; it never saves anything. The rules (range, rounding, undo, GPS) are in `domain/marking/`.
 */
export function PlaceMarker({ value, onChange, country, onAreas, onFailed, height = "h-64" }: {
  value: Pin | null;
  onChange: (pin: Pin | null, placedBy: PlacedBy) => void;
  /** Opens the map on this country and outlines its provinces. */
  country?: string | undefined;
  /** Told which areas the pin falls inside (a suggestion for the place's parent); never writes. */
  onAreas?: ((areas: ContainingArea[]) => void) | undefined;
  /** The map could not start: the caller falls back. */
  onFailed: () => void;
  height?: string;
}) {
  const services = useMapServices();
  const { t, lang, levelSingular } = useMapText();
  const dark = useColorMode() === "dark";
  const box = useRef<HTMLDivElement>(null);
  const placer = useRef<PinPlacer | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [history, setHistory] = useState(() => startHistory(value));
  const [lat, setLat] = useState(value ? String(value.latitude) : "");
  const [lng, setLng] = useState(value ? String(value.longitude) : "");
  const [problem, setProblem] = useState<string | null>(null);
  const [gps, setGps] = useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const areas = useContainingAreas(value, country, services.boundaries);

  useEffect(() => { onAreas?.(areas); }, [areas, onAreas]);

  const commit = useCallback((pin: Pin | null, by: PlacedBy) => {
    setHistory((h) => record(h, pin));
    setProblem(null);
    latest.current.onChange(pin, by);
  }, []);

  // Where to open and what to outline: the country's own boundary and its provinces, when the project has a country.
  useEffect(() => {
    let live = true;
    void (async () => {
      if (!country) { if (live) setScene({ focus: null, outline: null }); return; }
      const world = (await services.boundaries.load(null, 0)) ?? [];
      const home = world.find((u) => u.name.toLowerCase() === country.toLowerCase());
      const provinces = await services.boundaries.load({ name: country }, 1);
      if (!live) return;
      setScene({
        focus: home ? geometryBounds(home.geometry) : null,
        outline: provinces ? { type: "FeatureCollection", features: provinces.map((u) => ({ type: "Feature", properties: { name: u.name }, geometry: u.geometry })) } : null,
      });
    })().catch(() => { if (live) setScene({ focus: null, outline: null }); });
    return () => { live = false; };
  }, [country, services]);

  useEffect(() => {
    if (!scene || !box.current) return;
    let disposed = false;
    services.createPinPlacer(box.current, { basemap: dark ? "dark" : "light", focus: scene.focus, outline: scene.outline, lang })
      .then((p) => {
        if (disposed) { p.dispose(); return; }
        placer.current = p;
        p.onPlace((pin) => commit(pin, "MAP_PIN"));
        p.setPin(latest.current.value);
      })
      .catch(() => { if (!disposed) onFailed(); });
    return () => { disposed = true; placer.current?.dispose(); placer.current = null; };
    // The placer lives as long as the scene and the colour mode; the pin is moved by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, dark, lang, services]);

  // The pin follows the value, whoever changed it (a click, the boxes, undo, the parent form).
  useEffect(() => {
    placer.current?.setPin(value);
    setLat(value ? String(value.latitude) : "");
    setLng(value ? String(value.longitude) : "");
    setHistory((h) => (samePin(h.present, value) ? h : record(h, value)));
  }, [value]);

  function applyTyped() {
    const parsed = parsePin(lat, lng);
    if (parsed === null) { commit(null, "TYPED"); return; }
    if (!parsed.ok) { setProblem(t(`maps.pin.problem.${parsed.problem}`)); return; }
    commit(parsed.pin, "TYPED");
  }

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGps({ busy: false, note: t("maps.pin.gps.UNSUPPORTED") }); return; }
    setGps({ busy: true, note: null });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const fix = fromGps({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
        if (!fix.ok) { setGps({ busy: false, note: t(`maps.pin.problem.${fix.problem}`) }); return; }
        setGps({ busy: false, note: fix.vague && fix.accuracyMetres !== null ? t("maps.pin.gpsRough", { metres: fix.accuracyMetres }) : null });
        commit(fix.pin, "GPS");
      },
      (error) => setGps({ busy: false, note: t(`maps.pin.gps.${gpsFailureFor(error.code)}`) }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  function goBack() {
    const back = undo(history);
    setHistory(back);
    setProblem(null);
    latest.current.onChange(back.present, "MAP_PIN");
  }

  const inside = describeAreas(areas, levelSingular);
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
      <div ref={box} className={`${height} w-full overflow-hidden rounded-md`} role="application" aria-label={t("maps.pin.mapLabel")} />
      <p className="text-xs text-slate-500 dark:text-slate-400">{t("maps.pin.hint")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">{t("maps.pin.latitude")}
          <input className="input block w-32" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyTyped(); } }} />
        </label>
        <label className="text-xs">{t("maps.pin.longitude")}
          <input className="input block w-32" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyTyped(); } }} />
        </label>
        <button type="button" className="btn-secondary" onClick={applyTyped}>{t("maps.pin.apply")}</button>
        <button type="button" className="btn-secondary" onClick={useMyLocation} disabled={gps.busy}>{gps.busy ? t("maps.pin.locating") : t("maps.pin.useMyLocation")}</button>
        <button type="button" className="btn-secondary" onClick={goBack} disabled={!canUndo(history)}>{t("maps.pin.undo")}</button>
        <button type="button" className="btn-secondary" onClick={() => commit(null, "MAP_PIN")} disabled={!value}>{t("maps.pin.clear")}</button>
      </div>
      {value && (
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t("maps.pin.nudge")}>
          {DIRECTIONS.map((d) => <button key={d.id} type="button" className="rounded border px-2 text-sm" aria-label={t(d.key)} title={t(d.key)} onClick={() => commit(nudge(value, d.id), "MAP_PIN")}>{d.glyph}</button>)}
          <span className="ms-2 text-xs text-slate-500" data-testid="pin-readout"><bdi dir="ltr">{formatPin(value)}</bdi></span>
        </div>
      )}
      {!value && <p className="text-xs text-slate-500">{t("maps.pin.none")}</p>}
      {problem && <p role="alert" className="text-sm text-danger-600">{problem}</p>}
      {gps.note && <p role="status" className="text-xs text-slate-600 dark:text-slate-300">{gps.note}</p>}
      {inside && <p className="text-xs text-slate-600 dark:text-slate-300" data-testid="pin-inside">{t("maps.pin.inside", { areas: inside })}</p>}
    </div>
  );
}
