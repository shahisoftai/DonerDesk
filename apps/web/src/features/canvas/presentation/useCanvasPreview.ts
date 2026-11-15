"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isFiltered, type Canvas, type CrossFilter } from "@donordesk/domain/contexts/canvas/index.js";
import { previewCanvasAction, resolveCanvasAction } from "@/lib/actions/canvas";
import type { ResolvedCanvas } from "@/lib/server/schemas-canvas";

/**
 * What the canvas shows (Phase 45): the saved reading, or, while the person edits, the unsaved canvas read again after a short pause so each
 * change shows its real figures. A filtered saved canvas is read again with the viewer's choices; nothing is saved by either.
 */
export function useCanvasPreview({ canvas, id, projectId, filters, dirty, resolved, setResolved }: {
  canvas: Canvas;
  id: string;
  projectId: string | null | undefined;
  filters: CrossFilter;
  dirty: boolean;
  resolved: ResolvedCanvas | null | undefined;
  setResolved: (r: ResolvedCanvas) => void;
}) {
  // An edited, unsaved canvas is read again as the person works (after a short pause), so each change shows its real figures at once.
  const [preview, setPreview] = useState<{ sig: string; value: ResolvedCanvas } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const sig = useMemo(() => JSON.stringify({ t: canvas.title, th: canvas.themeId, l: canvas.language, m: canvas.mode, pages: canvas.pages, o: canvas.options, f: filters }), [canvas, filters]);
  const savedSig = useRef(sig);
  const filtered = useRef(false);
  useEffect(() => {
    if (!dirty) {
      setPreview(null); setPreviewError(null); savedSig.current = sig;
      // Narrowing a saved canvas reads it again with the viewer's period and places; nothing is saved.
      if (isFiltered(filters) || filtered.current) { filtered.current = isFiltered(filters); void resolveCanvasAction(id, { ...(filters.periodId ? { periodId: filters.periodId } : {}), places: filters.places, group: filters.group, status: filters.status, level: filters.level, indicator: filters.indicator, donors: filters.donors ?? [], partners: filters.partners ?? [], datasets: filters.datasets ?? [] }).then((r) => { if (r.ok) setResolved(r.value); }); }
      return;
    }
    let current = true;
    const timer = setTimeout(async () => {
      const r = await previewCanvasAction({ title: canvas.title, pages: canvas.pages, profile: canvas.profile, mode: canvas.mode, language: canvas.language, themeId: canvas.themeId, ...(canvas.options ? { options: canvas.options } : {}), ...(projectId ? { projectId: projectId } : {}), ...(filters.periodId ? { periodId: filters.periodId } : {}), ...(filters.places.length ? { placeKeys: filters.places } : {}), ...(filters.group ? { group: filters.group } : {}), ...(filters.status ? { status: filters.status } : {}), ...(filters.level ? { level: filters.level } : {}), ...(filters.indicator ? { indicator: filters.indicator } : {}), ...(filters.donors?.length ? { donors: filters.donors } : {}), ...(filters.partners?.length ? { partners: filters.partners } : {}), ...(filters.datasets?.length ? { datasetFilters: filters.datasets } : {}) });
      if (!current) return;
      if (r.ok) { setPreview({ sig, value: r.value }); setPreviewError(null); } else setPreviewError(r.error.message);
    }, 350);
    return () => { current = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, dirty]);
  const live = dirty && preview ? preview.value : resolved;
  const previewCurrent = !dirty || preview?.sig === sig;
  return { live, previewCurrent, previewError };
}
