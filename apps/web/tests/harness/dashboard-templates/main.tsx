import { createRoot } from "react-dom/client";
import { TEMPLATE_SECTORS, copyTemplate } from "@donordesk/domain/contexts/dashboards/dashboard-templates.js";
import { SECTOR_TEMPLATES } from "@donordesk/domain/contexts/dashboards/sector-templates.js";
import { TemplateGallery } from "@/features/dashboards/presentation/TemplateGallery";
import { TemplateEditor } from "@/features/dashboards/presentation/TemplateEditor";
import { listDashboardTemplatesAction } from "@/lib/actions/dashboards";
import { DashboardCanvas } from "@/features/dashboards/presentation/DashboardCanvas";

const w = window as unknown as { __h: object; __pushed: string[] };
w.__pushed = [];
w.__h = { own: {}, saves: [], applies: [], deletes: [], failNext: null, n: 0 };
const params = new URLSearchParams(window.location.search);
const view = params.get("view") ?? "gallery";
if (view === "editor-own") {
  const c = copyTemplate(SECTOR_TEMPLATES.find((t) => t.id === "tpl-wash-access-hygiene")!, { id: "own0" });
  (w.__h as { own: Record<string, unknown> }).own.own0 = { template: c, updatedAt: "2026-10-10T08:00:00.000Z" };
}
const root = createRoot(document.getElementById("root")!);
void listDashboardTemplatesAction().then((r) => {
  const templates = r.ok ? r.value : [];
  const builtIn = SECTOR_TEMPLATES.find((t) => t.id === "tpl-wash-access-hygiene")!;
  root.render(
    <div style={{ padding: 16, maxWidth: 1100 }}>
      {view === "gallery" && <TemplateGallery templates={templates} projects={[{ id: "p1", name: "WASH project" }, { id: "p2", name: "Health project" }]} canEdit />}
      {view === "editor-own" && <TemplateEditor template={(w.__h as { own: Record<string, { template: never }> }).own.own0!.template} updatedAt="2026-10-10T08:00:00.000Z" canEdit />}
      {view === "editor-builtin" && <TemplateEditor template={builtIn} canEdit />}
      {view === "canvas" && (
        <DashboardCanvas
          editing={false} onChange={() => undefined} labels={{ p1: "WASH project" }}
          widgets={[
            { id: "t1", projectId: "p1", kind: "TEXT", text: "Figures are cumulative to date.", x: 0, y: 0, w: 12, h: 2 },
            { id: "t2", projectId: "p1", x: 0, y: 2, w: 6, h: 4, spec: { version: 2, kind: "SCORECARD_TABLE", dataset: { template: "INDICATORS_PROGRESS", indicatorIds: [], measure: "CUMULATIVE", showTarget: false, includeDraft: true } } as never },
            { id: "t3", projectId: "p9", x: 6, y: 2, w: 6, h: 4, spec: { template: "INDICATOR_OVER_TIME", indicatorIds: ["a"], measure: "PERIOD", type: "BAR", showTarget: false } as never },
          ]}
          charts={new Map<string, never>([
            ["t1", { widgetId: "t1", text: "Figures are cumulative to date." } as never],
            ["t2", { widgetId: "t2", table: { title: "Scorecard", columns: ["Code", "Indicator", "% of target"], rows: [["A", "People", "40%"], ["B", "Kits", "Not measured"]], notes: [] } } as never],
            ["t3", { widgetId: "t3", unavailable: "This chart is from a project you cannot see." } as never],
          ])}
        />
      )}
      <p hidden>{Object.keys(TEMPLATE_SECTORS).length}</p>
    </div>,
  );
});
