import { createRoot } from "react-dom/client";
import { HomeGrid } from "@/features/dashboard/presentation/HomeGrid";
import { HomeLayoutEditor } from "@/features/dashboard/presentation/HomeLayoutEditor";
import { CollapsedPanel, Panel } from "@/features/dashboard/presentation/HomeParts";
import { resolveLayout, type LayoutPanel } from "@/features/dashboard/domain/home-layout";
import { PANEL_LABEL } from "@/features/dashboard/domain/home-layout-copy";

const w = window as unknown as { __h: Record<string, unknown> };
w.__h = { saves: [], resets: [], refreshes: 0, saveAnswer: { ok: true, value: { updatedAt: "2026-11-05T00:00:00.000Z" } } };

const scenario = new URLSearchParams(location.hash.slice(1));
const poor = scenario.get("data") === "poor";
const saved = scenario.get("layout") === "saved"
  ? [{ key: "RISKS", span: 6, hidden: false }, { key: "MAP", span: 12, hidden: true }, { key: "HEADLINES", span: 12, hidden: false }]
  : null;
const layout = resolveLayout("MANAGER", saved);

// Panels with a lot to show are tall, panels with little are short, and with poor data the light panels are the slim collapsed line.
const TALL: ReadonlySet<LayoutPanel> = new Set(["PROJECT_HEALTH", "PIPELINE", "MAP", "BREAKDOWNS"]);
const EMPTYABLE: ReadonlySet<LayoutPanel> = new Set(["UPCOMING_REPORTS", "PIPELINE", "RISKS", "RESULTS", "YOUR_WORK", "NOTIFICATIONS"]);
const render = (key: LayoutPanel) => {
  if (poor && EMPTYABLE.has(key)) return <CollapsedPanel title={PANEL_LABEL[key]} message="Nothing to show." href="/x" />;
  const rows = TALL.has(key) ? 6 : 3;
  return <Panel title={PANEL_LABEL[key]}><ul>{Array.from({ length: rows }, (_, i) => <li key={i} style={{ height: 48 }}>row {i + 1}</li>)}</ul></Panel>;
};

createRoot(document.getElementById("root")!).render(
  <div style={{ maxWidth: 1240, margin: "0 auto", padding: 16 }} className="space-y-6">
    <div className="flex justify-end"><HomeLayoutEditor variant="MANAGER" initial={[...layout]} version={saved ? "2026-11-04T00:00:00.000Z" : null} /></div>
    <div data-testid="grid"><HomeGrid layout={layout} render={render} /></div>
  </div>,
);
