"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearPlaceGeometryAction, getPlaceGeometryAction, setPlaceGeometryAction } from "@/lib/actions/places";
import { useActionState } from "@/lib/client/action-state";
import type { PlaceItem } from "@/lib/server/schemas-places";
import { Button } from "@/components/ui/Button";
import type { DrawnShape, ShapeVerdict } from "@/features/maps/domain/marking/area-rules";
import { AreaDrawer } from "@/features/maps/presentation/AreaDrawer";
import { useMapEngine } from "@/features/maps/presentation/useMapEngine";
import { useMapText } from "@/features/maps/presentation/useMapText";

/**
 * Draw, change or remove the outline or route of one area. Nothing is stored until Save: the shape is checked on screen by the domain's
 * rule and again by the server, and a stored shape is only ever replaced or removed by this form.
 */
export function PlaceShapeEditor({ place, parent, country, onClose }: { place: PlaceItem; parent?: PlaceItem | undefined; country?: string | undefined; onClose: () => void }) {
  const router = useRouter();
  const state = useActionState();
  const { engine, markFailed } = useMapEngine();
  const { t } = useMapText();
  const [shape, setShape] = useState<DrawnShape | null>(null);
  const [verdict, setVerdict] = useState<ShapeVerdict | null>(null);
  const [loaded, setLoaded] = useState(!place.geometryKind);
  const [parentShape, setParentShape] = useState<{ name: string; geometry: unknown } | null>(null);
  const [failed, setFailed] = useState(false);
  const original = useRef<string>("null");

  useEffect(() => {
    let live = true;
    if (place.geometryKind) {
      void getPlaceGeometryAction(place.id).then((r) => {
        if (!live) return;
        if (r.ok) { setShape(r.value.geometry as DrawnShape); original.current = JSON.stringify(r.value.geometry); }
        setLoaded(true);
      });
    }
    if (parent?.geometryKind) void getPlaceGeometryAction(parent.id).then((r) => { if (live && r.ok) setParentShape({ name: parent.name, geometry: r.value.geometry }); });
    return () => { live = false; };
  }, [place.id, place.geometryKind, parent?.id, parent?.geometryKind, parent?.name]);

  const changed = JSON.stringify(shape) !== original.current;
  const canSave = loaded && changed && shape !== null && verdict?.ok === true;
  const willRemove = loaded && changed && shape === null && !!place.geometryKind;

  async function save() {
    if (willRemove) {
      const done = await state.run(() => clearPlaceGeometryAction(place.id));
      if (done !== undefined) { router.refresh(); onClose(); }
      return;
    }
    if (!shape) return;
    const done = await state.run(() => setPlaceGeometryAction(place.id, shape));
    if (done !== undefined) { router.refresh(); onClose(); }
  }

  if (engine === "pending") return <p className="text-sm text-slate-500">{t("maps.loading")}</p>;
  if (engine === "echarts" || failed) return <p role="alert" className="card text-sm">{failed ? t("maps.draw.unavailable") : t("maps.draw.noWebGl")}</p>;
  return (
    <section className="card space-y-3" aria-label={t("maps.shape.aria", { name: place.name })}>
      <h3 className="text-sm font-semibold">{t(place.geometryKind ? "maps.shape.titleChange" : "maps.shape.titleDraw", { name: place.name })}</h3>
      {!loaded ? <p className="text-sm text-slate-500">{t("maps.shape.loadingSaved")}</p> : (
        <AreaDrawer value={shape} country={country} parent={parentShape} onFailed={() => { setFailed(true); markFailed(); }} onChange={(next, v) => { setShape(next); setVerdict(v); }} />
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void save()} pending={state.busy} disabled={!canSave && !willRemove}>{willRemove ? t("maps.shape.removeFromPlace") : t("maps.shape.save")}</Button>
        <Button type="button" variant="secondary" onClick={onClose} disabled={state.busy}>{t("maps.cancel")}</Button>
      </div>
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
    </section>
  );
}
