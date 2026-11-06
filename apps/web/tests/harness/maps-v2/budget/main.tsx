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

const page = new URLSearchParams(window.location.search).get("page");
createRoot(document.getElementById("root")!).render(
  page === "heavy" ? <Heavy /> : <div style={{ padding: 16, width: 1100 }}><MapExplorer projectId="p1" places={fixturePlaces} initial={fixtureResults} periods={[]} /></div>,
);
