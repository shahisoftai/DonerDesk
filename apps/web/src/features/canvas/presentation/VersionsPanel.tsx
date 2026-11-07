"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { useEffect, useState } from "react";
import type { Canvas } from "@donordesk/domain/contexts/canvas/index.js";
import { getCanvasVersionAction, listCanvasVersionsAction } from "@/lib/actions/canvas-publishing";
import type { CanvasVersionView } from "@/lib/server/schemas-canvas";

interface Props { canvasId: string; /** Bumps after every save so the list shows the new version. */ revision: number; canEdit: boolean; onRestore: (title: string, canvas: Canvas) => void }

/** The earlier versions of the canvas. Putting one back is an edit you can undo and still have to save. */
export function VersionsPanel({ canvasId, revision, canEdit, onRestore }: Props) {
  const { t } = useI18n();
  const [versions, setVersions] = useState<CanvasVersionView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => { void listCanvasVersionsAction(canvasId).then((r) => { if (r.ok) setVersions(r.value); else setError(r.error.message); }); }, [canvasId, revision]);

  async function restore(v: number): Promise<void> {
    setBusy(v); setError(null);
    const r = await getCanvasVersionAction(canvasId, v);
    setBusy(null);
    if (r.ok) onRestore(r.value.title, r.value.canvas); else setError(r.error.message);
  }
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!versions) return <p className="text-sm text-slate-500">Reading the history…</p>;
  if (versions.length === 0) return <p className="text-sm text-slate-500" data-testid="no-versions">{t("canvas.ui.noVersions")}</p>;
  return (
    <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800" data-testid="versions">
      {versions.map((v) => (
        <li key={v.revision} className="flex items-center justify-between gap-2 py-1.5">
          <span>{t("canvas.ui.versionLine", { n: v.revision, title: v.title, when: new Date(v.savedAt).toLocaleString() })}</span>
          {canEdit && <button type="button" className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800" disabled={busy !== null} onClick={() => void restore(v.revision)}>{busy === v.revision ? t("canvas.ui.saving") : t("canvas.ui.putOnPage")}</button>}
        </li>
      ))}
    </ul>
  );
}
