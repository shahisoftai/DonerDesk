import { createRoot } from "react-dom/client";
import { useState } from "react";
import { OverlayPanel } from "@/features/maps/presentation/OverlayPanel";
import { PhotosMapPanel } from "@/features/maps/presentation/PhotosMapPanel";
import type { Overlay } from "@/features/maps/domain/overlay-layer";

const photo = (id: string, location: string | undefined, o: Record<string, string> = {}) => ({ id, title: `Photo ${id}`, fileName: `${id}.jpg`, fileType: "image/jpeg", fileUrl: `/v1/files/t/${id}.jpg`, storageProvider: "LOCAL", location, ...o });
const photos = [photo("1", "Um Gargur"), photo("2", "Um Gargur"), photo("3", "Zzzz Nowhere"), photo("4", undefined), photo("5", "Um Gargur", { storageProvider: "GOOGLE_DRIVE", fileUrl: "https://drive.example/x" }), { ...photo("6", "Um Gargur"), fileType: "application/pdf" }];
const places = [{ name: "Um Gargur Camp", aliases: ["Um Gargur"], latitude: 13.2, longitude: 32.7 }];

function Page() {
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  (window as unknown as { __overlay: Overlay | null }).__overlay = overlay;
  return (
    <div style={{ padding: 16, maxWidth: 900 }} className="space-y-8">
      <OverlayPanel onOverlay={setOverlay} />
      <p data-testid="drawn">{overlay ? `${overlay.points.length} points, ${overlay.lines.length} lines` : "nothing drawn"}</p>
      <PhotosMapPanel projectId="p1" photos={photos} places={places} />
    </div>
  );
}
(window as unknown as { __h: object }).__h = { calls: [] };
createRoot(document.getElementById("root")!).render(<Page />);
