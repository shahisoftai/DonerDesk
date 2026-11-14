"use client";

import { useRouter } from "next/navigation";
import { createCanvasAction } from "@/lib/actions/canvas";
import { fitText, mapOnlyPages } from "../domain/map-page";
import { useMapText } from "./useMapText";
import { AddToDashboard } from "@/features/dashboards/presentation/AddToDashboard";

/**
 * The map's last step (Phase 53.3): put it on a dashboard. Version 4.000 (plan F24) uses the shared control: add the map to a
 * dashboard you can change, or make a new dashboard of just this map.
 */
export function AddMapToDashboard({ projectId, projectName, indicatorId }: { projectId: string; projectName: string; indicatorId?: string | undefined }) {
  const { t } = useMapText();
  const router = useRouter();
  const title = t("maps.builder.dashboardTitle", { project: projectName });
  return (
    <div data-no-print>
      <AddToDashboard
        projectId={projectId}
        choices={[{ key: "map", label: "Add the map", input: { map: { view: "RESULTS", title: fitText(title, 60), ...(indicatorId ? { indicatorId } : {}) } } }]}
        startNew={{
          label: t("maps.builder.add"),
          run: async () => {
            const r = await createCanvasAction({ title: fitText(title, 120), scope: "PROJECT", projectId, pages: mapOnlyPages({ projectId, indicatorId, title, alt: t("maps.builder.alt", { project: projectName }) }) });
            if (r.ok) router.push(`/visuals/${r.value.id}`);
          },
        }}
      />
    </div>
  );
}
