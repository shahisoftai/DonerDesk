import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { MapExplorer } from "@/features/maps/presentation/MapExplorer";
import { MapLibreCanvas } from "@/features/maps/presentation/MapLibreCanvas";
import { unitFromFeature } from "@/features/maps/domain/boundaries/join";
import { geometryBounds, unionBounds } from "@/features/maps/domain/model/bounds";
import type { MapScene } from "@/features/maps/domain/model/scene";
import { fixturePlaces, fixtureResults } from "../fixture";

// ?page=heavy draws every admin 4 unit of Bangladesh at once (5,160 units, about 259,000 vertices): the largest view the product could be asked for.
function Heavy() {
  const [scene, setScene] = useState<MapScene | null>(null);
  useEffect(() => {
    void fetch("/geo/BGD/ADM4.json").then((r) => r.json()).then((collection: { features: unknown[] }) => {
      const units = collection.features.map((f) => unitFromFeature(f as Parameters<typeof unitFromFeature>[0])).filter((u) => u !== null);
      setScene({
        label: "Bangladesh at admin 4", basemap: "plain", tips: {}, bounds: unionBounds(units.map((u) => geometryBounds(u!.geometry))),
        layers: [{ kind: "FILL", opacity: 0.85, outline: true, selectedRef: null, features: units.map((u) => ({ ref: u!.ref, name: u!.name, color: "#cbd5e1", geometry: u!.geometry })) }],
      });
    });
  }, []);
  return <div style={{ padding: 16, width: 1100 }}>{scene ? <MapLibreCanvas scene={scene} height="h-[600px]" onSelect={() => {}} onFailed={() => {}} /> : "loading"}</div>;
}

// ?page=pins&n=10000 draws N pins spread over Nigeria, clustered as the product draws them (Phase 49.0/49.4): the panning measurement.
function Pins({ n }: { n: number }) {
  const pins = Array.from({ length: n }, (_, i) => {
    const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12543.1234;
    return { id: `p${i}`, name: `Site ${i}`, lng: 3 + (a - Math.floor(a)) * 11, lat: 4.5 + (b - Math.floor(b)) * 9, color: ["#059669", "#dc2626", "#2563eb"][i % 3]!, radius: 5 };
  });
  const scene: MapScene = { label: `${n} pins`, basemap: "plain", tips: {}, bounds: [3, 4.5, 14, 13.5], layers: [{ kind: "PINS", pins, opacity: 1, selectedId: null, cluster: n > 200 }] };
  return <div style={{ padding: 16, width: 1100 }}><MapLibreCanvas scene={scene} height="h-[600px]" onSelect={() => {}} onFailed={() => {}} /></div>;
}

const page = new URLSearchParams(window.location.search).get("page");
createRoot(document.getElementById("root")!).render(
  page === "heavy" ? <Heavy /> : page === "pins" ? <Pins n={Number(new URLSearchParams(window.location.search).get("n") ?? 1000)} /> : <div style={{ padding: 16, width: 1100 }}><MapExplorer projectId="p1" places={fixturePlaces} initial={fixtureResults} periods={[]} /></div>,
);
