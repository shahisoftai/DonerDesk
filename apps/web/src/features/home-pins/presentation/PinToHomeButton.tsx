"use client";

import { useState } from "react";
import { pinDashboardAction } from "@/lib/actions/home-pins";
import { Button } from "@/components/ui/Button";

/** "Pin to Home" on a dashboard: adds it to the person's own Home. Says what happened, including "already pinned". */
export function PinToHomeButton({ dashboardId }: { dashboardId: string }) {
  const [state, setState] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="secondary" disabled={busy} onClick={async () => {
        setBusy(true);
        const r = await pinDashboardAction(dashboardId);
        setBusy(false);
        setState(r.ok ? { tone: "ok", text: "Pinned to your Home." } : { tone: "error", text: r.error.message });
      }}>Pin to Home</Button>
      {state && <span role={state.tone === "error" ? "alert" : "status"} className={`text-sm ${state.tone === "error" ? "text-danger-600" : "text-emerald-700 dark:text-emerald-300"}`}>{state.text}</span>}
    </>
  );
}
