"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordIndicatorsByPlaceAction } from "@/lib/actions/indicators";
import { useMapText } from "./useMapText";

/** The empty map's one-click fix (Phase 53.6): every countable indicator is recorded by place; the page then reloads to say what is next. */
export function RecordByPlaceButton({ projectId }: { projectId: string }) {
  const { t } = useMapText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    const r = await recordIndicatorsByPlaceAction(projectId);
    setBusy(false);
    if (!r.ok) { setSaid(r.error.message); return; }
    setSaid(t("maps.ready.recordedByPlace", { count: r.value.changed }));
    router.refresh();
  }
  return (
    <>
      <button type="button" className="btn-primary" disabled={busy} onClick={() => void go()} data-testid="record-by-place-all">{t("maps.ready.recordAllByPlace")}</button>
      {said && <p role="status" className="text-sm">{said}</p>}
    </>
  );
}
