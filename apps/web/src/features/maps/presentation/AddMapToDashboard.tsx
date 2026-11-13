"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCanvasAction } from "@/lib/actions/canvas";
import { fitText, mapOnlyPages } from "../domain/map-page";
import { useMapText } from "./useMapText";

/** The map's last step (Phase 53.3): make it a dashboard in one click. Sharing and downloading are then on the dashboard itself. */
export function AddMapToDashboard({ projectId, projectName, indicatorId }: { projectId: string; projectName: string; indicatorId?: string | undefined }) {
  const { t } = useMapText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true); setError(null);
    const title = t("maps.builder.dashboardTitle", { project: projectName });
    const r = await createCanvasAction({ title: fitText(title, 120), scope: "PROJECT", projectId, pages: mapOnlyPages({ projectId, indicatorId, title, alt: t("maps.builder.alt", { project: projectName }) }) });
    if (!r.ok) { setBusy(false); setError(r.error.message); return; }
    router.push(`/visuals/${r.value.id}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3" data-no-print>
      <button type="button" className="btn-primary" disabled={busy} onClick={() => void add()}>{t("maps.builder.add")}</button>
      {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
    </div>
  );
}
