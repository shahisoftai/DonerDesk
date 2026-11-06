import { createRoot } from "react-dom/client";
import { useState } from "react";
import { MapExplorer } from "@/features/maps/presentation/MapExplorer";
import { PinPicker } from "@/features/maps/presentation/PinPicker";
import type { Pin, PlacedBy } from "@/features/maps/domain/marking/pin";
import { AreaDrawer } from "@/features/maps/presentation/AreaDrawer";
import type { DrawnShape, ShapeVerdict } from "@/features/maps/domain/marking/area-rules";
import { PlaceShapeEditor } from "@/features/places/presentation/PlaceShapeEditor";
import { BoundaryLayersCard } from "@/features/settings/presentation/BoundaryLayersCard";
import { MapWidget } from "@/features/dashboards/presentation/MapWidget";
import { ShareLinkProvider } from "@/features/dashboards/presentation/ShareLinkContext";
import { SiteMap } from "@/features/maps/presentation/SiteMap";
import { IndicatorResultsPanel } from "@/features/logframe/presentation/IndicatorResultsPanel";
import { I18nProvider } from "@/features/i18n/presentation/I18nProvider";
import { isLocale } from "@/features/i18n/domain/locales";
import { fixturePlaces, fixtureResults } from "./fixture";

// ?page=marker is the pin picker on its own, as a form would use it; anything else is the results map.
function Marker() {
  const [pin, setPin] = useState<Pin | null>(null);
  const [by, setBy] = useState<PlacedBy | null>(null);
  const [changes, setChanges] = useState(0);
  return (
    <div style={{ padding: 16, maxWidth: 720 }}>
      <PinPicker value={pin} country="Uganda" onChange={(next, how) => { setPin(next); setBy(how); setChanges((n) => n + 1); }} legacy={() => <p>legacy picker</p>} />
      <p data-testid="value">{pin ? `${pin.latitude},${pin.longitude}` : "none"}</p>
      <p data-testid="by">{by ?? "-"}</p>
      <p data-testid="changes">{changes}</p>
    </div>
  );
}

// ?page=drawer is the shape control on its own; ?page=editor is the place's outline editor with the signed-in actions stood in for.
function Drawer() {
  const [shape, setShape] = useState<DrawnShape | null>(null);
  const [verdict, setVerdict] = useState<ShapeVerdict | null>(null);
  return (
    <div style={{ padding: 16, maxWidth: 720 }}>
      <AreaDrawer value={shape} country="Uganda" onFailed={() => {}} onChange={(next, v) => { setShape(next); setVerdict(v); }} />
      <p data-testid="shape">{shape ? JSON.stringify(shape) : "none"}</p>
      <p data-testid="verdict">{verdict ? (verdict.ok ? `ok ${verdict.kind} ${verdict.vertices}` : `bad ${verdict.problem}`) : "-"}</p>
    </div>
  );
}
function Editor() {
  const parent = fixturePlaces.find((p) => p.id === "uga")!;
  const camp = { ...fixturePlaces[1]!, id: "camp", name: "Lacor Camp", parentId: "uga", ...(new URLSearchParams(window.location.search).get("has") ? { geometryKind: "POLYGON" as const } : {}) };
  return <div style={{ padding: 16, maxWidth: 720 }}><PlaceShapeEditor place={camp} parent={parent} country="Uganda" onClose={() => { (window as unknown as { __closed: boolean }).__closed = true; }} /></div>;
}

// ?page=boundary-card is the settings card, with whatever layers window.__layers lists.
function BoundaryCard() {
  return <div style={{ padding: 16, maxWidth: 820 }}><BoundaryLayersCard layers={(window as unknown as { __layers?: never[] }).__layers ?? []} /></div>;
}

// ?page=shared-map is a results map on a shared dashboard (with the link's token, or with &nolink=1 as a fixed view); ?page=sites is the sites map.
const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789";
function SharedMap() {
  const link = !new URLSearchParams(window.location.search).get("nolink");
  const preloaded = { places: { places: fixturePlaces, canEdit: false }, results: { ...fixtureResults, periods: [{ id: "p1", label: "January" }, { id: "p2", label: "February" }] } };
  const body = <div style={{ padding: 16, maxWidth: 900, height: 760 }}><MapWidget view="RESULTS" projectId="p1" widgetId="w-results" preloaded={preloaded} /></div>;
  return link ? <ShareLinkProvider value={{ token: TOKEN }}>{body}</ShareLinkProvider> : body;
}
const SITE = { name: "Gulu", province: "Northern", country: "Uganda", lat: 2.77, lng: 32.3, worst: "LATE" as const, risks: ["Road washed out"], items: [{ id: "a", title: "Train staff", signal: "LATE" as const }, { id: "b", title: "Survey", signal: "DONE" as const }] };
function IndicatorResults() {
  return <div style={{ padding: 16, maxWidth: 1200 }}><IndicatorResultsPanel projectId="p1" indicatorId="i1" places={fixturePlaces} initial={fixtureResults} periods={[{ id: "p1", label: "January" }, { id: "p2", label: "February" }, { id: "p3", label: "March" }]} /></div>;
}
function Sites() {
  return <div style={{ padding: 16, maxWidth: 800 }}><SiteMap points={[SITE]} country="Uganda" caption="Where we work" /></div>;
}

const page = new URLSearchParams(window.location.search).get("page");
const asked = new URLSearchParams(window.location.search).get("locale");
createRoot(document.getElementById("root")!).render(
  <I18nProvider initialLocale={isLocale(asked) ? asked : "en"}>
  {page === "marker" ? <Marker /> : page === "shared-map" ? <SharedMap /> : page === "sites" ? <Sites /> : page === "indicator-results" ? <IndicatorResults /> : page === "drawer" ? <Drawer /> : page === "boundary-card" ? <BoundaryCard /> : page === "editor" ? <Editor /> : (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <MapExplorer projectId="p1" places={fixturePlaces} initial={fixtureResults} activityCounts={{ clinic: 3, gulu: 1 }} periods={new URLSearchParams(window.location.search).get("periods") ? [{ id: "p1", label: "January" }, { id: "p2", label: "February" }] : []} />
    </div>
  )}
  </I18nProvider>
);
